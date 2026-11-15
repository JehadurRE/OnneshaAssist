import type { ExamResultRecord, ExamSessionRecord, Region, RosterStudent } from "./types";

export interface CompletedOriginalIndex {
  completedRolls: Set<string>;
  completedPhones: Set<string>;
  completedByRoll: Map<string, ExamResultRecord>;
  completedByPhone: Map<string, ExamResultRecord>;
  zeroAttemptCount: number;
  completedCount: number;
}

export interface RegionRetakeDiagnostic {
  regionId: string;
  regionNameEn: string;
  regionNameBn: string;
  completedCount: number;
  zeroAttemptCount: number;
  missingRosterCount: number;
  eligibleRetakeCount: number;
}

export interface SessionRetakeDiagnostics {
  sessionId: string;
  originPin: string;
  completedCount: number;
  zeroAttemptCount: number;
  missingRosterCount: number;
  totalEligibleRetakeCount: number;
  regionBreakdown: RegionRetakeDiagnostic[];
}

export function normalizeMatchRoll(roll?: string): string {
  return (roll || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeMatchPhone(phone?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Determines whether an exam result reflects actual question submissions
 * rather than a passive join with zero answered questions.
 */
export function hasResultSubmittedAnswers(
  result: Pick<ExamResultRecord, "correctCount" | "incorrectCount" | "answersJson">,
): boolean {
  if ((result.correctCount || 0) + (result.incorrectCount || 0) > 0) {
    return true;
  }
  if (result.answersJson && result.answersJson.trim().length > 2) {
    try {
      const parsed = JSON.parse(result.answersJson) as Record<string, unknown>;
      return !!parsed && typeof parsed === "object" && Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Indexes examinees who already submitted >= 1 answer in a prior ExamSessionRecord
 * so supplementary / makeup runs can skip completed candidates cleanly.
 */
export function buildOriginalCompletionIndex(
  examResults: ExamResultRecord[],
  retakeForSessionId?: string,
  retakeOriginPin?: string,
): CompletedOriginalIndex {
  const completedRolls = new Set<string>();
  const completedPhones = new Set<string>();
  const completedByRoll = new Map<string, ExamResultRecord>();
  const completedByPhone = new Map<string, ExamResultRecord>();
  let completedCount = 0;
  let zeroAttemptCount = 0;

  if (!retakeForSessionId && !retakeOriginPin) {
    return {
      completedRolls,
      completedPhones,
      completedByRoll,
      completedByPhone,
      zeroAttemptCount,
      completedCount,
    };
  }

  for (const r of examResults) {
    const matchesSession =
      (!!retakeForSessionId && r.sessionId === retakeForSessionId) ||
      (!r.sessionId && !!retakeOriginPin && r.pin === retakeOriginPin) ||
      (!!retakeOriginPin && r.pin === retakeOriginPin && (!retakeForSessionId || r.sessionId === retakeForSessionId));
    if (!matchesSession) continue;
    if ((r.participantId || "").startsWith("bot-")) continue;

    if (hasResultSubmittedAnswers(r)) {
      completedCount++;
      const rollKey = normalizeMatchRoll(r.rollNumber);
      const phoneKey = normalizeMatchPhone(r.phone);
      if (rollKey) {
        completedRolls.add(rollKey);
        if (!completedByRoll.has(rollKey)) completedByRoll.set(rollKey, r);
      }
      if (phoneKey.length >= 6) {
        completedPhones.add(phoneKey);
        if (!completedByPhone.has(phoneKey)) completedByPhone.set(phoneKey, r);
      }
    } else {
      zeroAttemptCount++;
    }
  }

  return {
    completedRolls,
    completedPhones,
    completedByRoll,
    completedByPhone,
    zeroAttemptCount,
    completedCount,
  };
}

export function findCompletedMatchInIndex(
  index: CompletedOriginalIndex,
  candidate: { rollNumber?: string | undefined; phone?: string | undefined },
): ExamResultRecord | undefined {
  const rollKey = normalizeMatchRoll(candidate.rollNumber);
  if (rollKey && index.completedByRoll.has(rollKey)) {
    return index.completedByRoll.get(rollKey);
  }
  const phoneKey = normalizeMatchPhone(candidate.phone);
  if (phoneKey.length >= 6 && index.completedByPhone.has(phoneKey)) {
    return index.completedByPhone.get(phoneKey);
  }
  return undefined;
}

/**
 * Computes per-region completion vs zero-attempt vs unrecorded roster diagnostics
 * for any recorded ExamSessionRecord.
 */
export function computeSessionRetakeDiagnostics(params: {
  session: ExamSessionRecord;
  examResults: ExamResultRecord[];
  roster: RosterStudent[];
  regions: Region[];
}): SessionRetakeDiagnostics {
  const { session, examResults, roster, regions } = params;
  const sessionResults = examResults.filter(
    (r) =>
      !(r.participantId || "").startsWith("bot-") &&
      (r.sessionId === session.id || r.pin === session.pin),
  );

  const index = buildOriginalCompletionIndex(sessionResults, session.id, session.pin);
  const zeroByRoll = new Set<string>();
  const zeroByPhone = new Set<string>();

  for (const r of sessionResults) {
    if (!hasResultSubmittedAnswers(r)) {
      const rk = normalizeMatchRoll(r.rollNumber);
      const pk = normalizeMatchPhone(r.phone);
      if (rk) zeroByRoll.add(rk);
      if (pk.length >= 6) zeroByPhone.add(pk);
    }
  }

  const missingOverall = new Set<string>();
  const regionMap = new Map<string, RegionRetakeDiagnostic>();
  const ensureRegionDiag = (regId: string, regName?: string): RegionRetakeDiagnostic => {
    const id = regId || "reg-dhaka";
    const existing = regionMap.get(id);
    if (existing) return existing;
    const regObj = regions.find((reg) => reg.id === id);
    const created: RegionRetakeDiagnostic = {
      regionId: id,
      regionNameEn: regObj?.nameEn || regName || id,
      regionNameBn: regObj?.nameBn || regObj?.nameEn || regName || id,
      completedCount: 0,
      zeroAttemptCount: 0,
      missingRosterCount: 0,
      eligibleRetakeCount: 0,
    };
    regionMap.set(id, created);
    return created;
  };

  for (const reg of regions) {
    ensureRegionDiag(reg.id);
  }

  for (const r of sessionResults) {
    const diag = ensureRegionDiag(r.regionId || "reg-dhaka", r.regionName);
    if (hasResultSubmittedAnswers(r)) {
      diag.completedCount++;
    } else {
      diag.zeroAttemptCount++;
      diag.eligibleRetakeCount++;
    }
  }

  for (const student of roster) {
    const rk = normalizeMatchRoll(student.rollNumber);
    const pk = normalizeMatchPhone(student.phone || student.guardianPhone);
    const alreadyCompleted =
      (rk && index.completedRolls.has(rk)) || (pk.length >= 6 && index.completedPhones.has(pk));
    if (alreadyCompleted) continue;

    const alreadyCountedAsZero =
      (rk && zeroByRoll.has(rk)) || (pk.length >= 6 && zeroByPhone.has(pk));
    if (alreadyCountedAsZero) continue;

    const studentKey = rk || pk || student.id;
    missingOverall.add(studentKey);
    const diag = ensureRegionDiag(student.regionId || "reg-dhaka", student.regionName);
    diag.missingRosterCount++;
    diag.eligibleRetakeCount++;
  }

  const regionBreakdown = Array.from(regionMap.values()).filter(
    (d) =>
      d.completedCount > 0 ||
      d.zeroAttemptCount > 0 ||
      d.missingRosterCount > 0,
  );
  regionBreakdown.sort(
    (a, b) =>
      b.zeroAttemptCount - a.zeroAttemptCount ||
      b.eligibleRetakeCount - a.eligibleRetakeCount ||
      b.completedCount - a.completedCount,
  );

  return {
    sessionId: session.id,
    originPin: session.pin,
    completedCount: index.completedCount,
    zeroAttemptCount: index.zeroAttemptCount,
    missingRosterCount: missingOverall.size,
    totalEligibleRetakeCount: index.zeroAttemptCount + missingOverall.size,
    regionBreakdown,
  };
}

function extractTotalResponseTimeFromAnswersJson(answersJson?: string): number {
  if (!answersJson || answersJson.trim().length <= 2) return 0;
  try {
    const parsed = JSON.parse(answersJson) as Record<string, { timeTakenSec?: number }>;
    let sum = 0;
    for (const ans of Object.values(parsed || {})) {
      if (typeof ans?.timeTakenSec === "number" && Number.isFinite(ans.timeTakenSec)) {
        sum += Math.max(0, ans.timeTakenSec);
      }
    }
    return Math.round(sum * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Merges supplementary makeup results back into the original ExamSessionRecord,
 * replacing zero-attempt/matching rows while preserving completed examinees' marks
 * and recalculating unified merit ranks and session statistics.
 */
export function mergeRetakeExamResults(params: {
  origSession: ExamSessionRecord;
  existingResults: ExamResultRecord[];
  makeupResults: ExamResultRecord[];
  nowIso?: string;
}): {
  updatedSession: ExamSessionRecord;
  mergedResults: ExamResultRecord[];
} {
  const { origSession, existingResults, makeupResults, nowIso = new Date().toISOString() } = params;

  const makeupRolls = new Set<string>();
  const makeupPhones = new Set<string>();
  const normalizedMakeup: ExamResultRecord[] = makeupResults.map((mr) => {
    const rk = normalizeMatchRoll(mr.rollNumber);
    const pk = normalizeMatchPhone(mr.phone);
    if (rk) makeupRolls.add(rk);
    if (pk.length >= 6) makeupPhones.add(pk);
    return {
      ...mr,
      sessionId: origSession.id,
      pin: origSession.pin,
      id: rk ? `res-${origSession.pin}-${rk}` : mr.id,
    };
  });

  const keptExisting = existingResults.filter((r) => {
    const belongsToOrig = r.sessionId === origSession.id || (!r.sessionId && r.pin === origSession.pin);
    if (!belongsToOrig) return false;
    if ((r.participantId || "").startsWith("bot-")) return false;
    const rk = normalizeMatchRoll(r.rollNumber);
    const pk = normalizeMatchPhone(r.phone);
    const supersededByMakeup =
      (rk && makeupRolls.has(rk)) || (pk.length >= 6 && makeupPhones.has(pk));
    return !supersededByMakeup;
  });

  const combined = [...keptExisting, ...normalizedMakeup].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    const timeA = extractTotalResponseTimeFromAnswersJson(a.answersJson);
    const timeB = extractTotalResponseTimeFromAnswersJson(b.answersJson);
    if (timeA > 0 && timeB > 0 && Math.abs(timeA - timeB) > 0.005) {
      return timeA - timeB;
    }
    if ((timeA > 0) !== (timeB > 0)) {
      return timeA > 0 ? -1 : 1;
    }
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });

  const mergedResults = combined.map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));

  const count = mergedResults.length;
  const totalScore = mergedResults.reduce((acc, r) => acc + r.score, 0);
  const averageScore = count > 0 ? Math.round(totalScore / count) : 0;
  const highestScore = mergedResults[0]?.score ?? 0;

  const updatedSession: ExamSessionRecord = {
    ...origSession,
    participantCount: count,
    averageScore,
    highestScore,
    makeupRunsCount: (origSession.makeupRunsCount || 0) + 1,
    lastMakeupAt: nowIso,
  };

  return { updatedSession, mergedResults };
}

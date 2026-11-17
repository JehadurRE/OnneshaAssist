import type { ExamResultRecord, ExamSessionRecord, Region, RosterStudent } from "./types";

export interface CompletedOriginalIndex {
  completedRolls: Set<string>;
  completedPhones: Set<string>;
  completedByRoll: Map<string, ExamResultRecord>;
  completedByPhone: Map<string, ExamResultRecord>;
  zeroAttemptCount: number;
  partialBelowThresholdCount: number;
  completedCount: number;
  minCompletedAnswers: number;
}

export interface RegionRetakeDiagnostic {
  regionId: string;
  regionNameEn: string;
  regionNameBn: string;
  completedCount: number;
  zeroAttemptCount: number;
  partialBelowThresholdCount: number;
  missingRosterCount: number;
  eligibleRetakeCount: number;
}

export interface SessionRetakeDiagnostics {
  sessionId: string;
  originPin: string;
  minCompletedAnswers: number;
  completedCount: number;
  zeroAttemptCount: number;
  partialBelowThresholdCount: number;
  missingRosterCount: number;
  totalEligibleRetakeCount: number;
  regionBreakdown: RegionRetakeDiagnostic[];
}

export function resolveRetakeMinCompletedAnswers(value?: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.min(500, Math.round(num)));
}

export function normalizeMatchRoll(roll?: string): string {
  return (roll || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeMatchPhone(phone?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Counts how many questions an exam result actually submitted
 * from either graded counts or serialized answer entries.
 */
export function getResultSubmittedAnswersCount(
  result: Pick<ExamResultRecord, "correctCount" | "incorrectCount" | "answersJson">,
): number {
  const gradedCount = Math.max(0, (result.correctCount || 0) + (result.incorrectCount || 0));
  let jsonCount = 0;
  if (result.answersJson && result.answersJson.trim().length > 2) {
    try {
      const parsed = JSON.parse(result.answersJson) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        jsonCount = Object.keys(parsed).length;
      }
    } catch {
      jsonCount = 0;
    }
  }
  return Math.max(gradedCount, jsonCount);
}

/**
 * Determines whether an exam result meets the minimum submitted answer count
 * required to treat an examinee as having completed the exam.
 */
export function hasResultSubmittedAnswers(
  result: Pick<ExamResultRecord, "correctCount" | "incorrectCount" | "answersJson">,
  minCompletedAnswers = 1,
): boolean {
  const threshold = resolveRetakeMinCompletedAnswers(minCompletedAnswers);
  return getResultSubmittedAnswersCount(result) >= threshold;
}

/**
 * Indexes examinees who submitted >= minCompletedAnswers in a prior ExamSessionRecord
 * so supplementary / makeup runs can skip completed candidates cleanly.
 */
export function buildOriginalCompletionIndex(
  examResults: ExamResultRecord[],
  retakeForSessionId?: string,
  retakeOriginPin?: string,
  minCompletedAnswers = 1,
): CompletedOriginalIndex {
  const threshold = resolveRetakeMinCompletedAnswers(minCompletedAnswers);
  const completedRolls = new Set<string>();
  const completedPhones = new Set<string>();
  const completedByRoll = new Map<string, ExamResultRecord>();
  const completedByPhone = new Map<string, ExamResultRecord>();
  let completedCount = 0;
  let zeroAttemptCount = 0;
  let partialBelowThresholdCount = 0;

  if (!retakeForSessionId && !retakeOriginPin) {
    return {
      completedRolls,
      completedPhones,
      completedByRoll,
      completedByPhone,
      zeroAttemptCount,
      partialBelowThresholdCount,
      completedCount,
      minCompletedAnswers: threshold,
    };
  }

  for (const r of examResults) {
    const matchesSession =
      (!!retakeForSessionId && r.sessionId === retakeForSessionId) ||
      (!!retakeOriginPin && r.pin === retakeOriginPin);
    if (!matchesSession) continue;
    if ((r.participantId || "").startsWith("bot-")) continue;

    const submitted = getResultSubmittedAnswersCount(r);
    if (submitted >= threshold) {
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
    } else if (submitted === 0) {
      zeroAttemptCount++;
    } else {
      partialBelowThresholdCount++;
    }
  }

  return {
    completedRolls,
    completedPhones,
    completedByRoll,
    completedByPhone,
    zeroAttemptCount,
    partialBelowThresholdCount,
    completedCount,
    minCompletedAnswers: threshold,
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
 * Computes per-region completion vs zero-attempt / partial vs unrecorded roster diagnostics
 * for any recorded ExamSessionRecord using the configured minimum answer threshold.
 */
export function computeSessionRetakeDiagnostics(params: {
  session: ExamSessionRecord;
  examResults: ExamResultRecord[];
  roster: RosterStudent[];
  regions: Region[];
  minCompletedAnswers?: number | undefined;
}): SessionRetakeDiagnostics {
  const { session, examResults, roster, regions, minCompletedAnswers } = params;
  const threshold = resolveRetakeMinCompletedAnswers(minCompletedAnswers);
  const sessionResults = examResults.filter(
    (r) =>
      !(r.participantId || "").startsWith("bot-") &&
      (r.sessionId === session.id || r.pin === session.pin),
  );

  const index = buildOriginalCompletionIndex(sessionResults, session.id, session.pin, threshold);
  const nonCompletedByRoll = new Set<string>();
  const nonCompletedByPhone = new Set<string>();

  for (const r of sessionResults) {
    if (!hasResultSubmittedAnswers(r, threshold)) {
      const rk = normalizeMatchRoll(r.rollNumber);
      const pk = normalizeMatchPhone(r.phone);
      if (rk) nonCompletedByRoll.add(rk);
      if (pk.length >= 6) nonCompletedByPhone.add(pk);
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
      partialBelowThresholdCount: 0,
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
    const submitted = getResultSubmittedAnswersCount(r);
    if (submitted >= threshold) {
      diag.completedCount++;
    } else if (submitted === 0) {
      diag.zeroAttemptCount++;
      diag.eligibleRetakeCount++;
    } else {
      diag.partialBelowThresholdCount++;
      diag.eligibleRetakeCount++;
    }
  }

  for (const student of roster) {
    const rk = normalizeMatchRoll(student.rollNumber);
    const pk = normalizeMatchPhone(student.phone || student.guardianPhone);
    const alreadyCompleted =
      (rk && index.completedRolls.has(rk)) || (pk.length >= 6 && index.completedPhones.has(pk));
    if (alreadyCompleted) continue;

    const alreadyCountedAsNonCompleted =
      (rk && nonCompletedByRoll.has(rk)) || (pk.length >= 6 && nonCompletedByPhone.has(pk));
    if (alreadyCountedAsNonCompleted) continue;

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
      d.partialBelowThresholdCount > 0 ||
      d.missingRosterCount > 0,
  );
  regionBreakdown.sort(
    (a, b) =>
      b.zeroAttemptCount +
        b.partialBelowThresholdCount -
        (a.zeroAttemptCount + a.partialBelowThresholdCount) ||
      b.eligibleRetakeCount - a.eligibleRetakeCount ||
      b.completedCount - a.completedCount,
  );

  return {
    sessionId: session.id,
    originPin: session.pin,
    minCompletedAnswers: threshold,
    completedCount: index.completedCount,
    zeroAttemptCount: index.zeroAttemptCount,
    partialBelowThresholdCount: index.partialBelowThresholdCount,
    missingRosterCount: missingOverall.size,
    totalEligibleRetakeCount:
      index.zeroAttemptCount + index.partialBelowThresholdCount + missingOverall.size,
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
    const belongsToOrig =
      r.sessionId === origSession.id || (!!origSession.pin && r.pin === origSession.pin);
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
    if (timeA > 0 !== timeB > 0) {
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

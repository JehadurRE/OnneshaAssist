import type { CertificateData, ExamResultRecord, ExamSessionRecord, GameSession } from "./types";

export interface PurgeableSmsLog {
  id: string;
  recipientPhone: string;
  studentName: string;
  rollNumber: string;
  quizTitle: string;
  score: number;
  rank: number;
  messageText: string;
  status: string;
  createdAt?: string | undefined;
  timestamp?: string | undefined;
}

export interface PurgeableExamStore<TSms extends PurgeableSmsLog = PurgeableSmsLog> {
  examSessions: ExamSessionRecord[];
  examResults: ExamResultRecord[];
  certificates: CertificateData[];
  revokedCertificates?: string[] | undefined;
  revokedCertificateArchive?: Record<string, CertificateData> | undefined;
  smsLogs: TSms[];
}

export interface PurgeExamSummary {
  minExaminees: number;
  removedSessions: number;
  removedResults: number;
  removedCertificates: number;
  removedRevokedCerts: number;
  removedSmsLogs: number;
  removedLiveSessions: number;
  keptSessions: number;
  changed: boolean;
}

function normalizePinToken(pin?: string): string {
  return (pin || "").trim().toUpperCase();
}

function normalizeTitleToken(title?: string): string {
  return (title || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAlphaNum(value?: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeNameToken(name?: string): string {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhoneToken(phone?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function extractCertPin4Prefix(certificateNumber?: string): string {
  const upper = (certificateNumber || "").trim().toUpperCase();
  const match = upper.match(/^ONN-([A-Z0-9]{4})-/);
  return match ? match[1]! : "";
}

function collectResultKeys(
  results: ExamResultRecord[],
  sessionTitlesById: Map<string, string[]>,
  sessionTitlesByPin: Map<string, string[]>,
  pin4RollKeys: Set<string>,
  titleRollKeys: Set<string>,
  titleNameKeys: Set<string>,
  titlePhoneKeys: Set<string>,
) {
  for (const r of results) {
    const pinNorm = normalizePinToken(r.pin);
    const pin4 = pinNorm.slice(0, 4);
    const cleanRoll = normalizeAlphaNum(r.rollNumber);
    const cleanName = normalizeNameToken(r.name);
    const cleanPhone = normalizePhoneToken(r.phone);

    if (pin4 && cleanRoll) {
      pin4RollKeys.add(`${pin4}|${cleanRoll}`);
    }

    const titles =
      (r.sessionId ? sessionTitlesById.get(r.sessionId) : undefined) ||
      (pinNorm ? sessionTitlesByPin.get(pinNorm) : undefined) ||
      [];

    for (const title of titles) {
      if (!title) continue;
      if (cleanRoll) titleRollKeys.add(`${title}|${cleanRoll}`);
      if (cleanName) titleNameKeys.add(`${title}|${cleanName}`);
      if (cleanPhone) titlePhoneKeys.add(`${title}|${cleanPhone}`);
    }
  }
}

/**
 * Purges taken exam sessions having strictly fewer than `minExaminees` non-bot examinees
 * along with all related exam results, issued/revoked certificates, SMS logs, and
 * finished/matched live session entries. Curriculum quizzes and sessions with >= `minExaminees`
 * examinees are preserved intact.
 */
export function purgeUnderThresholdExamsInStore<
  TStore extends PurgeableExamStore<PurgeableSmsLog>,
  TLiveSession extends Pick<GameSession, "pin" | "phase" | "participants"> & {
    id?: string | undefined;
  } = GameSession,
>(store: TStore, minExaminees = 50, liveSessions?: Record<string, TLiveSession>): PurgeExamSummary {
  const threshold = Math.max(1, Math.floor(Number.isFinite(minExaminees) ? minExaminees : 50));
  const allSessions = Array.isArray(store.examSessions) ? store.examSessions : [];
  const allResults = Array.isArray(store.examResults) ? store.examResults : [];
  const allCerts = Array.isArray(store.certificates) ? store.certificates : [];
  const allSms = (Array.isArray(store.smsLogs) ? store.smsLogs : []) as TStore["smsLogs"];

  const sessionIds = new Set(allSessions.map((s) => s.id).filter(Boolean));
  const keptSessions: ExamSessionRecord[] = [];
  const removedSessions: ExamSessionRecord[] = [];
  const keptSessionIdSet = new Set<string>();
  const removedSessionIdSet = new Set<string>();
  const resultsMatchedToSession = new Set<ExamResultRecord>();

  // 1. Partition ExamSessionRecord entries by non-bot examinee count
  for (const session of allSessions) {
    const sessionPin = normalizePinToken(session.pin);
    const matchingResults = allResults.filter((r) => {
      if (r.sessionId) return r.sessionId === session.id;
      return sessionPin.length > 0 && normalizePinToken(r.pin) === sessionPin;
    });
    for (const mr of matchingResults) {
      resultsMatchedToSession.add(mr);
    }

    const nonBotResults = matchingResults.filter(
      (r) => !(r.participantId || "").startsWith("bot-"),
    );
    const examineeCount =
      matchingResults.length > 0
        ? nonBotResults.length
        : Math.max(0, Number.isFinite(session.participantCount) ? session.participantCount : 0);

    if (examineeCount >= threshold) {
      keptSessions.push(session);
      if (session.id) keptSessionIdSet.add(session.id);
    } else {
      removedSessions.push(session);
      if (session.id) removedSessionIdSet.add(session.id);
    }
  }

  // 2. Partition orphan ExamResultRecord groups (not linked to any known ExamSessionRecord)
  const orphanGroups = new Map<string, ExamResultRecord[]>();
  for (const r of allResults) {
    if (resultsMatchedToSession.has(r)) continue;
    if (r.sessionId && sessionIds.has(r.sessionId)) continue;
    const key = r.sessionId
      ? `sid:${r.sessionId}`
      : `pin:${normalizePinToken(r.pin) || "__none__"}`;
    const list = orphanGroups.get(key) || [];
    list.push(r);
    orphanGroups.set(key, list);
  }

  const removedOrphanResultSet = new Set<ExamResultRecord>();
  const removedOrphanPins = new Set<string>();
  const keptOrphanPins = new Set<string>();

  for (const groupResults of orphanGroups.values()) {
    const nonBotCount = groupResults.filter(
      (r) => !(r.participantId || "").startsWith("bot-"),
    ).length;
    const groupKeep = nonBotCount >= threshold;
    for (const r of groupResults) {
      const pinNorm = normalizePinToken(r.pin);
      if (groupKeep) {
        if (pinNorm) keptOrphanPins.add(pinNorm);
      } else {
        removedOrphanResultSet.add(r);
        if (pinNorm) removedOrphanPins.add(pinNorm);
        if (r.sessionId) removedSessionIdSet.add(r.sessionId);
      }
    }
  }

  // Filter examResults: remove results linked to removed sessions/orphan groups + any bot rows
  const keptResults: ExamResultRecord[] = [];
  const removedResults: ExamResultRecord[] = [];
  for (const r of allResults) {
    const belongsToRemovedSession = r.sessionId ? removedSessionIdSet.has(r.sessionId) : false;
    const matchedByPinToRemovedSession =
      !r.sessionId &&
      removedSessions.some((s) => normalizePinToken(s.pin) === normalizePinToken(r.pin)) &&
      !keptSessions.some((s) => normalizePinToken(s.pin) === normalizePinToken(r.pin));
    const isBot = (r.participantId || "").startsWith("bot-");

    if (
      belongsToRemovedSession ||
      matchedByPinToRemovedSession ||
      removedOrphanResultSet.has(r) ||
      isBot
    ) {
      removedResults.push(r);
    } else {
      keptResults.push(r);
    }
  }

  // 3. Build kept & removed fingerprints for certificates and SMS logs
  const keptPins = new Set<string>(keptOrphanPins);
  const keptPin4 = new Set<string>();
  const keptTitles = new Set<string>();
  const keptTitlesById = new Map<string, string[]>();
  const keptTitlesByPin = new Map<string, string[]>();

  for (const s of keptSessions) {
    const pinNorm = normalizePinToken(s.pin);
    if (pinNorm) {
      keptPins.add(pinNorm);
      if (pinNorm.length >= 4) keptPin4.add(pinNorm.slice(0, 4));
    }
    const titles = [normalizeTitleToken(s.quizTitleEn), normalizeTitleToken(s.quizTitleBn)].filter(
      Boolean,
    );
    for (const t of titles) keptTitles.add(t);
    if (s.id) keptTitlesById.set(s.id, titles);
    if (pinNorm) keptTitlesByPin.set(pinNorm, titles);
  }
  for (const p of keptOrphanPins) {
    if (p.length >= 4) keptPin4.add(p.slice(0, 4));
  }

  const removedPins = new Set<string>();
  const removedPin4 = new Set<string>();
  const removedTitles = new Set<string>();
  const removedTitlesById = new Map<string, string[]>();
  const removedTitlesByPin = new Map<string, string[]>();

  for (const s of removedSessions) {
    const pinNorm = normalizePinToken(s.pin);
    if (pinNorm && !keptPins.has(pinNorm)) {
      removedPins.add(pinNorm);
    }
    const p4 = pinNorm.slice(0, 4);
    if (p4.length === 4 && !keptPin4.has(p4)) {
      removedPin4.add(p4);
    }
    const titles = [normalizeTitleToken(s.quizTitleEn), normalizeTitleToken(s.quizTitleBn)].filter(
      Boolean,
    );
    for (const t of titles) removedTitles.add(t);
    if (s.id) removedTitlesById.set(s.id, titles);
    if (pinNorm) removedTitlesByPin.set(pinNorm, titles);
  }
  for (const p of removedOrphanPins) {
    if (!keptPins.has(p)) removedPins.add(p);
    const p4 = p.slice(0, 4);
    if (p4.length === 4 && !keptPin4.has(p4)) removedPin4.add(p4);
  }

  const keptPin4RollKeys = new Set<string>();
  const keptTitleRollKeys = new Set<string>();
  const keptTitleNameKeys = new Set<string>();
  const keptTitlePhoneKeys = new Set<string>();
  collectResultKeys(
    keptResults,
    keptTitlesById,
    keptTitlesByPin,
    keptPin4RollKeys,
    keptTitleRollKeys,
    keptTitleNameKeys,
    keptTitlePhoneKeys,
  );

  const removedPin4RollKeys = new Set<string>();
  const removedTitleRollKeys = new Set<string>();
  const removedTitleNameKeys = new Set<string>();
  const removedTitlePhoneKeys = new Set<string>();
  collectResultKeys(
    removedResults,
    removedTitlesById,
    removedTitlesByPin,
    removedPin4RollKeys,
    removedTitleRollKeys,
    removedTitleNameKeys,
    removedTitlePhoneKeys,
  );

  const shouldRemoveCertificate = (cert: CertificateData): boolean => {
    const certPin4 = extractCertPin4Prefix(cert.certificateNumber);
    const certTitle = normalizeTitleToken(cert.quizTitle);
    const cleanRoll = normalizeAlphaNum(cert.studentRoll);
    const cleanName = normalizeNameToken(cert.studentName);
    const hasUnderThresholdCount =
      typeof cert.totalParticipants === "number" &&
      cert.totalParticipants > 0 &&
      cert.totalParticipants < threshold;
    const hasPassingCount =
      typeof cert.totalParticipants === "number" && cert.totalParticipants >= threshold;

    // Protect certificates clearly tied to kept >= threshold sessions
    if (
      certPin4 &&
      cleanRoll &&
      keptPin4RollKeys.has(`${certPin4}|${cleanRoll}`) &&
      (!certTitle || keptTitles.has(certTitle))
    ) {
      return false;
    }
    if (
      certTitle &&
      keptTitles.has(certTitle) &&
      ((cleanRoll && keptTitleRollKeys.has(`${certTitle}|${cleanRoll}`)) ||
        (cleanName && keptTitleNameKeys.has(`${certTitle}|${cleanName}`))) &&
      !hasUnderThresholdCount
    ) {
      return false;
    }

    if (certPin4 && removedPin4.has(certPin4)) {
      const matchesRemovedResultOrTitle =
        (cleanRoll && removedPin4RollKeys.has(`${certPin4}|${cleanRoll}`)) ||
        (certTitle && removedTitles.has(certTitle)) ||
        hasUnderThresholdCount ||
        !/^20\d{2}$/.test(certPin4);
      if (matchesRemovedResultOrTitle && !hasPassingCount) {
        return true;
      }
    }

    if (
      certTitle &&
      removedTitles.has(certTitle) &&
      !hasPassingCount &&
      ((cleanRoll && removedTitleRollKeys.has(`${certTitle}|${cleanRoll}`)) ||
        (cleanName && removedTitleNameKeys.has(`${certTitle}|${cleanName}`)) ||
        (hasUnderThresholdCount && !keptTitles.has(certTitle)))
    ) {
      return true;
    }

    return false;
  };

  // 4. Filter active certificates, revokedCertificates, and revokedCertificateArchive
  const removedCertNumberUpper = new Set<string>();
  const keptCerts: CertificateData[] = [];
  for (const cert of allCerts) {
    if (shouldRemoveCertificate(cert)) {
      const numUpper = (cert.certificateNumber || "").trim().toUpperCase();
      if (numUpper) removedCertNumberUpper.add(numUpper);
    } else {
      keptCerts.push(cert);
    }
  }

  const removedRevokedKeys = new Set<string>();
  const currentArchive = store.revokedCertificateArchive || {};
  const nextArchive: Record<string, CertificateData> = {};
  for (const [certKey, archivedCert] of Object.entries(currentArchive)) {
    const keyUpper = certKey.trim().toUpperCase();
    if (removedCertNumberUpper.has(keyUpper) || shouldRemoveCertificate(archivedCert)) {
      removedCertNumberUpper.add(keyUpper);
      removedRevokedKeys.add(keyUpper);
    } else {
      nextArchive[certKey] = archivedCert;
    }
  }

  const currentRevoked = Array.isArray(store.revokedCertificates) ? store.revokedCertificates : [];
  const nextRevoked: string[] = [];
  for (const certNum of currentRevoked) {
    const numUpper = (certNum || "").trim().toUpperCase();
    const certPin4 = extractCertPin4Prefix(numUpper);
    const unarchivedPinMatch =
      certPin4.length === 4 && removedPin4.has(certPin4) && !/^20\d{2}$/.test(certPin4);
    if (removedCertNumberUpper.has(numUpper) || unarchivedPinMatch) {
      if (numUpper) removedRevokedKeys.add(numUpper);
    } else {
      nextRevoked.push(certNum);
    }
  }
  const removedRevokedCerts = removedRevokedKeys.size;

  // 5. Filter related SMS logs
  const keptSmsLogs: Array<TStore["smsLogs"][number]> = [];
  for (const sms of allSms) {
    const smsTitle = normalizeTitleToken(sms.quizTitle);
    const smsRoll = normalizeAlphaNum(sms.rollNumber);
    const smsPhone = normalizePhoneToken(sms.recipientPhone);
    const smsName = normalizeNameToken(sms.studentName);

    const matchesKept =
      smsTitle &&
      ((smsRoll && keptTitleRollKeys.has(`${smsTitle}|${smsRoll}`)) ||
        (smsPhone && keptTitlePhoneKeys.has(`${smsTitle}|${smsPhone}`)) ||
        (smsName && keptTitleNameKeys.has(`${smsTitle}|${smsName}`)));

    if (matchesKept) {
      keptSmsLogs.push(sms);
      continue;
    }

    const matchesRemoved =
      smsTitle &&
      ((smsRoll && removedTitleRollKeys.has(`${smsTitle}|${smsRoll}`)) ||
        (smsPhone && removedTitlePhoneKeys.has(`${smsTitle}|${smsPhone}`)) ||
        (smsName && removedTitleNameKeys.has(`${smsTitle}|${smsName}`)) ||
        (removedTitles.has(smsTitle) && !keptTitles.has(smsTitle)));

    if (!matchesRemoved) {
      keptSmsLogs.push(sms);
    }
  }

  // 6. Clean finished or matched-removed < threshold live session snapshots
  let removedLiveSessions = 0;
  if (liveSessions) {
    for (const [pinKey, sess] of Object.entries(liveSessions)) {
      if (!sess) continue;
      const nonBotCount = Object.values(sess.participants || {}).filter(
        (p) => !(p.id || "").startsWith("bot-"),
      ).length;
      const isEnded = sess.phase === "podium" || sess.phase === "finished";
      const matchesRemovedId = typeof sess.id === "string" && removedSessionIdSet.has(sess.id);
      const matchesRemovedPinEnded = removedPins.has(normalizePinToken(pinKey)) && isEnded;

      if ((isEnded || matchesRemovedId || matchesRemovedPinEnded) && nonBotCount < threshold) {
        delete liveSessions[pinKey];
        removedLiveSessions++;
      }
    }
  }

  const removedSessionsCount = removedSessions.length;
  const removedResultsCount = allResults.length - keptResults.length;
  const removedCertificatesCount = allCerts.length - keptCerts.length;
  const removedSmsLogsCount = allSms.length - keptSmsLogs.length;

  store.examSessions = keptSessions;
  store.examResults = keptResults;
  store.certificates = keptCerts;
  store.smsLogs = keptSmsLogs as TStore["smsLogs"];
  if (store.revokedCertificates !== undefined) {
    store.revokedCertificates = nextRevoked;
  }
  if (store.revokedCertificateArchive !== undefined) {
    store.revokedCertificateArchive = nextArchive;
  }

  const changed =
    removedSessionsCount > 0 ||
    removedResultsCount > 0 ||
    removedCertificatesCount > 0 ||
    removedRevokedCerts > 0 ||
    removedSmsLogsCount > 0 ||
    removedLiveSessions > 0;

  return {
    minExaminees: threshold,
    removedSessions: removedSessionsCount,
    removedResults: removedResultsCount,
    removedCertificates: removedCertificatesCount,
    removedRevokedCerts,
    removedSmsLogs: removedSmsLogsCount,
    removedLiveSessions,
    keptSessions: keptSessions.length,
    changed,
  };
}

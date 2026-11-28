/**
 * Final Exam gradesheet rows — regular quizzes (/10) + final quiz (/30) + practical (/60) = total (/100).
 * Pure helpers for staff desk table / CSV / PDF.
 */
import type {
  CertificateData,
  PracticalExam,
  PracticalSubmission,
  RosterStudent,
} from "./types";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  REGULAR_QUIZ_MARKS,
  computeCombinedFinalPct,
  formatFinalMarksBreakdown,
  marksFromPct,
  normalizeExamWeights,
} from "./practical-exam";
import { normalizeBdPhone } from "./sanjibon-seed-data";
import { isDeliverableStudentEmail } from "./email-otp";

export interface FinalGradeSheetRow {
  rank: number;
  rollNumber: string;
  studentName: string;
  regionName: string;
  phone?: string | undefined;
  email?: string | undefined;
  participated: boolean;
  regularQuizAvgPct: number;
  regularQuizMarks: number;
  regularQuizMaxMarks: number;
  regularQuizTaken: number;
  regularQuizTotal: number;
  quizAccuracyPct: number;
  quizMarks: number;
  quizMaxMarks: number;
  quizFound: boolean;
  quizzesSubtotalMarks: number;
  quizzesSubtotalMaxMarks: number;
  practicalScorePct: number;
  practicalMarks: number;
  practicalMaxMarks: number;
  practicalStatus: string;
  practicalGraded: boolean;
  combinedPct: number;
  totalMarks: number;
  maxTotal: number;
  submissionId?: string | undefined;
  certificateNumber?: string | undefined;
  certificateIssuedAt?: string | undefined;
  certificateEmailedAt?: string | undefined;
  certificateEmailedTo?: string | undefined;
  eligibleForCertificate?: boolean | undefined;
  missingRequirements?: string[] | undefined;
}

export function buildFinalGradeSheetRows(params: {
  exam: PracticalExam;
  submissions: PracticalSubmission[];
  /** Full enrolled roster so students who did not participate (or only took quiz) also appear. */
  roster?: RosterStudent[] | undefined;
  /** Existing course completion certificates for this course. */
  certificates?: CertificateData[] | undefined;
  /** Pre-resolved regular (non-final) quiz average by normalized roll. */
  regularQuizByRoll?:
    | Map<
        string,
        {
          avgPct: number;
          takenCount: number;
          totalQuizzes: number;
        }
      >
    | undefined;
  /** Pre-resolved final quiz accuracy by normalized roll (caller does linking). */
  quizByRoll: Map<
    string,
    {
      accuracyPct: number;
      found: boolean;
    }
  >;
  /** Optional pre-computed certificate eligibility by normalized roll. */
  eligibilityByRoll?:
    | Map<string, { eligible: boolean; missing: string[] }>
    | undefined;
  normalizeRoll: (roll: string) => string;
}): FinalGradeSheetRow[] {
  const weights = normalizeExamWeights(params.exam);
  const regularQuizMax =
    typeof params.exam.regularQuizMaxMarks === "number"
      ? Math.max(0, params.exam.regularQuizMaxMarks)
      : weights.regularQuizWeightPct > 0
        ? REGULAR_QUIZ_MARKS
        : 0;
  const quizMax = params.exam.quizMaxMarks || FINAL_QUIZ_MARKS;
  const practicalMax = params.exam.practicalMaxMarks || FINAL_PRACTICAL_MARKS;
  const maxTotal = regularQuizMax + quizMax + practicalMax || FINAL_TOTAL_MARKS;
  const quizzesSubtotalMax = regularQuizMax + quizMax;

  const rosterList = params.roster || [];
  const rosterByRoll = new Map<string, RosterStudent>();
  const rosterByPhone = new Map<string, RosterStudent>();
  for (const st of rosterList) {
    const rTok = params.normalizeRoll(st.rollNumber);
    if (rTok && !rosterByRoll.has(rTok)) rosterByRoll.set(rTok, st);
    const pTok = normalizeBdPhone(st.phone || "");
    if (pTok.length >= 10 && !rosterByPhone.has(pTok)) rosterByPhone.set(pTok, st);
  }

  const certByRoll = new Map<string, CertificateData>();
  for (const c of params.certificates || []) {
    if (c.kind && c.kind !== "course_completion") continue;
    const cTok = params.normalizeRoll(c.studentRoll || "");
    if (cTok && !certByRoll.has(cTok)) certByRoll.set(cTok, c);
  }

  const findCert = (roll: string, rosterRoll?: string) => {
    const t1 = params.normalizeRoll(roll);
    if (t1 && certByRoll.has(t1)) return certByRoll.get(t1);
    if (rosterRoll) {
      const t2 = params.normalizeRoll(rosterRoll);
      if (t2 && certByRoll.has(t2)) return certByRoll.get(t2);
    }
    return undefined;
  };

  const findEligibility = (roll: string, rosterRoll?: string) => {
    if (!params.eligibilityByRoll) return undefined;
    const t1 = params.normalizeRoll(roll);
    if (t1 && params.eligibilityByRoll.has(t1)) return params.eligibilityByRoll.get(t1);
    if (rosterRoll) {
      const t2 = params.normalizeRoll(rosterRoll);
      if (t2 && params.eligibilityByRoll.has(t2)) return params.eligibilityByRoll.get(t2);
    }
    return undefined;
  };

  const findRegularQuiz = (roll: string, rosterRoll?: string) => {
    if (!params.regularQuizByRoll) return undefined;
    const t1 = params.normalizeRoll(roll);
    if (t1 && params.regularQuizByRoll.has(t1)) return params.regularQuizByRoll.get(t1);
    if (rosterRoll) {
      const t2 = params.normalizeRoll(rosterRoll);
      if (t2 && params.regularQuizByRoll.has(t2)) return params.regularQuizByRoll.get(t2);
    }
    return undefined;
  };

  const matchedRosterIds = new Set<string>();
  const seenRollToks = new Set<string>();

  const rows: FinalGradeSheetRow[] = params.submissions.map((sub) => {
    const tok = params.normalizeRoll(sub.rollNumber);
    if (tok) seenRollToks.add(tok);
    const subPhone = normalizeBdPhone(sub.phone || "");
    const rosterMatch =
      (tok ? rosterByRoll.get(tok) : undefined) ||
      (subPhone.length >= 10 ? rosterByPhone.get(subPhone) : undefined);
    if (rosterMatch) {
      matchedRosterIds.add(rosterMatch.id);
      const rTok = params.normalizeRoll(rosterMatch.rollNumber);
      if (rTok) seenRollToks.add(rTok);
    }

    const regHit = findRegularQuiz(sub.rollNumber, rosterMatch?.rollNumber);
    const regularQuizAvgPct =
      typeof regHit?.avgPct === "number"
        ? regHit.avgPct
        : typeof sub.regularQuizAvgPct === "number"
          ? sub.regularQuizAvgPct
          : 0;
    const regularQuizTaken = regHit?.takenCount ?? sub.regularQuizTaken ?? 0;
    const regularQuizTotal = regHit?.totalQuizzes ?? sub.regularQuizTotal ?? 0;

    const quizHit =
      params.quizByRoll.get(tok) ||
      (rosterMatch ? params.quizByRoll.get(params.normalizeRoll(rosterMatch.rollNumber)) : undefined);
    const quizAccuracyPct =
      quizHit?.found
        ? quizHit.accuracyPct
        : typeof sub.quizAccuracyPct === "number"
          ? sub.quizAccuracyPct
          : 0;
    const quizFound = !!(
      quizHit?.found ||
      (typeof sub.quizAccuracyPct === "number" && sub.quizAccuracyPct > 0)
    );
    const practicalScorePct =
      typeof sub.practicalScorePct === "number" ? sub.practicalScorePct : 0;
    const breakdown = formatFinalMarksBreakdown({
      regularQuizAvgPct,
      quizAccuracyPct,
      practicalScorePct,
      regularQuizMaxMarks: regularQuizMax,
      quizMaxMarks: quizMax,
      practicalMaxMarks: practicalMax,
    });
    const combinedPct = computeCombinedFinalPct({
      regularQuizAvgPct,
      quizAccuracyPct,
      practicalScorePct,
      regularQuizWeightPct: weights.regularQuizWeightPct,
      quizWeightPct: weights.quizWeightPct,
      practicalWeightPct: weights.practicalWeightPct,
    });
    const cert = findCert(sub.rollNumber, rosterMatch?.rollNumber);
    const elig = findEligibility(sub.rollNumber, rosterMatch?.rollNumber);
    const cleanRosterEmail = isDeliverableStudentEmail(rosterMatch?.email)
      ? rosterMatch!.email!.trim().toLowerCase()
      : undefined;
    const validEmailedTo = isDeliverableStudentEmail(cert?.emailedTo)
      ? cert!.emailedTo!.trim().toLowerCase()
      : undefined;
    const validEmailedAt = validEmailedTo ? cert?.emailedAt : undefined;

    return {
      rank: 0,
      rollNumber: sub.rollNumber,
      studentName: sub.studentName || rosterMatch?.name || "",
      regionName: sub.regionName || rosterMatch?.regionName || "",
      phone: sub.phone || rosterMatch?.phone,
      email: cleanRosterEmail,
      participated: true,
      regularQuizAvgPct,
      regularQuizMarks: breakdown.regularQuizMarks,
      regularQuizMaxMarks: regularQuizMax,
      regularQuizTaken,
      regularQuizTotal,
      quizAccuracyPct,
      quizMarks: breakdown.quizMarks,
      quizMaxMarks: quizMax,
      quizFound,
      quizzesSubtotalMarks: breakdown.quizzesSubtotalMarks,
      quizzesSubtotalMaxMarks: quizzesSubtotalMax,
      practicalScorePct,
      practicalMarks: breakdown.practicalMarks,
      practicalMaxMarks: practicalMax,
      practicalStatus: sub.status,
      practicalGraded: sub.status === "graded",
      combinedPct,
      totalMarks: breakdown.totalMarks,
      maxTotal: breakdown.maxTotal || maxTotal,
      submissionId: sub.id,
      certificateNumber: cert?.certificateNumber,
      certificateIssuedAt: cert?.signedAt || cert?.issueDate,
      certificateEmailedAt: validEmailedAt,
      certificateEmailedTo: validEmailedTo,
      eligibleForCertificate: elig?.eligible,
      missingRequirements: elig?.missing,
    };
  });

  // Add remaining roster students (quiz-only participants and students who did not participate in Final Exam)
  for (const student of rosterList) {
    if (matchedRosterIds.has(student.id)) continue;
    const tok = params.normalizeRoll(student.rollNumber);
    if (tok && seenRollToks.has(tok)) continue;
    if (tok) seenRollToks.add(tok);

    const regHit = findRegularQuiz(student.rollNumber);
    const regularQuizAvgPct = regHit?.avgPct ?? 0;
    const regularQuizTaken = regHit?.takenCount ?? 0;
    const regularQuizTotal = regHit?.totalQuizzes ?? 0;

    const quizHit = tok ? params.quizByRoll.get(tok) : undefined;
    const quizFound = !!quizHit?.found;
    const quizAccuracyPct = quizFound ? quizHit!.accuracyPct : 0;
    const participated = quizFound;
    const breakdown = formatFinalMarksBreakdown({
      regularQuizAvgPct,
      quizAccuracyPct,
      practicalScorePct: 0,
      regularQuizMaxMarks: regularQuizMax,
      quizMaxMarks: quizMax,
      practicalMaxMarks: practicalMax,
    });
    const combinedPct =
      participated || regularQuizTaken > 0
        ? computeCombinedFinalPct({
            regularQuizAvgPct,
            quizAccuracyPct,
            practicalScorePct: 0,
            regularQuizWeightPct: weights.regularQuizWeightPct,
            quizWeightPct: weights.quizWeightPct,
            practicalWeightPct: weights.practicalWeightPct,
          })
        : 0;
    const cert = findCert(student.rollNumber);
    const elig = findEligibility(student.rollNumber);
    const cleanStudentEmail = isDeliverableStudentEmail(student.email)
      ? student.email!.trim().toLowerCase()
      : undefined;
    const validEmailedTo = isDeliverableStudentEmail(cert?.emailedTo)
      ? cert!.emailedTo!.trim().toLowerCase()
      : undefined;
    const validEmailedAt = validEmailedTo ? cert?.emailedAt : undefined;

    rows.push({
      rank: 0,
      rollNumber: student.rollNumber,
      studentName: student.name,
      regionName: student.regionName || "",
      phone: student.phone,
      email: cleanStudentEmail,
      participated,
      regularQuizAvgPct,
      regularQuizMarks: breakdown.regularQuizMarks,
      regularQuizMaxMarks: regularQuizMax,
      regularQuizTaken,
      regularQuizTotal,
      quizAccuracyPct,
      quizMarks: participated ? breakdown.quizMarks : 0,
      quizMaxMarks: quizMax,
      quizFound,
      quizzesSubtotalMarks: breakdown.quizzesSubtotalMarks,
      quizzesSubtotalMaxMarks: quizzesSubtotalMax,
      practicalScorePct: 0,
      practicalMarks: 0,
      practicalMaxMarks: practicalMax,
      practicalStatus: participated ? "quiz_only" : "not_participated",
      practicalGraded: false,
      combinedPct,
      totalMarks: participated || regularQuizTaken > 0 ? breakdown.totalMarks : 0,
      maxTotal: breakdown.maxTotal || maxTotal,
      certificateNumber: cert?.certificateNumber,
      certificateIssuedAt: cert?.signedAt || cert?.issueDate,
      certificateEmailedAt: validEmailedAt,
      certificateEmailedTo: validEmailedTo,
      eligibleForCertificate: elig?.eligible,
      missingRequirements: elig?.missing,
    });
  }

  rows.sort((a, b) => {
    if (a.participated !== b.participated) return a.participated ? -1 : 1;
    if (a.participated) {
      if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
      if (b.combinedPct !== a.combinedPct) return b.combinedPct - a.combinedPct;
    }
    return a.rollNumber.localeCompare(b.rollNumber);
  });

  let rankCounter = 0;
  for (const r of rows) {
    if (r.participated) {
      rankCounter += 1;
      r.rank = rankCounter;
    } else {
      r.rank = 0;
    }
  }
  return rows;
}

export function formatPracticalStatusLabel(status: string): string {
  switch (status) {
    case "not_participated":
      return "Not participated";
    case "quiz_only":
      return "Quiz only";
    default:
      return status || "—";
  }
}

export function finalGradeSheetCsv(rows: FinalGradeSheetRow[]): string {
  const escape = (value: string | number | undefined | null) => {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = [
    "rank",
    "roll",
    "name",
    "region",
    "phone",
    "regularQuizMarks",
    "regularQuizMax",
    "regularQuizPct",
    "regularQuizTaken",
    "regularQuizTotal",
    "quizMarks",
    "quizMax",
    "quizPct",
    "practicalMarks",
    "practicalMax",
    "practicalPct",
    "totalMarks",
    "maxTotal",
    "combinedPct",
    "practicalStatus",
    "participated",
    "email",
    "certificateNumber",
    "certificateEmailedAt",
  ];
  const lines = rows.map((r) =>
    [
      r.rank > 0 ? r.rank : "",
      r.rollNumber,
      r.studentName,
      r.regionName,
      r.phone || "",
      r.regularQuizMarks,
      r.regularQuizMaxMarks,
      r.regularQuizAvgPct,
      r.regularQuizTaken,
      r.regularQuizTotal,
      r.quizMarks,
      r.quizMaxMarks,
      r.quizAccuracyPct,
      r.practicalMarks,
      r.practicalMaxMarks,
      r.practicalScorePct,
      r.totalMarks,
      r.maxTotal,
      r.combinedPct,
      r.practicalStatus,
      r.participated ? "yes" : "no",
      r.email || "",
      r.certificateNumber || "",
      r.certificateEmailedAt || "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Convenience for PDF cells when quiz missing. */
export function formatQuizCell(row: FinalGradeSheetRow): string {
  if (!row.quizFound && row.quizAccuracyPct <= 0) return "—";
  return `${row.quizMarks}/${row.quizMaxMarks}`;
}

export function formatPracticalCell(row: FinalGradeSheetRow): string {
  if (!row.practicalGraded && row.practicalScorePct <= 0) return "—";
  return `${row.practicalMarks}/${row.practicalMaxMarks}`;
}

export interface DistrictPassSummaryRow {
  regionKey: string;
  regionName: string;
  totalStudents: number;
  passedCount: number;
  certifiedCount: number;
  emailedCount: number;
}

const DISTRICT_SPELLING_ALIASES: Record<string, string> = {
  comilla: "cumilla",
  barisal: "barishal",
  bogra: "bogura",
  jessore: "jashore",
  chittagong: "chattogram",
  jhalakathi: "jhalokathi",
  jhalokati: "jhalokathi",
  jhenidah: "jhenaidah",
  "coxs bazar": "coxs bazar",
  "cox's bazar": "coxs bazar",
};

/** Normalize training centre / range / district names so variants like "Cumilla" & "Cumilla Training Centre" merge cleanly. */
export function normalizeDistrictKey(regionName?: string | null): string {
  const cleaned = (regionName || "")
    .trim()
    .toLowerCase()
    .replace(/\b(training\s*cent(?:re|er)|divisional\s*cent(?:re|er)|cent(?:re|er)|range|district|zilla)\b/g, " ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "__unassigned__";
  return DISTRICT_SPELLING_ALIASES[cleaned] || cleaned;
}

/** Whether a gradesheet row counts as Passed / Eligible for official pass lists. */
export function isRowPassedForReport(row: FinalGradeSheetRow): boolean {
  return row.eligibleForCertificate === true || !!row.certificateNumber;
}

/** Whether a gradesheet row has had its completion certificate emailed to a real deliverable address. */
export function isRowEmailedForReport(row: FinalGradeSheetRow): boolean {
  if (!row.certificateEmailedAt) return false;
  if (row.certificateEmailedTo && !isDeliverableStudentEmail(row.certificateEmailedTo)) return false;
  return true;
}

/**
 * District / Range-wise pass and certificate email counts (no percentages or individual marks).
 * When `officialRegionNames` is supplied, restricts the summary strictly to those official centres
 * (so non-official/test centres like Dhaka Range are excluded).
 */
export function buildDistrictPassSummary(
  rows: FinalGradeSheetRow[],
  officialRegionNames?: string[] | undefined,
): {
  districts: DistrictPassSummaryRow[];
  totals: DistrictPassSummaryRow;
} {
  const allowedKeys =
    officialRegionNames && officialRegionNames.length > 0
      ? new Map(officialRegionNames.map((n) => [normalizeDistrictKey(n), n]))
      : null;

  const byKey = new Map<
    string,
    {
      regionKey: string;
      labels: Map<string, number>;
      totalStudents: number;
      passedCount: number;
      certifiedCount: number;
      emailedCount: number;
    }
  >();

  // Pre-seed all official centres so even a centre with 0 passed students still appears accurately.
  if (allowedKeys) {
    for (const [key, officialLabel] of allowedKeys.entries()) {
      byKey.set(key, {
        regionKey: key,
        labels: new Map([[officialLabel, 1000]]),
        totalStudents: 0,
        passedCount: 0,
        certifiedCount: 0,
        emailedCount: 0,
      });
    }
  }

  for (const r of rows) {
    const rawLabel = (r.regionName || "").trim();
    const key = normalizeDistrictKey(rawLabel);
    if (allowedKeys && !allowedKeys.has(key)) continue;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        regionKey: key,
        labels: new Map(),
        totalStudents: 0,
        passedCount: 0,
        certifiedCount: 0,
        emailedCount: 0,
      };
      byKey.set(key, bucket);
    }
    const label = rawLabel || "Unassigned / Other";
    bucket.labels.set(label, (bucket.labels.get(label) || 0) + 1);
    bucket.totalStudents += 1;
    if (isRowPassedForReport(r)) bucket.passedCount += 1;
    if (r.certificateNumber) bucket.certifiedCount += 1;
    if (isRowEmailedForReport(r)) bucket.emailedCount += 1;
  }

  const pickDisplayLabel = (key: string, labels: Map<string, number>): string => {
    if (key === "__unassigned__") return "Unassigned / Other";
    const entries = Array.from(labels.entries());
    // Prefer official "Training Centre" / "Range" label if present, otherwise most frequent / longest
    entries.sort((a, b) => {
      const aOfficial = /training\s*cent|range/i.test(a[0]) ? 1 : 0;
      const bOfficial = /training\s*cent|range/i.test(b[0]) ? 1 : 0;
      if (aOfficial !== bOfficial) return bOfficial - aOfficial;
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    });
    return entries[0]?.[0] || "Unassigned / Other";
  };

  const districts: DistrictPassSummaryRow[] = Array.from(byKey.values()).map((b) => ({
    regionKey: b.regionKey,
    regionName: pickDisplayLabel(b.regionKey, b.labels),
    totalStudents: b.totalStudents,
    passedCount: b.passedCount,
    certifiedCount: b.certifiedCount,
    emailedCount: b.emailedCount,
  }));

  districts.sort((a, b) => {
    if (a.regionKey === "__unassigned__") return 1;
    if (b.regionKey === "__unassigned__") return -1;
    return a.regionName.localeCompare(b.regionName);
  });

  const totals: DistrictPassSummaryRow = districts.reduce(
    (acc, d) => ({
      ...acc,
      totalStudents: acc.totalStudents + d.totalStudents,
      passedCount: acc.passedCount + d.passedCount,
      certifiedCount: acc.certifiedCount + d.certifiedCount,
      emailedCount: acc.emailedCount + d.emailedCount,
    }),
    {
      regionKey: "__total__",
      regionName: "Total (All Districts / Ranges)",
      totalStudents: 0,
      passedCount: 0,
      certifiedCount: 0,
      emailedCount: 0,
    },
  );

  return { districts, totals };
}

/**
 * Filter & sort official passed or emailed student register cleanly by District/Range then Roll
 * (intentionally omits ranking by score/marks).
 * When `officialRegionNames` is supplied, restricts rows strictly to those official centres.
 */
export function buildPassedOrEmailedRows(
  rows: FinalGradeSheetRow[],
  mode: "emailed" | "passed",
  officialRegionNames?: string[] | undefined,
): FinalGradeSheetRow[] {
  const allowedKeys =
    officialRegionNames && officialRegionNames.length > 0
      ? new Set(officialRegionNames.map((n) => normalizeDistrictKey(n)))
      : null;
  const filtered = rows.filter((r) => {
    if (allowedKeys && !allowedKeys.has(normalizeDistrictKey(r.regionName))) return false;
    return mode === "emailed" ? isRowEmailedForReport(r) : isRowPassedForReport(r);
  });
  return [...filtered].sort((a, b) => {
    const ka = normalizeDistrictKey(a.regionName);
    const kb = normalizeDistrictKey(b.regionName);
    if (ka !== kb) {
      if (ka === "__unassigned__") return 1;
      if (kb === "__unassigned__") return -1;
      return ka.localeCompare(kb);
    }
    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
  });
}

export { marksFromPct };

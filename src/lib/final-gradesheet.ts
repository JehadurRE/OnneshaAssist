/**
 * Final Exam gradesheet rows — quiz + practical + combined package marks.
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
  formatFinalMarksBreakdown,
  marksFromPct,
} from "./practical-exam";
import { normalizeBdPhone } from "./sanjibon-seed-data";

export interface FinalGradeSheetRow {
  rank: number;
  rollNumber: string;
  studentName: string;
  regionName: string;
  phone?: string | undefined;
  email?: string | undefined;
  participated: boolean;
  quizAccuracyPct: number;
  quizMarks: number;
  quizMaxMarks: number;
  quizFound: boolean;
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
  /** Pre-resolved quiz accuracy by normalized roll (caller does linking). */
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
  const quizMax = params.exam.quizMaxMarks || FINAL_QUIZ_MARKS;
  const practicalMax = params.exam.practicalMaxMarks || FINAL_PRACTICAL_MARKS;
  const maxTotal = quizMax + practicalMax || FINAL_TOTAL_MARKS;
  const quizWeight = params.exam.quizWeightPct || 43;
  const practicalWeight = params.exam.practicalWeightPct || 57;

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
      quizAccuracyPct,
      practicalScorePct,
      quizMaxMarks: quizMax,
      practicalMaxMarks: practicalMax,
    });
    const combinedPct =
      typeof sub.combinedPct === "number" && quizFound
        ? sub.combinedPct
        : Math.round(
            ((quizAccuracyPct * quizWeight + practicalScorePct * practicalWeight) / 100) * 10,
          ) / 10;
    const cert = findCert(sub.rollNumber, rosterMatch?.rollNumber);
    const elig = findEligibility(sub.rollNumber, rosterMatch?.rollNumber);

    return {
      rank: 0,
      rollNumber: sub.rollNumber,
      studentName: sub.studentName || rosterMatch?.name || "",
      regionName: sub.regionName || rosterMatch?.regionName || "",
      phone: sub.phone || rosterMatch?.phone,
      email: rosterMatch?.email?.trim() || undefined,
      participated: true,
      quizAccuracyPct,
      quizMarks: breakdown.quizMarks,
      quizMaxMarks: quizMax,
      quizFound,
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
      certificateEmailedAt: cert?.emailedAt,
      certificateEmailedTo: cert?.emailedTo,
      eligibleForCertificate: elig?.eligible,
      missingRequirements: elig?.missing,
    };
  });

  // Add remaining roster students (quiz-only participants and students who did not participate)
  for (const student of rosterList) {
    if (matchedRosterIds.has(student.id)) continue;
    const tok = params.normalizeRoll(student.rollNumber);
    if (tok && seenRollToks.has(tok)) continue;
    if (tok) seenRollToks.add(tok);

    const quizHit = tok ? params.quizByRoll.get(tok) : undefined;
    const quizFound = !!quizHit?.found;
    const quizAccuracyPct = quizFound ? quizHit!.accuracyPct : 0;
    const participated = quizFound;
    const breakdown = formatFinalMarksBreakdown({
      quizAccuracyPct,
      practicalScorePct: 0,
      quizMaxMarks: quizMax,
      practicalMaxMarks: practicalMax,
    });
    const combinedPct = participated
      ? Math.round(((quizAccuracyPct * quizWeight) / 100) * 10) / 10
      : 0;
    const cert = findCert(student.rollNumber);
    const elig = findEligibility(student.rollNumber);

    rows.push({
      rank: 0,
      rollNumber: student.rollNumber,
      studentName: student.name,
      regionName: student.regionName || "",
      phone: student.phone,
      email: student.email?.trim() || undefined,
      participated,
      quizAccuracyPct,
      quizMarks: participated ? breakdown.quizMarks : 0,
      quizMaxMarks: quizMax,
      quizFound,
      practicalScorePct: 0,
      practicalMarks: 0,
      practicalMaxMarks: practicalMax,
      practicalStatus: participated ? "quiz_only" : "not_participated",
      practicalGraded: false,
      combinedPct,
      totalMarks: participated ? breakdown.totalMarks : 0,
      maxTotal: breakdown.maxTotal || maxTotal,
      certificateNumber: cert?.certificateNumber,
      certificateIssuedAt: cert?.signedAt || cert?.issueDate,
      certificateEmailedAt: cert?.emailedAt,
      certificateEmailedTo: cert?.emailedTo,
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

export { marksFromPct };

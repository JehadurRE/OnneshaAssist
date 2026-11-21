/**
 * Final Exam gradesheet rows — quiz + practical + combined package marks.
 * Pure helpers for staff desk table / CSV / PDF.
 */
import type { PracticalExam, PracticalSubmission } from "./types";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  formatFinalMarksBreakdown,
  marksFromPct,
} from "./practical-exam";

export interface FinalGradeSheetRow {
  rank: number;
  rollNumber: string;
  studentName: string;
  regionName: string;
  phone?: string | undefined;
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
}

export function buildFinalGradeSheetRows(params: {
  exam: PracticalExam;
  submissions: PracticalSubmission[];
  /** Pre-resolved quiz accuracy by normalized roll (caller does linking). */
  quizByRoll: Map<
    string,
    {
      accuracyPct: number;
      found: boolean;
    }
  >;
  normalizeRoll: (roll: string) => string;
}): FinalGradeSheetRow[] {
  const quizMax = params.exam.quizMaxMarks || FINAL_QUIZ_MARKS;
  const practicalMax = params.exam.practicalMaxMarks || FINAL_PRACTICAL_MARKS;
  const rows: FinalGradeSheetRow[] = params.submissions.map((sub) => {
    const tok = params.normalizeRoll(sub.rollNumber);
    const quizHit = params.quizByRoll.get(tok);
    const quizAccuracyPct =
      quizHit?.found
        ? quizHit.accuracyPct
        : typeof sub.quizAccuracyPct === "number"
          ? sub.quizAccuracyPct
          : 0;
    const quizFound = !!(quizHit?.found || (typeof sub.quizAccuracyPct === "number" && sub.quizAccuracyPct > 0));
    const practicalScorePct =
      typeof sub.practicalScorePct === "number"
        ? sub.practicalScorePct
        : 0;
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
            (quizAccuracyPct * (params.exam.quizWeightPct || 43) +
              practicalScorePct * (params.exam.practicalWeightPct || 57)) /
              100 *
              10,
          ) / 10;
    return {
      rank: 0,
      rollNumber: sub.rollNumber,
      studentName: sub.studentName,
      regionName: sub.regionName || "",
      phone: sub.phone,
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
      maxTotal: breakdown.maxTotal || FINAL_TOTAL_MARKS,
      submissionId: sub.id,
    };
  });

  rows.sort((a, b) => {
    if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
    if (b.combinedPct !== a.combinedPct) return b.combinedPct - a.combinedPct;
    return a.rollNumber.localeCompare(b.rollNumber);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
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
  ];
  const lines = rows.map((r) =>
    [
      r.rank,
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

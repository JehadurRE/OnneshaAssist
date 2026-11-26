/**
 * Pure grading queue enrichment, merit ranking, filtering, and sorting helpers
 * for the Final Exam Desk "Grade work" view (?tab=practical&desk=grade).
 */
import type { PracticalExam, PracticalSubmission } from "./types";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  computeCombinedFinalPct,
  computePracticalScorePct,
  marksFromPct,
} from "./practical-exam";

export type GradeQueueStatusFilter =
  | "all"
  | "needs"
  | "graded"
  | "late"
  | "returned";

export type GradeQueueScoreFilter =
  | "all"
  | "top"
  | "passing"
  | "failing"
  | "missing_quiz"
  | "has_quiz"
  | "ungraded_practical";

export type GradeQueueSortBy =
  | "total_desc"
  | "total_asc"
  | "combined_desc"
  | "combined_asc"
  | "practical_desc"
  | "practical_asc"
  | "quiz_desc"
  | "quiz_asc"
  | "roll_asc"
  | "roll_desc"
  | "name_asc"
  | "name_desc"
  | "updated_desc"
  | "submitted_asc"
  | "status_priority";

export interface GradeQueueSortOption {
  id: GradeQueueSortBy;
  label: string;
  shortLabel: string;
  flipTo?: GradeQueueSortBy | undefined;
}

export const GRADE_QUEUE_SORT_OPTIONS: readonly GradeQueueSortOption[] = [
  {
    id: "total_desc",
    label: "Rank: High → Low (Total marks)",
    shortLabel: "Rank (High → Low)",
    flipTo: "total_asc",
  },
  {
    id: "total_asc",
    label: "Total marks: Low → High",
    shortLabel: "Low → High marks",
    flipTo: "total_desc",
  },
  {
    id: "combined_desc",
    label: "Combined %: High → Low",
    shortLabel: "Combined % ↓",
    flipTo: "combined_asc",
  },
  {
    id: "combined_asc",
    label: "Combined %: Low → High",
    shortLabel: "Combined % ↑",
    flipTo: "combined_desc",
  },
  {
    id: "practical_desc",
    label: "Practical marks: High → Low",
    shortLabel: "Practical ↓",
    flipTo: "practical_asc",
  },
  {
    id: "practical_asc",
    label: "Practical marks: Low → High",
    shortLabel: "Practical ↑",
    flipTo: "practical_desc",
  },
  {
    id: "quiz_desc",
    label: "Quiz marks: High → Low",
    shortLabel: "Quiz ↓",
    flipTo: "quiz_asc",
  },
  {
    id: "quiz_asc",
    label: "Quiz marks: Low → High",
    shortLabel: "Quiz ↑",
    flipTo: "quiz_desc",
  },
  {
    id: "roll_asc",
    label: "Roll number: A → Z",
    shortLabel: "Roll A–Z",
    flipTo: "roll_desc",
  },
  {
    id: "roll_desc",
    label: "Roll number: Z → A",
    shortLabel: "Roll Z–A",
    flipTo: "roll_asc",
  },
  {
    id: "name_asc",
    label: "Student name: A → Z",
    shortLabel: "Name A–Z",
    flipTo: "name_desc",
  },
  {
    id: "name_desc",
    label: "Student name: Z → A",
    shortLabel: "Name Z–A",
    flipTo: "name_asc",
  },
  {
    id: "updated_desc",
    label: "Recently updated (Newest first)",
    shortLabel: "Newest",
    flipTo: "submitted_asc",
  },
  {
    id: "submitted_asc",
    label: "Oldest submitted first",
    shortLabel: "Oldest",
    flipTo: "updated_desc",
  },
  {
    id: "status_priority",
    label: "Needs grading first",
    shortLabel: "Pending first",
    flipTo: "total_desc",
  },
] as const;

export interface EnrichedGradeQueueItem {
  sub: PracticalSubmission;
  /** Merit rank across all course submissions (1 = highest total marks), null if no marks yet. */
  meritRank: number | null;
  quizPct: number | null;
  quizMarks: number;
  quizMaxMarks: number;
  hasQuiz: boolean;
  practicalPct: number | null;
  practicalMarks: number;
  practicalMaxMarks: number;
  hasPracticalScore: boolean;
  totalMarks: number;
  maxTotal: number;
  combinedPct: number | null;
  isGraded: boolean;
  needsGrade: boolean;
  isPassing: boolean;
  isFailing: boolean;
  answeredTaskCount: number;
  totalTaskCount: number;
  fileCount: number;
  linkCount: number;
}

export interface GradeQueueStats {
  total: number;
  needs: number;
  graded: number;
  late: number;
  returned: number;
  withQuiz: number;
  missingQuiz: number;
  passing: number;
  failing: number;
  topPerformers: number;
  avgTotalMarks: number | null;
  avgCombinedPct: number | null;
  passThresholdPct: number;
}

function statusSortWeight(status: PracticalSubmission["status"]): number {
  switch (status) {
    case "submitted":
      return 0;
    case "late":
      return 1;
    case "returned":
      return 2;
    case "draft":
      return 3;
    case "graded":
      return 4;
    default:
      return 5;
  }
}

export function enrichGradingQueue(
  submissions: PracticalSubmission[],
  exam: PracticalExam | undefined,
): { items: EnrichedGradeQueueItem[]; stats: GradeQueueStats } {
  const quizMax = exam?.quizMaxMarks || FINAL_QUIZ_MARKS;
  const practicalMax = exam?.practicalMaxMarks || FINAL_PRACTICAL_MARKS;
  const maxTotal = quizMax + practicalMax || FINAL_TOTAL_MARKS;
  const passThresholdPct = exam?.passThresholdPct ?? 50;
  const totalTaskCount = exam?.tasks.length || 0;

  const items: EnrichedGradeQueueItem[] = submissions.map((sub) => {
    const hasQuiz = typeof sub.quizAccuracyPct === "number" && sub.quizAccuracyPct > 0;
    const quizPct = hasQuiz ? sub.quizAccuracyPct! : null;
    const quizMarks = quizPct !== null ? marksFromPct(quizPct, quizMax) : 0;

    let practicalPct: number | null = null;
    if (typeof sub.practicalScorePct === "number") {
      practicalPct = sub.practicalScorePct;
    } else if (exam?.tasks.length && sub.grades?.length) {
      const computed = computePracticalScorePct(exam.tasks, sub.grades);
      if (computed.max > 0) practicalPct = computed.pct;
    }
    const isGraded = sub.status === "graded";
    const hasPracticalScore = isGraded || (practicalPct !== null && practicalPct > 0);
    const practicalMarks =
      practicalPct !== null ? marksFromPct(practicalPct, practicalMax) : 0;

    const totalMarks = Math.round((quizMarks + practicalMarks) * 10) / 10;

    let combinedPct: number | null = null;
    if (typeof sub.combinedPct === "number" && (hasQuiz || hasPracticalScore)) {
      combinedPct = sub.combinedPct;
    } else if (hasQuiz || hasPracticalScore) {
      combinedPct = computeCombinedFinalPct({
        quizAccuracyPct: quizPct ?? 0,
        practicalScorePct: practicalPct ?? 0,
        quizWeightPct: exam?.quizWeightPct,
        practicalWeightPct: exam?.practicalWeightPct,
      });
    }

    const needsGrade =
      sub.status === "submitted" || sub.status === "late" || sub.status === "returned";
    const isPassing = combinedPct !== null && combinedPct >= passThresholdPct;
    const isFailing =
      (isGraded || hasQuiz) && combinedPct !== null && combinedPct < passThresholdPct;

    let answeredTaskCount = 0;
    let fileCount = 0;
    let linkCount = 0;
    for (const a of sub.answers || []) {
      if (a.textAnswer?.trim() || a.linkUrl?.trim() || a.fileName) answeredTaskCount += 1;
      if (a.fileName || a.fileRelPath) fileCount += 1;
      if (a.linkUrl?.trim()) linkCount += 1;
    }

    return {
      sub,
      meritRank: null,
      quizPct,
      quizMarks,
      quizMaxMarks: quizMax,
      hasQuiz,
      practicalPct,
      practicalMarks,
      practicalMaxMarks: practicalMax,
      hasPracticalScore,
      totalMarks,
      maxTotal,
      combinedPct,
      isGraded,
      needsGrade,
      isPassing,
      isFailing,
      answeredTaskCount,
      totalTaskCount,
      fileCount,
      linkCount,
    };
  });

  // Compute global merit rank across all scored/graded submissions in the course
  const rankedPool = items
    .filter((it) => it.isGraded || it.totalMarks > 0)
    .sort((a, b) => {
      if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
      const bc = b.combinedPct ?? -1;
      const ac = a.combinedPct ?? -1;
      if (bc !== ac) return bc - ac;
      if (b.practicalMarks !== a.practicalMarks) return b.practicalMarks - a.practicalMarks;
      if (b.quizMarks !== a.quizMarks) return b.quizMarks - a.quizMarks;
      return a.sub.rollNumber.localeCompare(b.sub.rollNumber, undefined, { numeric: true });
    });
  rankedPool.forEach((it, idx) => {
    it.meritRank = idx + 1;
  });

  const scoredItems = items.filter((it) => it.combinedPct !== null);
  const avgTotalMarks =
    scoredItems.length > 0
      ? Math.round(
          (scoredItems.reduce((acc, it) => acc + it.totalMarks, 0) / scoredItems.length) * 10,
        ) / 10
      : null;
  const avgCombinedPct =
    scoredItems.length > 0
      ? Math.round(
          (scoredItems.reduce((acc, it) => acc + (it.combinedPct ?? 0), 0) / scoredItems.length) *
            10,
        ) / 10
      : null;

  const stats: GradeQueueStats = {
    total: items.length,
    needs: items.filter((it) => it.needsGrade).length,
    graded: items.filter((it) => it.isGraded).length,
    late: items.filter((it) => it.sub.status === "late").length,
    returned: items.filter((it) => it.sub.status === "returned").length,
    withQuiz: items.filter((it) => it.hasQuiz).length,
    missingQuiz: items.filter((it) => !it.hasQuiz).length,
    passing: items.filter((it) => it.isPassing).length,
    failing: items.filter((it) => it.isFailing).length,
    topPerformers: items.filter((it) => (it.combinedPct ?? 0) >= 80).length,
    avgTotalMarks,
    avgCombinedPct,
    passThresholdPct,
  };

  return { items, stats };
}

export function filterAndSortGradingQueue(
  items: EnrichedGradeQueueItem[],
  opts: {
    statusFilter: GradeQueueStatusFilter;
    scoreFilter: GradeQueueScoreFilter;
    region: string;
    search: string;
    sortBy: GradeQueueSortBy;
  },
): EnrichedGradeQueueItem[] {
  const q = opts.search.trim().toLowerCase();

  const filtered = items.filter((it) => {
    const { sub } = it;
    if (opts.statusFilter === "needs" && !it.needsGrade) return false;
    if (opts.statusFilter === "graded" && !it.isGraded) return false;
    if (opts.statusFilter === "late" && sub.status !== "late") return false;
    if (opts.statusFilter === "returned" && sub.status !== "returned") return false;

    if (opts.scoreFilter === "top" && (it.combinedPct ?? -1) < 80) return false;
    if (opts.scoreFilter === "passing" && !it.isPassing) return false;
    if (opts.scoreFilter === "failing" && !it.isFailing) return false;
    if (opts.scoreFilter === "missing_quiz" && it.hasQuiz) return false;
    if (opts.scoreFilter === "has_quiz" && !it.hasQuiz) return false;
    if (opts.scoreFilter === "ungraded_practical" && it.isGraded) return false;

    if (opts.region !== "all" && (sub.regionName || "").trim() !== opts.region) {
      return false;
    }

    if (q) {
      const hay = `${sub.rollNumber} ${sub.studentName} ${sub.regionName || ""} ${sub.phone || ""} ${sub.status} ${sub.instructorFeedback || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const rollCmp = (a: EnrichedGradeQueueItem, b: EnrichedGradeQueueItem) =>
    a.sub.rollNumber.localeCompare(b.sub.rollNumber, undefined, { numeric: true });
  const nameCmp = (a: EnrichedGradeQueueItem, b: EnrichedGradeQueueItem) =>
    a.sub.studentName.localeCompare(b.sub.studentName, undefined, { sensitivity: "base" });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (opts.sortBy) {
      case "total_desc": {
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        const bc = b.combinedPct ?? -1;
        const ac = a.combinedPct ?? -1;
        if (bc !== ac) return bc - ac;
        return rollCmp(a, b);
      }
      case "total_asc": {
        if (a.totalMarks !== b.totalMarks) return a.totalMarks - b.totalMarks;
        const ac = a.combinedPct ?? -1;
        const bc = b.combinedPct ?? -1;
        if (ac !== bc) return ac - bc;
        return rollCmp(a, b);
      }
      case "combined_desc": {
        const bc = b.combinedPct ?? -1;
        const ac = a.combinedPct ?? -1;
        if (bc !== ac) return bc - ac;
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        return rollCmp(a, b);
      }
      case "combined_asc": {
        const ac = a.combinedPct ?? Number.POSITIVE_INFINITY;
        const bc = b.combinedPct ?? Number.POSITIVE_INFINITY;
        if (ac !== bc) return ac - bc;
        if (a.totalMarks !== b.totalMarks) return a.totalMarks - b.totalMarks;
        return rollCmp(a, b);
      }
      case "practical_desc": {
        const bp = b.hasPracticalScore ? b.practicalMarks : -1;
        const ap = a.hasPracticalScore ? a.practicalMarks : -1;
        if (bp !== ap) return bp - ap;
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        return rollCmp(a, b);
      }
      case "practical_asc": {
        const ap = a.hasPracticalScore ? a.practicalMarks : Number.POSITIVE_INFINITY;
        const bp = b.hasPracticalScore ? b.practicalMarks : Number.POSITIVE_INFINITY;
        if (ap !== bp) return ap - bp;
        if (a.totalMarks !== b.totalMarks) return a.totalMarks - b.totalMarks;
        return rollCmp(a, b);
      }
      case "quiz_desc": {
        const bq = b.hasQuiz ? b.quizMarks : -1;
        const aq = a.hasQuiz ? a.quizMarks : -1;
        if (bq !== aq) return bq - aq;
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        return rollCmp(a, b);
      }
      case "quiz_asc": {
        const aq = a.hasQuiz ? a.quizMarks : Number.POSITIVE_INFINITY;
        const bq = b.hasQuiz ? b.quizMarks : Number.POSITIVE_INFINITY;
        if (aq !== bq) return aq - bq;
        if (a.totalMarks !== b.totalMarks) return a.totalMarks - b.totalMarks;
        return rollCmp(a, b);
      }
      case "roll_asc":
        return rollCmp(a, b);
      case "roll_desc":
        return rollCmp(b, a);
      case "name_asc":
        return nameCmp(a, b) || rollCmp(a, b);
      case "name_desc":
        return nameCmp(b, a) || rollCmp(a, b);
      case "submitted_asc": {
        const at = a.sub.submittedAt || a.sub.createdAt || a.sub.updatedAt || "";
        const bt = b.sub.submittedAt || b.sub.createdAt || b.sub.updatedAt || "";
        return at.localeCompare(bt) || rollCmp(a, b);
      }
      case "status_priority": {
        const sw = statusSortWeight(a.sub.status) - statusSortWeight(b.sub.status);
        if (sw !== 0) return sw;
        return (b.sub.updatedAt || "").localeCompare(a.sub.updatedAt || "") || rollCmp(a, b);
      }
      case "updated_desc":
      default:
        return (b.sub.updatedAt || "").localeCompare(a.sub.updatedAt || "") || rollCmp(a, b);
    }
  });

  return sorted;
}

export function getFlipSortTarget(sortBy: GradeQueueSortBy): GradeQueueSortBy {
  const opt = GRADE_QUEUE_SORT_OPTIONS.find((o) => o.id === sortBy);
  return opt?.flipTo || "total_desc";
}

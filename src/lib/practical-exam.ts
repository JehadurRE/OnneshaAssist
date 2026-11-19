/**
 * Practical exam + course-completion certificate domain logic.
 * Pure functions — no I/O. Server/UI call these at the grading & eligibility seams.
 */
import type {
  Course,
  CourseCompletionRequirement,
  ExamResultRecord,
  PracticalExam,
  PracticalGrade,
  PracticalSubmission,
  PracticalTask,
  Quiz,
} from "./types";
import { clampPassThresholdPct, isPassingScore } from "./scoring";
import { normalizeBdPhone, normalizeRollToken } from "./sanjibon-seed-data";

export const DEFAULT_QUIZ_WEIGHT = 40;
export const DEFAULT_PRACTICAL_WEIGHT = 60;
export const DEFAULT_PRACTICAL_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PRACTICAL_MIME = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function clampWeightPct(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeExamWeights(exam: Pick<PracticalExam, "quizWeightPct" | "practicalWeightPct">): {
  quizWeightPct: number;
  practicalWeightPct: number;
} {
  const quizWeightPct = clampWeightPct(exam.quizWeightPct, DEFAULT_QUIZ_WEIGHT);
  let practicalWeightPct = clampWeightPct(exam.practicalWeightPct, DEFAULT_PRACTICAL_WEIGHT);
  const sum = quizWeightPct + practicalWeightPct;
  if (sum <= 0) {
    return { quizWeightPct: DEFAULT_QUIZ_WEIGHT, practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT };
  }
  if (sum !== 100) {
    // Keep quiz weight, assign remainder to practical so weights always sum to 100.
    practicalWeightPct = 100 - quizWeightPct;
  }
  return { quizWeightPct, practicalWeightPct };
}

export function computeTaskMaxMarks(tasks: PracticalTask[]): number {
  return tasks.reduce((acc, t) => acc + Math.max(0, t.maxMarks || 0), 0);
}

export function computePracticalScorePct(
  tasks: PracticalTask[],
  grades: PracticalGrade[] | undefined,
): { earned: number; max: number; pct: number; allGraded: boolean } {
  const max = computeTaskMaxMarks(tasks);
  if (max <= 0) return { earned: 0, max: 0, pct: 0, allGraded: false };
  const byTask = new Map((grades || []).map((g) => [g.taskId, g]));
  let earned = 0;
  let gradedCount = 0;
  for (const task of tasks) {
    const g = byTask.get(task.id);
    if (!g || typeof g.marks !== "number" || !Number.isFinite(g.marks)) continue;
    earned += Math.max(0, Math.min(task.maxMarks, g.marks));
    gradedCount += 1;
  }
  const pct = Math.round((earned / max) * 1000) / 10;
  return { earned, max, pct, allGraded: gradedCount === tasks.length && tasks.length > 0 };
}

export function computeCombinedFinalPct(params: {
  quizAccuracyPct: number;
  practicalScorePct: number;
  quizWeightPct?: number | undefined;
  practicalWeightPct?: number | undefined;
}): number {
  const weights = normalizeExamWeights({
    quizWeightPct: params.quizWeightPct,
    practicalWeightPct: params.practicalWeightPct,
  });
  const quiz = Math.max(0, Math.min(100, params.quizAccuracyPct));
  const practical = Math.max(0, Math.min(100, params.practicalScorePct));
  const combined =
    (quiz * weights.quizWeightPct) / 100 + (practical * weights.practicalWeightPct) / 100;
  return Math.round(combined * 10) / 10;
}

export function isPracticalWindowOpen(
  exam: Pick<PracticalExam, "opensAt" | "closesAt" | "status">,
  nowIso = new Date().toISOString(),
): boolean {
  if (exam.status === "archived" || exam.status === "draft") return false;
  if (exam.status === "closed") return false;
  if (exam.opensAt && nowIso < exam.opensAt) return false;
  // closesAt alone does not block — late submissions are allowed while status is open/scheduled
  return exam.status === "open" || exam.status === "scheduled";
}

export function isPracticalPastDeadline(
  exam: Pick<PracticalExam, "closesAt">,
  nowIso = new Date().toISOString(),
): boolean {
  return !!(exam.closesAt && nowIso > exam.closesAt);
}

/** Pick best result for a roll among sessions whose quizId is in the allowed set. */
export function findBestQuizResultForCourse(params: {
  results: ExamResultRecord[];
  sessions: Array<{ id: string; pin: string; quizId: string }>;
  allowedQuizIds: string[];
  rollNumber: string;
}): ExamResultRecord | undefined {
  const rollTok = normalizeRollToken(params.rollNumber);
  if (!rollTok || params.allowedQuizIds.length === 0) return undefined;
  const allowed = new Set(params.allowedQuizIds);
  const sessionById = new Map(params.sessions.map((s) => [s.id, s]));
  const sessionByPin = new Map(params.sessions.map((s) => [s.pin, s]));
  const matches = params.results.filter((r) => {
    if (normalizeRollToken(r.rollNumber) !== rollTok) return false;
    const sess = sessionById.get(r.sessionId) || sessionByPin.get(r.pin);
    return !!sess && allowed.has(sess.quizId);
  });
  if (matches.length === 0) return undefined;
  return [...matches].sort((a, b) => {
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    return b.score - a.score;
  })[0];
}

export interface CourseCompletionSnapshot {
  rollNumber: string;
  studentName: string;
  courseId: string;
  quizAccuracyPct: number;
  practicalScorePct: number;
  combinedPct: number;
  quizPassed: boolean;
  practicalPassed: boolean;
  practicalGraded: boolean;
  eligibleForCourseCertificate: boolean;
  missing: string[];
  quizResultId?: string | undefined;
  submissionId?: string | undefined;
}

export function evaluateCourseCompletion(params: {
  course: Course;
  requirement: CourseCompletionRequirement;
  practicalExam: PracticalExam | undefined;
  submission: PracticalSubmission | undefined;
  quizResult: ExamResultRecord | undefined;
  passThresholdPct?: number | undefined;
}): CourseCompletionSnapshot {
  const threshold = clampPassThresholdPct(
    params.passThresholdPct ??
      params.practicalExam?.passThresholdPct ??
      params.course.passThresholdPct,
    50,
  );
  const weights = normalizeExamWeights({
    quizWeightPct: params.practicalExam?.quizWeightPct ?? params.requirement.quizWeightPct,
    practicalWeightPct:
      params.practicalExam?.practicalWeightPct ?? params.requirement.practicalWeightPct,
  });

  const quizAccuracyPct = params.quizResult?.accuracyPct ?? 0;
  const quizPassed = params.requirement.requireQuiz
    ? !!params.quizResult && isPassingScore(quizAccuracyPct, threshold)
    : true;

  const practicalStats = params.practicalExam
    ? computePracticalScorePct(params.practicalExam.tasks, params.submission?.grades)
    : { earned: 0, max: 0, pct: 0, allGraded: false };

  const practicalRequired = params.requirement.requirePractical !== false;
  const practicalGraded = !practicalRequired || practicalStats.allGraded;
  const practicalPassed = !practicalRequired
    ? true
    : practicalGraded && isPassingScore(practicalStats.pct, threshold);

  const combinedPct = computeCombinedFinalPct({
    quizAccuracyPct,
    practicalScorePct: practicalStats.pct,
    quizWeightPct: weights.quizWeightPct,
    practicalWeightPct: weights.practicalWeightPct,
  });

  const missing: string[] = [];
  if (params.requirement.requireQuiz && !params.quizResult) {
    missing.push("final_quiz_result");
  } else if (params.requirement.requireQuiz && !quizPassed) {
    missing.push("final_quiz_pass");
  }
  if (practicalRequired && !params.submission) {
    missing.push("practical_submission");
  } else if (practicalRequired && params.submission?.status !== "graded" && !practicalGraded) {
    missing.push("practical_grading");
  } else if (practicalRequired && !practicalPassed) {
    missing.push("practical_pass");
  }
  if (!isPassingScore(combinedPct, threshold)) {
    missing.push("combined_pass");
  }

  return {
    rollNumber: params.submission?.rollNumber || params.quizResult?.rollNumber || "",
    studentName: params.submission?.studentName || params.quizResult?.name || "",
    courseId: params.course.id,
    quizAccuracyPct,
    practicalScorePct: practicalStats.pct,
    combinedPct,
    quizPassed,
    practicalPassed,
    practicalGraded,
    eligibleForCourseCertificate: missing.length === 0,
    missing,
    quizResultId: params.quizResult?.id,
    submissionId: params.submission?.id,
  };
}

/** Industrial course credential number: ONN-CRS-<COURSECODE>-<ROLL> */
export function makeCourseCertificateNumber(courseCode: string, rollNumber: string): string {
  const code = (courseCode || "COURSE")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10)
    .padEnd(4, "X");
  const roll = (rollNumber || "0000")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-8)
    .padStart(4, "0");
  return `ONN-CRS-${code}-${roll}`;
}

export function buildDefaultFinalPracticalExam(course: Course): PracticalExam {
  const now = new Date().toISOString();
  return {
    id: `practical-${course.id}-final`,
    courseId: course.id,
    titleEn: "Final Practical Examination",
    titleBn: "চূড়ান্ত প্রায়োগিক পরীক্ষা",
    descriptionEn:
      "Submit applied project deliverables for instructor marking. Combined with the Final Quiz toward the course completion certificate.",
    descriptionBn:
      "প্রায়োগিক প্রজেক্ট জমা দিন। চূড়ান্ত কুইজের সাথে মিলিয়ে কোর্স সমাপনী সার্টিফিকেট নির্ধারিত হবে।",
    linkedQuizId: "quiz-sanjibon-s10-final",
    quizWeightPct: DEFAULT_QUIZ_WEIGHT,
    practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT,
    passThresholdPct: course.passThresholdPct ?? 50,
    status: "open",
    opensAt: now,
    closesAt: undefined,
    maxFileBytes: DEFAULT_PRACTICAL_MAX_FILE_BYTES,
    allowedMimeTypes: [...ALLOWED_PRACTICAL_MIME],
    tasks: [
      {
        id: "task-portfolio",
        titleEn: "Applied AI Portfolio / Campaign Deliverable",
        titleBn: "প্রায়োগিক AI পোর্টফোলিও / ক্যাম্পেইন ডেলিভারেবল",
        promptEn:
          "Submit a link (Drive/GitHub/Netlify) and a short reflection describing your end-to-end AI marketing workflow. Optionally attach a PDF/ZIP (max 10 MB).",
        promptBn:
          "আপনার সম্পূর্ণ AI মার্কেটিং ওয়ার্কফ্লোর লিংক (Drive/GitHub/Netlify) ও সংক্ষিপ্ত রিফ্লেকশন জমা দিন। ইচ্ছামতো PDF/ZIP (সর্বোচ্চ ১০ MB) সংযুক্ত করুন।",
        maxMarks: 100,
        requireLink: true,
        requireText: true,
        allowFile: true,
        sortOrder: 1,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDefaultCourseRequirement(courseId: string): CourseCompletionRequirement {
  return {
    courseId,
    requireQuiz: true,
    requirePractical: true,
    requiredQuizIds: ["quiz-sanjibon-s10-final"],
    quizWeightPct: DEFAULT_QUIZ_WEIGHT,
    practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT,
    certificateTitleEn: "Certificate of Course Completion",
    certificateTitleBn: "কোর্স সমাপনী সনদপত্র",
  };
}

export function matchRosterIdentity(params: {
  rollNumber: string;
  phone: string;
  roster: Array<{
    rollNumber: string;
    phone?: string | undefined;
    name: string;
    id: string;
    regionName?: string | undefined;
    regionId?: string | undefined;
  }>;
}) {
  const rollTok = normalizeRollToken(params.rollNumber);
  const phoneTok = normalizeBdPhone(params.phone);
  if (!rollTok || phoneTok.length < 10) return null;
  return (
    params.roster.find(
      (s) =>
        normalizeRollToken(s.rollNumber) === rollTok &&
        normalizeBdPhone(s.phone || "") === phoneTok,
    ) || null
  );
}

export function validateSubmissionPayload(params: {
  exam: PracticalExam;
  taskAnswers: Array<{
    taskId: string;
    textAnswer?: string | undefined;
    linkUrl?: string | undefined;
    fileName?: string | undefined;
    fileMime?: string | undefined;
    fileSizeBytes?: number | undefined;
  }>;
}): { ok: true } | { ok: false; error: string } {
  if (!isPracticalWindowOpen(params.exam)) {
    return { ok: false, error: "Practical exam window is closed." };
  }
  for (const task of params.exam.tasks) {
    const ans = params.taskAnswers.find((a) => a.taskId === task.id);
    if (!ans) return { ok: false, error: `Missing answer for task: ${task.titleEn}` };
    if (task.requireText && !(ans.textAnswer || "").trim()) {
      return { ok: false, error: `Text response required for: ${task.titleEn}` };
    }
    if (task.requireLink && !(ans.linkUrl || "").trim()) {
      return { ok: false, error: `Link required for: ${task.titleEn}` };
    }
    if (ans.linkUrl && !/^https?:\/\//i.test(ans.linkUrl.trim())) {
      return { ok: false, error: `Link must start with http(s):// for: ${task.titleEn}` };
    }
    if (ans.fileName || ans.fileSizeBytes) {
      if (!task.allowFile) {
        return { ok: false, error: `File upload not allowed for: ${task.titleEn}` };
      }
      const maxBytes = params.exam.maxFileBytes || DEFAULT_PRACTICAL_MAX_FILE_BYTES;
      if ((ans.fileSizeBytes || 0) > maxBytes) {
        return {
          ok: false,
          error: `File too large for ${task.titleEn}. Max ${Math.round(maxBytes / (1024 * 1024))} MB.`,
        };
      }
      const mime = (ans.fileMime || "").toLowerCase();
      const allowed = params.exam.allowedMimeTypes || [...ALLOWED_PRACTICAL_MIME];
      if (mime && !allowed.includes(mime)) {
        return { ok: false, error: `File type not allowed for: ${task.titleEn}` };
      }
    }
  }
  return { ok: true };
}

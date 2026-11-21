/**
 * Practical exam + course-completion certificate domain logic.
 * Pure functions — no I/O. Server/UI call these at the grading & eligibility seams.
 */
import type {
  Course,
  CourseCompletionRequirement,
  ExamResultRecord,
  ExamSessionRecord,
  FinalExamAttempt,
  PracticalExam,
  PracticalGrade,
  PracticalSubmission,
  PracticalTask,
  Quiz,
} from "./types";
import { clampPassThresholdPct, isPassingScore } from "./scoring";
import { normalizeBdPhone, normalizeRollToken } from "./sanjibon-seed-data";

/** Final Exam absolute marks (AI-DM-04 / Sanjibon package). */
export const FINAL_QUIZ_MARKS = 30;
export const FINAL_PRACTICAL_MARKS = 40;
export const FINAL_TOTAL_MARKS = FINAL_QUIZ_MARKS + FINAL_PRACTICAL_MARKS; // 70

/**
 * Sanjibon final quiz id aliases.
 * Quiz 17 (`imported-quiz-1795079103116`) was used as the makeup / actual timed
 * final paper for students who missed the original final window.
 */
export const SANJIBON_FINAL_QUIZ_ID = "quiz-sanjibon-s10-final";
export const SANJIBON_QUIZ17_MAKEUP_ID = "imported-quiz-1795079103116";
export const SANJIBON_FINAL_QUIZ_ALIASES = [
  SANJIBON_FINAL_QUIZ_ID,
  "sanjibon-session-10-final-exam",
  SANJIBON_QUIZ17_MAKEUP_ID,
] as const;

/** Expand a quiz-id list so any final alias accepts every other final alias. */
export function expandFinalQuizIds(ids: Array<string | undefined | null>): string[] {
  const base = ids.filter((id): id is string => !!id && id.length > 0);
  const aliasSet = new Set<string>(SANJIBON_FINAL_QUIZ_ALIASES);
  const hit = base.some((id) => aliasSet.has(id));
  if (!hit) return Array.from(new Set(base));
  return Array.from(new Set([...base, ...SANJIBON_FINAL_QUIZ_ALIASES]));
}

/** Weights mirror 30/40 of 70 so combined % maps cleanly to /70. */
export const DEFAULT_QUIZ_WEIGHT = Math.round((FINAL_QUIZ_MARKS / FINAL_TOTAL_MARKS) * 100); // 43
export const DEFAULT_PRACTICAL_WEIGHT = 100 - DEFAULT_QUIZ_WEIGHT; // 57

export const DEFAULT_PRACTICAL_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB (video-friendly)
export const DEFAULT_FINAL_DURATION_HOURS = 3;
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
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export function generateFinalExamJoinPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function marksFromPct(pct: number, maxMarks: number): number {
  const safePct = Math.max(0, Math.min(100, pct));
  return Math.round((safePct / 100) * maxMarks * 10) / 10;
}

export function formatFinalMarksBreakdown(params: {
  quizAccuracyPct: number;
  practicalScorePct: number;
  quizMaxMarks?: number | undefined;
  practicalMaxMarks?: number | undefined;
}): {
  quizMarks: number;
  practicalMarks: number;
  totalMarks: number;
  maxTotal: number;
} {
  const quizMax = params.quizMaxMarks ?? FINAL_QUIZ_MARKS;
  const practicalMax = params.practicalMaxMarks ?? FINAL_PRACTICAL_MARKS;
  const quizMarks = marksFromPct(params.quizAccuracyPct, quizMax);
  const practicalMarks = marksFromPct(params.practicalScorePct, practicalMax);
  return {
    quizMarks,
    practicalMarks,
    totalMarks: Math.round((quizMarks + practicalMarks) * 10) / 10,
    maxTotal: quizMax + practicalMax,
  };
}

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
  exam: Pick<
    PracticalExam,
    "opensAt" | "closesAt" | "status" | "practicalWindowOpen" | "quizWindowOpen"
  >,
  nowIso = new Date().toISOString(),
): boolean {
  if (exam.status === "archived" || exam.status === "draft") return false;
  if (exam.practicalWindowOpen === false) return false;
  if (exam.status === "closed" && exam.practicalWindowOpen !== true) return false;
  if (exam.opensAt && nowIso < exam.opensAt) return false;
  // closesAt alone does not block — late submissions are allowed while status is open/scheduled
  // Explicit practicalWindowOpen:true keeps Part B open even if quiz join was closed.
  if (exam.practicalWindowOpen === true) return true;
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

/** Capstone practical tasks for AI-DM final — sum = FINAL_PRACTICAL_MARKS (40). */
export function buildFinalPracticalPackageTasks(): PracticalTask[] {
  return [
    {
      id: "task-brand-name",
      titleEn: "1. Brand name",
      titleBn: "১. ব্র্যান্ড নাম",
      promptEn:
        "Write the brand / company name you will use for this final project. Keep it clear and memorable.",
      promptBn:
        "এই ফাইনাল প্রজেক্টের জন্য আপনার ব্র্যান্ড/কোম্পানির নাম লিখুন। স্পষ্ট ও মনে রাখার মতো রাখুন।",
      maxMarks: 3,
      requireText: true,
      requireLink: false,
      allowFile: false,
      sortOrder: 1,
    },
    {
      id: "task-market-research",
      titleEn: "2. Market research",
      titleBn: "২. মার্কেট রিসার্চ",
      promptEn:
        "Submit a short market research for your brand (audience, competitors, offer, pain points). Paste notes and optionally attach a PDF/Doc.",
      promptBn:
        "আপনার ব্র্যান্ডের সংক্ষিপ্ত মার্কেট রিসার্চ জমা দিন (টার্গেট অডিয়েন্স, প্রতিযোগী, অফার, পেইন পয়েন্ট)। নোট লিখুন এবং ইচ্ছামতো PDF/Doc সংযুক্ত করুন।",
      maxMarks: 8,
      requireText: true,
      requireLink: false,
      allowFile: true,
      sortOrder: 2,
    },
    {
      id: "task-fb-creatives",
      titleEn: "3. Creative generation — 2 Facebook posts",
      titleBn: "৩. ক্রিয়েটিভ জেনারেশন — ২টি ফেসবুক পোস্ট",
      promptEn:
        "Using your brand name, create 2 Facebook post creatives (caption + visual). Paste both captions here and upload images or share Drive/Canva links.",
      promptBn:
        "আপনার ব্র্যান্ড নাম ব্যবহার করে ২টি ফেসবুক পোস্ট ক্রিয়েটিভ তৈরি করুন (ক্যাপশন + ভিজ্যুয়াল)। দুটি ক্যাপশন এখানে লিখুন এবং ছবি আপলোড করুন অথবা Drive/Canva লিংক দিন।",
      maxMarks: 8,
      requireText: true,
      requireLink: true,
      allowFile: true,
      sortOrder: 3,
    },
    {
      id: "task-ad-script",
      titleEn: "4. Ad script writing",
      titleBn: "৪. বিজ্ঞাপন স্ক্রিপ্ট লেখা",
      promptEn:
        "Write a short company ad script (hook, problem, solution, CTA) suitable for a ~10 second video.",
      promptBn:
        "প্রায় ১০ সেকেন্ডের ভিডিওর উপযোগী কোম্পানি অ্যাড স্ক্রিপ্ট লিখুন (হুক, সমস্যা, সমাধান, CTA)।",
      maxMarks: 6,
      requireText: true,
      requireLink: false,
      allowFile: false,
      sortOrder: 4,
    },
    {
      id: "task-ad-video",
      titleEn: "5. 10-second ad video",
      titleBn: "৫. ১০ সেকেন্ডের অ্যাড ভিডিও",
      promptEn:
        "Generate/produce a ~10 second ad video for your brand. Upload MP4/WebM (max 50 MB) or paste a Drive/YouTube/Canva link.",
      promptBn:
        "আপনার ব্র্যান্ডের জন্য প্রায় ১০ সেকেন্ডের অ্যাড ভিডিও তৈরি করুন। MP4/WebM আপলোড করুন (সর্বোচ্চ ৫০ MB) অথবা Drive/YouTube/Canva লিংক দিন।",
      maxMarks: 8,
      requireText: false,
      requireLink: true,
      allowFile: true,
      sortOrder: 5,
    },
    {
      id: "task-landing-page",
      titleEn: "6. Landing page + live URL",
      titleBn: "৬. ল্যান্ডিং পেজ + লাইভ URL",
      promptEn:
        "Design a landing page for your brand and submit the full live https URL. Bonus: mention if you added an AI assistant/chatbot on the page for full marks.",
      promptBn:
        "আপনার ব্র্যান্ডের ল্যান্ডিং পেজ ডিজাইন করে পূর্ণ লাইভ https URL জমা দিন। বোনাস: পেজে AI অ্যাসিস্ট্যান্ট/চ্যাটবট যোগ থাকলে পূর্ণ নম্বরের জন্য উল্লেখ করুন।",
      maxMarks: 7,
      requireText: true,
      requireLink: true,
      allowFile: false,
      sortOrder: 6,
    },
  ];
}

export function buildDefaultFinalPracticalExam(course: Course): PracticalExam {
  const now = new Date().toISOString();
  const closes = new Date(Date.now() + DEFAULT_FINAL_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  return {
    id: `practical-${course.id}-final`,
    courseId: course.id,
    titleEn: "Final Examination — Timed Quiz + Capstone Package",
    titleBn: "চূড়ান্ত পরীক্ষা — টাইমড কুইজ + ক্যাপস্টোন প্যাকেজ",
    descriptionEn:
      `Join with the shared PIN on /final-exam. Part A: ${FINAL_QUIZ_MARKS}-mark MCQ (single overall timer, not per-question). Part B: ${FINAL_PRACTICAL_MARKS}-mark applied package. Total ${FINAL_TOTAL_MARKS} marks.`,
    descriptionBn:
      `/final-exam এ শেয়ার করা PIN দিয়ে যোগ দিন। অংশ ক: ${FINAL_QUIZ_MARKS} নম্বরের MCQ (একটি মোট টাইমার — প্রশ্নপ্রতি নয়)। অংশ খ: ${FINAL_PRACTICAL_MARKS} নম্বরের প্রায়োগিক প্যাকেজ। মোট ${FINAL_TOTAL_MARKS} নম্বর।`,
    linkedQuizId: SANJIBON_FINAL_QUIZ_ID,
    joinPin: generateFinalExamJoinPin(),
    quizDurationMinutes: 10,
    quizMaxMarks: FINAL_QUIZ_MARKS,
    practicalMaxMarks: FINAL_PRACTICAL_MARKS,
    totalMaxMarks: FINAL_TOTAL_MARKS,
    quizWeightPct: DEFAULT_QUIZ_WEIGHT,
    practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT,
    passThresholdPct: course.passThresholdPct ?? 50,
    status: "scheduled",
    opensAt: now,
    closesAt: closes,
    maxFileBytes: DEFAULT_PRACTICAL_MAX_FILE_BYTES,
    allowedMimeTypes: [...ALLOWED_PRACTICAL_MIME],
    tasks: buildFinalPracticalPackageTasks(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Upgrade legacy single-portfolio finals to the 70-mark timed package when safe. */
export function shouldUpgradeFinalExamPackage(exam: PracticalExam): boolean {
  if (exam.courseId !== "course-sanjibon-ai-dm") return false;
  if ((exam.tasks || []).some((t) => t.id === "task-brand-name")) return false;
  if ((exam.tasks || []).length === 1 && exam.tasks[0]?.id === "task-portfolio") return true;
  if (!exam.joinPin || !exam.quizDurationMinutes) return true;
  return false;
}

export function upgradeFinalExamPackage(exam: PracticalExam): PracticalExam {
  const now = new Date().toISOString();
  const nextTasks =
    (exam.tasks || []).some((t) => t.id === "task-brand-name")
      ? exam.tasks
      : buildFinalPracticalPackageTasks();
  return {
    ...exam,
    titleEn: exam.titleEn?.includes("Timed")
      ? exam.titleEn
      : "Final Examination — Timed Quiz + Capstone Package",
    titleBn: exam.titleBn?.includes("টাইমড")
      ? exam.titleBn
      : "চূড়ান্ত পরীক্ষা — টাইমড কুইজ + ক্যাপস্টোন প্যাকেজ",
    linkedQuizId: exam.linkedQuizId || SANJIBON_FINAL_QUIZ_ID,
    joinPin: exam.joinPin || generateFinalExamJoinPin(),
    quizDurationMinutes: exam.quizDurationMinutes || 10,
    quizMaxMarks: FINAL_QUIZ_MARKS,
    practicalMaxMarks: FINAL_PRACTICAL_MARKS,
    totalMaxMarks: FINAL_TOTAL_MARKS,
    quizWeightPct: DEFAULT_QUIZ_WEIGHT,
    practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT,
    maxFileBytes: Math.max(exam.maxFileBytes || 0, DEFAULT_PRACTICAL_MAX_FILE_BYTES),
    allowedMimeTypes: [...new Set([...(exam.allowedMimeTypes || []), ...ALLOWED_PRACTICAL_MIME])],
    tasks: nextTasks,
    updatedAt: now,
  };
}

export function buildDefaultCourseRequirement(courseId: string): CourseCompletionRequirement {
  return {
    courseId,
    requireQuiz: true,
    requirePractical: true,
    requiredQuizIds: [...SANJIBON_FINAL_QUIZ_ALIASES],
    quizWeightPct: DEFAULT_QUIZ_WEIGHT,
    practicalWeightPct: DEFAULT_PRACTICAL_WEIGHT,
    certificateTitleEn: "Certificate of Course Completion",
    certificateTitleBn: "কোর্স সমাপনী সনদপত্র",
  };
}

export interface MergeMakeupQuizIntoFinalParams {
  exam: PracticalExam;
  requirement?: CourseCompletionRequirement | undefined;
  makeupQuizIds?: string[] | undefined;
  results: ExamResultRecord[];
  sessions: ExamSessionRecord[];
  attempts: FinalExamAttempt[];
  submissions: PracticalSubmission[];
  nowIso?: string | undefined;
}

export interface MergeMakeupQuizIntoFinalResult {
  requirementRequiredQuizIds: string[];
  linkedQuizId: string;
  makeupQuizIds: string[];
  attemptsCreated: number;
  attemptsUpgraded: number;
  attemptsSkipped: number;
  submissionsUpdated: number;
  resultsLinked: number;
  sample: Array<{
    rollNumber: string;
    name: string;
    accuracyPct: number;
    action: string;
  }>;
  attempts: FinalExamAttempt[];
  submissions: PracticalSubmission[];
  results: ExamResultRecord[];
  sessions: ExamSessionRecord[];
}

/**
 * Merge makeup Quiz 17 (or other makeup quiz) scores into the Final Exam package:
 * - expand allowed quiz ids so makeup counts as the final
 * - mint / upgrade FinalExamAttempt rows from the best makeup result
 * - refresh practical submission quizAccuracyPct (and combinedPct when graded)
 * - ensure a fer/fes transcript exists for each merged attempt
 */
export function mergeMakeupQuizIntoFinalExam(
  params: MergeMakeupQuizIntoFinalParams,
): MergeMakeupQuizIntoFinalResult {
  const nowIso = params.nowIso || new Date().toISOString();
  const makeupQuizIds = Array.from(
    new Set(
      (params.makeupQuizIds?.length
        ? params.makeupQuizIds
        : [SANJIBON_QUIZ17_MAKEUP_ID]
      ).filter(Boolean),
    ),
  );
  const allowed = expandFinalQuizIds([
    params.exam.linkedQuizId,
    ...(params.requirement?.requiredQuizIds || []),
    ...makeupQuizIds,
  ]);
  const makeupSet = new Set(makeupQuizIds);
  const sessionById = new Map(params.sessions.map((s) => [s.id, s]));
  const sessionByPin = new Map(params.sessions.map((s) => [s.pin, s]));

  const bestByRoll = new Map<string, ExamResultRecord>();
  for (const r of params.results) {
    const sess = sessionById.get(r.sessionId) || sessionByPin.get(r.pin);
    if (!sess || !makeupSet.has(sess.quizId)) continue;
    const tok = normalizeRollToken(r.rollNumber);
    if (!tok) continue;
    const prev = bestByRoll.get(tok);
    if (
      !prev ||
      r.accuracyPct > prev.accuracyPct ||
      (r.accuracyPct === prev.accuracyPct && r.score > prev.score)
    ) {
      bestByRoll.set(tok, r);
    }
  }

  const attempts = [...params.attempts];
  const submissions = [...params.submissions];
  const results = [...params.results];
  const sessions = [...params.sessions];

  const quizMax = params.exam.quizMaxMarks || FINAL_QUIZ_MARKS;
  let attemptsCreated = 0;
  let attemptsUpgraded = 0;
  let attemptsSkipped = 0;
  let submissionsUpdated = 0;
  let resultsLinked = 0;
  const sample: MergeMakeupQuizIntoFinalResult["sample"] = [];

  const pickAttemptIndex = (rollTok: string): number => {
    let bestIdx = -1;
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i]!;
      if (a.practicalExamId !== params.exam.id) continue;
      if (normalizeRollToken(a.rollNumber) !== rollTok) continue;
      if (bestIdx < 0) {
        bestIdx = i;
        continue;
      }
      const prev = attempts[bestIdx]!;
      const prevDone = prev.status === "submitted" || prev.status === "graded";
      const curDone = a.status === "submitted" || a.status === "graded";
      if (curDone && !prevDone) bestIdx = i;
      else if (curDone === prevDone && (a.accuracyPct || 0) > (prev.accuracyPct || 0)) {
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  for (const [tok, makeup] of bestByRoll) {
    const quizMarks = marksFromPct(makeup.accuracyPct, quizMax);
    const idx = pickAttemptIndex(tok);
    const existing = idx >= 0 ? attempts[idx] : undefined;
    let action = "skipped";

    if (!existing || (existing.status !== "submitted" && existing.status !== "graded")) {
      const attemptId = existing?.id || `fea-merge-${tok}-${Date.now().toString(36)}`;
      const sessionId = `fes-${attemptId}`;
      const resultId = `fer-${attemptId}`;
      const startedAt = existing?.startedAt || makeup.createdAt || nowIso;
      const endsAt = existing?.endsAt || nowIso;
      const attempt: FinalExamAttempt = {
        id: attemptId,
        practicalExamId: params.exam.id,
        courseId: params.exam.courseId,
        quizId: makeupQuizIds[0] || SANJIBON_QUIZ17_MAKEUP_ID,
        pin: params.exam.joinPin || makeup.pin,
        rollNumber: makeup.rollNumber,
        studentName: makeup.name,
        phone: makeup.phone,
        regionId: makeup.regionId,
        regionName: makeup.regionName,
        startedAt,
        endsAt,
        submittedAt: makeup.createdAt || nowIso,
        status: "submitted",
        answers: existing?.answers || {},
        correctCount: makeup.correctCount,
        incorrectCount: makeup.incorrectCount,
        unansweredCount: makeup.unattemptedCount,
        accuracyPct: makeup.accuracyPct,
        quizMarks,
        quizMaxMarks: quizMax,
        resultId,
        sessionId,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (idx >= 0) attempts[idx] = attempt;
      else attempts.unshift(attempt);

      const result: ExamResultRecord = {
        id: resultId,
        sessionId,
        pin: attempt.pin,
        participantId: `fp-${tok}`,
        rollNumber: makeup.rollNumber,
        name: makeup.name,
        phone: makeup.phone,
        regionId: makeup.regionId,
        regionName: makeup.regionName,
        score: quizMarks,
        rank: 1,
        correctCount: makeup.correctCount,
        incorrectCount: makeup.incorrectCount,
        unattemptedCount: makeup.unattemptedCount,
        accuracyPct: makeup.accuracyPct,
        passed: makeup.passed,
        answersJson: makeup.answersJson || "{}",
        createdAt: makeup.createdAt || nowIso,
      };
      const totalQ =
        makeup.correctCount + makeup.incorrectCount + makeup.unattemptedCount || 0;
      const totalQuestions = totalQ > 0 ? totalQ : 30;
      const session: ExamSessionRecord = {
        id: sessionId,
        pin: attempt.pin,
        quizId: attempt.quizId,
        quizTitleEn: "Final Exam (Quiz 17 makeup merge)",
        quizTitleBn: "চূড়ান্ত পরীক্ষা (কুইজ ১৭ মেকআপ)",
        hostId: "final-exam-desk",
        totalQuestions,
        participantCount: 1,
        averageScore: quizMarks,
        highestScore: quizMarks,
        passThresholdPct: params.exam.passThresholdPct,
        createdAt: startedAt,
      };
      const rIdx = results.findIndex((r) => r.id === resultId);
      if (rIdx >= 0) results[rIdx] = result;
      else results.unshift(result);
      const sIdx = sessions.findIndex((s) => s.id === sessionId);
      if (sIdx >= 0) sessions[sIdx] = session;
      else sessions.unshift(session);
      attemptsCreated += 1;
      resultsLinked += 1;
      action = "attempt_created";
    } else if ((existing.accuracyPct || 0) + 0.05 < makeup.accuracyPct) {
      const sessionId = existing.sessionId || `fes-${existing.id}`;
      const resultId = existing.resultId || `fer-${existing.id}`;
      attempts[idx] = {
        ...existing,
        quizId: existing.quizId || makeupQuizIds[0] || SANJIBON_QUIZ17_MAKEUP_ID,
        status: existing.status === "graded" ? "graded" : "submitted",
        correctCount: makeup.correctCount,
        incorrectCount: makeup.incorrectCount,
        unansweredCount: makeup.unattemptedCount,
        accuracyPct: makeup.accuracyPct,
        quizMarks,
        quizMaxMarks: quizMax,
        resultId,
        sessionId,
        submittedAt: existing.submittedAt || makeup.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const rIdx = results.findIndex((r) => r.id === resultId || r.id === makeup.id);
      if (rIdx >= 0) {
        results[rIdx] = {
          ...results[rIdx]!,
          accuracyPct: makeup.accuracyPct,
          score: quizMarks,
          correctCount: makeup.correctCount,
          incorrectCount: makeup.incorrectCount,
          unattemptedCount: makeup.unattemptedCount,
          passed: makeup.passed ?? results[rIdx]!.passed,
        };
      } else {
        results.unshift({
          ...makeup,
          id: resultId,
          sessionId,
          pin: existing.pin || makeup.pin,
          score: quizMarks,
        });
        resultsLinked += 1;
      }
      attemptsUpgraded += 1;
      action = "attempt_upgraded";
    } else {
      attemptsSkipped += 1;
      action = "skipped_equal_or_better";
    }

    const subIdx = submissions.findIndex(
      (s) =>
        (s.practicalExamId === params.exam.id || s.courseId === params.exam.courseId) &&
        normalizeRollToken(s.rollNumber) === tok,
    );
    if (subIdx >= 0) {
      const sub = submissions[subIdx]!;
      const prev = sub.quizAccuracyPct;
      if (prev == null || makeup.accuracyPct > prev + 0.05) {
        const nextQuiz = makeup.accuracyPct;
        const combined =
          typeof sub.practicalScorePct === "number"
            ? computeCombinedFinalPct({
                quizAccuracyPct: nextQuiz,
                practicalScorePct: sub.practicalScorePct,
                quizWeightPct: params.exam.quizWeightPct,
                practicalWeightPct: params.exam.practicalWeightPct,
              })
            : sub.combinedPct;
        submissions[subIdx] = {
          ...sub,
          quizAccuracyPct: nextQuiz,
          combinedPct: combined,
          updatedAt: nowIso,
        };
        submissionsUpdated += 1;
        if (action.startsWith("skipped")) action = "submission_updated";
        else action = `${action}+submission`;
      }
    }

    if (sample.length < 25) {
      sample.push({
        rollNumber: makeup.rollNumber,
        name: makeup.name,
        accuracyPct: makeup.accuracyPct,
        action,
      });
    }
  }

  return {
    requirementRequiredQuizIds: allowed,
    linkedQuizId: params.exam.linkedQuizId || makeupQuizIds[0] || SANJIBON_QUIZ17_MAKEUP_ID,
    makeupQuizIds,
    attemptsCreated,
    attemptsUpgraded,
    attemptsSkipped,
    submissionsUpdated,
    resultsLinked,
    sample,
    attempts,
    submissions,
    results,
    sessions,
  };
}

export function matchRosterIdentity(params: {
  rollNumber: string;
  phone: string;
  roster: Array<{
    rollNumber: string;
    phone?: string | undefined;
    email?: string | undefined;
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
  /** When true (instructor returned work), allow submit even if window is closed. */
  allowReturnedResubmit?: boolean | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (!params.allowReturnedResubmit && !isPracticalWindowOpen(params.exam)) {
    return { ok: false, error: "Practical exam window is closed." };
  }
  if (params.allowReturnedResubmit && (params.exam.status === "archived" || params.exam.status === "draft")) {
    return { ok: false, error: "Practical exam is not accepting resubmissions." };
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

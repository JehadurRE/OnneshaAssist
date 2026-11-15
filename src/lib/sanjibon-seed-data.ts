import sanjibonSeedRaw from "./sanjibon-seed.json";
import type { Course, Quiz, Region, RosterStudent } from "./types";

interface SanjibonSeedPayload {
  regions: Region[];
  course: Course;
  roster: RosterStudent[];
  quizzes: Quiz[];
}

const seedPayload = sanjibonSeedRaw as unknown as SanjibonSeedPayload;

/** All 11 Bangladesh Ansar & VDP Computer Training Centres for Batch-04. */
export const SANJIBON_REGIONS: Region[] = seedPayload.regions;

/** Official course: Applied AI & Autonomous Workflows for Digital Marketing Freelancers. */
export const SANJIBON_COURSE: Course = {
  ...seedPayload.course,
  isPrivate: true,
};

/** All 228 enrolled trainees across the 11 Sanjibon training centres. */
export const SANJIBON_ROSTER: RosterStudent[] = seedPayload.roster;

/** All 11 curriculum quizzes (Pre-Test Baseline + Sessions 01-09 + Session 10 Final Exam = 140 questions). */
export const SANJIBON_QUIZZES: Quiz[] = seedPayload.quizzes.map((q) => ({
  ...q,
  isPrivate: true,
}));

/**
 * Determines whether a course is private (instructor-hosted live exams only; no public self-practice).
 * Sanjibon and admin-created courses default to private (`true`), while the open demo course
 * `course-bcs-foundation` defaults to public (`false`) unless explicitly toggled by Super Admin.
 */
export function isCoursePrivate(course?: Course | null): boolean {
  if (!course) return false;
  if (typeof course.isPrivate === "boolean") return course.isPrivate;
  return course.id !== "course-bcs-foundation";
}

/**
 * Determines whether a quiz belongs to a private course or is itself marked private.
 * When `courses` is supplied, the parent course's `isPrivate` setting takes precedence so
 * Super Admin toggles immediately apply to every quiz in that course.
 */
export function isQuizPrivate(quiz: Quiz, courses?: Course[]): boolean {
  if (quiz.courseId && courses && courses.length > 0) {
    const parentCourse = courses.find((c) => c.id === quiz.courseId);
    if (parentCourse) {
      return isCoursePrivate(parentCourse);
    }
  }
  if (typeof quiz.isPrivate === "boolean") return quiz.isPrivate;
  if (
    quiz.courseId === "course-sanjibon-ai-dm" ||
    quiz.id.startsWith("quiz-sanjibon-") ||
    quiz.slug.startsWith("sanjibon-")
  ) {
    return true;
  }
  if (quiz.courseId && quiz.courseId !== "course-bcs-foundation") {
    return true;
  }
  return false;
}

/**
 * Normalizes Bangladeshi mobile numbers into consistent digit strings so inputs like
 * `+88017...`, `88017...`, `+8817...`, `+8888017...`, or `17...` match cleanly.
 */
export function normalizeBdPhone(raw?: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  while (digits.startsWith("880") && digits.length > 11) {
    digits = digits.slice(3);
  }
  while (digits.startsWith("88") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("00")) {
    digits = digits.slice(1);
  }
  if (!digits.startsWith("0") && digits.length === 10) {
    digits = `0${digits}`;
  }
  return digits;
}

/**
 * Normalizes roll codes by ignoring case, hyphens, and spaces (`JHN-01` -> `jhn01`).
 */
export function normalizeRollToken(raw?: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

import { describe, expect, it } from "vitest";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  REGULAR_QUIZ_MARKS,
  buildDefaultFinalPracticalExam,
  buildFinalPracticalPackageTasks,
  computePracticalScorePct,
  computeRegularQuizSummaryForStudent,
  formatFinalMarksBreakdown,
  marksFromPct,
  shouldUpgradeFinalExamPackage,
  upgradeFinalExamPackage,
  validateSubmissionPayload,
} from "../practical-exam";
import type { Course, ExamResultRecord, PracticalExam } from "../types";

const course: Course = {
  id: "course-sanjibon-ai-dm",
  code: "AI-DM-04",
  titleEn: "Applied AI",
  titleBn: "প্রায়োগিক AI",
  descriptionEn: "",
  descriptionBn: "",
  instructorIds: [],
  instructorNames: [],
  isPrivate: true,
  passThresholdPct: 50,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("final exam 100-mark package (10 + 30 + 60)", () => {
  it("defines 10 regular quizzes + 30 final quiz + 60 practical = 100 total marks", () => {
    expect(REGULAR_QUIZ_MARKS).toBe(10);
    expect(FINAL_QUIZ_MARKS).toBe(30);
    expect(FINAL_PRACTICAL_MARKS).toBe(60);
    expect(FINAL_TOTAL_MARKS).toBe(100);
  });

  it("builds six practical tasks totaling 40 rubric marks (scaled to 60%)", () => {
    const tasks = buildFinalPracticalPackageTasks();
    expect(tasks).toHaveLength(6);
    expect(tasks.reduce((a, t) => a + t.maxMarks, 0)).toBe(40);
    expect(tasks.map((t) => t.id)).toEqual([
      "task-brand-name",
      "task-market-research",
      "task-fb-creatives",
      "task-ad-script",
      "task-ad-video",
      "task-landing-page",
    ]);
  });

  it("seeds timed PIN final with 10/30/60 default weights and overall quiz duration", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    expect(exam.joinPin).toMatch(/^\d{6}$/);
    expect(exam.quizDurationMinutes).toBe(10);
    expect(exam.linkedQuizId).toBe("quiz-sanjibon-s10-final");
    expect(exam.regularQuizMaxMarks).toBe(10);
    expect(exam.quizMaxMarks).toBe(30);
    expect(exam.practicalMaxMarks).toBe(60);
    expect(exam.totalMaxMarks).toBe(100);
    expect(exam.regularQuizWeightPct).toBe(10);
    expect(exam.quizWeightPct).toBe(30);
    expect(exam.practicalWeightPct).toBe(60);
    expect(exam.tasks.reduce((a, t) => a + t.maxMarks, 0)).toBe(40);
  });

  it("maps accuracy percent onto 10 + 30 + 60 = 100 breakdown", () => {
    expect(marksFromPct(100, 30)).toBe(30);
    expect(marksFromPct(80, 30)).toBe(24);
    expect(
      formatFinalMarksBreakdown({
        regularQuizAvgPct: 80,
        quizAccuracyPct: 80,
        practicalScorePct: 50,
      }),
    ).toEqual({
      regularQuizMarks: 8,
      quizMarks: 24,
      quizzesSubtotalMarks: 32,
      practicalMarks: 30,
      totalMarks: 62,
      maxTotal: 100,
    });
  });

  it("combines all non-final regular quizzes equally into 10 marks", () => {
    const sessions = [
      { id: "s1", pin: "111111", quizId: "q1" },
      { id: "s2", pin: "222222", quizId: "q2" },
      { id: "s3", pin: "333333", quizId: "q3" },
      { id: "s4", pin: "444444", quizId: "q4" },
    ];
    const results = [
      { id: "r1", sessionId: "s1", pin: "111111", participantId: "p1", rollNumber: "GZP-01", name: "A", score: 10, rank: 1, correctCount: 8, incorrectCount: 2, unattemptedCount: 0, accuracyPct: 80, createdAt: "" },
      { id: "r2", sessionId: "s2", pin: "222222", participantId: "p1", rollNumber: "GZP-01", name: "A", score: 10, rank: 1, correctCount: 10, incorrectCount: 0, unattemptedCount: 0, accuracyPct: 100, createdAt: "" },
      { id: "r3", sessionId: "s3", pin: "333333", participantId: "p1", rollNumber: "GZP-01", name: "A", score: 10, rank: 1, correctCount: 6, incorrectCount: 4, unattemptedCount: 0, accuracyPct: 60, createdAt: "" },
      // q4 missed -> counts as 0%
    ] as ExamResultRecord[];
    const summary = computeRegularQuizSummaryForStudent({
      results,
      sessions,
      regularQuizGroups: [
        { canonicalId: "q1", aliases: [] },
        { canonicalId: "q2", aliases: [] },
        { canonicalId: "q3", aliases: [] },
        { canonicalId: "q4", aliases: [] },
      ],
      rollNumber: "GZP-01",
    });
    // (80 + 100 + 60 + 0) / 4 = 60% -> 6.0 / 10
    expect(summary.takenCount).toBe(3);
    expect(summary.totalQuizzes).toBe(4);
    expect(summary.avgPct).toBe(60);
    expect(summary.marks).toBe(6);
    expect(summary.maxMarks).toBe(10);
  });

  it("upgrades legacy 70-mark finals once without overwriting admin custom weights", () => {
    const legacy70: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      regularQuizMaxMarks: undefined,
      regularQuizWeightPct: undefined,
      quizMaxMarks: 30,
      practicalMaxMarks: 40,
      totalMaxMarks: 70,
      quizWeightPct: 43,
      practicalWeightPct: 57,
    };
    expect(shouldUpgradeFinalExamPackage(legacy70)).toBe(true);
    const upgraded = upgradeFinalExamPackage(legacy70);
    expect(upgraded.regularQuizWeightPct).toBe(10);
    expect(upgraded.quizWeightPct).toBe(30);
    expect(upgraded.practicalWeightPct).toBe(60);
    expect(upgraded.totalMaxMarks).toBe(100);
    expect(shouldUpgradeFinalExamPackage(upgraded)).toBe(false);

    // Admin customizes weights to 15 / 25 / 60 — must NOT be overwritten on next boot
    const adminCustom: PracticalExam = {
      ...upgraded,
      regularQuizWeightPct: 15,
      quizWeightPct: 25,
      practicalWeightPct: 60,
      regularQuizMaxMarks: 15,
      quizMaxMarks: 25,
      practicalMaxMarks: 60,
      totalMaxMarks: 100,
    };
    expect(shouldUpgradeFinalExamPackage(adminCustom)).toBe(false);
  });

  it("validates full package answers", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    const answers = exam.tasks.map((t) => ({
      taskId: t.id,
      textAnswer: t.requireText ? "sample answer for grading" : undefined,
      linkUrl: t.requireLink ? "https://example.com/work" : undefined,
    }));
    expect(validateSubmissionPayload({ exam, taskAnswers: answers }).ok).toBe(true);
    const scored = computePracticalScorePct(
      exam.tasks,
      exam.tasks.map((t) => ({ taskId: t.id, marks: t.maxMarks, maxMarks: t.maxMarks })),
    );
    expect(scored.pct).toBe(100);
    expect(scored.max).toBe(40);
  });
});

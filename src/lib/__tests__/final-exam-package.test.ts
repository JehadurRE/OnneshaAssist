import { describe, expect, it } from "vitest";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  buildDefaultFinalPracticalExam,
  buildFinalPracticalPackageTasks,
  computePracticalScorePct,
  formatFinalMarksBreakdown,
  marksFromPct,
  shouldUpgradeFinalExamPackage,
  upgradeFinalExamPackage,
  validateSubmissionPayload,
} from "../practical-exam";
import type { Course, PracticalExam } from "../types";

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

describe("final exam 70-mark package", () => {
  it("defines 30 + 40 = 70 absolute marks", () => {
    expect(FINAL_QUIZ_MARKS).toBe(30);
    expect(FINAL_PRACTICAL_MARKS).toBe(40);
    expect(FINAL_TOTAL_MARKS).toBe(70);
  });

  it("builds six practical tasks totaling 40 marks", () => {
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

  it("seeds timed PIN final with overall quiz duration", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    expect(exam.joinPin).toMatch(/^\d{6}$/);
    expect(exam.quizDurationMinutes).toBe(10);
    expect(exam.linkedQuizId).toBe("quiz-sanjibon-s10-final");
    expect(exam.quizMaxMarks).toBe(30);
    expect(exam.practicalMaxMarks).toBe(40);
    expect(exam.totalMaxMarks).toBe(70);
    expect(exam.tasks.reduce((a, t) => a + t.maxMarks, 0)).toBe(40);
  });

  it("maps accuracy percent onto quiz marks out of 30", () => {
    expect(marksFromPct(100, 30)).toBe(30);
    expect(marksFromPct(80, 30)).toBe(24);
    expect(formatFinalMarksBreakdown({ quizAccuracyPct: 80, practicalScorePct: 50 })).toEqual({
      quizMarks: 24,
      practicalMarks: 20,
      totalMarks: 44,
      maxTotal: 70,
    });
  });

  it("upgrades legacy portfolio-only finals", () => {
    const legacy: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      joinPin: undefined,
      quizDurationMinutes: undefined,
      tasks: [
        {
          id: "task-portfolio",
          titleEn: "Portfolio",
          titleBn: "পোর্টফোলিও",
          promptEn: "old",
          promptBn: "পুরনো",
          maxMarks: 100,
          requireText: true,
          requireLink: true,
          allowFile: true,
          sortOrder: 1,
        },
      ],
    };
    expect(shouldUpgradeFinalExamPackage(legacy)).toBe(true);
    const next = upgradeFinalExamPackage(legacy);
    expect(next.tasks).toHaveLength(6);
    expect(next.joinPin).toMatch(/^\d{6}$/);
    expect(next.quizDurationMinutes).toBe(10);
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

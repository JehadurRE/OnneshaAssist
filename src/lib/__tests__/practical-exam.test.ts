import { describe, expect, it } from "vitest";
import {
  buildDefaultFinalPracticalExam,
  computeCombinedFinalPct,
  computePracticalScorePct,
  evaluateCourseCompletion,
  findBestQuizResultForCourse,
  isPracticalPastDeadline,
  isPracticalWindowOpen,
  makeCourseCertificateNumber,
  matchRosterIdentity,
  normalizeExamWeights,
  validateSubmissionPayload,
} from "../practical-exam";
import type { Course, ExamResultRecord, PracticalExam, PracticalSubmission } from "../types";

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

describe("practical exam weights & scoring", () => {
  it("normalizes weights to sum 100", () => {
    expect(normalizeExamWeights({ quizWeightPct: 40, practicalWeightPct: 60 })).toEqual({
      quizWeightPct: 40,
      practicalWeightPct: 60,
    });
    expect(normalizeExamWeights({ quizWeightPct: 70, practicalWeightPct: 70 })).toEqual({
      quizWeightPct: 70,
      practicalWeightPct: 30,
    });
  });

  it("combines quiz and practical with industrial 40/60 default", () => {
    expect(
      computeCombinedFinalPct({ quizAccuracyPct: 80, practicalScorePct: 90 }),
    ).toBe(86);
  });

  it("computes practical percent only when all tasks graded", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    const partial = computePracticalScorePct(exam.tasks, [
      { taskId: exam.tasks[0]!.id, marks: 80, maxMarks: 100 },
    ]);
    expect(partial.pct).toBe(80);
    expect(partial.allGraded).toBe(true);
  });
});

describe("course completion eligibility", () => {
  it("requires quiz + graded practical before course certificate", () => {
    const practical = buildDefaultFinalPracticalExam(course);
    const quizResult: ExamResultRecord = {
      id: "res-1",
      sessionId: "exam-1",
      pin: "123456",
      participantId: "p1",
      rollNumber: "BAR-01",
      name: "Test Student",
      score: 24000,
      rank: 1,
      correctCount: 24,
      incorrectCount: 6,
      unattemptedCount: 0,
      accuracyPct: 80,
      passed: true,
      createdAt: "2026-11-19T00:00:00Z",
    };
    const open = evaluateCourseCompletion({
      course,
      requirement: {
        courseId: course.id,
        requireQuiz: true,
        requirePractical: true,
        requiredQuizIds: ["quiz-sanjibon-s10-final"],
      },
      practicalExam: practical,
      submission: undefined,
      quizResult,
    });
    expect(open.eligibleForCourseCertificate).toBe(false);
    expect(open.missing).toContain("practical_submission");

    const submission: PracticalSubmission = {
      id: "sub-1",
      practicalExamId: practical.id,
      courseId: course.id,
      rollNumber: "BAR-01",
      studentName: "Test Student",
      answers: [
        {
          taskId: practical.tasks[0]!.id,
          textAnswer: "Built a Meta ads funnel with Gemini + CapCut.",
          linkUrl: "https://drive.google.com/example",
        },
      ],
      grades: [{ taskId: practical.tasks[0]!.id, marks: 90, maxMarks: 100 }],
      status: "graded",
      createdAt: "2026-11-19T00:00:00Z",
      updatedAt: "2026-11-19T00:00:00Z",
    };
    const done = evaluateCourseCompletion({
      course,
      requirement: {
        courseId: course.id,
        requireQuiz: true,
        requirePractical: true,
      },
      practicalExam: practical,
      submission,
      quizResult,
    });
    expect(done.eligibleForCourseCertificate).toBe(true);
    expect(done.combinedPct).toBe(86);
  });

  it("builds stable industrial course certificate numbers", () => {
    expect(makeCourseCertificateNumber("AI-DM-04", "BAR-01")).toBe("ONN-CRS-AIDM04-BAR01");
  });
});

describe("practical window & submission validation", () => {
  it("rejects closed windows and invalid links", () => {
    const exam: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      status: "open",
    };
    expect(isPracticalWindowOpen(exam)).toBe(true);
    const bad = validateSubmissionPayload({
      exam,
      taskAnswers: [
        {
          taskId: exam.tasks[0]!.id,
          textAnswer: "ok",
          linkUrl: "drive.google.com/no-scheme",
        },
      ],
    });
    expect(bad.ok).toBe(false);

    const good = validateSubmissionPayload({
      exam,
      taskAnswers: [
        {
          taskId: exam.tasks[0]!.id,
          textAnswer: "Completed CapCut export and Meta ads test.",
          linkUrl: "https://netlify.app/my-site",
        },
      ],
    });
    expect(good.ok).toBe(true);
  });

  it("allows late submit while status open past closesAt", () => {
    const exam: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      status: "open",
      closesAt: "2020-01-01T00:00:00.000Z",
    };
    expect(isPracticalWindowOpen(exam)).toBe(true);
    expect(isPracticalPastDeadline(exam)).toBe(true);
    const good = validateSubmissionPayload({
      exam,
      taskAnswers: [
        {
          taskId: exam.tasks[0]!.id,
          textAnswer: "Late but accepted",
          linkUrl: "https://example.com/work",
        },
      ],
    });
    expect(good.ok).toBe(true);
  });

  it("rejects draft/closed status even before deadline", () => {
    const exam: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      status: "closed",
      closesAt: "2099-01-01T00:00:00.000Z",
    };
    expect(isPracticalWindowOpen(exam)).toBe(false);
  });

  it("allows returned resubmit when window is closed", () => {
    const exam: PracticalExam = {
      ...buildDefaultFinalPracticalExam(course),
      status: "closed",
    };
    const blocked = validateSubmissionPayload({
      exam,
      taskAnswers: [
        {
          taskId: exam.tasks[0]!.id,
          textAnswer: "Revised deliverable",
          linkUrl: "https://example.com/v2",
        },
      ],
    });
    expect(blocked.ok).toBe(false);

    const allowed = validateSubmissionPayload({
      exam,
      allowReturnedResubmit: true,
      taskAnswers: [
        {
          taskId: exam.tasks[0]!.id,
          textAnswer: "Revised deliverable",
          linkUrl: "https://example.com/v2",
        },
      ],
    });
    expect(allowed.ok).toBe(true);
  });

  it("matches quiz results only for allowed quiz ids (no any-quiz fallback)", () => {
    const sessions = [
      { id: "exam-q1", pin: "111111", quizId: "quiz-sanjibon-s01" },
      { id: "exam-final", pin: "222222", quizId: "quiz-sanjibon-s10-final" },
    ];
    const results: ExamResultRecord[] = [
      {
        id: "r1",
        sessionId: "exam-q1",
        pin: "111111",
        participantId: "p1",
        rollNumber: "BAR-01",
        name: "Test",
        score: 100,
        rank: 1,
        correctCount: 10,
        incorrectCount: 0,
        unattemptedCount: 0,
        accuracyPct: 100,
        passed: true,
        createdAt: "2026-11-19T00:00:00Z",
      },
      {
        id: "r2",
        sessionId: "exam-final",
        pin: "222222",
        participantId: "p1",
        rollNumber: "BAR-01",
        name: "Test",
        score: 80,
        rank: 1,
        correctCount: 24,
        incorrectCount: 6,
        unattemptedCount: 0,
        accuracyPct: 80,
        passed: true,
        createdAt: "2026-11-19T00:00:00Z",
      },
    ];
    const onlyFinal = findBestQuizResultForCourse({
      results,
      sessions,
      allowedQuizIds: ["quiz-sanjibon-s10-final"],
      rollNumber: "BAR-01",
    });
    expect(onlyFinal?.id).toBe("r2");
    expect(onlyFinal?.accuracyPct).toBe(80);

    const none = findBestQuizResultForCourse({
      results,
      sessions,
      allowedQuizIds: [],
      rollNumber: "BAR-01",
    });
    expect(none).toBeUndefined();
  });

  it("matches roster by normalized roll + BD phone", () => {
    const hit = matchRosterIdentity({
      rollNumber: "bar-01",
      phone: "+8801712345678",
      roster: [
        {
          id: "st-1",
          rollNumber: "BAR-01",
          phone: "01712345678",
          name: "Cadet",
          regionName: "Barisal",
        },
      ],
    });
    expect(hit?.id).toBe("st-1");
  });
});

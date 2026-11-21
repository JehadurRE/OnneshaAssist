import { describe, expect, it } from "vitest";
import {
  buildDefaultFinalPracticalExam,
  computeCombinedFinalPct,
  computePracticalScorePct,
  evaluateCourseCompletion,
  expandFinalQuizIds,
  findBestQuizResultForCourse,
  isPracticalPastDeadline,
  isPracticalWindowOpen,
  makeCourseCertificateNumber,
  matchRosterIdentity,
  mergeMakeupQuizIntoFinalExam,
  normalizeExamWeights,
  SANJIBON_QUIZ17_MAKEUP_ID,
  validateSubmissionPayload,
} from "../practical-exam";
import type {
  Course,
  ExamResultRecord,
  ExamSessionRecord,
  FinalExamAttempt,
  PracticalExam,
  PracticalSubmission,
} from "../types";

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

  it("combines quiz and practical with 30/40-of-70 default weights (~43/57)", () => {
    expect(
      computeCombinedFinalPct({ quizAccuracyPct: 80, practicalScorePct: 90 }),
    ).toBe(85.7);
  });

  it("computes practical percent only when all tasks graded", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    const partial = computePracticalScorePct(exam.tasks, [
      { taskId: exam.tasks[0]!.id, marks: exam.tasks[0]!.maxMarks, maxMarks: exam.tasks[0]!.maxMarks },
    ]);
    expect(partial.allGraded).toBe(false);
    expect(partial.max).toBe(40);
    const full = computePracticalScorePct(
      exam.tasks,
      exam.tasks.map((t) => ({ taskId: t.id, marks: t.maxMarks, maxMarks: t.maxMarks })),
    );
    expect(full.pct).toBe(100);
    expect(full.allGraded).toBe(true);
  });
});

function fullPackageAnswers(exam: ReturnType<typeof buildDefaultFinalPracticalExam>) {
  return exam.tasks.map((t) => ({
    taskId: t.id,
    textAnswer: t.requireText ? "Completed final package answer." : undefined,
    linkUrl: t.requireLink ? "https://example.com/deliverable" : undefined,
  }));
}

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
      answers: fullPackageAnswers(practical),
      grades: practical.tasks.map((t) => ({
        taskId: t.id,
        marks: Math.round(t.maxMarks * 0.9),
        maxMarks: t.maxMarks,
      })),
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
    // 80% quiz @43 + ~90% practical @57
    expect(done.combinedPct).toBeGreaterThanOrEqual(80);
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
    const badAnswers = fullPackageAnswers(exam);
    const linkTask = exam.tasks.find((t) => t.requireLink)!;
    const badIdx = badAnswers.findIndex((a) => a.taskId === linkTask.id);
    badAnswers[badIdx] = { ...badAnswers[badIdx]!, linkUrl: "drive.google.com/no-scheme" };
    const bad = validateSubmissionPayload({ exam, taskAnswers: badAnswers });
    expect(bad.ok).toBe(false);

    const good = validateSubmissionPayload({
      exam,
      taskAnswers: fullPackageAnswers(exam),
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
      taskAnswers: fullPackageAnswers(exam),
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
      taskAnswers: fullPackageAnswers(exam),
    });
    expect(blocked.ok).toBe(false);

    const allowed = validateSubmissionPayload({
      exam,
      allowReturnedResubmit: true,
      taskAnswers: fullPackageAnswers(exam),
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

  it("expands final quiz aliases to include Quiz 17 makeup", () => {
    expect(expandFinalQuizIds(["quiz-sanjibon-s10-final"])).toEqual(
      expect.arrayContaining([
        "quiz-sanjibon-s10-final",
        "sanjibon-session-10-final-exam",
        SANJIBON_QUIZ17_MAKEUP_ID,
      ]),
    );
    expect(expandFinalQuizIds(["quiz-sanjibon-s01"])).toEqual(["quiz-sanjibon-s01"]);
  });

  it("merges Quiz 17 makeup into final attempts and refreshes practical quiz %", () => {
    const exam = buildDefaultFinalPracticalExam(course);
    exam.id = "practical-course-sanjibon-ai-dm-final";
    exam.joinPin = "290546";
    exam.linkedQuizId = SANJIBON_QUIZ17_MAKEUP_ID;

    const sessions: ExamSessionRecord[] = [
      {
        id: "exam-425209",
        pin: "425209",
        quizId: SANJIBON_QUIZ17_MAKEUP_ID,
        quizTitleEn: "Quiz 17",
        quizTitleBn: "Quiz 17",
        hostId: "host-1",
        totalQuestions: 30,
        participantCount: 1,
        averageScore: 21,
        highestScore: 21,
        createdAt: "2026-11-19T10:00:00Z",
      },
    ];
    const results: ExamResultRecord[] = [
      {
        id: "r-makeup",
        sessionId: "exam-425209",
        pin: "425209",
        participantId: "p1",
        rollNumber: "COX-14",
        name: "SHAFIUL ISLAM",
        score: 24,
        rank: 1,
        correctCount: 24,
        incorrectCount: 6,
        unattemptedCount: 0,
        accuracyPct: 80,
        passed: true,
        createdAt: "2026-11-19T10:05:00Z",
      },
    ];
    const attempts: FinalExamAttempt[] = [
      {
        id: "fea-weak",
        practicalExamId: exam.id,
        courseId: course.id,
        quizId: SANJIBON_QUIZ17_MAKEUP_ID,
        pin: "290546",
        rollNumber: "SYL-17",
        studentName: "Obaidul",
        startedAt: "2026-11-19T09:00:00Z",
        endsAt: "2026-11-19T09:10:00Z",
        submittedAt: "2026-11-19T09:10:00Z",
        status: "submitted",
        accuracyPct: 3.3,
        quizMarks: 1,
        quizMaxMarks: 30,
        correctCount: 1,
        incorrectCount: 29,
        unansweredCount: 0,
        createdAt: "2026-11-19T09:00:00Z",
        updatedAt: "2026-11-19T09:10:00Z",
      },
    ];
    // Separate makeup result for the weak attempt upgrade
    results.push({
      id: "r-syl",
      sessionId: "exam-425209",
      pin: "425209",
      participantId: "p2",
      rollNumber: "SYL-17",
      name: "Obaidul",
      score: 21,
      rank: 2,
      correctCount: 21,
      incorrectCount: 9,
      unattemptedCount: 0,
      accuracyPct: 70,
      passed: true,
      createdAt: "2026-11-19T11:00:00Z",
    });
    const submissions: PracticalSubmission[] = [
      {
        id: "psub-1",
        practicalExamId: exam.id,
        courseId: course.id,
        rollNumber: "SYL-17",
        studentName: "Obaidul",
        answers: [],
        status: "submitted",
        quizAccuracyPct: 3.3,
        createdAt: "2026-11-19T12:00:00Z",
        updatedAt: "2026-11-19T12:00:00Z",
      },
    ];

    const merged = mergeMakeupQuizIntoFinalExam({
      exam,
      requirement: {
        courseId: course.id,
        requireQuiz: true,
        requirePractical: true,
        requiredQuizIds: ["quiz-sanjibon-s10-final"],
        quizWeightPct: 43,
        practicalWeightPct: 57,
      },
      makeupQuizIds: [SANJIBON_QUIZ17_MAKEUP_ID],
      results,
      sessions,
      attempts,
      submissions,
      nowIso: "2026-11-21T12:00:00Z",
    });

    expect(merged.attemptsCreated).toBe(1); // COX-14
    expect(merged.attemptsUpgraded).toBe(1); // SYL-17
    expect(merged.submissionsUpdated).toBe(1);
    expect(merged.requirementRequiredQuizIds).toEqual(
      expect.arrayContaining(["quiz-sanjibon-s10-final", SANJIBON_QUIZ17_MAKEUP_ID]),
    );
    const cox = merged.attempts.find((a) => a.rollNumber === "COX-14");
    expect(cox?.status).toBe("submitted");
    expect(cox?.accuracyPct).toBe(80);
    const syl = merged.attempts.find((a) => a.rollNumber === "SYL-17");
    expect(syl?.accuracyPct).toBe(70);
    expect(merged.submissions[0]?.quizAccuracyPct).toBe(70);
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

import { describe, expect, it } from "vitest";
import {
  enrichGradingQueue,
  filterAndSortGradingQueue,
  getFlipSortTarget,
} from "../grading-queue";
import type { PracticalExam, PracticalSubmission } from "../types";

const exam: PracticalExam = {
  id: "exam-1",
  courseId: "course-1",
  titleEn: "Final",
  titleBn: "Final",
  status: "closed",
  tasks: [
    {
      id: "t1",
      titleEn: "Task 1",
      titleBn: "Task 1",
      promptEn: "",
      promptBn: "",
      maxMarks: 40,
    },
  ],
  quizMaxMarks: 30,
  practicalMaxMarks: 40,
  totalMaxMarks: 70,
  quizWeightPct: 43,
  practicalWeightPct: 57,
  passThresholdPct: 50,
  createdAt: "",
  updatedAt: "",
};

const subs: PracticalSubmission[] = [
  {
    id: "sub-low",
    practicalExamId: "exam-1",
    courseId: "course-1",
    rollNumber: "GZP-02",
    studentName: "Babul Mia",
    regionName: "Gazipur",
    status: "graded",
    quizAccuracyPct: 40,
    practicalScorePct: 30,
    combinedPct: 34.3,
    answers: [{ taskId: "t1", textAnswer: "done" }],
    submittedAt: "2026-11-20T09:00:00Z",
    createdAt: "2026-11-20T09:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
  },
  {
    id: "sub-top",
    practicalExamId: "exam-1",
    courseId: "course-1",
    rollNumber: "GZP-10",
    studentName: "Ayesha Akter",
    regionName: "Dhaka",
    status: "graded",
    quizAccuracyPct: 90,
    practicalScorePct: 95,
    combinedPct: 92.9,
    answers: [{ taskId: "t1", textAnswer: "great", linkUrl: "https://example.com" }],
    submittedAt: "2026-11-20T08:00:00Z",
    createdAt: "2026-11-20T08:00:00Z",
    updatedAt: "2026-11-20T12:00:00Z",
  },
  {
    id: "sub-mid",
    practicalExamId: "exam-1",
    courseId: "course-1",
    rollNumber: "GZP-01",
    studentName: "Kamrul Hasan",
    regionName: "Gazipur",
    status: "late",
    quizAccuracyPct: 80,
    answers: [{ taskId: "t1", textAnswer: "late", fileName: "deck.pdf" }],
    submittedAt: "2026-11-20T11:00:00Z",
    createdAt: "2026-11-20T11:00:00Z",
    updatedAt: "2026-11-20T11:30:00Z",
  },
  {
    id: "sub-noquiz",
    practicalExamId: "exam-1",
    courseId: "course-1",
    rollNumber: "DHK-05",
    studentName: "Nadia Rahman",
    regionName: "Dhaka",
    status: "submitted",
    answers: [{ taskId: "t1", textAnswer: "only practical" }],
    submittedAt: "2026-11-20T07:00:00Z",
    createdAt: "2026-11-20T07:00:00Z",
    updatedAt: "2026-11-20T07:30:00Z",
  },
];

describe("grading queue engine", () => {
  it("computes merit ranks, marks breakdown, and summary stats", () => {
    const { items, stats } = enrichGradingQueue(subs, exam);
    expect(stats.total).toBe(4);
    expect(stats.graded).toBe(2);
    expect(stats.needs).toBe(2);
    expect(stats.late).toBe(1);
    expect(stats.withQuiz).toBe(3);
    expect(stats.missingQuiz).toBe(1);
    expect(stats.topPerformers).toBe(1);
    expect(stats.passing).toBe(1);
    expect(stats.failing).toBe(2);

    const byId = new Map(items.map((it) => [it.sub.id, it]));
    expect(byId.get("sub-top")?.meritRank).toBe(1);
    expect(byId.get("sub-top")?.totalMarks).toBe(65); // 27 + 38
    expect(byId.get("sub-mid")?.meritRank).toBe(2); // 24 quiz + 0 prac = 24
    expect(byId.get("sub-low")?.meritRank).toBe(2 + 1); // 12 quiz + 12 prac = 24 (GZP-01 < GZP-02 tie break)
    expect(byId.get("sub-noquiz")?.meritRank).toBeNull();
  });

  it("sorts high-to-low rank, low-to-high marks, practical, quiz, roll, and name", () => {
    const { items } = enrichGradingQueue(subs, exam);
    const base = {
      statusFilter: "all" as const,
      scoreFilter: "all" as const,
      region: "all",
      search: "",
    };

    const byRankDesc = filterAndSortGradingQueue(items, { ...base, sortBy: "total_desc" });
    expect(byRankDesc.map((i) => i.sub.id)).toEqual([
      "sub-top",
      "sub-mid",
      "sub-low",
      "sub-noquiz",
    ]);

    const byMarksAsc = filterAndSortGradingQueue(items, { ...base, sortBy: "total_asc" });
    expect(byMarksAsc.map((i) => i.sub.id)).toEqual([
      "sub-noquiz",
      "sub-low",
      "sub-mid",
      "sub-top",
    ]);

    const byPracticalAsc = filterAndSortGradingQueue(items, { ...base, sortBy: "practical_asc" });
    expect(byPracticalAsc[0]?.sub.id).toBe("sub-low");
    expect(byPracticalAsc[1]?.sub.id).toBe("sub-top");

    const byQuizDesc = filterAndSortGradingQueue(items, { ...base, sortBy: "quiz_desc" });
    expect(byQuizDesc.map((i) => i.sub.id)).toEqual([
      "sub-top",
      "sub-mid",
      "sub-low",
      "sub-noquiz",
    ]);

    const byRollAsc = filterAndSortGradingQueue(items, { ...base, sortBy: "roll_asc" });
    expect(byRollAsc.map((i) => i.sub.rollNumber)).toEqual([
      "DHK-05",
      "GZP-01",
      "GZP-02",
      "GZP-10",
    ]);

    const byNameAsc = filterAndSortGradingQueue(items, { ...base, sortBy: "name_asc" });
    expect(byNameAsc.map((i) => i.sub.studentName)).toEqual([
      "Ayesha Akter",
      "Babul Mia",
      "Kamrul Hasan",
      "Nadia Rahman",
    ]);

    expect(getFlipSortTarget("total_desc")).toBe("total_asc");
    expect(getFlipSortTarget("total_asc")).toBe("total_desc");
  });

  it("filters by status, score band, region, and search query", () => {
    const { items } = enrichGradingQueue(subs, exam);

    const topOnly = filterAndSortGradingQueue(items, {
      statusFilter: "all",
      scoreFilter: "top",
      region: "all",
      search: "",
      sortBy: "total_desc",
    });
    expect(topOnly.map((i) => i.sub.id)).toEqual(["sub-top"]);

    const missingQuiz = filterAndSortGradingQueue(items, {
      statusFilter: "all",
      scoreFilter: "missing_quiz",
      region: "all",
      search: "",
      sortBy: "roll_asc",
    });
    expect(missingQuiz.map((i) => i.sub.id)).toEqual(["sub-noquiz"]);

    const gazipurSearch = filterAndSortGradingQueue(items, {
      statusFilter: "all",
      scoreFilter: "all",
      region: "Gazipur",
      search: "kamrul",
      sortBy: "total_desc",
    });
    expect(gazipurSearch.map((i) => i.sub.id)).toEqual(["sub-mid"]);
  });

  it("computes 10+30+60=100 total marks and supports regular quiz sorting", () => {
    const exam100: PracticalExam = {
      ...exam,
      regularQuizMaxMarks: 10,
      quizMaxMarks: 30,
      practicalMaxMarks: 60,
      totalMaxMarks: 100,
      regularQuizWeightPct: 10,
      quizWeightPct: 30,
      practicalWeightPct: 60,
    };
    const subs100: PracticalSubmission[] = [
      {
        ...subs[0]!,
        id: "s-a",
        regularQuizAvgPct: 50, // 5/10
        regularQuizTaken: 2,
        regularQuizTotal: 4,
        quizAccuracyPct: 80, // 24/30
        practicalScorePct: 80, // 48/60 -> total 77/100
        combinedPct: 77,
      },
      {
        ...subs[1]!,
        id: "s-b",
        regularQuizAvgPct: 90, // 9/10
        regularQuizTaken: 4,
        regularQuizTotal: 4,
        quizAccuracyPct: 70, // 21/30
        practicalScorePct: 85, // 51/60 -> total 81/100
        combinedPct: 81,
      },
    ];
    const { items } = enrichGradingQueue(subs100, exam100);
    const byId = new Map(items.map((it) => [it.sub.id, it]));
    expect(byId.get("s-a")?.regularQuizMarks).toBe(5);
    expect(byId.get("s-a")?.quizMarks).toBe(24);
    expect(byId.get("s-a")?.practicalMarks).toBe(48);
    expect(byId.get("s-a")?.totalMarks).toBe(77);
    expect(byId.get("s-a")?.maxTotal).toBe(100);

    expect(byId.get("s-b")?.totalMarks).toBe(81);
    expect(byId.get("s-b")?.meritRank).toBe(1);

    const byRegularDesc = filterAndSortGradingQueue(items, {
      statusFilter: "all",
      scoreFilter: "all",
      region: "all",
      search: "",
      sortBy: "regular_desc",
    });
    expect(byRegularDesc.map((i) => i.sub.id)).toEqual(["s-b", "s-a"]);
    expect(getFlipSortTarget("regular_desc")).toBe("regular_asc");
  });
});

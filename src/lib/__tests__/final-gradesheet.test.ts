import { describe, expect, it } from "vitest";
import {
  buildFinalGradeSheetRows,
  finalGradeSheetCsv,
} from "../final-gradesheet";
import type { PracticalExam, PracticalSubmission } from "../types";
import { normalizeRollToken } from "../sanjibon-seed-data";

const exam = {
  id: "exam-1",
  courseId: "course-1",
  titleEn: "Final",
  titleBn: "Final",
  status: "closed",
  tasks: [],
  quizMaxMarks: 30,
  practicalMaxMarks: 40,
  totalMaxMarks: 70,
  quizWeightPct: 43,
  practicalWeightPct: 57,
} as PracticalExam;

describe("final gradesheet", () => {
  it("ranks by total marks and builds csv", () => {
    const submissions = [
      {
        id: "s1",
        practicalExamId: "exam-1",
        courseId: "course-1",
        rollNumber: "NOA-02",
        studentName: "Beta",
        regionName: "Dhaka",
        status: "graded",
        practicalScorePct: 50,
        quizAccuracyPct: 80,
        answers: [],
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "s2",
        practicalExamId: "exam-1",
        courseId: "course-1",
        rollNumber: "NOA-01",
        studentName: "Alpha",
        regionName: "Chittagong",
        status: "graded",
        practicalScorePct: 100,
        quizAccuracyPct: 100,
        answers: [],
        createdAt: "",
        updatedAt: "",
      },
    ] as PracticalSubmission[];

    const quizByRoll = new Map([
      [normalizeRollToken("NOA-01"), { accuracyPct: 100, found: true }],
      [normalizeRollToken("NOA-02"), { accuracyPct: 80, found: true }],
    ]);

    const rows = buildFinalGradeSheetRows({
      exam,
      submissions,
      quizByRoll,
      normalizeRoll: normalizeRollToken,
    });

    expect(rows[0]?.rollNumber).toBe("NOA-01");
    expect(rows[0]?.rank).toBe(1);
    expect(rows[0]?.quizMarks).toBe(30);
    expect(rows[0]?.practicalMarks).toBe(40);
    expect(rows[0]?.totalMarks).toBe(70);
    expect(rows[1]?.quizMarks).toBe(24);
    expect(rows[1]?.practicalMarks).toBe(20);

    const csv = finalGradeSheetCsv(rows);
    expect(csv).toContain("rank,roll,name");
    expect(csv).toContain("NOA-01");
    expect(csv).toContain("NOA-02");
  });
});

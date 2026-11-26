import { describe, expect, it } from "vitest";
import {
  buildFinalGradeSheetRows,
  finalGradeSheetCsv,
  formatPracticalStatusLabel,
} from "../final-gradesheet";
import type {
  CertificateData,
  PracticalExam,
  PracticalSubmission,
  RosterStudent,
} from "../types";
import { normalizeRollToken } from "../sanjibon-seed-data";

const exam: PracticalExam = {
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
  createdAt: "",
  updatedAt: "",
};

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
    expect(rows[0]?.participated).toBe(true);
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

  it("includes quiz-only and non-participated roster students with certificate metadata", () => {
    const submissions = [
      {
        id: "s1",
        practicalExamId: "exam-1",
        courseId: "course-1",
        rollNumber: "GZP-01",
        studentName: "Submitted Student",
        regionName: "Gazipur",
        phone: "01711111111",
        status: "graded",
        practicalScorePct: 90,
        quizAccuracyPct: 80,
        answers: [],
        createdAt: "",
        updatedAt: "",
      },
    ] as PracticalSubmission[];

    const roster: RosterStudent[] = [
      {
        id: "r1",
        rollNumber: "GZP-01",
        name: "Submitted Student",
        phone: "01711111111",
        regionName: "Gazipur",
        email: "gzp01@example.com",
      },
      {
        id: "r2",
        rollNumber: "GZP-02",
        name: "Quiz Only Student",
        phone: "01722222222",
        regionName: "Gazipur",
        email: "gzp02@example.com",
      },
      {
        id: "r3",
        rollNumber: "GZP-03",
        name: "Absent Student",
        phone: "01733333333",
        regionName: "Dhaka",
        email: "gzp03@example.com",
      },
    ];

    const certificates: CertificateData[] = [
      {
        id: "cert-1",
        certificateNumber: "ONN-CRS-AIDM04-GZP01",
        kind: "course_completion",
        courseId: "course-1",
        studentName: "Submitted Student",
        studentRoll: "GZP-01",
        quizTitle: "Final",
        rank: 1,
        totalParticipants: 1,
        issueDate: "2026-11-26",
        verified: true,
        emailedAt: "2026-11-26T12:00:00Z",
        emailedTo: "gzp01@example.com",
      },
    ];

    const quizByRoll = new Map([
      [normalizeRollToken("GZP-01"), { accuracyPct: 80, found: true }],
      [normalizeRollToken("GZP-02"), { accuracyPct: 70, found: true }],
      [normalizeRollToken("GZP-03"), { accuracyPct: 0, found: false }],
    ]);

    const eligibilityByRoll = new Map([
      [normalizeRollToken("GZP-01"), { eligible: true, missing: [] }],
      [normalizeRollToken("GZP-02"), { eligible: false, missing: ["practical_submission"] }],
      [
        normalizeRollToken("GZP-03"),
        { eligible: false, missing: ["final_quiz_result", "practical_submission"] },
      ],
    ]);

    const rows = buildFinalGradeSheetRows({
      exam,
      submissions,
      roster,
      certificates,
      quizByRoll,
      eligibilityByRoll,
      normalizeRoll: normalizeRollToken,
    });

    expect(rows).toHaveLength(3);

    // 1. Submitted + graded student ranked #1 with email & cert metadata
    expect(rows[0]?.rollNumber).toBe("GZP-01");
    expect(rows[0]?.rank).toBe(1);
    expect(rows[0]?.participated).toBe(true);
    expect(rows[0]?.email).toBe("gzp01@example.com");
    expect(rows[0]?.certificateNumber).toBe("ONN-CRS-AIDM04-GZP01");
    expect(rows[0]?.certificateEmailedAt).toBe("2026-11-26T12:00:00Z");
    expect(rows[0]?.eligibleForCertificate).toBe(true);

    // 2. Quiz-only student ranked #2, marked participated with status quiz_only
    expect(rows[1]?.rollNumber).toBe("GZP-02");
    expect(rows[1]?.rank).toBe(2);
    expect(rows[1]?.participated).toBe(true);
    expect(rows[1]?.practicalStatus).toBe("quiz_only");
    expect(rows[1]?.quizMarks).toBe(21);
    expect(rows[1]?.practicalMarks).toBe(0);
    expect(rows[1]?.totalMarks).toBe(21);
    expect(rows[1]?.eligibleForCertificate).toBe(false);

    // 3. Non-participated student appears last with rank 0 and not_participated status
    expect(rows[2]?.rollNumber).toBe("GZP-03");
    expect(rows[2]?.rank).toBe(0);
    expect(rows[2]?.participated).toBe(false);
    expect(rows[2]?.practicalStatus).toBe("not_participated");
    expect(rows[2]?.email).toBe("gzp03@example.com");
    expect(rows[2]?.totalMarks).toBe(0);

    // CSV includes empty rank for absent student + participated flag + certificate info
    const csv = finalGradeSheetCsv(rows);
    expect(csv).toContain("participated,email,certificateNumber,certificateEmailedAt");
    expect(csv).toContain("ONN-CRS-AIDM04-GZP01");
    expect(csv).toContain(",GZP-03,Absent Student,Dhaka,01733333333,0,30,0,0,40,0,0,70,0,not_participated,no,gzp03@example.com,,");

    expect(formatPracticalStatusLabel("not_participated")).toBe("Not participated");
    expect(formatPracticalStatusLabel("quiz_only")).toBe("Quiz only");
    expect(formatPracticalStatusLabel("graded")).toBe("graded");
  });

  it("deduplicates roster student matched by phone when submission used a different roll format", () => {
    const submissions = [
      {
        id: "s-alt",
        practicalExamId: "exam-1",
        courseId: "course-1",
        rollNumber: "009297",
        studentName: "Alt Roll Student",
        regionName: "Noakhali",
        phone: "+8801744444444",
        status: "graded",
        practicalScorePct: 75,
        quizAccuracyPct: 60,
        answers: [],
        createdAt: "",
        updatedAt: "",
      },
    ] as PracticalSubmission[];

    const roster: RosterStudent[] = [
      {
        id: "r-noa",
        rollNumber: "NOA-08",
        name: "Alt Roll Student",
        phone: "01744444444",
        regionName: "Noakhali",
        email: "noa08@example.com",
      },
    ];

    const rows = buildFinalGradeSheetRows({
      exam,
      submissions,
      roster,
      quizByRoll: new Map(),
      normalizeRoll: normalizeRollToken,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("noa08@example.com");
    expect(rows[0]?.participated).toBe(true);
  });
});

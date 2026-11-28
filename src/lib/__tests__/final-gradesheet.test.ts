import { describe, expect, it } from "vitest";
import {
  buildDistrictPassSummary,
  buildFinalGradeSheetRows,
  buildPassedOrEmailedRows,
  finalGradeSheetCsv,
  formatPracticalStatusLabel,
  normalizeDistrictKey,
} from "../final-gradesheet";
import {
  detectCommonEmailTypo,
  isDeliverableStudentEmail,
  isPlaceholderStudentEmail,
} from "../email-otp";
import { migrateOfficialCentresAndRealEmailsInStore } from "../server-session";
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
        email: "gzp01@gmail.com",
      },
      {
        id: "r2",
        rollNumber: "GZP-02",
        name: "Quiz Only Student",
        phone: "01722222222",
        regionName: "Gazipur",
        email: "gzp02@gmail.com",
      },
      {
        id: "r3",
        rollNumber: "GZP-03",
        name: "Absent Student",
        phone: "01733333333",
        regionName: "Dhaka",
        email: "gzp03@gmail.com",
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
        emailedTo: "gzp01@gmail.com",
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
    expect(rows[0]?.email).toBe("gzp01@gmail.com");
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
    expect(rows[2]?.email).toBe("gzp03@gmail.com");
    expect(rows[2]?.totalMarks).toBe(0);

    // CSV includes empty rank for absent student + participated flag + certificate info
    const csv = finalGradeSheetCsv(rows);
    expect(csv).toContain("regularQuizMarks,regularQuizMax");
    expect(csv).toContain("participated,email,certificateNumber,certificateEmailedAt");
    expect(csv).toContain("ONN-CRS-AIDM04-GZP01");
    expect(csv).toContain(",GZP-03,Absent Student,Dhaka,01733333333,0,0,0,0,0,0,30,0,0,40,0,0,70,0,not_participated,no,gzp03@gmail.com,,");

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
        email: "noa08@gmail.com",
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
    expect(rows[0]?.email).toBe("noa08@gmail.com");
    expect(rows[0]?.participated).toBe(true);
  });

  it("computes 10 regular quizzes + 30 final quiz + 60 practical = 100 total marks", () => {
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
    const submissions = [
      {
        id: "s-100",
        practicalExamId: "exam-1",
        courseId: "course-1",
        rollNumber: "SYL-01",
        studentName: "Top Learner",
        regionName: "Sylhet",
        status: "graded",
        practicalScorePct: 75,
        quizAccuracyPct: 90,
        answers: [],
        createdAt: "",
        updatedAt: "",
      },
    ] as PracticalSubmission[];

    const regularQuizByRoll = new Map([
      [normalizeRollToken("SYL-01"), { avgPct: 80, takenCount: 8, totalQuizzes: 10 }],
    ]);
    const quizByRoll = new Map([
      [normalizeRollToken("SYL-01"), { accuracyPct: 90, found: true }],
    ]);

    const rows = buildFinalGradeSheetRows({
      exam: exam100,
      submissions,
      regularQuizByRoll,
      quizByRoll,
      normalizeRoll: normalizeRollToken,
    });

    // 8/10 + 27/30 + 45/60 = 80/100 (80%)
    expect(rows[0]?.regularQuizMarks).toBe(8);
    expect(rows[0]?.quizMarks).toBe(27);
    expect(rows[0]?.quizzesSubtotalMarks).toBe(35);
    expect(rows[0]?.quizzesSubtotalMaxMarks).toBe(40);
    expect(rows[0]?.practicalMarks).toBe(45);
    expect(rows[0]?.totalMarks).toBe(80);
    expect(rows[0]?.maxTotal).toBe(100);
    expect(rows[0]?.combinedPct).toBe(80);
  });

  it("builds district/range-wise pass & emailed counts and merges spelling/centre variants", () => {
    const sampleRows = buildFinalGradeSheetRows({
      exam,
      submissions: [
        {
          id: "s-c1",
          practicalExamId: "exam-1",
          courseId: "course-1",
          rollNumber: "CUM-01",
          studentName: "A",
          regionName: "Cumilla Training Centre",
          status: "graded",
          practicalScorePct: 80,
          quizAccuracyPct: 80,
          answers: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "s-c2",
          practicalExamId: "exam-1",
          courseId: "course-1",
          rollNumber: "CUM-02",
          studentName: "B",
          regionName: "Cumilla",
          status: "graded",
          practicalScorePct: 70,
          quizAccuracyPct: 70,
          answers: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "s-b1",
          practicalExamId: "exam-1",
          courseId: "course-1",
          rollNumber: "BOG-01",
          studentName: "C",
          regionName: "Bogura Training Centre",
          status: "graded",
          practicalScorePct: 30,
          quizAccuracyPct: 20,
          answers: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as PracticalSubmission[],
      roster: [
        { id: "r-c3", rollNumber: "CUM-03", name: "Absent Cumilla", regionName: "Comilla" },
      ],
      certificates: [
        {
          id: "c-1",
          certificateNumber: "ONN-CRS-AIDM04-CUM01",
          kind: "course_completion",
          courseId: "course-1",
          studentName: "A",
          studentRoll: "CUM-01",
          quizTitle: "Final",
          rank: 1,
          totalParticipants: 1,
          issueDate: "2026-11-28",
          verified: true,
          emailedAt: "2026-11-28T10:00:00Z",
          emailedTo: "cum01@gmail.com",
        },
      ],
      quizByRoll: new Map([
        [normalizeRollToken("CUM-01"), { accuracyPct: 80, found: true }],
        [normalizeRollToken("CUM-02"), { accuracyPct: 70, found: true }],
        [normalizeRollToken("BOG-01"), { accuracyPct: 20, found: true }],
      ]),
      eligibilityByRoll: new Map([
        [normalizeRollToken("CUM-01"), { eligible: true, missing: [] }],
        [normalizeRollToken("CUM-02"), { eligible: true, missing: [] }],
        [normalizeRollToken("BOG-01"), { eligible: false, missing: ["combined_pass"] }],
        [normalizeRollToken("CUM-03"), { eligible: false, missing: ["practical_submission"] }],
      ]),
      normalizeRoll: normalizeRollToken,
    });

    expect(normalizeDistrictKey("Cumilla Training Centre")).toBe("cumilla");
    expect(normalizeDistrictKey("Comilla")).toBe("cumilla");

    const { districts, totals } = buildDistrictPassSummary(sampleRows);
    expect(districts).toHaveLength(2);
    expect(districts[0]?.regionName).toBe("Bogura Training Centre");
    expect(districts[0]?.totalStudents).toBe(1);
    expect(districts[0]?.passedCount).toBe(0);
    expect(districts[0]?.emailedCount).toBe(0);

    expect(districts[1]?.regionName).toBe("Cumilla Training Centre");
    expect(districts[1]?.totalStudents).toBe(3);
    expect(districts[1]?.passedCount).toBe(2);
    expect(districts[1]?.emailedCount).toBe(1);

    expect(totals.totalStudents).toBe(4);
    expect(totals.passedCount).toBe(2);
    expect(totals.emailedCount).toBe(1);

    const emailedRows = buildPassedOrEmailedRows(sampleRows, "emailed");
    expect(emailedRows.map((r) => r.rollNumber)).toEqual(["CUM-01"]);

    const passedRows = buildPassedOrEmailedRows(sampleRows, "passed");
    expect(passedRows.map((r) => r.rollNumber)).toEqual(["CUM-01", "CUM-02"]);
  });

  it("blocks @sanjibon.onnesha.* placeholders & Gmail typos, cleans store to 11 centres, and excludes non-official centres", () => {
    expect(isPlaceholderStudentEmail("cum-01@sanjibon.onnesha.courses")).toBe(true);
    expect(isPlaceholderStudentEmail("syl-02@sanjibon.onnesha.app")).toBe(true);
    expect(isPlaceholderStudentEmail("student@gmail.com")).toBe(false);
    expect(detectCommonEmailTypo("mohaiminul788@gamail.com")).toBe("mohaiminul788@gmail.com");
    expect(detectCommonEmailTypo("mdjobairahamed67@gmail")).toBe("mdjobairahamed67@gmail.com");
    expect(isDeliverableStudentEmail("cum-01@sanjibon.onnesha.courses")).toBe(false);
    expect(isDeliverableStudentEmail("mohaiminul788@gamail.com")).toBe(false);
    expect(isDeliverableStudentEmail("student@gmail.com")).toBe(true);

    const mockStore = {
      regions: [
        { id: "reg-dhaka", code: "DHK", nameEn: "Dhaka Range", nameBn: "ঢাকা", createdAt: "" },
        { id: "reg-sylhet", code: "SYL", nameEn: "Sylhet Training Centre", nameBn: "সিলেট", createdAt: "" },
      ],
      deletedRegionIds: [],
      roster: [
        { id: "s1", rollNumber: "CUM-01", name: "Cumilla Student", email: "cum-01@sanjibon.onnesha.courses" },
        { id: "s2", rollNumber: "NOA-12", name: "Noakhali Student", email: "mohaiminul788@gamail.com" },
        { id: "s3", rollNumber: "KIS-17", name: "Kishoreganj Student", email: "mdjobairahamed67@gmail" },
        { id: "s4", rollNumber: "BAR-01", name: "Barishal Student", email: "bar01@gmail.com" },
      ],
      certificates: [
        {
          id: "c1",
          certificateNumber: "ONN-CRS-AIDM04-CUM01",
          studentRoll: "CUM-01",
          emailedAt: "2026-11-28T10:00:00Z",
          emailedTo: "cum-01@sanjibon.onnesha.courses",
        },
        {
          id: "c2",
          certificateNumber: "ONN-CRS-AIDM04-BAR01",
          studentRoll: "BAR-01",
          emailedAt: "2026-11-28T10:00:00Z",
          emailedTo: "bar01@gmail.com",
        },
      ],
    };

    const mig = migrateOfficialCentresAndRealEmailsInStore(mockStore as never);
    expect(mig.removedRegions).toBe(1);
    expect(mockStore.regions).toHaveLength(11);
    expect(mockStore.regions.some((r) => r.id === "reg-dhaka")).toBe(false);
    expect(mig.strippedPlaceholders).toBe(1);
    expect(mig.fixedTypos).toBe(2);
    expect(mig.clearedBouncedCerts).toBe(1);
    expect(mockStore.roster[0]?.email).toBeUndefined();
    expect(mockStore.roster[1]?.email).toBe("mohaiminul788@gmail.com");
    expect(mockStore.roster[2]?.email).toBe("mdjobairahamed67@gmail.com");
    expect(mockStore.roster[3]?.email).toBe("bar01@gmail.com");
    expect(mockStore.certificates[0]?.emailedAt).toBeUndefined();
    expect(mockStore.certificates[1]?.emailedAt).toBe("2026-11-28T10:00:00Z");

    // Official region filter excludes Dhaka Range cleanly from District summary
    const sampleRows = buildFinalGradeSheetRows({
      exam,
      submissions: [
        {
          id: "sub-dhk",
          practicalExamId: "exam-1",
          courseId: "course-1",
          rollNumber: "82",
          studentName: "Admin Test",
          regionName: "Dhaka Range",
          status: "graded",
          practicalScorePct: 90,
          quizAccuracyPct: 90,
          answers: [],
          createdAt: "",
          updatedAt: "",
        },
      ] as PracticalSubmission[],
      quizByRoll: new Map(),
      normalizeRoll: normalizeRollToken,
    });
    const officialNames = mockStore.regions.map((r) => r.nameEn);
    const summary = buildDistrictPassSummary(sampleRows, officialNames);
    expect(summary.districts).toHaveLength(11);
    expect(summary.districts.some((d) => d.regionName.includes("Dhaka"))).toBe(false);
  });
});

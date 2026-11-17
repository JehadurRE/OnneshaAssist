import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverGetBootstrapData = vi.fn();
const serverAdminMutateStore = vi.fn();

vi.mock("../server-session", () => ({
  serverGetBootstrapData: (...args: unknown[]) => serverGetBootstrapData(...args),
  serverAdminMutateStore: (...args: unknown[]) => serverAdminMutateStore(...(args as [])),
}));

function installMockWindowStorage() {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    get length() {
      return store.size;
    },
  };

  const g = globalThis as Record<string, unknown>;
  g["window"] = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  g["localStorage"] = mockLocalStorage;
  return mockLocalStorage;
}

describe("client SQLite & localStorage synchronization from server bootstrap", () => {
  const g = globalThis as Record<string, unknown>;
  const origWindow = g["window"];
  const origLocalStorage = g["localStorage"];

  beforeEach(() => {
    vi.resetModules();
    serverGetBootstrapData.mockReset();
    serverAdminMutateStore.mockReset();
  });

  afterEach(() => {
    g["window"] = origWindow;
    g["localStorage"] = origLocalStorage;
  });

  it("clears stale localStorage and SQLite collections when bootstrap returns empty arrays", async () => {
    const ls = installMockWindowStorage();
    const { sqliteEngine } = await import("../db/sqlite-engine");
    const { db } = await import("../db");

    await sqliteEngine.init();

    // Seed stale non-empty records locally and in localStorage
    db.recordTransaction({
      planId: "tier-academy",
      amount: 1490,
      msisdn: "01711112222",
      trxId: "TRX_STALE_1",
      method: "bkash",
      status: "completed",
    });
    db.logSms({
      recipientPhone: "01711112222",
      studentName: "Stale Student",
      rollNumber: "2026-101",
      quizTitle: "Old Quiz",
      score: 1000,
      rank: 1,
      messageText: "Stale SMS",
      status: "delivered",
    });
    ls.setItem("onnesha_db_sales_leads", JSON.stringify([{ id: "lead-old", name: "Old Lead" }]));
    ls.setItem("onnesha_db_exam_sessions", JSON.stringify([{ id: "sess-old", pin: "111222" }]));
    ls.setItem("onnesha_db_courses", JSON.stringify([{ id: "course-old" }]));
    ls.setItem("onnesha_db_regions", JSON.stringify([{ id: "reg-old" }]));
    ls.setItem("onnesha_db_revoked_certificates", JSON.stringify(["ONN-OLD-101"]));

    expect(db.getTransactions().length).toBeGreaterThan(0);
    expect(db.getSmsLogs().length).toBeGreaterThan(0);

    // Server returns empty arrays (e.g. unauthenticated client or purged store)
    serverGetBootstrapData.mockResolvedValueOnce({
      success: true,
      regions: [],
      roster: [],
      courses: [],
      users: [],
      customQuizzes: [],
      examSessions: [],
      examResults: [],
      certificates: [],
      revokedCertificates: [],
      transactions: [],
      salesLeads: [],
      smsLogs: [],
    });

    await db.syncFromServerStore();

    expect(db.getTransactions()).toEqual([]);
    expect(db.getSmsLogs()).toEqual([]);
    expect(db.getExamSessions()).toEqual([]);
    expect(db.getCourses()).toEqual([]);
    expect(db.getRegions()).toEqual([]);
    expect(db.getRevokedCertificates()).toEqual([]);

    expect(ls.getItem("onnesha_db_transactions")).toBe("[]");
    expect(ls.getItem("onnesha_db_sales_leads")).toBe("[]");
    expect(ls.getItem("onnesha_db_sms_logs")).toBe("[]");
    expect(ls.getItem("onnesha_db_exam_sessions")).toBe("[]");
    expect(ls.getItem("onnesha_db_courses")).toBe("[]");
    expect(ls.getItem("onnesha_db_regions")).toBe("[]");
    expect(ls.getItem("onnesha_db_revoked_certificates")).toBe("[]");
  });

  it("restores revoked certificates through admin mutation and resyncs store", async () => {
    const ls = installMockWindowStorage();
    const { sqliteEngine } = await import("../db/sqlite-engine");
    const { db } = await import("../db");

    await sqliteEngine.init();
    ls.setItem(
      "onnesha_db_revoked_certificates",
      JSON.stringify(["ONN-4455-0101", "ONN-9999-0202"]),
    );

    serverAdminMutateStore.mockResolvedValueOnce({ success: true });
    serverGetBootstrapData.mockResolvedValueOnce({
      success: true,
      revokedCertificates: ["ONN-9999-0202"],
    });

    const restored = await db.restoreCertificate("onn-4455-0101");
    expect(restored).toBe(true);
    expect(serverAdminMutateStore).toHaveBeenCalledWith({
      data: { action: "restore_certificate", certificateNumber: "ONN-4455-0101" },
    });
    expect(db.getRevokedCertificates()).toEqual(["ONN-9999-0202"]);
  });

  it("blocks revoked certificates in getCertificateById even if a stale SQLite row exists", async () => {
    const ls = installMockWindowStorage();
    const { sqliteEngine } = await import("../db/sqlite-engine");
    const { db } = await import("../db");

    await sqliteEngine.init();
    sqliteEngine.run(
      "INSERT OR REPLACE INTO certificates (id, certificateNumber, studentName, studentRoll, regionName, quizTitle, score, totalPoints, rank, totalParticipants, accuracyPercent, issueDate, organizationName, instructorName, verificationUrl, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "cert-stale-1",
        "ONN-7788-0101",
        "Stale Candidate",
        "2026-101",
        "Dhaka Range",
        "Mock Test",
        1000,
        1000,
        1,
        1,
        100,
        "2026-11-17",
        "Onnesha",
        "Instructor",
        "/verify/ONN-7788-0101",
        1,
      ],
    );
    ls.setItem("onnesha_db_revoked_certificates", JSON.stringify(["ONN-7788-0101"]));

    expect(db.getCertificateById("ONN-7788-0101")).toBeUndefined();
    expect(db.getCertificateById("onn-7788-0101")).toBeUndefined();
  });

  it("syncs user aiCredits and keeps roster empty when purgedSampleData is true", async () => {
    installMockWindowStorage();
    const { sqliteEngine } = await import("../db/sqlite-engine");
    const { db } = await import("../db");

    await sqliteEngine.init();
    serverGetBootstrapData.mockResolvedValueOnce({
      success: true,
      regions: [
        {
          id: "reg-custom",
          code: "CUS",
          nameEn: "Custom",
          nameBn: "কাস্টম",
          createdAt: "2026-11-17",
        },
      ],
      roster: [],
      courses: [],
      users: [
        {
          id: "usr-instructor-1",
          email: "instructor@onnesha.app",
          name: "Chief Instructor",
          role: "instructor",
          aiCredits: 37,
          createdAt: "2026-11-17",
        },
      ],
      customQuizzes: [],
      deletedQuizIds: [],
      deletedRegionIds: ["reg-dhaka"],
      deletedCourseIds: ["course-bcs-foundation"],
      purgedSampleData: true,
      examSessions: [],
      examResults: [],
      certificates: [],
      revokedCertificates: [],
      transactions: [],
      salesLeads: [],
      smsLogs: [],
    });

    await db.syncFromServerStore();

    expect(db.getRoster()).toEqual([]);
    const users = db.getUsers();
    expect(users[0]?.aiCredits).toBe(37);
  });
});

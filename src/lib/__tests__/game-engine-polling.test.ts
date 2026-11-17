import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression tests for "candidates joined but never saw the questions" (Exam 2 incident).
// The player feed relies 100% on delta polling for remote examinees, so these lock in that
// the polling loop survives across exams, slow networks and client clock skew.

import type { GameEvent } from "../game-engine";
import type { GameSession } from "../types";

const serverGetSession = vi.fn();
const serverHostControl = vi.fn(
  async (_arg?: {
    data?: { pin?: string; action?: string };
  }): Promise<{
    success: boolean;
    session?: GameSession | null;
    closed?: boolean;
    serverNow?: number;
  }> => ({
    success: false,
  }),
);
const serverSubmitAnswer = vi.fn();
const serverSyncSession = vi.fn(async () => ({ success: true }));

vi.mock("../server-session", () => ({
  serverCreateSession: vi.fn(),
  serverGetSession: (...args: unknown[]) => serverGetSession(...args),
  serverHostControl: (arg?: { data?: { pin?: string; action?: string } }) => serverHostControl(arg),
  serverJoinSession: vi.fn(),
  serverReportProctorIncident: vi.fn(),
  serverSubmitAnswer: (...args: unknown[]) => serverSubmitAnswer(...(args as [])),
  serverSyncSession: (...args: unknown[]) => serverSyncSession(...(args as [])),
}));

vi.mock("../db", () => ({
  db: {
    getRegions: () => [],
    getQuizzes: () => [],
    getQuizBySlug: () => undefined,
    recordExamSession: vi.fn(),
    syncFromServerStore: vi.fn(),
  },
}));

vi.mock("../mock-data", () => ({ DEFAULT_REGIONS: [], READY_MADE_PACKS: [] }));

function installBrowserStubs() {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g["window"] = { addEventListener: () => {} };
  g["document"] = { addEventListener: () => {}, visibilityState: "visible" };
  g["localStorage"] = storage;
  g["sessionStorage"] = storage;
}

function makeSession(
  pin: string,
  updatedAt: number,
  phase: GameSession["phase"] = "lobby",
  extra: Partial<GameSession> = {},
): GameSession {
  return {
    pin,
    quizId: "quiz-1",
    quizTitleEn: "Quiz",
    quizTitleBn: "Quiz",
    hostId: "host",
    phase,
    currentQuestionIndex: 0,
    questionStartTime: 0,
    questionEndTime: 0,
    settings: {
      timePerQuestion: 20,
      speedBonus: true,
      negativeMarking: 0,
      shuffleQuestions: false,
      shuffleOptions: false,
      soundEnabled: true,
      musicEnabled: false,
      isFormalAssessment: true,
      requireRollNumber: false,
    },
    participants: {},
    totalQuestions: 20,
    createdAt: 1,
    updatedAt,
    ...extra,
  };
}

async function loadEngine() {
  vi.resetModules();
  installBrowserStubs();
  const mod = await import("../game-engine");
  return mod.gameEngine;
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe("player delta polling resilience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    serverGetSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not leak Exam 1's delta watermark into Exam 2 (different PIN)", async () => {
    const engine = await loadEngine();
    // Exam 1 finished late → large server timestamp cached
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("111111", 9_000),
    });
    await engine.getSessionAsync("111111", "player");
    expect(engine.getLastKnownUpdatedAt("111111")).toBe(9_000);

    // Exam 2 room was created earlier (older updatedAt) — must still be fetched in full
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("222222", 5_000),
    });
    await engine.getSessionAsync("222222", "player");
    expect(engine.getLastKnownUpdatedAt("222222")).toBe(5_000);

    serverGetSession.mockResolvedValue({ success: true, unchanged: true, session: null });
    await vi.advanceTimersByTimeAsync(1600);
    const pollArgs = serverGetSession.mock.calls.at(-1)![0].data;
    expect(pollArgs.pin).toBe("222222");
    expect(pollArgs.sinceUpdatedAt).toBe(5_000);
    engine.stopPolling();
  });

  it("drops out-of-order (older) server snapshots so the question never reverts to lobby", async () => {
    const engine = await loadEngine();
    const seen: string[] = [];
    engine.subscribe((e) => {
      if (e.type === "SESSION_UPDATED") seen.push(e.session.phase);
    });

    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("333333", 2_000, "question", {
        currentQuestion: {
          id: "q1",
          textEn: "Q1",
          textBn: "Q1",
          type: "single_mcq",
          timeLimitSec: 20,
          points: 1000,
          options: [],
          correctOptionIds: [],
        },
      }),
    });
    await engine.getSessionAsync("333333", "player");

    // A slow, older "lobby" reply arrives afterwards
    serverGetSession.mockResolvedValueOnce({
      success: true,
      unchanged: false,
      session: makeSession("333333", 1_000, "lobby"),
    });
    await vi.advanceTimersByTimeAsync(1600);

    expect(seen).toEqual(["question"]);
    expect(engine.getSession("333333")?.phase).toBe("question");
    engine.stopPolling();
  });

  it("never stacks overlapping poll requests on slow networks, but recovers from a hung request", async () => {
    const engine = await loadEngine();
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("444444", 1_000),
    });
    await engine.getSessionAsync("444444", "player");
    serverGetSession.mockClear();

    // First poll hangs forever
    serverGetSession.mockImplementationOnce(() => new Promise(() => {}));
    serverGetSession.mockResolvedValue({ success: true, unchanged: true, session: null });

    await vi.advanceTimersByTimeAsync(6_000);
    expect(serverGetSession).toHaveBeenCalledTimes(1);

    // After the 8s abandonment window, polling resumes
    await vi.advanceTimersByTimeAsync(6_000);
    expect(serverGetSession.mock.calls.length).toBeGreaterThan(1);
    engine.stopPolling();
  });

  it("does not let a locally-stamped (client clock) snapshot suppress server updates", async () => {
    const engine = await loadEngine();
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("555555", 1_000),
    });
    const s = await engine.getSessionAsync("555555", "host");
    // Host device clock far in the future
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
    engine.saveSession({ ...s! });
    expect(engine.getLastKnownUpdatedAt("555555")).toBe(1_000);
    engine.stopPolling();
  });

  it("periodically performs a full (non-delta) resync as a safety net", async () => {
    const engine = await loadEngine();
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("666666", 1_000),
    });
    await engine.getSessionAsync("666666", "player");
    serverGetSession.mockClear();
    serverGetSession.mockResolvedValue({ success: true, unchanged: true, session: null });

    await vi.advanceTimersByTimeAsync(1_500 * 12 + 100);
    const fullResyncs = serverGetSession.mock.calls.filter(
      (c) => c[0].data.sinceUpdatedAt === undefined,
    );
    expect(fullResyncs.length).toBeGreaterThanOrEqual(1);
    engine.stopPolling();
  });

  it("stopPolling clears the active room even if no timer was running", async () => {
    const engine = await loadEngine();
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("777777", 1_000),
    });
    await engine.getSessionAsync("777777", "player");
    expect(engine.isPolling("777777")).toBe(true);
    engine.stopPolling();
    expect(engine.isPolling()).toBe(false);
    await flush();
  });
});

describe("live engine timing, offline recovery & token security", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    serverGetSession.mockReset();
    serverHostControl.mockReset();
    serverHostControl.mockResolvedValue({ success: false });
    serverSubmitAnswer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes hostToken for host session fetches and polling ticks", async () => {
    const engine = await loadEngine();
    engine.saveStoredHostToken("888888", "host-secret-888");
    serverGetSession.mockResolvedValueOnce({
      success: true,
      serverNow: Date.now() + 12_000,
      session: makeSession("888888", 2_000, "lobby"),
    });

    await engine.resumeHostSessionAsync("888888");
    expect(serverGetSession.mock.calls[0]?.[0]?.data?.hostToken).toBe("host-secret-888");

    // Server clock offset is synchronized from serverNow
    expect(engine.getServerNow() - Date.now()).toBeGreaterThanOrEqual(11_000);

    serverGetSession.mockResolvedValueOnce({
      success: true,
      unchanged: true,
      serverNow: Date.now() + 12_000,
      session: null,
    });
    await vi.advanceTimersByTimeAsync(900);
    expect(serverGetSession.mock.calls.at(-1)?.[0]?.data?.hostToken).toBe("host-secret-888");
    engine.stopPolling();
  });

  it("cancels pending startGame 3s countdown timer when host advances or stops early", async () => {
    const engine = await loadEngine();
    localStorage.setItem(
      "onnesha_session_909090",
      JSON.stringify(makeSession("909090", 1_000, "lobby")),
    );
    serverHostControl.mockResolvedValue({
      success: true,
      session: makeSession("909090", 2_000, "countdown"),
    });

    engine.startGame("909090");
    await flush();
    expect(serverHostControl).toHaveBeenCalledWith({
      data: expect.objectContaining({ pin: "909090", action: "start_game" }),
    });

    serverHostControl.mockClear();
    serverHostControl.mockResolvedValue({
      success: true,
      session: makeSession("909090", 3_000, "podium"),
    });

    engine.endGame("909090");
    await flush();

    await vi.advanceTimersByTimeAsync(3_500);
    // Delayed startGame next_question(0) must NOT fire after endGame/stopPolling
    expect(serverHostControl).toHaveBeenCalledTimes(1);
    expect(serverHostControl.mock.calls[0]?.[0]?.data?.action).toBe("end_game");
  });

  it("queues transient { success: false } answer failures and drops permanent rejections", async () => {
    const engine = await loadEngine();

    // Transient server error without permanent rejection code must remain queued for retry
    serverSubmitAnswer.mockResolvedValueOnce({ success: false, error: "Temporary busy" });
    engine.submitAnswer("123456", "p1", "q1", ["o1"]);
    await flush();
    expect(JSON.parse(localStorage.getItem("onnesha_offline_outbox") || "[]")).toHaveLength(1);

    // Next flush succeeds and clears queue
    serverSubmitAnswer.mockResolvedValueOnce({
      success: true,
      session: makeSession("123456", 5_000, "question"),
    });
    await engine.flushOfflineOutbox();
    expect(JSON.parse(localStorage.getItem("onnesha_offline_outbox") || "[]")).toHaveLength(0);

    // Permanent rejection (e.g., SUSPENDED) must NOT remain stuck in infinite retry loop
    serverSubmitAnswer.mockResolvedValueOnce({
      success: false,
      code: "SUSPENDED",
      error: "Exam suspended",
    });
    engine.submitAnswer("123456", "p1", "q2", ["o2"]);
    await flush();
    expect(JSON.parse(localStorage.getItem("onnesha_offline_outbox") || "[]")).toHaveLength(0);
  });

  it("closeRoomAsync removes onnesha_session_<pin> and stops polling", async () => {
    const engine = await loadEngine();
    localStorage.setItem(
      "onnesha_session_654321",
      JSON.stringify(makeSession("654321", 1_000, "lobby")),
    );
    serverGetSession.mockResolvedValueOnce({
      success: true,
      session: makeSession("654321", 1_000, "lobby"),
    });
    await engine.getSessionAsync("654321", "host");
    expect(engine.isPolling("654321")).toBe(true);

    serverHostControl.mockResolvedValueOnce({ success: true, closed: true, session: null });
    const ok = await engine.closeRoomAsync("654321");
    expect(ok).toBe(true);
    expect(engine.isPolling("654321")).toBe(false);
    expect(localStorage.getItem("onnesha_session_654321")).toBeNull();
  });

  it("clears stale local room and never resurrects closed sessions on notFound", async () => {
    const engine = await loadEngine();
    localStorage.setItem(
      "onnesha_session_777888",
      JSON.stringify(makeSession("777888", 1_000, "lobby")),
    );

    serverGetSession.mockResolvedValueOnce({
      success: false,
      notFound: true,
      error: "Session not found",
    });
    expect(await engine.getSessionAsync("777888", "player")).toBeNull();
    expect(localStorage.getItem("onnesha_session_777888")).toBeNull();

    // Same for host resume when room was purged on server
    localStorage.setItem(
      "onnesha_session_777889",
      JSON.stringify(makeSession("777889", 1_000, "lobby")),
    );
    serverGetSession.mockResolvedValueOnce({
      success: false,
      notFound: true,
      error: "Session not found",
    });
    expect(await engine.resumeHostSessionAsync("777889")).toBeNull();
    expect(localStorage.getItem("onnesha_session_777889")).toBeNull();
  });

  it("clears ejected seat on seatRemoved and emits SESSION_ENDED during polling", async () => {
    const engine = await loadEngine();
    const events: GameEvent[] = [];
    const unsub = engine.subscribe((e) => events.push(e));

    localStorage.setItem("onnesha_seat_pid_334455", "kicked-pid");
    localStorage.setItem("onnesha_seat_token_334455", "kicked-tok");
    // 1) Initial getSessionAsync returns seatRemoved -> clears seat and re-fetches lobby cleanly
    serverGetSession
      .mockResolvedValueOnce({
        success: false,
        seatRemoved: true,
        error: "Seat removed",
      })
      .mockResolvedValueOnce({
        success: true,
        session: makeSession("334455", 2_000, "lobby"),
      });

    const recoveredLobby = await engine.getSessionAsync("334455", "player", "kicked-pid");
    expect(recoveredLobby?.phase).toBe("lobby");
    expect(localStorage.getItem("onnesha_seat_pid_334455")).toBeNull();
    expect(localStorage.getItem("onnesha_seat_token_334455")).toBeNull();

    // 2) Active polling later receives seatRemoved -> stops polling and emits SESSION_ENDED
    localStorage.setItem("onnesha_seat_pid_334455", "new-pid");
    localStorage.setItem("onnesha_seat_token_334455", "new-tok");
    engine.startPolling("334455", "player", "new-pid");
    serverGetSession.mockResolvedValueOnce({
      success: false,
      seatRemoved: true,
      error: "Seat removed by host",
    });
    await vi.advanceTimersByTimeAsync(1_600);
    await flush();

    expect(engine.isPolling("334455")).toBe(false);
    expect(localStorage.getItem("onnesha_seat_pid_334455")).toBeNull();
    expect(localStorage.getItem("onnesha_seat_token_334455")).toBeNull();
    expect(events).toContainEqual({
      type: "SESSION_ENDED",
      pin: "334455",
      reason: "seat_removed",
    });

    // 3) Active polling receives notFound -> emits SESSION_ENDED(not_found) and clears session cache
    localStorage.setItem(
      "onnesha_session_334455",
      JSON.stringify(makeSession("334455", 3_000, "lobby")),
    );
    engine.startPolling("334455", "player");
    serverGetSession.mockResolvedValueOnce({
      success: false,
      notFound: true,
      error: "Session ended",
    });
    await vi.advanceTimersByTimeAsync(1_600);
    await flush();

    expect(engine.isPolling("334455")).toBe(false);
    expect(localStorage.getItem("onnesha_session_334455")).toBeNull();
    expect(events).toContainEqual({
      type: "SESSION_ENDED",
      pin: "334455",
      reason: "not_found",
    });
    unsub();
  });
});

describe("host pause/resume & QUESTION_CLOSED outbox handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    serverHostControl.mockReset();
    serverSubmitAnswer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("syncs pause/resume via serverHostControl and falls back cleanly offline", async () => {
    const engine = await loadEngine();
    vi.setSystemTime(100_000);

    const pausedSession = makeSession("991122", 100_000, "question", {
      questionStartTime: 90_000,
      questionEndTime: 120_000,
      pausedAt: 100_000,
    });
    serverHostControl.mockResolvedValueOnce({
      success: true,
      serverNow: 100_000,
      session: pausedSession,
    });

    engine.pauseGame("991122");
    await flush();

    expect(serverHostControl).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pin: "991122", action: "pause_game" }),
      }),
    );
    expect(engine.getSession("991122")?.pausedAt).toBe(100_000);

    // Offline fallback on pauseGame & resumeGame shifts deadline cleanly
    vi.setSystemTime(105_000);
    serverHostControl.mockRejectedValueOnce(new Error("offline"));
    engine.resumeGame("991122");
    await flush();

    const resumedLocal = engine.getSession("991122");
    expect(resumedLocal?.pausedAt).toBeUndefined();
    expect(resumedLocal?.questionStartTime).toBe(95_000);
    expect(resumedLocal?.questionEndTime).toBe(125_000);

    serverHostControl.mockRejectedValueOnce(new Error("offline"));
    engine.pauseGame("991122");
    await flush();
    expect(engine.getSession("991122")?.pausedAt).toBe(105_000);
  });

  it("drops QUESTION_CLOSED rejections instead of keeping them in the offline outbox", async () => {
    const engine = await loadEngine();

    // 1. Live submitAnswer with QUESTION_CLOSED must not enqueue into outbox
    serverSubmitAnswer.mockResolvedValueOnce({
      success: false,
      code: "QUESTION_CLOSED",
      error: "Answer window has closed for this question.",
    });

    engine.submitAnswer("556677", "p-1", "q-1", ["opt-a"]);
    await flush();
    expect(engine.getOfflineOutbox()).toHaveLength(0);

    // 2. Previously queued answer hitting QUESTION_CLOSED during flush must be discarded
    serverSubmitAnswer.mockRejectedValueOnce(new Error("temporary drop"));
    engine.submitAnswer("556677", "p-1", "q-2", ["opt-b"]);
    await flush();
    expect(engine.getOfflineOutbox()).toHaveLength(1);

    serverSubmitAnswer.mockResolvedValueOnce({
      success: false,
      code: "QUESTION_CLOSED",
      error: "Closed",
    });
    await engine.flushOfflineOutbox();
    expect(engine.getOfflineOutbox()).toHaveLength(0);
  });

  it("purges stale local session keys and orphaned participant tokens after TTL", async () => {
    const engine = await loadEngine();
    const oldStamp = Date.now() - 30 * 60 * 60 * 1000;
    const freshStamp = Date.now() - 60_000;

    localStorage.setItem(
      "onnesha_session_111111",
      JSON.stringify(makeSession("111111", oldStamp, "lobby", { createdAt: oldStamp })),
    );
    localStorage.setItem("onnesha_pid_111111", "old-pid");
    localStorage.setItem(
      "onnesha_session_222222",
      JSON.stringify(makeSession("222222", freshStamp, "lobby", { createdAt: freshStamp })),
    );
    localStorage.setItem("onnesha_pid_222222", "fresh-pid");
    localStorage.setItem("onnesha_seat_token_999999", "orphan-tok");

    const removed = engine.cleanupStaleLocalSessions();
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem("onnesha_session_111111")).toBeNull();
    expect(localStorage.getItem("onnesha_pid_111111")).toBeNull();
    expect(localStorage.getItem("onnesha_seat_token_999999")).toBeNull();
    expect(localStorage.getItem("onnesha_session_222222")).not.toBeNull();
    expect(localStorage.getItem("onnesha_pid_222222")).toBe("fresh-pid");
  });
});

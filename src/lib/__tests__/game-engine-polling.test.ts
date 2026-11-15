import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression tests for "candidates joined but never saw the questions" (Exam 2 incident).
// The player feed relies 100% on delta polling for remote examinees, so these lock in that
// the polling loop survives across exams, slow networks and client clock skew.

const serverGetSession = vi.fn();
const serverHostControl = vi.fn(async (..._args: any[]): Promise<any> => ({ success: false }));
const serverSubmitAnswer = vi.fn();
const serverSyncSession = vi.fn(async () => ({ success: true }));

vi.mock("../server-session", () => ({
  serverCreateSession: vi.fn(),
  serverGetSession: (...args: unknown[]) => serverGetSession(...args),
  serverHostControl: (...args: unknown[]) => serverHostControl(...(args as [])),
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
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  const g = globalThis as any;
  g.window = { addEventListener: () => {} };
  g.document = { addEventListener: () => {}, visibilityState: "visible" };
  g.localStorage = storage;
  g.sessionStorage = storage;
}

function makeSession(pin: string, updatedAt: number, phase = "lobby", extra: any = {}) {
  return {
    pin,
    quizId: "quiz-1",
    quizTitleEn: "Quiz",
    quizTitleBn: "Quiz",
    hostId: "host",
    phase,
    currentQuestionIndex: 0,
    settings: {},
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
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("111111", 9_000) });
    await engine.getSessionAsync("111111", "player");
    expect(engine.getLastKnownUpdatedAt("111111")).toBe(9_000);

    // Exam 2 room was created earlier (older updatedAt) — must still be fetched in full
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("222222", 5_000) });
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
      session: makeSession("333333", 2_000, "question", { currentQuestion: { id: "q1" } }),
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
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("444444", 1_000) });
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
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("555555", 1_000) });
    const s = await engine.getSessionAsync("555555", "host");
    // Host device clock far in the future
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
    engine.saveSession({ ...(s as any) });
    expect(engine.getLastKnownUpdatedAt("555555")).toBe(1_000);
    engine.stopPolling();
  });

  it("periodically performs a full (non-delta) resync as a safety net", async () => {
    const engine = await loadEngine();
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("666666", 1_000) });
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
    serverGetSession.mockResolvedValueOnce({ success: true, session: makeSession("777777", 1_000) });
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
});

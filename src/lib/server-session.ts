import { createServerFn } from "@tanstack/react-start";
import {
  BrandingSettings,
  CertificateData,
  Course,
  ExamResultRecord,
  ExamSessionRecord,
  GameSession,
  GameSettings,
  LedgerOtsCheckpoint,
  ManagedUser,
  Participant,
  ParticipantAnswer,
  ProctorIncidentRecord,
  Question,
  QuestionType,
  Quiz,
  Region,
  RosterStudent,
} from "./types";
import {
  DEFAULT_COURSES,
  DEFAULT_REGIONS,
  DEFAULT_USERS,
  READY_MADE_PACKS,
  SAMPLE_ROSTER,
} from "./mock-data";
import {
  canActorMutateStoreAction,
  generateHostToken,
  getCertificateSigningKeys,
  getServerSessionSecret,
  hashPasswordScrypt,
  sanitizeUserForClient,
  sealCertificateWithLedger,
  signSessionToken,
  verifyCertificateCryptographically,
  verifyPasswordScrypt,
  verifySessionToken,
} from "./server-security";
import { computeTotalQuizMarks, evaluateQuestionAnswer, resolveOrgName } from "./scoring";
import {
  anchorCertificateToRekor,
  anchorDigestToOpenTimestamps,
  buildDidDocument,
  buildW3CVerifiableCredential,
  ed25519PemToMultibase,
  getRekorAnchorKeys,
  hostToDidWeb,
} from "./transparency-anchor";

// ============================================================================
// SERVER-AUTHORITATIVE PERSISTENT STORE (Render Persistent Disk / Node FS)
// ============================================================================

export interface ServerTransactionRecord {
  id: string;
  planId: string;
  amount: number;
  msisdn: string;
  trxId: string;
  method: "bkash" | "nagad" | "card" | string;
  status: string;
  userId?: string | undefined;
  createdAt: string;
}

export interface ServerSmsLogRecord {
  id: string;
  recipientPhone: string;
  studentName: string;
  rollNumber: string;
  quizTitle: string;
  score: number;
  rank: number;
  messageText: string;
  status: "delivered" | "queued" | "failed";
  createdAt: string;
}

export interface ServerSalesLeadRecord {
  id: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  studentCount: string;
  message: string;
  status: string;
  createdAt: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  showPartnerLogo: false,
  partnerName: "",
  partnerLogoUrl: "",
  institutionTitle: "Onnesha Assessment Arena",
  defaultEnforceFullscreen: false,
  defaultBlockCopyPaste: true,
  defaultMaxProctorViolations: 3,
};

interface PersistentStoreData {
  regions: Region[];
  roster: RosterStudent[];
  courses: Course[];
  users: ManagedUser[];
  customQuizzes: Quiz[];
  examSessions: ExamSessionRecord[];
  examResults: ExamResultRecord[];
  certificates: CertificateData[];
  ledgerCheckpoints: LedgerOtsCheckpoint[];
  transactions: ServerTransactionRecord[];
  smsLogs: ServerSmsLogRecord[];
  salesLeads: ServerSalesLeadRecord[];
  branding: BrandingSettings;
  updatedAt: number;
}

type ServerLiveSession = GameSession & {
  updatedAt: number;
  countdownStartedAt?: number | undefined;
  hostToken?: string | undefined;
  fullQuiz?: Quiz | undefined;
  cachedTop5?: Participant[] | undefined;
  cachedSanitizedQuestion?: Question | undefined;
};

interface PendingPhoneOtp {
  code: string;
  expiresAt: number;
  attempts: number;
}

function getNodeFs(): typeof import("node:fs") | null {
  try {
    const proc = globalThis.process as unknown as {
      getBuiltinModule?: (id: string) => typeof import("node:fs");
    };
    return proc?.getBuiltinModule ? proc.getBuiltinModule("node:fs") : null;
  } catch {
    return null;
  }
}

function getStorePaths(): { dataDir: string; storeFile: string; liveFile: string } {
  const cwd =
    typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
  const dataDir = (typeof process !== "undefined" && process.env?.["DATA_DIR"]) || `${cwd}/.data`;
  const normalizedDir = dataDir.replace(/[\\/]+$/, "");
  return {
    dataDir: normalizedDir,
    storeFile: `${normalizedDir}/onnesha-store.json`,
    liveFile: `${normalizedDir}/live-sessions.json`,
  };
}

// Global singleton in Node process so hot-reloads and concurrent requests share memory
const globalStore = globalThis as unknown as {
  __onneshaStore?: PersistentStoreData;
  __onneshaLiveSessions?: Record<string, ServerLiveSession>;
  __onneshaSaveTimer?: ReturnType<typeof setTimeout> | null;
  __onneshaLiveSaveTimer?: ReturnType<typeof setTimeout> | null;
  __onneshaPhoneOtps?: Record<string, PendingPhoneOtp>;
};

const AUTH_COOKIE_NAME = "onnesha_sid";

async function getServerHelpers() {
  return await import("@tanstack/react-start/server");
}

async function getActorFromRequest(): Promise<ManagedUser | null> {
  try {
    const { getCookie } = await getServerHelpers();
    const token = getCookie(AUTH_COOKIE_NAME);
    if (!token) return null;
    const { dataDir } = getStorePaths();
    const secret = getServerSessionSecret(dataDir);
    const verified = verifySessionToken(token, secret);
    if (!verified) return null;
    const store = getStore();
    const user = store.users.find((u) => u.id === verified.uid);
    if (!user || user.status === "suspended") return null;
    return user;
  } catch {
    return null;
  }
}

async function setAuthCookieForUser(user: ManagedUser): Promise<void> {
  try {
    const { setCookie } = await getServerHelpers();
    const { dataDir } = getStorePaths();
    const secret = getServerSessionSecret(dataDir);
    const token = signSessionToken(
      {
        uid: user.id,
        role: user.role,
        exp: Date.now() + 7 * 24 * 3600 * 1000,
      },
      secret,
    );
    setCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
      secure: typeof process !== "undefined" && process.env["NODE_ENV"] === "production",
    });
  } catch {
    // Ignore outside HTTP request context (e.g., unit tests)
  }
}

async function clearAuthCookie(): Promise<void> {
  try {
    const { deleteCookie } = await getServerHelpers();
    deleteCookie(AUTH_COOKIE_NAME, { path: "/" });
  } catch {
    // Ignore outside HTTP request context
  }
}

function ensureDefaultUsers(existing?: ManagedUser[]): ManagedUser[] {
  const list = (existing?.length ? [...existing] : []).map((u) => {
    if (u.passwordHash && !u.passwordHash.startsWith("scrypt:")) {
      return { ...u, passwordHash: hashPasswordScrypt(u.passwordHash) };
    }
    return u;
  });
  for (const def of DEFAULT_USERS) {
    if (!list.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
      const hashed = def.passwordHash ? hashPasswordScrypt(def.passwordHash) : undefined;
      list.push({
        ...def,
        passwordHash: hashed,
      });
    }
  }
  return list;
}

function loadInitialStore(): PersistentStoreData {
  try {
    const fs = getNodeFs();
    const { dataDir, storeFile } = getStorePaths();
    if (fs) {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (fs.existsSync(storeFile)) {
        const raw = fs.readFileSync(storeFile, "utf-8");
        const parsed = JSON.parse(raw) as Partial<PersistentStoreData>;
        const cleanedRoster = (parsed.roster || []).filter(
          (s) => !(/^st-([1-9]|10)$/.test(s.id) && s.email?.endsWith("@academy.edu.bd")),
        );
        const cleanedResults = (parsed.examResults || []).filter(
          (r) => !(r.participantId || "").startsWith("bot-"),
        );
        return {
          regions: parsed.regions?.length ? parsed.regions : [...DEFAULT_REGIONS],
          roster: cleanedRoster,
          courses: parsed.courses?.length ? parsed.courses : [...DEFAULT_COURSES],
          users: ensureDefaultUsers(parsed.users),
          customQuizzes: parsed.customQuizzes || [],
          examSessions: parsed.examSessions || [],
          examResults: cleanedResults,
          certificates: parsed.certificates || [],
          ledgerCheckpoints: parsed.ledgerCheckpoints || [],
          transactions: parsed.transactions || [],
          smsLogs: parsed.smsLogs || [],
          salesLeads: parsed.salesLeads || [],
          branding: parsed.branding
            ? { ...DEFAULT_BRANDING, ...parsed.branding }
            : { ...DEFAULT_BRANDING },
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn("[OnneshaServerStore] Initializing fresh store in memory:", err);
  }

  return {
    regions: [...DEFAULT_REGIONS],
    roster: [...SAMPLE_ROSTER],
    courses: [...DEFAULT_COURSES],
    users: ensureDefaultUsers([]),
    customQuizzes: [],
    examSessions: [],
    examResults: [],
    certificates: [],
    ledgerCheckpoints: [],
    transactions: [],
    smsLogs: [],
    salesLeads: [],
    branding: { ...DEFAULT_BRANDING },
    updatedAt: Date.now(),
  };
}

function getStore(): PersistentStoreData {
  if (!globalStore.__onneshaStore) {
    globalStore.__onneshaStore = loadInitialStore();
  }
  return globalStore.__onneshaStore;
}

function getLiveSessions(): Record<string, ServerLiveSession> {
  if (!globalStore.__onneshaLiveSessions) {
    globalStore.__onneshaLiveSessions = {};
    try {
      const fs = getNodeFs();
      const { liveFile } = getStorePaths();
      if (fs && fs.existsSync(liveFile)) {
        const raw = fs.readFileSync(liveFile, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, ServerLiveSession>;
        const cutoff = Date.now() - 12 * 3600 * 1000;
        for (const [pin, sess] of Object.entries(parsed)) {
          if (sess && sess.updatedAt >= cutoff) {
            globalStore.__onneshaLiveSessions[pin] = sess;
          }
        }
      }
    } catch {
      // ignore corrupted live session snapshot
    }
  }
  return globalStore.__onneshaLiveSessions;
}

function scheduleLiveSessionsPersist() {
  if (globalStore.__onneshaLiveSaveTimer) return;
  globalStore.__onneshaLiveSaveTimer = setTimeout(async () => {
    globalStore.__onneshaLiveSaveTimer = null;
    try {
      const fs = getNodeFs();
      if (!fs) return;
      const { dataDir, liveFile } = getStorePaths();
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
      const sessions = getLiveSessions();
      const tmp = `${liveFile}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(sessions), "utf-8");
      await fs.promises.rename(tmp, liveFile);
    } catch {
      // silent background save guard
    }
  }, 600);
}

// Debounced non-blocking atomic disk write (handles 500+ req/sec without I/O contention)
function scheduleDiskPersist() {
  const store = getStore();
  store.updatedAt = Date.now();
  if (globalStore.__onneshaSaveTimer) return;

  globalStore.__onneshaSaveTimer = setTimeout(async () => {
    globalStore.__onneshaSaveTimer = null;
    try {
      const fs = getNodeFs();
      if (!fs) return;
      const { dataDir, storeFile } = getStorePaths();
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
      const tmpFile = `${storeFile}.tmp`;
      await fs.promises.writeFile(tmpFile, JSON.stringify(store), "utf-8");
      await fs.promises.rename(tmpFile, storeFile);
    } catch (err) {
      console.warn("[OnneshaServerStore] Disk persist warning:", err);
    }
  }, 350);
}

function toHostSessionView(session: ServerLiveSession): GameSession {
  const {
    fullQuiz: _q,
    hostToken: _t,
    cachedTop5: _top5,
    cachedSanitizedQuestion: _sq,
    ...hostView
  } = session;
  return hostView;
}

function normalizeDigits(val?: string): string {
  return (val || "").replace(/\D/g, "");
}

function normalizeCode(val?: string): string {
  return (val || "").trim().toLowerCase();
}

function makeCertificateNumber(pin: string, rollNumber?: string, fallbackIdx = 1): string {
  const cleanRoll = (rollNumber || `${100 + fallbackIdx}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-6)
    .padStart(4, "0");
  return `ONN-${pin.slice(0, 4)}-${cleanRoll}`;
}

function recalculateSessionMetrics(session: ServerLiveSession) {
  const list = Object.values(session.participants);
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lastActive - b.lastActive;
  });
  list.forEach((p, idx) => {
    const entry = session.participants[p.id];
    if (entry) entry.rank = idx + 1;
  });
  session.participantCount = list.length;
  const currentQId = session.currentQuestion?.id;
  session.answeredCount = currentQId ? list.filter((p) => !!p.answers[currentQId]).length : 0;
  session.cachedTop5 = list.slice(0, 5).map((p) => {
    const { seatToken: _s, answers: _a, ...rest } = p;
    return {
      ...rest,
      answers: {},
    };
  });
  session.cachedSanitizedQuestion = sanitizeQuestionForPlayer(
    session.currentQuestion,
    session.phase,
  );
  session.updatedAt = Date.now();
}

function sanitizeQuestionForPlayer(
  q?: Question,
  phase?: GameSession["phase"],
): Question | undefined {
  if (!q) return undefined;
  // Only reveal correct answers after the active question timer closes
  const canRevealAnswers =
    phase === "chart" || phase === "leaderboard" || phase === "podium" || phase === "finished";
  if (canRevealAnswers) return q;

  return {
    ...q,
    correctOptionIds: [],
    acceptedAnswers: [],
    options: q.options.map((o) => ({
      id: o.id,
      textEn: o.textEn,
      textBn: o.textBn,
    })),
  };
}

function buildPlayerSessionProjection(
  session: ServerLiveSession,
  participantId?: string,
): GameSession {
  // O(1) constant-time projection for 500+ concurrent examinees
  const compactParticipants: Record<string, Participant> = {};
  if (participantId && session.participants[participantId]) {
    const { seatToken: _s, ...meSafe } = session.participants[participantId];
    compactParticipants[participantId] = meSafe;
  }

  const top5 = session.cachedTop5 || [];
  for (const p of top5) {
    if (!compactParticipants[p.id]) {
      compactParticipants[p.id] = p;
    }
  }

  return {
    pin: session.pin,
    quizId: session.quizId,
    quizTitleEn: session.quizTitleEn,
    quizTitleBn: session.quizTitleBn,
    hostId: session.hostId,
    phase: session.phase,
    currentQuestionIndex: session.currentQuestionIndex,
    currentQuestion:
      session.cachedSanitizedQuestion ??
      sanitizeQuestionForPlayer(session.currentQuestion, session.phase),
    questionStartTime: session.questionStartTime,
    questionEndTime: session.questionEndTime,
    settings: session.settings,
    participants: compactParticipants,
    totalQuestions: session.totalQuestions,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    participantCount: session.participantCount ?? Object.keys(session.participants).length,
    answeredCount: session.answeredCount ?? 0,
    completedQuestions: session.phase === "podium" ? session.fullQuiz?.questions : undefined,
  };
}

function findCoveringOtsCheckpoint(
  cert: CertificateData,
  checkpoints: LedgerOtsCheckpoint[],
): LedgerOtsCheckpoint | undefined {
  if (typeof cert.ledgerIndex !== "number") return undefined;
  const covering = checkpoints
    .filter((cp) => cp.ledgerIndex >= cert.ledgerIndex!)
    .sort((a, b) => {
      if (a.status === "bitcoin_confirmed" && b.status !== "bitcoin_confirmed") return -1;
      if (b.status === "bitcoin_confirmed" && a.status !== "bitcoin_confirmed") return 1;
      return a.ledgerIndex - b.ledgerIndex;
    });
  return covering[0];
}

function enrichCertificateWithOtsCheckpoint(
  cert: CertificateData,
  checkpoints: LedgerOtsCheckpoint[],
): CertificateData {
  const cp = findCoveringOtsCheckpoint(cert, checkpoints);
  if (!cp) return cert;
  return {
    ...cert,
    otsStatus: cert.otsStatus === "bitcoin_confirmed" ? "bitcoin_confirmed" : cp.status,
    otsProofBase64: cert.otsProofBase64 || cp.otsProofBase64,
    otsChainHash: cert.otsChainHash || cp.chainHash,
    otsLedgerIndex: cert.otsLedgerIndex ?? cp.ledgerIndex,
    otsCalendarUrl: cert.otsCalendarUrl || cp.calendarUrl,
    otsSubmittedAt: cert.otsSubmittedAt || cp.submittedAt,
    otsBitcoinBlockHeight: cert.otsBitcoinBlockHeight ?? cp.bitcoinBlockHeight,
  };
}

async function anchorSingleCertificateToRekor(
  certNo: string,
  timeoutMs = 3500,
): Promise<{ anchored: boolean; error?: string }> {
  const store = getStore();
  const { dataDir } = getStorePaths();
  const idx = store.certificates.findIndex(
    (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
  );
  const current = idx >= 0 ? store.certificates[idx] : undefined;
  if (!current || !current.chainHash) {
    return { anchored: false, error: "Unsealed certificate" };
  }
  if (current.rekorStatus === "anchored" && current.rekorEntryUuid) {
    return { anchored: true };
  }

  const res = await anchorCertificateToRekor(current, { dataDir, timeoutMs });
  if (Object.keys(res.fields).length > 0) {
    store.certificates = store.certificates.map((c) =>
      c.certificateNumber.toLowerCase() === certNo.toLowerCase() ? { ...c, ...res.fields } : c,
    );
    scheduleDiskPersist();
  }
  return { anchored: res.anchored, ...(res.error ? { error: res.error } : {}) };
}

async function ensureLatestLedgerOtsCheckpoint(
  targetLedgerIndex?: number,
  timeoutMs = 3800,
): Promise<{ anchored: boolean; checkpoint?: LedgerOtsCheckpoint; error?: string }> {
  const store = getStore();
  const signedTip = store.certificates
    .filter((c) => typeof c.ledgerIndex === "number" && !!c.chainHash)
    .sort((a, b) => (b.ledgerIndex || 0) - (a.ledgerIndex || 0))[0];

  if (!signedTip || !signedTip.chainHash || typeof signedTip.ledgerIndex !== "number") {
    return { anchored: false, error: "No signed ledger blocks to checkpoint" };
  }

  const minNeededIndex = targetLedgerIndex ?? signedTip.ledgerIndex;
  const existing = store.ledgerCheckpoints.find((cp) => cp.ledgerIndex >= minNeededIndex);
  if (existing) {
    return { anchored: true, checkpoint: existing };
  }

  const otsRes = await anchorDigestToOpenTimestamps(signedTip.chainHash, { timeoutMs });
  if (!otsRes.success || !otsRes.otsProofBase64 || !otsRes.calendarUrl) {
    return { anchored: false, error: otsRes.error || "OpenTimestamps anchoring failed" };
  }

  const checkpoint: LedgerOtsCheckpoint = {
    id: `ots-${signedTip.ledgerIndex}-${Date.now().toString(36)}`,
    ledgerIndex: signedTip.ledgerIndex,
    chainHash: signedTip.chainHash,
    otsProofBase64: otsRes.otsProofBase64,
    calendarUrl: otsRes.calendarUrl,
    status: otsRes.status || "pending_bitcoin",
    bitcoinBlockHeight: otsRes.bitcoinBlockHeight,
    submittedAt: new Date().toISOString(),
  };

  store.ledgerCheckpoints = [
    checkpoint,
    ...store.ledgerCheckpoints.filter((cp) => cp.ledgerIndex !== checkpoint.ledgerIndex),
  ].slice(0, 200);
  scheduleDiskPersist();
  return { anchored: true, checkpoint };
}

function triggerBackgroundExternalAnchoring(certNumbers: string[]): void {
  if (certNumbers.length === 0) return;
  void (async () => {
    for (const certNo of certNumbers) {
      await anchorSingleCertificateToRekor(certNo, 3500);
    }
    await ensureLatestLedgerOtsCheckpoint(undefined, 3800);
  })();
}

function persistCompletedExamToStore(session: ServerLiveSession) {
  const store = getStore();
  const sessionId = `exam-${session.pin}`;
  const createdAt = new Date().toISOString();
  const participantsList = Object.values(session.participants)
    .filter((p) => !p.isBot)
    .sort((a, b) => b.score - a.score);
  const count = participantsList.length;
  if (count === 0) return;
  const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  const highestScore = participantsList[0]?.score ?? 0;

  const sessionRecord: ExamSessionRecord = {
    id: sessionId,
    pin: session.pin,
    quizId: session.quizId,
    quizTitleEn: session.quizTitleEn || "Onnesha Assessment",
    quizTitleBn: session.quizTitleBn || "অন্বেষা মডেল টেস্ট",
    hostId: session.hostId || "host",
    allowedRegionId: session.settings.allowedRegionId || "all",
    allowedRegionName: session.settings.allowedRegionName || "All Regions",
    totalQuestions: session.totalQuestions,
    participantCount: count,
    averageScore: avgScore,
    highestScore,
    createdAt,
  };

  store.examSessions = [
    sessionRecord,
    ...store.examSessions.filter((s) => s.id !== sessionId && s.pin !== session.pin),
  ];

  // Remove any previous results for this pin before writing final results
  store.examResults = store.examResults.filter((r) => r.pin !== session.pin);

  const quizObj =
    session.fullQuiz ||
    store.customQuizzes.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
    READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId);
  const totalMarks = computeTotalQuizMarks(quizObj?.questions, session.totalQuestions);
  const mintedCertNumbers: string[] = [];

  participantsList.forEach((p, idx) => {
    const answersList = Object.values(p.answers || {});
    const correctCount = answersList.filter((a) => a.isCorrect).length;
    const incorrectCount = answersList.filter(
      (a) =>
        !a.isCorrect &&
        ((a.selectedOptionIds && a.selectedOptionIds.length > 0) || !!a.writtenAnswer),
    ).length;
    const unattemptedCount = Math.max(0, session.totalQuestions - answersList.length);
    const totalAnswers = answersList.length;
    const accuracy = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    const roll = p.rollNumber || `2026-${100 + idx + 1}`;

    const resultRecord: ExamResultRecord = {
      id: `res-${session.pin}-${p.id}`,
      sessionId,
      pin: session.pin,
      participantId: p.id,
      rollNumber: roll,
      name: p.nickname || p.name || `Candidate ${idx + 1}`,
      phone: p.phone || "",
      regionId: p.regionId || "reg-dhaka",
      regionName: p.regionName || "Dhaka Range",
      score: p.score,
      rank: p.rank || idx + 1,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracyPct: accuracy,
      answersJson: JSON.stringify(p.answers || {}),
      createdAt,
    };
    store.examResults.push(resultRecord);

    const certNo = makeCertificateNumber(session.pin, roll, idx + 1);
    const unsignedCert: CertificateData = {
      id: `cert-${session.pin}-${p.id}`,
      certificateNumber: certNo,
      studentName: p.nickname || p.name || `Candidate ${idx + 1}`,
      studentRoll: roll,
      regionName: p.regionName || "Dhaka Range",
      quizTitle: session.quizTitleBn || session.quizTitleEn || "Institutional Assessment",
      score: p.score,
      marksObtained: p.score,
      totalPoints: totalMarks,
      totalMarks,
      rank: p.rank || idx + 1,
      totalParticipants: count,
      accuracyPercent: accuracy,
      scorePct: accuracy,
      issueDate: createdAt.slice(0, 10),
      organizationName: resolveOrgName(store.branding),
      institutionName: store.branding?.institutionTitle || "Onnesha Assessment Arena",
      instructorName: "Chief Assessment Officer",
      verificationUrl: `/verify/${certNo}`,
      verified: true,
    };

    const certRecord = sealCertificateWithLedger(
      unsignedCert,
      store.certificates,
      getStorePaths().dataDir,
    );

    store.certificates = [
      certRecord,
      ...store.certificates.filter(
        (c) => c.certificateNumber.toLowerCase() !== certNo.toLowerCase(),
      ),
    ];
    mintedCertNumbers.push(certNo);
  });

  scheduleDiskPersist();
  triggerBackgroundExternalAnchoring(mintedCertNumbers);
}

function resolveSessionQuiz(
  session: ServerLiveSession,
  store: PersistentStoreData,
): Quiz | undefined {
  if (session.fullQuiz) return session.fullQuiz;
  const found =
    store.customQuizzes.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
    READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
    READY_MADE_PACKS[0];
  if (found) session.fullQuiz = found;
  return found;
}

function advanceSessionToQuestion(
  session: ServerLiveSession,
  store: PersistentStoreData,
  questionIndex?: number,
) {
  const quiz = resolveSessionQuiz(session, store);
  const idx = questionIndex ?? session.currentQuestionIndex + 1;
  const question = quiz?.questions[idx];
  if (!quiz || !question || idx >= quiz.questions.length) {
    session.phase = "podium";
    recalculateSessionMetrics(session);
    persistCompletedExamToStore(session);
    return;
  }

  session.phase = "question";
  session.currentQuestionIndex = idx;
  session.currentQuestion = question;
  session.questionStartTime = Date.now();
  session.questionEndTime = Date.now() + question.timeLimitSec * 1000;
  recalculateSessionMetrics(session);

  // Simulate bot answers if any bots exist in the session
  Object.values(session.participants).forEach((p) => {
    if (!p.isBot) return;
    const isBotCorrect = Math.random() > 0.3;
    const isWrittenStyle = question.type === "written" || question.type === "fill_blank";
    const chosen = isWrittenStyle
      ? []
      : isBotCorrect
        ? [...question.correctOptionIds]
        : [
            question.options.find((o) => !question.correctOptionIds.includes(o.id))?.id ||
              question.options[0]?.id ||
              "opt-none",
          ].filter(Boolean);
    const botWritten = isWrittenStyle
      ? isBotCorrect
        ? question.acceptedAnswers?.[0] || "1971"
        : "0000"
      : undefined;
    const timeLimit = question.timeLimitSec || 20;
    const timeTakenSec = Math.round(2 + Math.random() * Math.max(3, timeLimit * 0.6));
    let pointsAwarded = 0;
    let newStreak = p.streak;
    if (isBotCorrect) {
      newStreak += 1;
      const mult = newStreak >= 3 ? 1.5 : newStreak >= 2 ? 1.2 : 1.0;
      const speed = Math.max(0.5, 1 - (timeTakenSec / timeLimit) * 0.5);
      pointsAwarded = Math.round((question.points || 1000) * speed * mult);
    } else {
      newStreak = 0;
      if (session.settings.negativeMarking > 0) {
        pointsAwarded = -Math.round((question.points || 1000) * session.settings.negativeMarking);
      }
    }
    p.answers[question.id] = {
      questionId: question.id,
      selectedOptionIds: chosen,
      writtenAnswer: botWritten,
      isCorrect: isBotCorrect,
      timeTakenSec,
      pointsAwarded,
      streakCount: newStreak,
      answeredAt: Date.now(),
    };
    p.score = Math.max(0, p.score + pointsAwarded);
    p.streak = newStreak;
  });
  recalculateSessionMetrics(session);
}

// ============================================================================
// 1. AUTHENTICATION & BOOTSTRAP ENDPOINTS (SIGNED HTTP-ONLY SESSION COOKIE)
// ============================================================================

export const serverGetCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await getActorFromRequest();
  return {
    success: true,
    user: actor ? sanitizeUserForClient(actor) : null,
  };
});

export const serverLogout = createServerFn({ method: "POST" }).handler(async () => {
  await clearAuthCookie();
  return { success: true };
});

export const serverGetBootstrapData = createServerFn({ method: "GET" }).handler(async () => {
  const store = getStore();
  const actor = await getActorFromRequest();
  const isStaff = !!actor && (actor.role === "admin" || actor.role === "instructor");

  return {
    success: true,
    regions: store.regions,
    roster: isStaff ? store.roster : [],
    courses: store.courses,
    users: isStaff ? store.users.map(sanitizeUserForClient) : [],
    customQuizzes: store.customQuizzes,
    examSessions: store.examSessions,
    examResults: isStaff ? store.examResults : [],
    certificates: store.certificates,
    transactions: actor?.role === "admin" ? store.transactions : [],
    smsLogs: isStaff ? store.smsLogs : [],
    salesLeads: actor?.role === "admin" ? store.salesLeads : [],
    branding: store.branding,
  };
});

export const serverAuthenticateUser = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const cleanEmail = (data.email || "").trim().toLowerCase();
    const foundIdx = store.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    const found = foundIdx >= 0 ? store.users[foundIdx] : undefined;
    if (!found) {
      return {
        success: false,
        error: "Account not found. Check your email or use one of the demo credentials.",
      };
    }
    if (found.status === "suspended") {
      return { success: false, error: "This account has been suspended by the Super Admin." };
    }

    const check = verifyPasswordScrypt(data.password || "", found.passwordHash);
    if (!check.valid) {
      return { success: false, error: "Incorrect password." };
    }
    if (check.needsRehash && foundIdx >= 0) {
      store.users[foundIdx] = {
        ...found,
        passwordHash: hashPasswordScrypt(data.password),
      };
      scheduleDiskPersist();
    }

    await setAuthCookieForUser(found);
    return {
      success: true,
      user: sanitizeUserForClient(found),
    };
  });

export const serverSignupUser = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      name: string;
      password: string;
      role: "instructor" | "candidate" | "admin";
      institutionName?: string | undefined;
      phone?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    const cleanEmail = (data.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (!data.password || data.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }
    if (data.role === "admin") {
      return {
        success: false,
        error:
          "Super Admin accounts cannot be self-registered. Please contact your institution administrator.",
      };
    }

    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: "An account with this email already exists." };
    }

    const safeRole: ManagedUser["role"] = data.role === "candidate" ? "candidate" : "instructor";
    const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const newUser: ManagedUser = {
      id,
      email: cleanEmail,
      name: (data.name || "").trim() || cleanEmail.split("@")[0] || "Instructor",
      role: safeRole,
      institutionName: data.institutionName?.trim() || "Onnesha Member Institution",
      institution: data.institutionName?.trim() || "Onnesha Member Institution",
      phone: data.phone?.trim(),
      passwordHash: hashPasswordScrypt(data.password),
      status: "active",
      aiCredits: 50,
      createdAt: new Date().toISOString(),
    };

    store.users.push(newUser);
    scheduleDiskPersist();
    await setAuthCookieForUser(newUser);

    return {
      success: true,
      user: sanitizeUserForClient(newUser),
    };
  });

export const serverRequestPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: { phone: string }) => data)
  .handler(async ({ data }) => {
    const cleanPhone = normalizeDigits(data.phone);
    if (cleanPhone.length < 11) {
      return { success: false, error: "Please enter a valid 11-digit Bangladeshi mobile number." };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const smsToken =
      typeof process !== "undefined" ? process.env["GREENWEB_SMS_TOKEN"]?.trim() : undefined;

    if (!globalStore.__onneshaPhoneOtps) {
      globalStore.__onneshaPhoneOtps = {};
    }
    globalStore.__onneshaPhoneOtps[cleanPhone] = {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    };

    if (smsToken && smsToken.length > 5) {
      try {
        const message = `[Onnesha Arena] Your login verification code is ${otpCode}. Valid for 5 minutes.`;
        const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(smsToken)}&to=${encodeURIComponent(cleanPhone)}&message=${encodeURIComponent(message)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          return { success: false, error: "SMS provider returned an error while sending OTP." };
        }
        return { success: true };
      } catch {
        return { success: false, error: "Failed to reach SMS OTP gateway." };
      }
    }

    const isProd = typeof process !== "undefined" && process.env["NODE_ENV"] === "production";
    if (isProd) {
      return {
        success: false,
        error:
          "Phone SMS OTP gateway (GREENWEB_SMS_TOKEN) is not configured on this server. Please sign in with email & password.",
      };
    }

    // Development convenience only (never exposed when NODE_ENV === 'production')
    return { success: true, devOtp: otpCode };
  });

export const serverVerifyPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: { phone: string; otp: string }) => data)
  .handler(async ({ data }) => {
    const cleanPhone = normalizeDigits(data.phone);
    const pending = globalStore.__onneshaPhoneOtps?.[cleanPhone];
    if (!pending) {
      return { success: false, error: "OTP not requested or expired. Please request a new code." };
    }
    if (Date.now() > pending.expiresAt) {
      delete globalStore.__onneshaPhoneOtps?.[cleanPhone];
      return { success: false, error: "OTP expired. Please request a new code." };
    }
    pending.attempts += 1;
    if (pending.attempts > 5) {
      delete globalStore.__onneshaPhoneOtps?.[cleanPhone];
      return { success: false, error: "Too many invalid OTP attempts. Please request a new code." };
    }
    if (pending.code !== (data.otp || "").trim()) {
      return { success: false, error: "Invalid OTP verification code." };
    }

    delete globalStore.__onneshaPhoneOtps?.[cleanPhone];

    const store = getStore();
    let found = store.users.find((u) => normalizeDigits(u.phone) === cleanPhone);
    if (!found) {
      const id = `usr-phone-${cleanPhone.slice(-6)}-${Date.now().toString(36)}`;
      found = {
        id,
        email: `${cleanPhone}@mobile.onnesha.app`,
        name: `User (${cleanPhone})`,
        role: "instructor",
        phone: cleanPhone,
        institutionName: "Mobile Quick Login",
        status: "active",
        aiCredits: 50,
        createdAt: new Date().toISOString(),
      };
      store.users.push(found);
      scheduleDiskPersist();
    }

    if (found.status === "suspended") {
      return { success: false, error: "This account has been suspended by the Super Admin." };
    }

    await setAuthCookieForUser(found);
    return {
      success: true,
      user: sanitizeUserForClient(found),
    };
  });

export const serverSubmitSalesLead = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name: string;
      organization: string;
      email: string;
      phone: string;
      studentCount: string;
      message: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!data.name?.trim() || !data.email?.trim() || !data.organization?.trim()) {
      return { success: false, error: "Name, organization, and email are required." };
    }
    const store = getStore();
    const lead: ServerSalesLeadRecord = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name.trim(),
      organization: data.organization.trim(),
      email: data.email.trim().toLowerCase(),
      phone: (data.phone || "").trim(),
      studentCount: (data.studentCount || "500-1000").trim(),
      message: (data.message || "").trim(),
      status: "new",
      createdAt: new Date().toISOString(),
    };
    store.salesLeads.unshift(lead);
    if (store.salesLeads.length > 500) {
      store.salesLeads.length = 500;
    }
    scheduleDiskPersist();
    return { success: true, leadId: lead.id };
  });

export const serverRecordTransaction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      planId: string;
      amount: number;
      msisdn: string;
      trxId: string;
      method?: string | undefined;
      status?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    const store = getStore();
    const record: ServerTransactionRecord = {
      id: `trx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      planId: data.planId,
      amount: Number(data.amount) || 0,
      msisdn: (data.msisdn || "").trim(),
      trxId: (data.trxId || "").trim(),
      method: data.method || "bkash",
      status: data.status || "completed",
      userId: actor?.id,
      createdAt: new Date().toISOString(),
    };
    store.transactions.unshift(record);
    if (store.transactions.length > 1000) {
      store.transactions.length = 1000;
    }
    scheduleDiskPersist();
    return { success: true, transaction: record };
  });

export const serverSendGuardianSms = createServerFn({ method: "POST" })
  .validator(
    (data: {
      guardianPhone: string;
      studentName: string;
      rollNumber: string;
      quizTitle: string;
      score: number;
      totalPoints: number;
      rank: number;
      totalParticipants: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return {
        success: false,
        error: "Instructor or Admin login required to dispatch guardian SMS.",
      };
    }
    const cleanPhone = normalizeDigits(data.guardianPhone);
    if (cleanPhone.length < 10) {
      return { success: false, error: "Invalid guardian phone number." };
    }

    const messageText = `[ফলাফল বার্তা]\nশ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${data.studentName} (রোল: ${data.rollNumber}) "${data.quizTitle}" পরীক্ষায় ${data.score}/${data.totalPoints} পেয়ে ${data.totalParticipants} জনের মধ্যে ${data.rank}ম স্থান অর্জন করেছে।\n- অন্বেষা এক্সাম অ্যারেনা`;

    const token =
      typeof process !== "undefined" ? process.env["GREENWEB_SMS_TOKEN"]?.trim() : undefined;
    let status: "delivered" | "queued" | "failed" = token ? "queued" : "failed";

    if (token && token.length > 5) {
      try {
        const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(token)}&to=${encodeURIComponent(cleanPhone)}&message=${encodeURIComponent(messageText)}`;
        const response = await fetch(url, { method: "GET" });
        if (response.ok) {
          const resText = (await response.text()).toLowerCase();
          status =
            resText.includes("ok") || resText.includes("success") || resText.includes("100")
              ? "delivered"
              : "queued";
        } else {
          status = "failed";
        }
      } catch {
        status = "failed";
      }
    }

    const store = getStore();
    const log: ServerSmsLogRecord = {
      id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      recipientPhone: data.guardianPhone,
      studentName: data.studentName,
      rollNumber: data.rollNumber,
      quizTitle: data.quizTitle,
      score: data.score,
      rank: data.rank,
      messageText,
      status,
      createdAt: new Date().toISOString(),
    };
    store.smsLogs.unshift(log);
    if (store.smsLogs.length > 1000) {
      store.smsLogs.length = 1000;
    }
    scheduleDiskPersist();

    return {
      success: status !== "failed",
      configured: !!(token && token.length > 5),
      log,
    };
  });

export const serverGenerateQuizWithAi = createServerFn({ method: "POST" })
  .validator(
    (data: {
      topic: string;
      sourceText?: string | undefined;
      questionCount: number;
      difficulty: "easy" | "medium" | "hard";
      category: string;
      courseId?: string | undefined;
      courseTitle?: string | undefined;
      quizNumber?: number | undefined;
      questionStyleMode?: "mixed_all_4" | "single_mcq" | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, quiz: null, error: "Instructor or Admin login required." };
    }

    const apiKey =
      typeof process !== "undefined" ? process.env["GEMINI_API_KEY"]?.trim() : undefined;
    if (!apiKey || apiKey.length < 10) {
      return { success: false, quiz: null, error: "GEMINI_API_KEY not configured on server" };
    }

    const store = getStore();
    const userIdx = store.users.findIndex((u) => u.id === actor.id);
    const currentCredits = userIdx >= 0 ? (store.users[userIdx]?.aiCredits ?? 50) : 50;
    if (currentCredits <= 0) {
      return {
        success: false,
        quiz: null,
        error: "No AI generation credits remaining for this account.",
      };
    }

    const count = Math.min(20, Math.max(3, data.questionCount || 5));
    const styleMode = data.questionStyleMode || "mixed_all_4";
    const styleInstructions =
      styleMode === "mixed_all_4"
        ? `Include a balanced mix of question types: "single_mcq" (4 options, 1 correct), "true_false" (2 options: True/সত্য and False/মিথ্যা), "multi_mcq" (4 options, 2 or 3 correct), and "written" (options: [], acceptedAnswers: ["answer in English", "বাংলায় উত্তর"]).`
        : `All questions must be "single_mcq" with 4 options and 1 correct option.`;

    const prompt = `You are an expert exam paper setter for competitive examinations in Bangladesh (BCS, Bank Jobs, Cadet Colleges, University Admission).
Generate an official ${count}-question assessment on the topic: "${data.topic}".
Course context: "${data.courseTitle || data.category}".
Additional syllabus text: "${data.sourceText || "Standard BCS & Institutional Syllabus"}".
Difficulty: ${data.difficulty}. Language requirement: bilingual English and Bengali.
${styleInstructions}

Return ONLY a valid JSON object matching this exact schema:
{
  "titleEn": "string",
  "titleBn": "string",
  "descriptionEn": "string",
  "descriptionBn": "string",
  "categoryEn": "string",
  "categoryBn": "string",
  "questions": [
    {
      "type": "single_mcq" | "true_false" | "multi_mcq" | "written",
      "textEn": "Question in English",
      "textBn": "বাংলায় প্রশ্ন",
      "options": [
        { "textEn": "Option A in English", "textBn": "অপশন ক", "isCorrect": true },
        { "textEn": "Option B in English", "textBn": "অপশন খ", "isCorrect": false }
      ],
      "acceptedAnswers": ["exact short answer EN", "সংক্ষিপ্ত উত্তর"],
      "explanationEn": "Explanation in English",
      "explanationBn": "বাংলায় বিস্তারিত ব্যাখ্যা"
    }
  ]
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.25,
            },
          }),
        },
      );

      if (!response.ok) {
        return { success: false, quiz: null, error: `Gemini API HTTP ${response.status}` };
      }
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawJsonText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJsonText) {
        return { success: false, quiz: null, error: "Empty Gemini response" };
      }

      const parsed = JSON.parse(rawJsonText) as {
        titleEn?: string;
        titleBn?: string;
        descriptionEn?: string;
        descriptionBn?: string;
        categoryEn?: string;
        categoryBn?: string;
        questions?: Array<{
          type?: string;
          textEn?: string;
          textBn?: string;
          options?: Array<{ textEn?: string; textBn?: string; isCorrect?: boolean }>;
          acceptedAnswers?: string[];
          explanationEn?: string;
          explanationBn?: string;
        }>;
      };

      const id = `ai-quiz-${Date.now()}`;
      const slug = `ai-${data.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 25)}-${Date.now() % 10000}`;

      const questions: Question[] = (parsed.questions || []).map((q, idx) => {
        const qId = `q-ai-${idx + 1}-${Date.now() % 10000}`;
        const qType: QuestionType =
          q.type === "true_false" || q.type === "multi_mcq" || q.type === "written"
            ? q.type
            : "single_mcq";

        if (qType === "written") {
          const accepted =
            Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0
              ? q.acceptedAnswers.map((a) => String(a).trim()).filter(Boolean)
              : ["1971", "১৯৭১"];
          return {
            id: qId,
            textEn: q.textEn || `${data.topic} Short Answer #${idx + 1}`,
            textBn: q.textBn || `${data.topic} সংক্ষিপ্ত প্রশ্ন #${idx + 1}`,
            type: "written",
            timeLimitSec: 30,
            points: 1000,
            negativeMarks: 0,
            options: [],
            correctOptionIds: [],
            acceptedAnswers: accepted,
            explanationEn: q.explanationEn,
            explanationBn: q.explanationBn,
            category: data.category,
            difficulty: data.difficulty,
          };
        }

        const options = (q.options || []).map((opt, optIdx) => ({
          id: `o-${qId}-${optIdx + 1}`,
          textEn: opt.textEn || `Option ${optIdx + 1}`,
          textBn: opt.textBn || `অপশন ${optIdx + 1}`,
          isCorrect: !!opt.isCorrect,
        }));
        const correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);
        if (correctOptionIds.length === 0 && options[0]) {
          options[0].isCorrect = true;
          correctOptionIds.push(options[0].id);
        }

        return {
          id: qId,
          textEn: q.textEn || `${data.topic} Question #${idx + 1}`,
          textBn: q.textBn || `${data.topic} প্রশ্ন #${idx + 1}`,
          type: qType,
          timeLimitSec: qType === "multi_mcq" ? 25 : 20,
          points: 1000,
          negativeMarks: 0.25,
          options,
          correctOptionIds,
          explanationEn: q.explanationEn,
          explanationBn: q.explanationBn,
          category: data.category,
          difficulty: data.difficulty,
        };
      });

      if (userIdx >= 0 && store.users[userIdx]) {
        store.users[userIdx] = {
          ...store.users[userIdx],
          aiCredits: Math.max(0, currentCredits - 1),
        };
        scheduleDiskPersist();
      }

      const quiz: Quiz = {
        id,
        slug,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        quizNumber: data.quizNumber,
        instructorId: actor.id,
        instructorName: actor.name,
        icon: "✨",
        titleEn: parsed.titleEn || `${data.topic} (${data.difficulty.toUpperCase()})`,
        titleBn: parsed.titleBn || `${data.topic} (এআই মডেল টেস্ট)`,
        descriptionEn: parsed.descriptionEn || `AI synthesized assessment on ${data.topic}.`,
        descriptionBn: parsed.descriptionBn || `${data.topic} বিষয়ের ওপর নির্মিত এআই মূল্যায়ন।`,
        categoryEn: parsed.categoryEn || data.category || "General",
        categoryBn: parsed.categoryBn || "সাধারণ",
        color: "from-violet-500/20 to-fuchsia-500/20",
        tags: ["AI Studio", data.difficulty, data.category],
        questions,
        author: actor.name,
        isTemplate: false,
        createdAt: new Date().toISOString(),
      };

      return {
        success: true,
        quiz,
        remainingCredits: Math.max(0, currentCredits - 1),
      };
    } catch {
      return { success: false, quiz: null, error: "Gemini synthesis error" };
    }
  });

export const serverVerifyCertificate = createServerFn({ method: "GET" })
  .validator(
    (data: {
      certId?: string | undefined;
      certNo?: string | undefined;
      origin?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    const { dataDir } = getStorePaths();
    const rawCert = (data.certNo || data.certId || "").trim();
    const target = rawCert.toLowerCase();
    const certKeys = getCertificateSigningKeys(dataDir);
    const didWeb = hostToDidWeb(data.origin);
    const publicKeyMultibase = certKeys ? ed25519PemToMultibase(certKeys.publicKeyPem) : null;

    const resolveVerifiedEnvelope = async (cert: CertificateData) => {
      const verification = verifyCertificateCryptographically(cert, dataDir, store.certificates);
      let activeCert = cert;
      if (verification.status === "verified_signed") {
        if (activeCert.rekorStatus !== "anchored" || !activeCert.rekorEntryUuid) {
          await anchorSingleCertificateToRekor(activeCert.certificateNumber, 2600);
          activeCert =
            store.certificates.find(
              (c) =>
                c.certificateNumber.toLowerCase() === activeCert.certificateNumber.toLowerCase(),
            ) || activeCert;
        }
        if (
          typeof activeCert.ledgerIndex === "number" &&
          !findCoveringOtsCheckpoint(activeCert, store.ledgerCheckpoints)
        ) {
          triggerBackgroundExternalAnchoring([activeCert.certificateNumber]);
        }
        activeCert = enrichCertificateWithOtsCheckpoint(activeCert, store.ledgerCheckpoints);
      }

      return {
        success: true,
        certificate:
          verification.status === "tampered" ? { ...activeCert, verified: false } : activeCert,
        verification,
        didWeb,
        publicKeyMultibase,
      };
    };

    const found = store.certificates.find((c) => c.certificateNumber.toLowerCase() === target);
    if (found) {
      return await resolveVerifiedEnvelope(found);
    }

    // Check if it matches a deterministic ONN-<PIN>-<ROLL> pattern backed by a real exam result
    const match = rawCert.toUpperCase().match(/^ONN-([A-Z0-9]{4})-([A-Z0-9]{4,6})$/);
    if (match && match[1] && match[2]) {
      const pinPrefix = match[1];
      const rollSuffix = match[2];
      const matchedResult = store.examResults.find((r) => {
        const cleanRoll = (r.rollNumber || "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(-6)
          .padStart(4, "0");
        return r.pin.startsWith(pinPrefix) && cleanRoll === rollSuffix;
      });

      if (matchedResult) {
        const matchedSession = store.examSessions.find(
          (s) => s.id === matchedResult.sessionId || s.pin === matchedResult.pin,
        );
        const quizObj = matchedSession
          ? store.customQuizzes.find(
              (q) => q.id === matchedSession.quizId || q.slug === matchedSession.quizId,
            ) ||
            READY_MADE_PACKS.find(
              (q) => q.id === matchedSession.quizId || q.slug === matchedSession.quizId,
            )
          : undefined;
        const totalMarks = computeTotalQuizMarks(
          quizObj?.questions,
          matchedSession?.totalQuestions || 5,
        );
        const certNoUpper = rawCert.toUpperCase();
        const synthesized = sealCertificateWithLedger(
          {
            id: `cert-${certNoUpper.toLowerCase()}`,
            certificateNumber: certNoUpper,
            studentName: matchedResult.name,
            studentRoll: matchedResult.rollNumber,
            regionName: matchedResult.regionName || "Dhaka Range",
            quizTitle:
              matchedSession?.quizTitleBn ||
              matchedSession?.quizTitleEn ||
              "Onnesha Assessment Evaluation",
            score: matchedResult.score,
            marksObtained: matchedResult.score,
            totalPoints: totalMarks,
            totalMarks,
            rank: matchedResult.rank,
            totalParticipants: matchedSession?.participantCount || 1,
            accuracyPercent: matchedResult.accuracyPct,
            scorePct: matchedResult.accuracyPct,
            issueDate: (matchedResult.createdAt || new Date().toISOString()).slice(0, 10),
            organizationName: resolveOrgName(store.branding),
            institutionName: store.branding?.institutionTitle || "Onnesha Assessment Arena",
            instructorName: "Chief Assessment Officer",
            verificationUrl: `/verify/${certNoUpper}`,
            verified: true,
          },
          store.certificates,
          dataDir,
        );

        store.certificates = [
          synthesized,
          ...store.certificates.filter(
            (c) => c.certificateNumber.toLowerCase() !== certNoUpper.toLowerCase(),
          ),
        ];
        scheduleDiskPersist();

        return await resolveVerifiedEnvelope(synthesized);
      }
    }

    return {
      success: false,
      certificate: null,
      verification: null,
      didWeb,
      publicKeyMultibase,
    };
  });

export const serverAnchorCertificateNow = createServerFn({ method: "POST" })
  .validator((data: { certNo: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const { dataDir } = getStorePaths();
    const certNo = (data.certNo || "").trim();
    const found = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!found) {
      return { success: false, error: "Certificate not found" };
    }
    const verification = verifyCertificateCryptographically(found, dataDir, store.certificates);
    if (verification.status !== "verified_signed") {
      return { success: false, error: "Certificate is not cryptographically valid" };
    }

    const rekorRes = await anchorSingleCertificateToRekor(found.certificateNumber, 4500);
    const otsRes = await ensureLatestLedgerOtsCheckpoint(found.ledgerIndex, 4500);
    const updatedRaw =
      store.certificates.find(
        (c) => c.certificateNumber.toLowerCase() === found.certificateNumber.toLowerCase(),
      ) || found;
    const enriched = enrichCertificateWithOtsCheckpoint(updatedRaw, store.ledgerCheckpoints);

    return {
      success: rekorRes.anchored || otsRes.anchored,
      certificate: enriched,
      verification: verifyCertificateCryptographically(enriched, dataDir, store.certificates),
      rekorAnchored: rekorRes.anchored,
      otsAnchored: otsRes.anchored,
      rekorError: rekorRes.error,
      otsError: otsRes.error,
    };
  });

export const serverExportVerifiableCredential = createServerFn({ method: "GET" })
  .validator((data: { certNo: string; origin?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const { dataDir } = getStorePaths();
    const certKeys = getCertificateSigningKeys(dataDir);
    const rekorKeys = getRekorAnchorKeys(dataDir);
    const originUrl = (data.origin || "https://onnesha.app").replace(/\/+$/, "");
    const raw = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === (data.certNo || "").trim().toLowerCase(),
    );
    if (!raw || !certKeys) {
      return { success: false, credential: null, didDocument: null, otsProofBase64: null };
    }
    const checkpoint = findCoveringOtsCheckpoint(raw, store.ledgerCheckpoints);
    const enriched = enrichCertificateWithOtsCheckpoint(raw, store.ledgerCheckpoints);
    const credential = buildW3CVerifiableCredential(enriched, certKeys, {
      originUrl,
      checkpoint,
    });
    const didDocument = buildDidDocument(originUrl, certKeys, rekorKeys);
    return {
      success: true,
      credential,
      didDocument,
      otsProofBase64: enriched.otsProofBase64 || checkpoint?.otsProofBase64 || null,
    };
  });

/** Pure HTTP handler for /.well-known/did.json, /api/certificates/:certNo/vc.json, and timestamp.ots */
export async function handlePublicStandardEndpoint(request: Request): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const path = url.pathname;
  const store = getStore();
  const { dataDir } = getStorePaths();
  const certKeys = getCertificateSigningKeys(dataDir);
  const rekorKeys = getRekorAnchorKeys(dataDir);
  const originUrl = `${url.protocol}//${url.host}`;

  if (path === "/.well-known/did.json") {
    if (!certKeys) {
      return Response.json({ error: "Signing keys unavailable" }, { status: 503 });
    }
    return new Response(JSON.stringify(buildDidDocument(originUrl, certKeys, rekorKeys), null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/did+json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const vcMatch = path.match(/^\/api\/certificates\/([^/]+)\/vc\.json$/i);
  if (vcMatch && vcMatch[1]) {
    const certNo = decodeURIComponent(vcMatch[1]);
    const raw = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!raw || !certKeys) {
      return Response.json({ error: "Credential not found" }, { status: 404 });
    }
    const checkpoint = findCoveringOtsCheckpoint(raw, store.ledgerCheckpoints);
    const enriched = enrichCertificateWithOtsCheckpoint(raw, store.ledgerCheckpoints);
    const vc = buildW3CVerifiableCredential(enriched, certKeys, { originUrl, checkpoint });
    return new Response(JSON.stringify(vc, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/vc+json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${raw.certificateNumber}.vc.json"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const otsMatch = path.match(/^\/api\/certificates\/([^/]+)\/timestamp\.ots$/i);
  if (otsMatch && otsMatch[1]) {
    const certNo = decodeURIComponent(otsMatch[1]);
    const raw = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!raw) {
      return Response.json({ error: "Credential not found" }, { status: 404 });
    }
    const enriched = enrichCertificateWithOtsCheckpoint(raw, store.ledgerCheckpoints);
    if (!enriched.otsProofBase64) {
      return Response.json(
        { error: "Bitcoin OpenTimestamps checkpoint not yet attached" },
        { status: 404 },
      );
    }
    const binary = Buffer.from(enriched.otsProofBase64, "base64");
    return new Response(new Uint8Array(binary), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${raw.certificateNumber}.ots"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return null;
}

export const serverChangeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { oldPassword: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor) {
      return { success: false, error: "Authentication required." };
    }
    if (!data.newPassword || data.newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters long." };
    }
    const store = getStore();
    const idx = store.users.findIndex((u) => u.id === actor.id);
    if (idx < 0 || !store.users[idx]) {
      return { success: false, error: "Account not found." };
    }
    const check = verifyPasswordScrypt(data.oldPassword || "", store.users[idx].passwordHash);
    if (!check.valid) {
      return { success: false, error: "Current password is incorrect." };
    }
    store.users[idx] = {
      ...store.users[idx],
      passwordHash: hashPasswordScrypt(data.newPassword),
    };
    scheduleDiskPersist();
    return { success: true };
  });

export const serverUpdateOwnProfile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name?: string | undefined;
      institutionName?: string | undefined;
      designation?: string | undefined;
      phone?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor) {
      return { success: false, user: null, error: "Authentication required." };
    }
    const store = getStore();
    const idx = store.users.findIndex((u) => u.id === actor.id);
    if (idx < 0 || !store.users[idx]) {
      return { success: false, user: null, error: "Account not found." };
    }
    const existing = store.users[idx];
    const updated: ManagedUser = {
      ...existing,
      name: data.name?.trim() || existing.name,
      institutionName:
        data.institutionName !== undefined ? data.institutionName.trim() : existing.institutionName,
      institution:
        data.institutionName !== undefined ? data.institutionName.trim() : existing.institution,
      designation: data.designation !== undefined ? data.designation.trim() : existing.designation,
      phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
    };
    store.users[idx] = updated;
    scheduleDiskPersist();
    return { success: true, user: sanitizeUserForClient(updated) };
  });

export const serverAdminMutateStore = createServerFn({ method: "POST" })
  .validator(
    (data: {
      action:
        | "add_region"
        | "delete_region"
        | "add_student"
        | "bulk_add_students"
        | "delete_student"
        | "clear_roster"
        | "save_course"
        | "delete_course"
        | "save_user"
        | "delete_user"
        | "save_quiz"
        | "delete_quiz"
        | "issue_certificate"
        | "update_branding"
        | "update_sales_lead"
        | "update_transaction"
        | "import_store_backup"
        | "purge_dummy_data";
      region?: Region | undefined;
      regionId?: string | undefined;
      student?: RosterStudent | undefined;
      students?: RosterStudent[] | undefined;
      studentId?: string | undefined;
      course?: Course | undefined;
      courseId?: string | undefined;
      user?: ManagedUser | undefined;
      userId?: string | undefined;
      quiz?: Quiz | undefined;
      quizId?: string | undefined;
      certificate?: CertificateData | undefined;
      branding?: BrandingSettings | undefined;
      leadId?: string | undefined;
      leadStatus?: string | undefined;
      trxId?: string | undefined;
      trxStatus?: string | undefined;
      backup?: Partial<PersistentStoreData> | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    const actor = await getActorFromRequest();

    const targetCustomQuiz =
      data.action === "delete_quiz" && data.quizId
        ? store.customQuizzes.find((q) => q.id === data.quizId || q.slug === data.quizId)
        : data.action === "save_quiz" && data.quiz
          ? store.customQuizzes.find((q) => q.id === data.quiz!.id || q.slug === data.quiz!.slug)
          : undefined;
    const collidesWithTemplate =
      data.action === "save_quiz" && data.quiz
        ? READY_MADE_PACKS.some((q) => q.id === data.quiz!.id || q.slug === data.quiz!.slug)
        : false;

    const perm = canActorMutateStoreAction(
      actor ? { id: actor.id, role: actor.role } : null,
      data.action,
      targetCustomQuiz?.instructorId,
      collidesWithTemplate || targetCustomQuiz?.isTemplate,
    );
    if (!perm.allowed) {
      return {
        success: false,
        error: perm.reason || "Unauthorized",
        regions: store.regions,
        roster: [],
        courses: store.courses,
        users: [],
        customQuizzes: store.customQuizzes,
        branding: store.branding,
      };
    }

    switch (data.action) {
      case "add_region": {
        if (data.region) {
          const existsIdx = store.regions.findIndex(
            (r) =>
              r.id === data.region!.id || r.code.toLowerCase() === data.region!.code.toLowerCase(),
          );
          if (existsIdx >= 0) {
            store.regions[existsIdx] = data.region;
          } else {
            store.regions.push(data.region);
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_region": {
        if (data.regionId) {
          store.regions = store.regions.filter((r) => r.id !== data.regionId);
          scheduleDiskPersist();
        }
        break;
      }
      case "add_student": {
        if (data.student) {
          const existingIdx = store.roster.findIndex(
            (s) =>
              s.id === data.student!.id ||
              normalizeCode(s.rollNumber) === normalizeCode(data.student!.rollNumber),
          );
          if (existingIdx >= 0) {
            store.roster[existingIdx] = data.student;
          } else {
            store.roster.push(data.student);
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "bulk_add_students": {
        if (data.students?.length) {
          for (const st of data.students) {
            const idx = store.roster.findIndex(
              (s) => s.id === st.id || normalizeCode(s.rollNumber) === normalizeCode(st.rollNumber),
            );
            if (idx >= 0) {
              store.roster[idx] = st;
            } else {
              store.roster.push(st);
            }
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_student": {
        if (data.studentId) {
          store.roster = store.roster.filter((s) => s.id !== data.studentId);
          scheduleDiskPersist();
        }
        break;
      }
      case "clear_roster": {
        store.roster = [];
        scheduleDiskPersist();
        break;
      }
      case "save_course": {
        if (data.course) {
          const idx = store.courses.findIndex(
            (c) =>
              c.id === data.course!.id || c.code.toLowerCase() === data.course!.code.toLowerCase(),
          );
          if (idx >= 0) {
            store.courses[idx] = data.course;
          } else {
            store.courses.unshift(data.course);
          }
          if (data.course.instructorIds) {
            store.users = store.users.map((u) => {
              const curr = new Set(u.assignedCourseIds || []);
              if (data.course!.instructorIds.includes(u.id)) {
                curr.add(data.course!.id);
              }
              return { ...u, assignedCourseIds: Array.from(curr) };
            });
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_course": {
        if (data.courseId) {
          store.courses = store.courses.filter((c) => c.id !== data.courseId);
          scheduleDiskPersist();
        }
        break;
      }
      case "save_user": {
        if (data.user) {
          const idx = store.users.findIndex(
            (u) =>
              u.id === data.user!.id || u.email.toLowerCase() === data.user!.email.toLowerCase(),
          );
          const incomingPass = data.user.passwordHash?.trim();
          const nextHash =
            incomingPass && !incomingPass.startsWith("scrypt:")
              ? hashPasswordScrypt(incomingPass)
              : incomingPass;
          const existing = idx >= 0 ? store.users[idx] : undefined;
          if (idx >= 0 && existing) {
            store.users[idx] = {
              ...existing,
              ...data.user,
              passwordHash: nextHash || existing.passwordHash,
            };
          } else {
            if (!nextHash) {
              return {
                success: false,
                error: "A password is required when creating a new user account.",
                regions: store.regions,
                roster: store.roster,
                courses: store.courses,
                users: store.users.map(sanitizeUserForClient),
                customQuizzes: store.customQuizzes,
                branding: store.branding,
              };
            }
            store.users.push({
              ...data.user,
              passwordHash: nextHash,
            });
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_user": {
        if (data.userId) {
          const deletedUser = store.users.find((u) => u.id === data.userId);
          store.users = store.users.filter((u) => u.id !== data.userId);
          store.courses = store.courses.map((course) => {
            if (!(course.instructorIds || []).includes(data.userId!)) {
              return course;
            }
            const nextIds = (course.instructorIds || []).filter((id) => id !== data.userId);
            const nextNames = nextIds
              .map((id) => store.users.find((u) => u.id === id)?.name)
              .filter((n): n is string => Boolean(n));
            const fallbackNames = deletedUser
              ? (course.instructorNames || []).filter((n) => n !== deletedUser.name)
              : course.instructorNames || [];
            return {
              ...course,
              instructorIds: nextIds,
              instructorNames:
                nextNames.length > 0 || nextIds.length === 0 ? nextNames : fallbackNames,
            };
          });
          scheduleDiskPersist();
        }
        break;
      }
      case "save_quiz": {
        if (data.quiz) {
          const idx = store.customQuizzes.findIndex(
            (q) => q.id === data.quiz!.id || q.slug === data.quiz!.slug,
          );
          const existingQuiz = idx >= 0 ? store.customQuizzes[idx] : undefined;
          const ownerId =
            actor?.role === "admin"
              ? data.quiz.instructorId || existingQuiz?.instructorId || actor.id
              : existingQuiz?.instructorId || actor?.id;
          const ownerName =
            actor?.role === "admin"
              ? data.quiz.instructorName || existingQuiz?.instructorName || actor.name
              : existingQuiz?.instructorName || actor?.name;
          const quizRecord: Quiz = {
            ...data.quiz,
            isTemplate: false,
            instructorId: ownerId,
            instructorName: ownerName,
          };
          if (idx >= 0) {
            store.customQuizzes[idx] = quizRecord;
          } else {
            store.customQuizzes.unshift(quizRecord);
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_quiz": {
        if (data.quizId) {
          store.customQuizzes = store.customQuizzes.filter(
            (q) => q.id !== data.quizId && q.slug !== data.quizId,
          );
          scheduleDiskPersist();
        }
        break;
      }
      case "issue_certificate": {
        if (data.certificate) {
          const {
            payloadHash: _ph,
            prevBlockHash: _pbh,
            ledgerIndex: _li,
            chainHash: _ch,
            cryptoSignature: _cs,
            signerKeyId: _sk,
            signedAt: _sa,
            rekorEntryUuid: _reu,
            rekorLogIndex: _rli,
            rekorIntegratedTime: _rit,
            rekorLogId: _rlid,
            rekorStatus: _rs,
            rekorReceiptDigest: _rrd,
            rekorPublicKeyId: _rpk,
            rekorExplorerUrl: _rex,
            otsStatus: _os,
            otsProofBase64: _opb,
            otsChainHash: _och,
            otsLedgerIndex: _oli,
            otsCalendarUrl: _ocu,
            otsSubmittedAt: _osa,
            otsBitcoinBlockHeight: _obh,
            ...cleanCert
          } = data.certificate;
          const sealedCert = sealCertificateWithLedger(
            cleanCert,
            store.certificates,
            getStorePaths().dataDir,
          );
          store.certificates = [
            sealedCert,
            ...store.certificates.filter(
              (c) =>
                c.certificateNumber.toLowerCase() !== sealedCert.certificateNumber.toLowerCase(),
            ),
          ];
          scheduleDiskPersist();
          triggerBackgroundExternalAnchoring([sealedCert.certificateNumber]);
        }
        break;
      }
      case "update_branding": {
        if (data.branding) {
          store.branding = {
            ...DEFAULT_BRANDING,
            ...store.branding,
            ...data.branding,
            updatedAt: Date.now(),
          };
          scheduleDiskPersist();
        }
        break;
      }
      case "update_sales_lead": {
        if (data.leadId && data.leadStatus) {
          store.salesLeads = store.salesLeads.map((l) =>
            l.id === data.leadId ? { ...l, status: data.leadStatus! } : l,
          );
          scheduleDiskPersist();
        }
        break;
      }
      case "update_transaction": {
        if (data.trxId && data.trxStatus) {
          store.transactions = store.transactions.map((t) =>
            t.id === data.trxId || t.trxId === data.trxId ? { ...t, status: data.trxStatus! } : t,
          );
          scheduleDiskPersist();
        }
        break;
      }
      case "import_store_backup": {
        if (data.backup) {
          if (data.backup.regions?.length) store.regions = data.backup.regions;
          if (data.backup.roster?.length) store.roster = data.backup.roster;
          if (data.backup.courses?.length) store.courses = data.backup.courses;
          if (data.backup.users?.length) store.users = ensureDefaultUsers(data.backup.users);
          if (data.backup.customQuizzes) store.customQuizzes = data.backup.customQuizzes;
          if (data.backup.examSessions) store.examSessions = data.backup.examSessions;
          if (data.backup.examResults) store.examResults = data.backup.examResults;
          if (data.backup.certificates) store.certificates = data.backup.certificates;
          if (data.backup.branding)
            store.branding = { ...DEFAULT_BRANDING, ...data.backup.branding };
          scheduleDiskPersist();
        }
        break;
      }
      case "purge_dummy_data": {
        store.roster = store.roster.filter(
          (s) => !(/^st-([1-9]|10)$/.test(s.id) && s.email?.endsWith("@academy.edu.bd")),
        );
        store.examResults = store.examResults.filter(
          (r) => !(r.participantId || "").startsWith("bot-"),
        );
        store.users = ensureDefaultUsers(
          store.users.filter((u) => !["usr-instructor-2", "usr-instructor-3"].includes(u.id)),
        );
        store.courses = store.courses.filter(
          (c) => !["course-field-safety", "course-science-stem"].includes(c.id),
        );
        store.certificates = store.certificates.filter(
          (c) => !["ONN-4821-9982", "ONN-4634-026104"].includes(c.certificateNumber.toUpperCase()),
        );
        scheduleDiskPersist();
        break;
      }
    }

    return {
      success: true,
      regions: store.regions,
      roster: store.roster,
      courses: store.courses,
      users: store.users.map(sanitizeUserForClient),
      customQuizzes: store.customQuizzes,
      branding: store.branding,
      salesLeads: actor?.role === "admin" ? store.salesLeads : [],
      transactions: actor?.role === "admin" ? store.transactions : [],
    };
  });

// ============================================================================
// 2. CANDIDATE DIRECTORY & NUMBER LOOKUP FOR JOIN TERMINAL
// ============================================================================

export const serverGetJoinDirectory = createServerFn({ method: "GET" })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const sessions = getLiveSessions();
    const session = sessions[data.pin];

    const activeSeatRollSet = new Set<string>();
    const activeSeatCandidateIds = new Set<string>();
    if (session) {
      Object.values(session.participants).forEach((p) => {
        if (p.rollNumber) activeSeatRollSet.add(normalizeCode(p.rollNumber));
        if (p.candidateId) activeSeatCandidateIds.add(p.candidateId);
      });
    }

    const candidates = store.roster.map((s) => {
      const cleanPhone = normalizeDigits(s.phone || s.guardianPhone);
      const maskedPhone =
        cleanPhone.length >= 7
          ? `${cleanPhone.slice(0, 3)}••••${cleanPhone.slice(-3)}`
          : cleanPhone;

      return {
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        regionId: s.regionId || "reg-dhaka",
        regionName: s.regionName || "Dhaka Range",
        batch: s.batch || "46th BCS & Cadet Batch",
        maskedPhone,
        isAlreadyJoined:
          activeSeatCandidateIds.has(s.id) || activeSeatRollSet.has(normalizeCode(s.rollNumber)),
      };
    });

    return {
      success: true,
      regions: store.regions,
      candidates,
      allowedRegionId: session?.settings?.allowedRegionId || "all",
      allowedRegionName: session?.settings?.allowedRegionName || "All Regions",
    };
  });

export const serverLookupCandidateByNumber = createServerFn({ method: "GET" })
  .validator((data: { pin: string; query: string; regionId?: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const sessions = getLiveSessions();
    const session = sessions[data.pin];

    const rawQuery = (data.query || "").trim();
    const digitsQuery = normalizeDigits(rawQuery);
    const codeQuery = normalizeCode(rawQuery);

    if (!rawQuery || rawQuery.length < 2) {
      return {
        success: false,
        error: "Enter at least 3 digits of your Mobile Number or Roll Number.",
      };
    }

    const matched = store.roster.find((s) => {
      const sRoll = normalizeCode(s.rollNumber);
      const sPhone = normalizeDigits(s.phone);
      const sGuardian = normalizeDigits(s.guardianPhone);

      const rollMatch =
        sRoll === codeQuery || (digitsQuery.length >= 3 && sRoll.endsWith(digitsQuery));
      const phoneMatch =
        digitsQuery.length >= 6 &&
        ((sPhone && (sPhone === digitsQuery || sPhone.endsWith(digitsQuery))) ||
          (sGuardian && (sGuardian === digitsQuery || sGuardian.endsWith(digitsQuery))));

      return rollMatch || phoneMatch;
    });

    if (!matched) {
      return {
        success: false,
        error:
          "No enrolled candidate matched this Mobile / Roll Number. You can also select your Region and Name below.",
      };
    }

    if (
      session?.settings?.allowedRegionId &&
      session.settings.allowedRegionId !== "all" &&
      matched.regionId !== session.settings.allowedRegionId
    ) {
      return {
        success: false,
        error: `This exam session is restricted to ${session.settings.allowedRegionName}. Your profile is registered under ${matched.regionName}.`,
      };
    }

    const activeParticipant = session
      ? Object.values(session.participants).find(
          (p) =>
            p.candidateId === matched.id ||
            normalizeCode(p.rollNumber) === normalizeCode(matched.rollNumber),
        )
      : undefined;

    return {
      success: true,
      candidate: {
        id: matched.id,
        name: matched.name,
        rollNumber: matched.rollNumber,
        phone: matched.phone || matched.guardianPhone || "",
        regionId: matched.regionId || "reg-dhaka",
        regionName: matched.regionName || "Dhaka Range",
        batch: matched.batch || "46th BCS & Cadet Batch",
        isSeatLocked: !!activeParticipant,
      },
    };
  });

// ============================================================================
// 3. LIVE SESSION LIFECYCLE & 500+ CONCURRENCY DELTA ENGINE
// ============================================================================

export const serverGetActiveRooms = createServerFn({ method: "GET" }).handler(async () => {
  const sessions = getLiveSessions();
  const cutoff = Date.now() - 4 * 3600 * 1000;
  const activeRooms = Object.values(sessions)
    .filter((s) => s.updatedAt >= cutoff && s.phase !== "podium")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
    .map((s) => ({
      pin: s.pin,
      quizId: s.quizId,
      quizTitleEn: s.quizTitleEn,
      quizTitleBn: s.quizTitleBn,
      hostId: s.hostId,
      phase: s.phase,
      participantCount: s.participantCount ?? Object.keys(s.participants).length,
      totalQuestions: s.totalQuestions,
      allowedRegionName: s.settings.allowedRegionName || "All Regions",
      createdAt: s.createdAt,
    }));

  return {
    success: true,
    rooms: activeRooms,
  };
});

export const serverCreateSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      quiz: Quiz;
      isFormal?: boolean | undefined;
      allowedRegionId?: string | undefined;
      allowedRegionName?: string | undefined;
      negativeMarking?: number | undefined;
      enforceFullscreen?: boolean | undefined;
      blockCopyPaste?: boolean | undefined;
      maxProctorViolations?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const actor = await getActorFromRequest();

    // Purge stale sessions older than 12 hours
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const key of Object.keys(sessions)) {
      const entry = sessions[key];
      if (!entry || entry.updatedAt < cutoff) {
        delete sessions[key];
      }
    }

    // Only authenticated staff persist new quizzes into server customQuizzes
    if (
      actor &&
      (actor.role === "admin" || actor.role === "instructor") &&
      data.quiz &&
      !READY_MADE_PACKS.some((p) => p.id === data.quiz.id)
    ) {
      const idx = store.customQuizzes.findIndex((q) => q.id === data.quiz.id);
      if (idx >= 0) store.customQuizzes[idx] = data.quiz;
      else store.customQuizzes.unshift(data.quiz);
      scheduleDiskPersist();
    }

    let pin = Math.floor(100000 + Math.random() * 900000).toString();
    while (sessions[pin]) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const isFormal = data.isFormal ?? true;
    const now = Date.now();
    const hostToken = generateHostToken();
    const enforceFs =
      data.enforceFullscreen ??
      store.branding.defaultEnforceFullscreen ??
      store.branding.enforceFullscreenDefault ??
      false;
    const blockCopy =
      data.blockCopyPaste ??
      store.branding.defaultBlockCopyPaste ??
      store.branding.blockCopyPasteDefault ??
      true;
    const maxViol =
      data.maxProctorViolations ??
      store.branding.defaultMaxProctorViolations ??
      store.branding.maxProctorViolationsDefault ??
      3;

    const newSession: ServerLiveSession = {
      pin,
      quizId: data.quiz.id,
      quizTitleEn: data.quiz.titleEn,
      quizTitleBn: data.quiz.titleBn,
      hostId: actor?.id || `host-${now}`,
      hostToken,
      phase: "lobby",
      currentQuestionIndex: -1,
      questionStartTime: 0,
      questionEndTime: 0,
      settings: {
        speedBonus: true,
        negativeMarking: data.negativeMarking ?? (isFormal ? 0.25 : 0),
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: isFormal,
        requireRollNumber: isFormal,
        requireRosterVerification: true,
        allowedRegionId: data.allowedRegionId || "all",
        allowedRegionName: data.allowedRegionName || "All Regions (National)",
        enforceFullscreen: enforceFs,
        blockCopyPaste: blockCopy,
        maxProctorViolations: maxViol,
      },
      participants: {},
      totalQuestions: data.quiz.questions.length,
      createdAt: now,
      updatedAt: now,
      participantCount: 0,
      answeredCount: 0,
      proctorIncidents: [],
      fullQuiz: data.quiz,
    };

    sessions[pin] = newSession;
    scheduleLiveSessionsPersist();
    return { success: true, session: toHostSessionView(newSession), hostToken };
  });

export const serverGetSession = createServerFn({ method: "GET" })
  .validator(
    (data: {
      pin: string;
      role?: "host" | "player" | undefined;
      participantId?: string | undefined;
      sinceUpdatedAt?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, notFound: true, session: null };
    }

    // Server-authoritative countdown auto-advance so disconnecting host never strands rooms
    if (session.phase === "countdown") {
      const started = session.countdownStartedAt || session.updatedAt;
      if (Date.now() - started >= 2800) {
        advanceSessionToQuestion(session, store, 0);
        scheduleLiveSessionsPersist();
      }
    }

    // Fast 304-style delta short-circuit if nothing changed since client's last poll
    if (data.sinceUpdatedAt && session.updatedAt <= data.sinceUpdatedAt) {
      return {
        success: true,
        unchanged: true,
        updatedAt: session.updatedAt,
        session: null,
      };
    }

    if (data.role === "player") {
      return {
        success: true,
        unchanged: false,
        updatedAt: session.updatedAt,
        session: buildPlayerSessionProjection(session, data.participantId),
      };
    }

    return {
      success: true,
      unchanged: false,
      updatedAt: session.updatedAt,
      session: toHostSessionView(session),
    };
  });

export const serverSyncSession = createServerFn({ method: "POST" })
  .validator((data: { session: GameSession; hostToken?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    if (!data?.session?.pin) {
      return { success: false, error: "Invalid session payload" };
    }
    const existing = sessions[data.session.pin];
    if (!existing) {
      const hostToken = data.hostToken || generateHostToken();
      sessions[data.session.pin] = {
        ...data.session,
        hostToken,
        updatedAt: Date.now(),
      };
      scheduleLiveSessionsPersist();
      return { success: true, session: toHostSessionView(sessions[data.session.pin]!), hostToken };
    }

    const actor = await getActorFromRequest();
    const isAuthorized =
      (existing.hostToken && data.hostToken === existing.hostToken) ||
      actor?.role === "admin" ||
      (!!actor && actor.id === existing.hostId);
    if (!isAuthorized) {
      return { success: false, error: "Host authorization required." };
    }

    existing.phase = data.session.phase;
    existing.currentQuestionIndex = data.session.currentQuestionIndex;
    if (data.session.currentQuestion) {
      existing.currentQuestion = data.session.currentQuestion;
    }
    existing.questionStartTime = data.session.questionStartTime;
    existing.questionEndTime = data.session.questionEndTime;
    existing.settings = { ...existing.settings, ...data.session.settings };
    for (const [pId, pObj] of Object.entries(data.session.participants || {})) {
      if (!existing.participants[pId]) {
        existing.participants[pId] = pObj;
      }
    }
    recalculateSessionMetrics(existing);
    scheduleLiveSessionsPersist();
    return { success: true, session: toHostSessionView(existing) };
  });

export const serverJoinSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      participant: Participant;
      verificationNumber?: string | undefined;
      seatToken?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: "No active examination room found for this PIN." };
    }

    const incoming = data.participant;
    const requestedCandidateId = incoming.candidateId;
    const requestedRoll = normalizeCode(incoming.rollNumber);
    const requestedPhone = normalizeDigits(incoming.phone || data.verificationNumber);

    // 1. Check Region Restriction
    if (
      session.settings.allowedRegionId &&
      session.settings.allowedRegionId !== "all" &&
      incoming.regionId &&
      incoming.regionId !== session.settings.allowedRegionId
    ) {
      return {
        success: false,
        error: `Access Restricted: This examination room is exclusively for ${session.settings.allowedRegionName}.`,
      };
    }

    // 2. If joining as an enrolled Roster Candidate, verify their Mobile / Roll Number ownership
    const rosterMatch = store.roster.find(
      (s) =>
        (requestedCandidateId && s.id === requestedCandidateId) ||
        (requestedRoll && normalizeCode(s.rollNumber) === requestedRoll),
    );

    if (rosterMatch) {
      const enrolledPhone = normalizeDigits(rosterMatch.phone || rosterMatch.guardianPhone);
      const enrolledRoll = normalizeCode(rosterMatch.rollNumber);
      const verifyInput = normalizeDigits(
        data.verificationNumber || incoming.phone || incoming.rollNumber,
      );
      const verifyCodeInput = normalizeCode(data.verificationNumber || incoming.rollNumber);

      // Verify ownership so Student A cannot pick Student B from the Region dropdown without knowing their number
      const phoneMatches =
        enrolledPhone.length >= 4 &&
        verifyInput.length >= 4 &&
        (enrolledPhone === verifyInput || enrolledPhone.endsWith(verifyInput.slice(-4)));
      const rollMatches = enrolledRoll && verifyCodeInput && enrolledRoll === verifyCodeInput;

      if (!phoneMatches && !rollMatches) {
        return {
          success: false,
          code: "VERIFICATION_FAILED",
          error: `Identity Verification Failed for ${rosterMatch.name}. Please enter the registered Mobile Number or exact Roll Number (${rosterMatch.rollNumber}) to unlock this seat.`,
        };
      }

      // Normalize participant details from authoritative roster
      incoming.candidateId = rosterMatch.id;
      incoming.name = rosterMatch.name;
      incoming.nickname = rosterMatch.name;
      incoming.rollNumber = rosterMatch.rollNumber;
      incoming.phone = rosterMatch.phone || rosterMatch.guardianPhone;
      incoming.regionId = rosterMatch.regionId || incoming.regionId || "reg-dhaka";
      incoming.regionName = rosterMatch.regionName || incoming.regionName || "Dhaka Range";
      incoming.batch = rosterMatch.batch;
    } else if (incoming.rollNumber && incoming.name) {
      // Auto-enroll new verified candidate into the Region roster so Admin has their record
      const newStd: RosterStudent = {
        id: `std-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        rollNumber: incoming.rollNumber,
        name: incoming.name,
        phone: incoming.phone || data.verificationNumber || "",
        regionId: incoming.regionId || "reg-dhaka",
        regionName: incoming.regionName || "Dhaka Range",
        batch: "Live Arena Induction",
        guardianPhone: incoming.phone || "",
        createdAt: new Date().toISOString(),
      };
      store.roster.push(newStd);
      incoming.candidateId = newStd.id;
      scheduleDiskPersist();
    }

    // 3. Anti-Impersonation Single-Seat Lock Check
    const existingSeat = Object.values(session.participants).find(
      (p) =>
        (incoming.candidateId && p.candidateId === incoming.candidateId) ||
        (incoming.rollNumber &&
          normalizeCode(p.rollNumber) === normalizeCode(incoming.rollNumber)) ||
        (requestedPhone.length >= 10 && normalizeDigits(p.phone) === requestedPhone),
    );

    const clientSeatToken =
      data.seatToken ||
      incoming.seatToken ||
      `seat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (existingSeat) {
      // Allow seamless reconnection ONLY if the browser presents the matching seatToken
      if (existingSeat.seatToken && existingSeat.seatToken === clientSeatToken) {
        existingSeat.connected = true;
        existingSeat.lastActive = Date.now();
        recalculateSessionMetrics(session);
        return {
          success: true,
          reconnected: true,
          participant: existingSeat,
          seatToken: existingSeat.seatToken,
          session: buildPlayerSessionProjection(session, existingSeat.id),
        };
      }

      return {
        success: false,
        code: "SEAT_LOCKED",
        error: `Anti-Impersonation Lock: ${existingSeat.nickname} (Roll: ${existingSeat.rollNumber || "N/A"}) is already active in this exam room on another device. Nobody else can appear in their exam. If you switched phones, ask the Host to click "Unlock Seat".`,
      };
    }

    const participantRecord: Participant = {
      ...incoming,
      seatToken: clientSeatToken,
      score: 0,
      streak: 0,
      rank: Object.keys(session.participants).length + 1,
      answers: {},
      connected: true,
      lastActive: Date.now(),
      proctorFlags: 0,
      isSuspended: false,
    };

    session.participants[participantRecord.id] = participantRecord;
    recalculateSessionMetrics(session);

    return {
      success: true,
      reconnected: false,
      participant: participantRecord,
      seatToken: clientSeatToken,
      session: buildPlayerSessionProjection(session, participantRecord.id),
    };
  });

export const serverSubmitAnswer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      participantId: string;
      questionId: string;
      selectedOptionIds?: string[] | undefined;
      writtenAnswer?: string | undefined;
      seatToken?: string | undefined;
      clientAnsweredAt?: number | undefined;
      // Legacy fallback fields
      answer?: ParticipantAnswer | undefined;
      scoreDelta?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: "Session not found on server" };
    }

    const p = session.participants[data.participantId];
    if (!p) {
      return { success: false, error: "Participant not found in session" };
    }

    if (p.isSuspended) {
      return { success: false, error: "Exam suspended by Proctor due to focus violations." };
    }

    // Prevent duplicate answer submission for the same question
    if (p.answers[data.questionId]) {
      return {
        success: true,
        alreadyAnswered: true,
        answer: p.answers[data.questionId],
        participant: p,
        session: buildPlayerSessionProjection(session, p.id),
      };
    }

    // Authoritative server-side grading using fullQuiz
    const fullQuestion =
      session.fullQuiz?.questions.find((q) => q.id === data.questionId) ||
      READY_MADE_PACKS.flatMap((pack) => pack.questions).find((q) => q.id === data.questionId) ||
      session.currentQuestion;

    const selectedIds = data.selectedOptionIds || data.answer?.selectedOptionIds || [];
    const written = (data.writtenAnswer ?? data.answer?.writtenAnswer ?? "").trim();

    let answerRecord: ParticipantAnswer;

    if (fullQuestion) {
      // Support offline-queued answers with fair timestamp clamping
      const effectiveTimestamp = data.clientAnsweredAt
        ? Math.max(
            session.questionStartTime || Date.now(),
            Math.min(Date.now(), data.clientAnsweredAt),
          )
        : Date.now();
      const elapsedSec =
        (effectiveTimestamp - (session.questionStartTime || effectiveTimestamp)) / 1000;
      const timeTakenSec = Math.max(1, Math.min(fullQuestion.timeLimitSec || 20, elapsedSec));

      const graded = evaluateQuestionAnswer({
        question: fullQuestion,
        selectedOptionIds: selectedIds,
        writtenAnswer: written,
        currentStreak: p.streak,
        timeTakenSec,
        speedBonus: !!session.settings.speedBonus,
        negativeMarking: session.settings.negativeMarking || 0,
      });

      answerRecord = {
        questionId: data.questionId,
        selectedOptionIds: selectedIds,
        writtenAnswer: written || undefined,
        isCorrect: graded.isCorrect,
        timeTakenSec,
        pointsAwarded: graded.pointsAwarded,
        streakCount: graded.newStreak,
        answeredAt: effectiveTimestamp,
      };

      p.answers[data.questionId] = answerRecord;
      p.score = Math.max(0, p.score + graded.pointsAwarded);
      p.streak = graded.newStreak;
      p.lastActive = Date.now();
    } else if (data.answer) {
      answerRecord = data.answer;
      p.answers[data.questionId] = answerRecord;
      p.score = Math.max(0, p.score + (data.scoreDelta ?? data.answer.pointsAwarded ?? 0));
      p.streak = data.answer.isCorrect ? p.streak + 1 : 0;
      p.lastActive = Date.now();
    } else {
      return { success: false, error: "Unable to grade question" };
    }

    recalculateSessionMetrics(session);

    return {
      success: true,
      answer: answerRecord,
      participant: p,
      session: buildPlayerSessionProjection(session, p.id),
    };
  });

export const serverReportProctorIncident = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      participantId: string;
      type: "tab_switch" | "window_blur" | "fullscreen_exit" | "copy_attempt" | "devtools_attempt";
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    if (!session) return { success: false };

    const p = session.participants[data.participantId];
    if (!p) return { success: false };

    const maxViolations = session.settings.maxProctorViolations || 3;
    p.proctorFlags = (p.proctorFlags || 0) + 1;
    if (p.proctorFlags >= maxViolations && session.settings.isFormalAssessment) {
      p.isSuspended = true;
    }

    const incident: ProctorIncidentRecord = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: data.type,
      timestamp: new Date().toISOString(),
      candidateId: p.id,
      candidateName: p.nickname || p.name,
      rollNumber: p.rollNumber,
      regionName: p.regionName,
    };

    if (!session.proctorIncidents) session.proctorIncidents = [];
    session.proctorIncidents.unshift(incident);
    if (session.proctorIncidents.length > 100) {
      session.proctorIncidents.length = 100;
    }

    session.updatedAt = Date.now();
    return {
      success: true,
      proctorFlags: p.proctorFlags,
      isSuspended: !!p.isSuspended,
    };
  });

export const serverHostControl = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      hostToken?: string | undefined;
      action:
        | "start_game"
        | "next_question"
        | "show_chart"
        | "show_leaderboard"
        | "end_game"
        | "close_room"
        | "kick_player"
        | "pardon_player"
        | "add_bots"
        | "update_settings";
      questionIndex?: number | undefined;
      participantId?: string | undefined;
      botCount?: number | undefined;
      settings?: Partial<GameSettings> | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const actor = await getActorFromRequest();
    const isAuthorized =
      (!!session.hostToken && data.hostToken === session.hostToken) ||
      actor?.role === "admin" ||
      (!!actor && actor.id === session.hostId);
    if (!isAuthorized) {
      return {
        success: false,
        error: "Unauthorized: host control requires the room host token or administrator sign-in.",
      };
    }

    switch (data.action) {
      case "start_game": {
        session.phase = "countdown";
        session.countdownStartedAt = Date.now();
        session.updatedAt = session.countdownStartedAt;
        break;
      }
      case "next_question": {
        if (
          data.questionIndex === 0 &&
          session.phase === "question" &&
          session.currentQuestionIndex === 0
        ) {
          break;
        }
        advanceSessionToQuestion(session, store, data.questionIndex);
        break;
      }
      case "show_chart": {
        session.phase = "chart";
        recalculateSessionMetrics(session);
        break;
      }
      case "show_leaderboard": {
        session.phase = "leaderboard";
        recalculateSessionMetrics(session);
        break;
      }
      case "end_game": {
        session.phase = "podium";
        recalculateSessionMetrics(session);
        persistCompletedExamToStore(session);
        break;
      }
      case "kick_player": {
        if (data.participantId && session.participants[data.participantId]) {
          delete session.participants[data.participantId];
          recalculateSessionMetrics(session);
        }
        break;
      }
      case "pardon_player": {
        const target = data.participantId ? session.participants[data.participantId] : undefined;
        if (target) {
          target.isSuspended = false;
          target.proctorFlags = 0;
          session.updatedAt = Date.now();
        }
        break;
      }
      case "update_settings": {
        if (data.settings) {
          session.settings = { ...session.settings, ...data.settings };
          session.updatedAt = Date.now();
        }
        break;
      }
      case "add_bots": {
        const count = data.botCount || 8;
        const sampleRegions = store.regions.length ? store.regions : DEFAULT_REGIONS;
        const botProfiles = [
          { name: "Cadet Tanvir", emoji: "🦅", bg: "#059669" },
          { name: "Cadet Sadia", emoji: "⚡", bg: "#0284c7" },
          { name: "Cadet Rafiul", emoji: "🛡️", bg: "#d97706" },
          { name: "Cadet Nusrat", emoji: "🎯", bg: "#0d9488" },
          { name: "Cadet Farhan", emoji: "🚀", bg: "#2563eb" },
          { name: "Cadet Mehnaz", emoji: "⭐", bg: "#e11d48" },
          { name: "Cadet Tahmid", emoji: "🔥", bg: "#ea580c" },
          { name: "Cadet Sumaiya", emoji: "🏆", bg: "#16a34a" },
        ];
        botProfiles.slice(0, count).forEach((b, idx) => {
          const reg = sampleRegions[idx % sampleRegions.length] || DEFAULT_REGIONS[0];
          const botId = `bot-${idx + 1}-${Date.now()}`;
          session.participants[botId] = {
            id: botId,
            name: b.name,
            nickname: b.name,
            avatarEmoji: b.emoji,
            avatarBg: b.bg,
            rollNumber: `2026-${200 + idx + 1}`,
            regionId: reg?.id || "reg-dhaka",
            regionName: reg?.nameEn || "Dhaka Range",
            score: 0,
            streak: 0,
            rank: Object.keys(session.participants).length + 1,
            isBot: true,
            answers: {},
            connected: true,
            lastActive: Date.now(),
          };
        });
        recalculateSessionMetrics(session);
        break;
      }
      case "close_room": {
        delete sessions[data.pin];
        scheduleLiveSessionsPersist();
        return {
          success: true,
          closed: true,
          session: null,
        };
      }
    }

    scheduleLiveSessionsPersist();
    return {
      success: true,
      session: toHostSessionView(session),
    };
  });

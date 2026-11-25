import { createServerFn } from "@tanstack/react-start";
import {
  AiPoolConfig,
  AiPoolNode,
  AiPoolRoutingStrategy,
  AiProviderId,
  AiTaskCapability,
  BrandingSettings,
  CertificateData,
  Course,
  CourseAnnouncement,
  CourseCompletionRequirement,
  CourseKnowledgeCategory,
  CourseKnowledgeEntry,
  CourseMaterial,
  CourseRecording,
  ExamResultRecord,
  ExamSessionRecord,
  FinalExamAttempt,
  GameSession,
  GameSettings,
  LedgerOtsCheckpoint,
  ManagedUser,
  Participant,
  ParticipantAnswer,
  PracticalExam,
  PracticalGrade,
  PracticalSubmission,
  PracticalTaskAnswer,
  ProctorIncidentRecord,
  Question,
  Quiz,
  Region,
  RosterStudent,
} from "./types";
import {
  DEFAULT_BRANDING_SETTINGS,
  getCertificateDesignProfile,
  mergeBrandingSettings,
} from "./branding";
import { purgeUnderThresholdExamsInStore, type PurgeExamSummary } from "./exam-purge";
import {
  generateQuizViaAiPool,
  resolveEnvGeminiApiKey,
} from "./ai-quiz-core";
import {
  AI_PROVIDER_CATALOG,
  buildEffectivePoolNodes,
  createDefaultAiPoolConfig,
  hasAnyConfiguredAiProvider,
  normalizeAiPoolConfig,
  pingAiPoolNode,
  sanitizeAiPoolConfig,
} from "./ai-pool";
import {
  buildAiTutorContext,
  buildDefaultSanjibonLmsContent,
  newLmsId,
} from "./lms-content";
import {
  buildDefaultSanjibonKnowledgeBase,
  buildPlatformSupportContext,
  retrieveCourseKnowledgeContext,
} from "./course-kb";
import {
  buildSanjibonDriveKnowledgeBase,
  buildSanjibonDriveMaterials,
} from "./sanjibon-drive-materials";
import {
  askCourseTutorViaAiPool,
  type TutorHistoryTurn,
  type TutorStudyMode,
} from "./ai-tutor-core";
import {
  analyzeExamSessionViaAiPool,
  draftLmsContentViaAiPool,
  suggestPracticalGradeViaAiPool,
} from "./ai-copilots";
import {
  buildCourseCertificateEmail,
  buildQuizCertificateEmail,
  isPortalEmailConfigured,
  isValidPortalEmail,
  normalizePortalEmail,
  resolveBrevoApiKey,
  resolveResendApiKey,
  sendPortalOtpEmail,
  sendTransactionalEmail,
} from "./email-otp";
import {
  buildOriginalCompletionIndex,
  findCompletedMatchInIndex,
  getResultSubmittedAnswersCount,
  mergeRetakeExamResults,
  normalizeMatchRoll,
  resolveRetakeMinCompletedAnswers,
} from "./retake-utils";
import {
  DEFAULT_COURSES,
  DEFAULT_REGIONS,
  DEFAULT_USERS,
  LEGACY_BCS_COURSE_ID,
  LEGACY_BCS_QUIZ_ID,
  READY_MADE_PACKS,
  SAMPLE_ROSTER,
} from "./mock-data";
import {
  buildDefaultCourseRequirement,
  buildDefaultFinalPracticalExam,
  buildFinalQuizRecordSnapshot,
  expandFinalQuizIds,
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
  generateFinalExamJoinPin,
  marksFromPct,
  mergeMakeupQuizIntoFinalExam,
  SANJIBON_QUIZ17_MAKEUP_ID,
  shouldUpgradeFinalExamPackage,
  upgradeFinalExamPackage,
  computeCombinedFinalPct,
  computePracticalScorePct,
  evaluateCourseCompletion,
  findBestQuizResultForCourse,
  findBestQuizResultMatchForCourse,
  isPracticalPastDeadline,
  makeCourseCertificateNumber,
  matchRosterIdentity,
  normalizeExamWeights,
  validateSubmissionPayload,
  type FinalQuizRecordSnapshot,
} from "./practical-exam";
import {
  buildFinalGradeSheetRows,
  type FinalGradeSheetRow,
} from "./final-gradesheet";
import {
  isCoursePrivate,
  isQuizPrivate,
  normalizeBdPhone,
  normalizeRollToken,
  SANJIBON_COURSE,
  SANJIBON_QUIZZES,
} from "./sanjibon-seed-data";
import {
  canActorMutateStoreAction,
  generateHostToken,
  getCertificateSigningKeys,
  getNodeCrypto,
  getServerSessionSecret,
  hashPasswordScrypt,
  sanitizeUserForClient,
  sealCertificateWithLedger,
  signSessionToken,
  verifyCertificateCryptographically,
  verifyPasswordScrypt,
  verifySessionToken,
} from "./server-security";
import {
  compareParticipantsByMerit,
  computeParticipantAccuracyPct,
  computeParticipantTotalScore,
  computeParticipantTotalTimeSec,
  computeTotalQuizMarks,
  evaluateQuestionAnswer,
  isPassingScore,
  mergeSessionSettingsPatch,
  resolveOrgName,
  resolvePassThresholdPct,
  resolveQuestionTimeLimitSec,
  resolveStartCountdownSec,
  splitBetweenQuestionDelays,
} from "./scoring";
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
  ...DEFAULT_BRANDING_SETTINGS,
};

interface PersistentStoreData {
  regions: Region[];
  roster: RosterStudent[];
  courses: Course[];
  users: ManagedUser[];
  customQuizzes: Quiz[];
  deletedQuizIds?: string[] | undefined;
  deletedRegionIds?: string[] | undefined;
  deletedCourseIds?: string[] | undefined;
  examSessions: ExamSessionRecord[];
  examResults: ExamResultRecord[];
  certificates: CertificateData[];
  revokedCertificates?: string[] | undefined;
  revokedCertificateArchive?: Record<string, CertificateData> | undefined;
  practicalExams?: PracticalExam[] | undefined;
  practicalSubmissions?: PracticalSubmission[] | undefined;
  finalExamAttempts?: FinalExamAttempt[] | undefined;
  courseMaterials?: CourseMaterial[] | undefined;
  courseRecordings?: CourseRecording[] | undefined;
  courseAnnouncements?: CourseAnnouncement[] | undefined;
  courseKnowledgeBase?: CourseKnowledgeEntry[] | undefined;
  courseRequirements?: CourseCompletionRequirement[] | undefined;
  seededLmsContentV1?: boolean | undefined;
  seededCourseKbV1?: boolean | undefined;
  migratedSanjibonDriveLmsV1?: boolean | undefined;
  purgedSampleData?: boolean | undefined;
  purgedUnder50Initial?: boolean | undefined;
  purgedBcsDemoCourse?: boolean | undefined;
  purgedBcsDemoCourseV2?: boolean | undefined;
  seededFinalPractical?: boolean | undefined;
  migratedFinalExamPackageV1?: boolean | undefined;
  migratedSanjibonS03V2?: boolean | undefined;
  migratedSanjibonS05V4?: boolean | undefined;
  /** One-shot: reset every admin/instructor password to role defaults. */
  staffPasswordsResetV1?: boolean | undefined;
  autoIssueQuizCertificates?: boolean | undefined;
  serverGeminiApiKey?: string | undefined;
  aiPool?: AiPoolConfig | undefined;
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
  isSelfPractice?: boolean | undefined;
  fullQuiz?: Quiz | undefined;
  cachedTop5?: Participant[] | undefined;
  cachedSanitizedQuestion?: Question | undefined;
  questionStartTimes?: Record<string, number> | undefined;
};

interface PendingPhoneOtp {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
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
  __onneshaSaveBusy?: boolean;
  __onneshaSaveDirty?: boolean;
  __onneshaLiveSaveTimer?: ReturnType<typeof setTimeout> | null;
  __onneshaLiveSaveBusy?: boolean;
  __onneshaLiveSaveDirty?: boolean;
  __onneshaTmpSeq?: number;
  __onneshaShutdownHooked?: boolean;
  __onneshaPhoneOtps?: Record<string, PendingPhoneOtp>;
  __onneshaEmailOtps?: Record<string, PendingPhoneOtp>;
  __onneshaAnchorCooldowns?: Record<string, number>;
  __onneshaFinalAttemptIndex?: Map<string, number>;
  __onneshaSaveDelayMs?: number | undefined;
};

const AUTH_COOKIE_NAME = "onnesha_sid";
const STUDENT_PORTAL_COOKIE = "onnesha_student";

async function getServerHelpers() {
  return await import("@tanstack/react-start/server");
}

async function getRosterStudentFromPortalCookie(
  store: PersistentStoreData,
): Promise<RosterStudent | null> {
  try {
    const { getCookie } = await getServerHelpers();
    const token = getCookie(STUDENT_PORTAL_COOKIE);
    if (!token) return null;
    const { dataDir } = getStorePaths();
    const secret = getServerSessionSecret(dataDir);
    const verified = verifySessionToken(token, secret);
    if (!verified?.uid || !String(verified.uid).startsWith("student:")) return null;
    const studentId = String(verified.uid).slice("student:".length);
    return store.roster.find((s) => s.id === studentId) || null;
  } catch {
    return null;
  }
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
    const withCourse =
      u.id === "usr-super-admin" || u.id === "usr-instructor-1"
        ? {
            ...u,
            assignedCourseIds: Array.from(
              new Set(["course-sanjibon-ai-dm", ...(u.assignedCourseIds || [])]),
            ),
          }
        : u;
    if (withCourse.passwordHash && !withCourse.passwordHash.startsWith("scrypt:")) {
      return { ...withCourse, passwordHash: hashPasswordScrypt(withCourse.passwordHash) };
    }
    return withCourse;
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

/**
 * Idempotently merges default/Sanijbon seed regions, courses, and student roster
 * into an existing persistent store without overwriting user-added records.
 */
export function mergeSeededStoreData<
  T extends {
    regions: Region[];
    courses: Course[];
    roster: RosterStudent[];
    purgedSampleData?: boolean | undefined;
    deletedRegionIds?: string[] | undefined;
    deletedCourseIds?: string[] | undefined;
  },
>(current: T): T {
  const deletedRegionSet = new Set(current.deletedRegionIds || []);
  const regions = [...current.regions];
  for (const defReg of DEFAULT_REGIONS) {
    if (deletedRegionSet.has(defReg.id)) continue;
    const idx = regions.findIndex((r) => r.id === defReg.id);
    if (idx === -1) {
      regions.push(defReg);
    } else if (
      (defReg.id === "reg-sylhet" && regions[idx]?.nameEn === "Sylhet Range") ||
      (defReg.id === "reg-barishal" && regions[idx]?.nameEn === "Barishal Range")
    ) {
      // Upgrade generic Sylhet/Barishal placeholder names to official Training Centres
      regions[idx] = { ...regions[idx]!, ...defReg };
    }
  }

  if (current.purgedSampleData) {
    return {
      ...current,
      regions,
    };
  }

  const deletedCourseSet = new Set(current.deletedCourseIds || []);
  const courses = [...current.courses];
  for (const defCourse of DEFAULT_COURSES) {
    if (deletedCourseSet.has(defCourse.id)) continue;
    const existingIdx = courses.findIndex((c) => c.id === defCourse.id);
    if (existingIdx === -1) {
      if (defCourse.id === "course-sanjibon-ai-dm") {
        courses.unshift(defCourse);
      } else {
        courses.push(defCourse);
      }
    } else if (courses[existingIdx]) {
      const existingCourse = courses[existingIdx]!;
      courses[existingIdx] = {
        ...existingCourse,
        isPrivate:
          typeof existingCourse.isPrivate === "boolean"
            ? existingCourse.isPrivate
            : isCoursePrivate(defCourse),
      };
    }
  }

  const roster = [...current.roster];
  const seenIds = new Set(roster.map((s) => s.id));
  const seenRolls = new Set(roster.map((s) => normalizeRollToken(s.rollNumber)));
  for (const defStudent of SAMPLE_ROSTER) {
    const rollTok = normalizeRollToken(defStudent.rollNumber);
    // Backfill missing portal email onto existing roster rows matched by roll.
    if (rollTok && defStudent.email) {
      const existingIdx = roster.findIndex(
        (s) => normalizeRollToken(s.rollNumber) === rollTok && !(s.email || "").trim(),
      );
      if (existingIdx >= 0) {
        roster[existingIdx] = { ...roster[existingIdx]!, email: defStudent.email };
      }
    }
    if (!seenIds.has(defStudent.id) && (!rollTok || !seenRolls.has(rollTok))) {
      roster.push(defStudent);
      seenIds.add(defStudent.id);
      if (rollTok) seenRolls.add(rollTok);
    }
  }

  return {
    ...current,
    regions,
    courses,
    roster,
  };
}

/**
 * One-time curriculum migration merging Quiz 4 into the 20-question Quiz 3 (Session 03 Final Slide):
 * removes any stale persisted override for quiz-sanjibon-s03 / quiz-sanjibon-s04 so the updated
 * canonical READY_MADE_PACKS definition is served cleanly, while keeping all user quizzes & results.
 */
export function migrateSanjibonQ3MergeInStore<
  T extends {
    courses: Course[];
    customQuizzes: Quiz[];
  },
>(store: T): { removedQuizOverrides: number; updatedCourseDesc: boolean } {
  const beforeLen = store.customQuizzes.length;
  store.customQuizzes = store.customQuizzes.filter(
    (q) => q.id !== "quiz-sanjibon-s03" && q.id !== "quiz-sanjibon-s04",
  );
  const removedQuizOverrides = beforeLen - store.customQuizzes.length;

  let updatedCourseDesc = false;
  const courseIdx = store.courses.findIndex((c) => c.id === SANJIBON_COURSE.id);
  if (courseIdx >= 0 && store.courses[courseIdx]) {
    const cur = store.courses[courseIdx]!;
    if (
      cur.descriptionEn !== SANJIBON_COURSE.descriptionEn ||
      cur.descriptionBn !== SANJIBON_COURSE.descriptionBn
    ) {
      store.courses[courseIdx] = {
        ...cur,
        descriptionEn: SANJIBON_COURSE.descriptionEn,
        descriptionBn: SANJIBON_COURSE.descriptionBn,
      };
      updatedCourseDesc = true;
    }
  }
  return { removedQuizOverrides, updatedCourseDesc };
}

/**
 * One-time migration refreshing Quiz 5 (`quiz-sanjibon-s05`) with the exact 15 Session 05-06
 * video-production items while preserving all custom quizzes and past exam results.
 */
export function migrateSanjibonQ5ExactInStore<
  T extends {
    customQuizzes: Quiz[];
    deletedQuizIds?: string[] | undefined;
  },
>(store: T): { removedQ5Override: boolean } {
  const before = store.customQuizzes.length;
  store.customQuizzes = store.customQuizzes.filter((q) => q.id !== "quiz-sanjibon-s05");
  if (Array.isArray(store.deletedQuizIds)) {
    store.deletedQuizIds = store.deletedQuizIds.filter(
      (tok) => tok !== "quiz-sanjibon-s05" && tok !== "sanjibon-session-05-video-ads",
    );
  }
  return { removedQ5Override: store.customQuizzes.length < before };
}

export function deleteQuizInStore<
  T extends {
    customQuizzes: Quiz[];
    deletedQuizIds?: string[] | undefined;
  },
>(store: T, quizIdOrSlug: string, builtInPacks: Quiz[] = READY_MADE_PACKS): boolean {
  const key = (quizIdOrSlug || "").trim();
  if (!key) return false;
  const tokensToTombstone = new Set<string>([key]);
  const matchedCustom = store.customQuizzes.find((q) => q.id === key || q.slug === key);
  if (matchedCustom) {
    tokensToTombstone.add(matchedCustom.id);
    if (matchedCustom.slug) tokensToTombstone.add(matchedCustom.slug);
  }
  const matchedPack = builtInPacks.find((q) => q.id === key || q.slug === key);
  if (matchedPack) {
    tokensToTombstone.add(matchedPack.id);
    if (matchedPack.slug) tokensToTombstone.add(matchedPack.slug);
  }

  store.customQuizzes = store.customQuizzes.filter(
    (q) => !tokensToTombstone.has(q.id) && (!q.slug || !tokensToTombstone.has(q.slug)),
  );
  const existingDeleted = new Set(store.deletedQuizIds || []);
  for (const tok of tokensToTombstone) {
    if (builtInPacks.some((p) => p.id === tok || p.slug === tok)) {
      existingDeleted.add(tok);
    }
  }
  store.deletedQuizIds = Array.from(existingDeleted);
  return true;
}

export function clearDeletedQuizTokensInStore<T extends { deletedQuizIds?: string[] | undefined }>(
  store: T,
  quiz: Pick<Quiz, "id" | "slug">,
): void {
  if (!Array.isArray(store.deletedQuizIds) || store.deletedQuizIds.length === 0) return;
  store.deletedQuizIds = store.deletedQuizIds.filter(
    (tok) => tok !== quiz.id && (!quiz.slug || tok !== quiz.slug),
  );
}

export function ensureStoreAiPool(store: PersistentStoreData): AiPoolConfig {
  if (!store.aiPool) {
    store.aiPool = createDefaultAiPoolConfig();
  } else if (!Array.isArray(store.aiPool.nodes) || !Array.isArray(store.aiPool.logs)) {
    store.aiPool = normalizeAiPoolConfig(store.aiPool);
  }
  return store.aiPool;
}

export function resolveServerGeminiApiKey(
  store: Pick<PersistentStoreData, "serverGeminiApiKey">,
  clientOverride?: string,
): { apiKey?: string; source: "client" | "server" | "env" | "none" } {
  const clientKey = (clientOverride || "").trim();
  if (clientKey.length >= 10) return { apiKey: clientKey, source: "client" };
  const storedKey = (store.serverGeminiApiKey || "").trim();
  if (storedKey.length >= 10) return { apiKey: storedKey, source: "server" };
  const envKey = resolveEnvGeminiApiKey();
  if (envKey) return { apiKey: envKey, source: "env" };
  return { source: "none" };
}

/**
 * Resolves a trainee from the roster by normalized BD mobile number (full or trailing digits),
 * exact/case-insensitive Roll Number (`JHN-01` / `jhn01`), centre-scoped serial (`1` + regionId),
 * or registered email address.
 */
export function findRosterCandidate(
  roster: RosterStudent[],
  query: string,
  regionId?: string,
): RosterStudent | undefined {
  const rawQuery = (query || "").trim();
  if (!rawQuery) return undefined;

  const lowerQuery = rawQuery.toLowerCase();
  const normRollQuery = normalizeRollToken(rawQuery);
  const digitsQuery = normalizeDigits(rawQuery);
  const normPhoneQuery = normalizeBdPhone(rawQuery);
  const isSerialQuery = !!regionId && regionId !== "all" && /^\d{1,2}$/.test(rawQuery);

  // 1. Exact Roll Number match (supports `JHN-01` and `jhn01`)
  if (normRollQuery.length >= 3) {
    const exactRoll = roster.find((s) => normalizeRollToken(s.rollNumber) === normRollQuery);
    if (exactRoll) return exactRoll;
  }

  // 2. Email lookup (when input looks like an email)
  if (lowerQuery.includes("@")) {
    const emailMatch = roster.find((s) => (s.email || "").trim().toLowerCase() === lowerQuery);
    if (emailMatch) return emailMatch;
  }

  // 3. Centre-scoped Serial Number lookup (e.g. typing `1` or `01` after picking a centre)
  if (isSerialQuery && regionId) {
    const padded = rawQuery.padStart(2, "0");
    const serialMatch = roster.find(
      (s) => s.regionId === regionId && s.rollNumber.toUpperCase().endsWith(`-${padded}`),
    );
    if (serialMatch) return serialMatch;
  }

  // 4. Exact Normalized BD Phone lookup (01XXXXXXXXX, +8801XXXXXXXXX, etc.)
  if (normPhoneQuery.length >= 8) {
    const exactPhone = roster.find((s) => {
      const p1 = normalizeBdPhone(s.phone);
      const p2 = normalizeBdPhone(s.guardianPhone);
      return (p1 && p1 === normPhoneQuery) || (p2 && p2 === normPhoneQuery);
    });
    if (exactPhone) return exactPhone;
  }

  // 5. Partial suffix lookup (6+ trailing phone digits or 3+ roll suffix)
  const scopedPool =
    regionId && regionId !== "all" ? roster.filter((s) => s.regionId === regionId) : roster;
  const searchPools = scopedPool.length < roster.length ? [scopedPool, roster] : [roster];

  for (const pool of searchPools) {
    const suffixMatch = pool.find((s) => {
      const sRoll = normalizeCode(s.rollNumber);
      const p1 = normalizeBdPhone(s.phone);
      const p2 = normalizeBdPhone(s.guardianPhone);

      const rollSuffix = digitsQuery.length >= 3 && sRoll.endsWith(digitsQuery);
      const phoneSuffix =
        digitsQuery.length >= 6 &&
        ((p1 && (p1.endsWith(digitsQuery) || (p1.length >= 8 && normPhoneQuery.endsWith(p1)))) ||
          (p2 && (p2.endsWith(digitsQuery) || (p2.length >= 8 && normPhoneQuery.endsWith(p2)))));

      return rollSuffix || phoneSuffix;
    });
    if (suffixMatch) return suffixMatch;
  }

  return undefined;
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
        try {
          const parsed = JSON.parse(raw) as Partial<PersistentStoreData>;
          const cleanedRoster = (parsed.roster || []).filter(
            (s) => !(/^st-([1-9]|10)$/.test(s.id) && s.email?.endsWith("@academy.edu.bd")),
          );
          const cleanedResults = (parsed.examResults || []).filter(
            (r) => !(r.participantId || "").startsWith("bot-"),
          );
          const purged = !!parsed.purgedSampleData;
          return mergeSeededStoreData({
            regions: Array.isArray(parsed.regions) ? parsed.regions : [...DEFAULT_REGIONS],
            roster: cleanedRoster,
            courses: purged
              ? parsed.courses || []
              : parsed.courses?.length
                ? parsed.courses
                : [...DEFAULT_COURSES],
            users: ensureDefaultUsers(parsed.users),
            customQuizzes: parsed.customQuizzes || [],
            deletedQuizIds: parsed.deletedQuizIds || [],
            deletedRegionIds: parsed.deletedRegionIds || [],
            deletedCourseIds: parsed.deletedCourseIds || [],
            examSessions: parsed.examSessions || [],
            examResults: cleanedResults,
            certificates: parsed.certificates || [],
            revokedCertificates: parsed.revokedCertificates || [],
            revokedCertificateArchive: parsed.revokedCertificateArchive || {},
            practicalExams: parsed.practicalExams || [],
            practicalSubmissions: parsed.practicalSubmissions || [],
            finalExamAttempts: parsed.finalExamAttempts || [],
            courseMaterials: parsed.courseMaterials || [],
            courseRecordings: parsed.courseRecordings || [],
            courseAnnouncements: parsed.courseAnnouncements || [],
            courseKnowledgeBase: parsed.courseKnowledgeBase || [],
            courseRequirements: parsed.courseRequirements || [],
            seededLmsContentV1: !!parsed.seededLmsContentV1,
            seededCourseKbV1: !!parsed.seededCourseKbV1,
            migratedSanjibonDriveLmsV1: !!parsed.migratedSanjibonDriveLmsV1,
            purgedSampleData: purged,
            purgedUnder50Initial: !!parsed.purgedUnder50Initial,
            purgedBcsDemoCourse: !!parsed.purgedBcsDemoCourse,
            seededFinalPractical: !!parsed.seededFinalPractical,
            migratedSanjibonS03V2: !!parsed.migratedSanjibonS03V2,
            migratedSanjibonS05V4: !!parsed.migratedSanjibonS05V4,
            staffPasswordsResetV1: !!parsed.staffPasswordsResetV1,
            autoIssueQuizCertificates: false,
            serverGeminiApiKey: parsed.serverGeminiApiKey,
            aiPool: normalizeAiPoolConfig(parsed.aiPool),
            ledgerCheckpoints: parsed.ledgerCheckpoints || [],
            transactions: parsed.transactions || [],
            smsLogs: parsed.smsLogs || [],
            salesLeads: parsed.salesLeads || [],
            branding: mergeBrandingSettings(parsed.branding, DEFAULT_BRANDING),
            updatedAt: parsed.updatedAt || Date.now(),
          });
        } catch (parseErr) {
          // Preserve corrupted snapshot instead of silently overwriting it on next save
          try {
            fs.copyFileSync(storeFile, `${storeFile}.corrupt-${Date.now()}`);
          } catch {
            // ignore backup copy failure
          }
          console.warn("[OnneshaServerStore] Store JSON corrupted; backed up copy:", parseErr);
        }
      }
    }
  } catch (err) {
    console.warn("[OnneshaServerStore] Initializing fresh store in memory:", err);
  }

  return mergeSeededStoreData({
    regions: [...DEFAULT_REGIONS],
    roster: [...SAMPLE_ROSTER],
    courses: [...DEFAULT_COURSES],
    users: ensureDefaultUsers([]),
    customQuizzes: [],
    deletedQuizIds: [LEGACY_BCS_QUIZ_ID],
    deletedRegionIds: [],
    deletedCourseIds: [LEGACY_BCS_COURSE_ID],
    examSessions: [],
    examResults: [],
    certificates: [],
    revokedCertificates: [],
    revokedCertificateArchive: {},
    practicalExams: [],
    practicalSubmissions: [],
    finalExamAttempts: [],
    courseMaterials: [],
    courseRecordings: [],
    courseAnnouncements: [],
    courseKnowledgeBase: [],
    courseRequirements: [],
    seededLmsContentV1: false,
    seededCourseKbV1: false,
    migratedSanjibonDriveLmsV1: false,
    purgedSampleData: false,
    purgedUnder50Initial: true,
    purgedBcsDemoCourse: true,
    seededFinalPractical: false,
    migratedSanjibonS03V2: true,
    migratedSanjibonS05V4: true,
    staffPasswordsResetV1: false,
    autoIssueQuizCertificates: false,
    aiPool: createDefaultAiPoolConfig(),
    ledgerCheckpoints: [],
    transactions: [],
    smsLogs: [],
    salesLeads: [],
    branding: { ...DEFAULT_BRANDING },
    updatedAt: Date.now(),
  });
}

/** Soft-delete legacy BCS-101 demo course/quiz from existing production stores. */
export function migratePurgeBcsDemoCourseInStore(store: PersistentStoreData): {
  removedCourse: boolean;
  removedQuiz: boolean;
  removedSessions: number;
  removedResults: number;
  removedCerts: number;
} {
  const beforeCourses = store.courses.length;
  store.courses = store.courses.filter((c) => c.id !== LEGACY_BCS_COURSE_ID);
  const removedCourse = store.courses.length !== beforeCourses;
  const delCourses = new Set(store.deletedCourseIds || []);
  delCourses.add(LEGACY_BCS_COURSE_ID);
  store.deletedCourseIds = Array.from(delCourses);

  const beforeQuizzes = store.customQuizzes.length;
  store.customQuizzes = store.customQuizzes.filter(
    (q) => q.id !== LEGACY_BCS_QUIZ_ID && q.courseId !== LEGACY_BCS_COURSE_ID,
  );
  const removedQuiz = store.customQuizzes.length !== beforeQuizzes;
  const delQuizzes = new Set(store.deletedQuizIds || []);
  delQuizzes.add(LEGACY_BCS_QUIZ_ID);
  store.deletedQuizIds = Array.from(delQuizzes);

  store.users = store.users.map((u) => ({
    ...u,
    assignedCourseIds: (u.assignedCourseIds || []).filter((id) => id !== LEGACY_BCS_COURSE_ID),
  }));

  const bcsSessionIds = new Set(
    store.examSessions
      .filter((s) => s.quizId === LEGACY_BCS_QUIZ_ID || /bcs/i.test(s.quizId) || /bcs/i.test(s.quizTitleEn || ""))
      .map((s) => s.id),
  );
  const beforeSessions = store.examSessions.length;
  store.examSessions = store.examSessions.filter((s) => !bcsSessionIds.has(s.id));
  const removedSessions = beforeSessions - store.examSessions.length;

  const beforeResults = store.examResults.length;
  store.examResults = store.examResults.filter((r) => !bcsSessionIds.has(r.sessionId));
  const removedResults = beforeResults - store.examResults.length;

  const beforeCerts = store.certificates.length;
  store.certificates = store.certificates.filter(
    (c) =>
      (c.courseId || "") !== LEGACY_BCS_COURSE_ID &&
      !/bcs/i.test(c.quizTitle || "") &&
      !/bcs/i.test(c.certificateNumber || ""),
  );
  const removedCerts = beforeCerts - store.certificates.length;

  return { removedCourse, removedQuiz, removedSessions, removedResults, removedCerts };
}

export function ensureFinalPracticalSeeded(store: PersistentStoreData): boolean {
  if (!store.practicalExams) store.practicalExams = [];
  if (!store.practicalSubmissions) store.practicalSubmissions = [];
  if (!store.finalExamAttempts) store.finalExamAttempts = [];
  if (!store.courseRequirements) store.courseRequirements = [];

  const mainCourse =
    store.courses.find((c) => c.id === SANJIBON_COURSE.id) || SANJIBON_COURSE;
  let changed = false;

  if (!store.practicalExams.some((p) => p.courseId === mainCourse.id)) {
    store.practicalExams.push(buildDefaultFinalPracticalExam(mainCourse));
    changed = true;
  }
  if (!store.courseRequirements.some((r) => r.courseId === mainCourse.id)) {
    store.courseRequirements.push(buildDefaultCourseRequirement(mainCourse.id));
    changed = true;
  }
  // Upgrade legacy single-task finals to timed PIN package (70 marks).
  for (let i = 0; i < store.practicalExams.length; i++) {
    const exam = store.practicalExams[i]!;
    if (shouldUpgradeFinalExamPackage(exam)) {
      store.practicalExams[i] = upgradeFinalExamPackage(exam);
      changed = true;
    }
  }
  return changed;
}

function getStore(): PersistentStoreData {
  if (!globalStore.__onneshaStore) {
    const loaded = loadInitialStore();
    globalStore.__onneshaStore = loaded;
    if (!loaded.purgedUnder50Initial) {
      const liveSessions = getLiveSessions();
      const summary = purgeUnderThresholdExamsInStore(loaded, 50, liveSessions);
      loaded.purgedUnder50Initial = true;
      scheduleDiskPersist();
      if (summary.removedLiveSessions > 0) {
        scheduleLiveSessionsPersist();
      }
      console.info(
        `[OnneshaServerStore] Initial <50 examinee purge completed: sessions=${summary.removedSessions}, results=${summary.removedResults}, certs=${summary.removedCertificates}, revoked=${summary.removedRevokedCerts}, sms=${summary.removedSmsLogs}, live=${summary.removedLiveSessions}, keptSessions=${summary.keptSessions}`,
      );
    }
    if (!loaded.migratedSanjibonS03V2) {
      const mig = migrateSanjibonQ3MergeInStore(loaded);
      loaded.migratedSanjibonS03V2 = true;
      scheduleDiskPersist();
      console.info(
        `[OnneshaServerStore] Sanjibon Quiz 3+4 merge migration completed: removedOverrides=${mig.removedQuizOverrides}, updatedCourse=${mig.updatedCourseDesc}`,
      );
    }
    if (!loaded.migratedSanjibonS05V4) {
      const mig5 = migrateSanjibonQ5ExactInStore(loaded);
      loaded.migratedSanjibonS05V4 = true;
      scheduleDiskPersist();
      console.info(
        `[OnneshaServerStore] Sanjibon Quiz 5 exact 15-Q migration completed: removedQ5Override=${mig5.removedQ5Override}`,
      );
    }
    if (!loaded.purgedBcsDemoCourse || !loaded.purgedBcsDemoCourseV2) {
      const migBcs = migratePurgeBcsDemoCourseInStore(loaded);
      loaded.purgedBcsDemoCourse = true;
      loaded.purgedBcsDemoCourseV2 = true;
      scheduleDiskPersist();
      console.info(
        `[OnneshaServerStore] BCS demo purge: course=${migBcs.removedCourse}, quiz=${migBcs.removedQuiz}, sessions=${migBcs.removedSessions}, results=${migBcs.removedResults}, certs=${migBcs.removedCerts}`,
      );
    }
    if (typeof loaded.autoIssueQuizCertificates !== "boolean") {
      loaded.autoIssueQuizCertificates = false;
    }
    if (!loaded.seededFinalPractical) {
      const seeded = ensureFinalPracticalSeeded(loaded);
      loaded.seededFinalPractical = true;
      if (seeded) scheduleDiskPersist();
      console.info(`[OnneshaServerStore] Final practical exam seed applied: changed=${seeded}`);
    } else {
      ensureFinalPracticalSeeded(loaded);
    }
    if (!loaded.staffPasswordsResetV1) {
      const reset = resetAllStaffPasswordsInStore(loaded);
      loaded.staffPasswordsResetV1 = true;
      scheduleDiskPersist();
      console.info(
        `[OnneshaServerStore] Staff password reset v1: admins=${reset.adminCount}, instructors=${reset.instructorCount}`,
      );
    }
    if (!loaded.seededLmsContentV1) {
      ensureLmsContentSeeded(loaded);
      loaded.seededLmsContentV1 = true;
      scheduleDiskPersist();
      console.info("[OnneshaServerStore] LMS learning content seed applied");
    } else {
      const lmsChanged = ensureLmsContentSeeded(loaded);
      if (lmsChanged) scheduleDiskPersist();
    }
    if (!loaded.migratedSanjibonDriveLmsV1) {
      const driveChanged = ensureSanjibonDriveMaterialsMigrated(loaded);
      loaded.migratedSanjibonDriveLmsV1 = true;
      scheduleDiskPersist();
      console.info(
        `[OnneshaServerStore] Sanjibon Google Drive LMS & KB migration v1 applied: changed=${driveChanged}`,
      );
    }
  }
  return globalStore.__onneshaStore;
}

export function ensureSanjibonDriveMaterialsMigrated(store: PersistentStoreData): boolean {
  if (!store.courseMaterials) store.courseMaterials = [];
  if (!store.courseKnowledgeBase) store.courseKnowledgeBase = [];
  const courseId = SANJIBON_COURSE.id;
  let changed = false;

  const existingMatIds = new Set(store.courseMaterials.map((m) => m.id));
  const driveMaterials = buildSanjibonDriveMaterials(courseId);
  const missingMats = driveMaterials.filter((m) => !existingMatIds.has(m.id));
  if (missingMats.length > 0) {
    // Shift legacy default seed cards down so Master Pack + Sessions 00..10 appear first in order.
    for (const m of store.courseMaterials) {
      if (m.courseId === courseId && m.id === "mat-sanjibon-overview" && m.sortOrder < 12) {
        m.sortOrder = 12;
      } else if (m.courseId === courseId && m.id === "mat-sanjibon-final-brief" && m.sortOrder < 13) {
        m.sortOrder = 13;
      } else if (m.courseId === courseId && m.id === "mat-sanjibon-tools" && m.sortOrder < 14) {
        m.sortOrder = 14;
      }
    }
    store.courseMaterials.push(...missingMats);
    store.courseMaterials.sort((a, b) => a.sortOrder - b.sortOrder);
    changed = true;
  }

  const existingKbIds = new Set(store.courseKnowledgeBase.map((k) => k.id));
  const driveKb = buildSanjibonDriveKnowledgeBase(courseId);
  const missingKb = driveKb.filter((k) => !existingKbIds.has(k.id));
  if (missingKb.length > 0) {
    store.courseKnowledgeBase.push(...missingKb);
    changed = true;
  }

  return changed;
}

export function ensureCourseKbSeeded(store: PersistentStoreData): boolean {
  if (!store.courseKnowledgeBase) store.courseKnowledgeBase = [];
  if (store.seededCourseKbV1) return false;
  const courseId = SANJIBON_COURSE.id;
  const hasKb = store.courseKnowledgeBase.some((k) => k.courseId === courseId);
  if (hasKb) {
    store.seededCourseKbV1 = true;
    return false;
  }
  store.courseKnowledgeBase.unshift(...buildDefaultSanjibonKnowledgeBase());
  store.seededCourseKbV1 = true;
  return true;
}

export function ensureLmsContentSeeded(store: PersistentStoreData): boolean {
  if (!store.courseMaterials) store.courseMaterials = [];
  if (!store.courseRecordings) store.courseRecordings = [];
  if (!store.courseAnnouncements) store.courseAnnouncements = [];
  const kbChanged = ensureCourseKbSeeded(store);
  const courseId = SANJIBON_COURSE.id;
  const hasMat = store.courseMaterials.some((m) => m.courseId === courseId);
  if (hasMat) {
    const driveChanged = !store.migratedSanjibonDriveLmsV1
      ? ensureSanjibonDriveMaterialsMigrated(store)
      : false;
    if (driveChanged) store.migratedSanjibonDriveLmsV1 = true;
    return kbChanged || driveChanged;
  }
  const seed = buildDefaultSanjibonLmsContent();
  store.courseMaterials.unshift(...seed.materials);
  store.courseRecordings.unshift(...seed.recordings);
  store.courseAnnouncements.unshift(...seed.announcements);
  store.migratedSanjibonDriveLmsV1 = true;
  return true;
}

/** Default plaintext passwords applied on staff bulk reset (hashed before persist). */
export const DEFAULT_ADMIN_PASSWORD = "admin123";
export const DEFAULT_INSTRUCTOR_PASSWORD = "instructor123";

export function resetAllStaffPasswordsInStore(store: PersistentStoreData): {
  adminCount: number;
  instructorCount: number;
  resetEmails: string[];
} {
  let adminCount = 0;
  let instructorCount = 0;
  const resetEmails: string[] = [];
  store.users = (store.users || []).map((u) => {
    if (u.role !== "admin" && u.role !== "instructor") return u;
    const plain =
      u.role === "admin" ? DEFAULT_ADMIN_PASSWORD : DEFAULT_INSTRUCTOR_PASSWORD;
    if (u.role === "admin") adminCount += 1;
    else instructorCount += 1;
    resetEmails.push(u.email);
    return {
      ...u,
      passwordHash: hashPasswordScrypt(plain),
      status: u.status === "suspended" ? u.status : "active",
    };
  });
  return { adminCount, instructorCount, resetEmails };
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
    if (!globalStore.__onneshaStore) {
      void getStore();
    }
  }
  return globalStore.__onneshaLiveSessions;
}

function nextTmpSuffix(): string {
  globalStore.__onneshaTmpSeq = ((globalStore.__onneshaTmpSeq || 0) + 1) % 1_000_000;
  const pid = typeof process !== "undefined" ? process.pid : 0;
  return `${pid}.${globalStore.__onneshaTmpSeq}.tmp`;
}

function flushAllPendingDiskSync() {
  try {
    const fs = getNodeFs();
    if (!fs) return;
    const { dataDir, storeFile, liveFile } = getStorePaths();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (globalStore.__onneshaSaveTimer && globalStore.__onneshaStore) {
      clearTimeout(globalStore.__onneshaSaveTimer);
      globalStore.__onneshaSaveTimer = null;
      const tmp = `${storeFile}.${nextTmpSuffix()}`;
      fs.writeFileSync(tmp, JSON.stringify(globalStore.__onneshaStore), "utf-8");
      fs.renameSync(tmp, storeFile);
    }
    if (globalStore.__onneshaLiveSaveTimer && globalStore.__onneshaLiveSessions) {
      clearTimeout(globalStore.__onneshaLiveSaveTimer);
      globalStore.__onneshaLiveSaveTimer = null;
      const tmpLive = `${liveFile}.${nextTmpSuffix()}`;
      fs.writeFileSync(tmpLive, JSON.stringify(globalStore.__onneshaLiveSessions), "utf-8");
      fs.renameSync(tmpLive, liveFile);
    }
  } catch {
    // best-effort shutdown flush
  }
}

function ensureShutdownHooks() {
  if (globalStore.__onneshaShutdownHooked || typeof process === "undefined" || !process.once)
    return;
  globalStore.__onneshaShutdownHooked = true;
  process.once("SIGINT", flushAllPendingDiskSync);
  process.once("SIGTERM", flushAllPendingDiskSync);
  process.once("beforeExit", flushAllPendingDiskSync);
}

async function flushLiveSessionsToDisk() {
  if (globalStore.__onneshaLiveSaveBusy) {
    globalStore.__onneshaLiveSaveDirty = true;
    return;
  }
  globalStore.__onneshaLiveSaveBusy = true;
  try {
    do {
      globalStore.__onneshaLiveSaveDirty = false;
      const fs = getNodeFs();
      if (!fs) break;
      const { dataDir, liveFile } = getStorePaths();
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
      const sessions = getLiveSessions();
      const tmp = `${liveFile}.${nextTmpSuffix()}`;
      await fs.promises.writeFile(tmp, JSON.stringify(sessions), "utf-8");
      await fs.promises.rename(tmp, liveFile);
    } while (globalStore.__onneshaLiveSaveDirty);
  } catch (err) {
    console.warn("[OnneshaLiveSessions] Disk persist warning:", err);
  } finally {
    globalStore.__onneshaLiveSaveBusy = false;
  }
}

function scheduleLiveSessionsPersist() {
  ensureShutdownHooks();
  if (globalStore.__onneshaLiveSaveBusy) {
    globalStore.__onneshaLiveSaveDirty = true;
  }
  if (globalStore.__onneshaLiveSaveTimer) return;
  globalStore.__onneshaLiveSaveTimer = setTimeout(() => {
    globalStore.__onneshaLiveSaveTimer = null;
    void flushLiveSessionsToDisk();
  }, 600);
}

async function flushStoreToDisk() {
  if (globalStore.__onneshaSaveBusy) {
    globalStore.__onneshaSaveDirty = true;
    return;
  }
  globalStore.__onneshaSaveBusy = true;
  try {
    do {
      globalStore.__onneshaSaveDirty = false;
      const fs = getNodeFs();
      if (!fs) break;
      const { dataDir, storeFile } = getStorePaths();
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
      const store = getStore();
      const tmpFile = `${storeFile}.${nextTmpSuffix()}`;
      await fs.promises.writeFile(tmpFile, JSON.stringify(store), "utf-8");
      await fs.promises.rename(tmpFile, storeFile);
    } while (globalStore.__onneshaSaveDirty);
  } catch (err) {
    console.warn("[OnneshaServerStore] Disk persist warning:", err);
  } finally {
    globalStore.__onneshaSaveBusy = false;
  }
}

// Debounced non-blocking atomic disk write (handles 500+ req/sec without I/O contention).
// Autosave may request a longer delay; a shorter request reschedules sooner.
function scheduleDiskPersist(delayMs = 800) {
  ensureShutdownHooks();
  const store = getStore();
  store.updatedAt = Date.now();
  if (globalStore.__onneshaSaveBusy) {
    globalStore.__onneshaSaveDirty = true;
  }
  const requested = Math.max(50, delayMs);
  const existingDelay = globalStore.__onneshaSaveDelayMs;
  if (globalStore.__onneshaSaveTimer && existingDelay != null && requested >= existingDelay) {
    return;
  }
  if (globalStore.__onneshaSaveTimer) {
    clearTimeout(globalStore.__onneshaSaveTimer);
    globalStore.__onneshaSaveTimer = null;
  }
  globalStore.__onneshaSaveDelayMs = requested;
  globalStore.__onneshaSaveTimer = setTimeout(() => {
    globalStore.__onneshaSaveTimer = null;
    globalStore.__onneshaSaveDelayMs = undefined;
    void flushStoreToDisk();
  }, requested);
}

function rebuildFinalAttemptIndex(store: PersistentStoreData): Map<string, number> {
  const map = new Map<string, number>();
  (store.finalExamAttempts || []).forEach((a, i) => {
    if (a?.id) map.set(a.id, i);
  });
  globalStore.__onneshaFinalAttemptIndex = map;
  return map;
}

function findFinalAttemptIndex(store: PersistentStoreData, attemptId: string): number {
  if (!attemptId) return -1;
  const cached = globalStore.__onneshaFinalAttemptIndex?.get(attemptId);
  if (
    typeof cached === "number" &&
    store.finalExamAttempts?.[cached]?.id === attemptId
  ) {
    return cached;
  }
  const map = rebuildFinalAttemptIndex(store);
  return map.get(attemptId) ?? -1;
}

function rememberFinalAttemptIndex(attemptId: string, index: number): void {
  if (!globalStore.__onneshaFinalAttemptIndex) {
    globalStore.__onneshaFinalAttemptIndex = new Map();
  }
  globalStore.__onneshaFinalAttemptIndex.set(attemptId, index);
}

function toHostSessionView(session: ServerLiveSession): GameSession {
  const {
    fullQuiz: _q,
    hostToken: _t,
    cachedTop5: _top5,
    cachedSanitizedQuestion: _sq,
    participants,
    ...hostView
  } = session;
  const sanitizedParticipants: Record<string, Participant> = {};
  for (const [id, p] of Object.entries(participants)) {
    const { seatToken: _s, ...safeP } = p;
    sanitizedParticipants[id] = safeP;
  }
  return {
    ...hostView,
    participants: sanitizedParticipants,
    completedQuestions:
      session.phase === "podium" || session.phase === "finished"
        ? session.fullQuiz?.questions
        : hostView.completedQuestions,
  };
}

function normalizeDigits(val?: string): string {
  return (val || "").replace(/\D/g, "");
}

function normalizeCode(val?: string): string {
  return (val || "").trim().toLowerCase();
}

export function maskPhoneHint(phone?: string): string {
  const cleanPhone = normalizeDigits(phone);
  return cleanPhone.length >= 7
    ? `${cleanPhone.slice(0, 3)}••••${cleanPhone.slice(-3)}`
    : cleanPhone;
}

export function isCertificateRevoked(
  store: { revokedCertificates?: string[] | undefined },
  certNo: string,
): boolean {
  const target = (certNo || "").trim().toLowerCase();
  if (!target) return false;
  return (store.revokedCertificates || []).some((rc) => rc.trim().toLowerCase() === target);
}

/**
 * Bidirectionally syncs every user's `assignedCourseIds` when a course's `instructorIds` changes,
 * adding `course.id` for assigned instructors and removing it from unassigned instructors.
 */
export function syncCourseInstructorsInStore(users: ManagedUser[], course: Course): ManagedUser[] {
  if (!Array.isArray(course.instructorIds)) return users;
  const assignedSet = new Set(course.instructorIds);
  return users.map((u) => {
    const curr = new Set(u.assignedCourseIds || []);
    if (assignedSet.has(u.id)) {
      curr.add(course.id);
    } else {
      curr.delete(course.id);
    }
    return { ...u, assignedCourseIds: Array.from(curr) };
  });
}

/**
 * Bidirectionally syncs every course's `instructorIds` & `instructorNames` when a user's
 * `assignedCourseIds` is edited directly from User Management.
 */
export function syncUserCoursesInStore(
  courses: Course[],
  users: ManagedUser[],
  user: ManagedUser,
): Course[] {
  const userCourses = new Set(user.assignedCourseIds || []);
  return courses.map((course) => {
    const hasUser = (course.instructorIds || []).includes(user.id);
    const shouldHave = userCourses.has(course.id);
    if (hasUser === shouldHave) return course;
    const nextIds = shouldHave
      ? Array.from(new Set([...(course.instructorIds || []), user.id]))
      : (course.instructorIds || []).filter((id) => id !== user.id);
    const nextNames = nextIds
      .map((id) => (id === user.id ? user.name : users.find((u) => u.id === id)?.name))
      .filter((n): n is string => Boolean(n));
    return {
      ...course,
      instructorIds: nextIds,
      instructorNames: nextNames,
    };
  });
}

export function resolveSignupRoleForActor(
  actor: { role: ManagedUser["role"] } | null,
  requestedRole: ManagedUser["role"],
): { allowed: boolean; role: ManagedUser["role"]; error?: string } {
  if ((requestedRole === "admin" || requestedRole === "instructor") && actor?.role !== "admin") {
    return {
      allowed: false,
      role: "candidate",
      error:
        "Instructor and Admin accounts must be provisioned by your Institution Super Admin in the Admin Panel.",
    };
  }
  return {
    allowed: true,
    role: actor?.role === "admin" && requestedRole === "instructor" ? "instructor" : "candidate",
  };
}

export function upsertManagedUserInStore(
  users: ManagedUser[],
  incomingUser: ManagedUser,
): { success: boolean; users: ManagedUser[]; savedUser?: ManagedUser; error?: string } {
  const nextUsers = [...users];
  const idx = nextUsers.findIndex(
    (u) => u.id === incomingUser.id || u.email.toLowerCase() === incomingUser.email.toLowerCase(),
  );
  const rawIncomingPass = incomingUser.passwordHash?.trim();
  const incomingPass =
    idx >= 0 && rawIncomingPass === "instructor123" ? undefined : rawIncomingPass;
  const nextHash =
    incomingPass && !incomingPass.startsWith("scrypt:")
      ? hashPasswordScrypt(incomingPass)
      : incomingPass;
  const existing = idx >= 0 ? nextUsers[idx] : undefined;
  if (idx >= 0 && existing) {
    const savedUser: ManagedUser = {
      ...existing,
      ...incomingUser,
      passwordHash: nextHash || existing.passwordHash,
    };
    nextUsers[idx] = savedUser;
    return { success: true, users: nextUsers, savedUser };
  }
  if (!nextHash) {
    return {
      success: false,
      users: nextUsers,
      error: "A password is required when creating a new user account.",
    };
  }
  const savedUser: ManagedUser = {
    ...incomingUser,
    passwordHash: nextHash,
  };
  nextUsers.push(savedUser);
  return { success: true, users: nextUsers, savedUser };
}

export function deleteCertificateInStore(
  store: {
    certificates: CertificateData[];
    revokedCertificates?: string[] | undefined;
    revokedCertificateArchive?: Record<string, CertificateData> | undefined;
  },
  certificateNumber: string,
): boolean {
  const targetCertNo = (certificateNumber || "").trim().toUpperCase();
  if (!targetCertNo) return false;
  const removedCert = store.certificates.find(
    (c) => c.certificateNumber.trim().toUpperCase() === targetCertNo,
  );
  if (removedCert) {
    store.revokedCertificateArchive = {
      ...(store.revokedCertificateArchive || {}),
      [targetCertNo]: removedCert,
    };
  }
  store.certificates = store.certificates.filter(
    (c) => c.certificateNumber.trim().toUpperCase() !== targetCertNo,
  );
  const revoked = new Set((store.revokedCertificates || []).map((c) => c.trim().toUpperCase()));
  revoked.add(targetCertNo);
  store.revokedCertificates = [...revoked];
  return true;
}

export function restoreCertificateInStore(
  store: {
    certificates: CertificateData[];
    revokedCertificates?: string[] | undefined;
    revokedCertificateArchive?: Record<string, CertificateData> | undefined;
  },
  certificateNumber: string,
): boolean {
  const targetCertNo = (certificateNumber || "").trim().toUpperCase();
  if (!targetCertNo) return false;
  store.revokedCertificates = (store.revokedCertificates || []).filter(
    (c) => c.trim().toUpperCase() !== targetCertNo,
  );
  const archived = store.revokedCertificateArchive?.[targetCertNo];
  if (archived) {
    const exists = store.certificates.some(
      (c) => c.certificateNumber.trim().toUpperCase() === targetCertNo,
    );
    if (!exists) {
      store.certificates.unshift(archived);
    }
    const nextArchive = { ...(store.revokedCertificateArchive || {}) };
    delete nextArchive[targetCertNo];
    store.revokedCertificateArchive = nextArchive;
  }
  return true;
}

export function isQuestionSubmissionClosed(
  session: Pick<GameSession, "phase" | "currentQuestion" | "pausedAt"> &
    Partial<Pick<GameSession, "questionEndTime">>,
  questionId: string,
  now = Date.now(),
): boolean {
  if (
    session.phase === "lobby" ||
    session.phase === "countdown" ||
    session.phase === "podium" ||
    session.phase === "finished"
  ) {
    return true;
  }
  if (
    (session.phase === "chart" || session.phase === "leaderboard") &&
    session.currentQuestion?.id === questionId
  ) {
    return true;
  }
  if (
    session.phase === "question" &&
    session.currentQuestion?.id === questionId &&
    !session.pausedAt &&
    typeof session.questionEndTime === "number" &&
    session.questionEndTime > 0 &&
    now > session.questionEndTime + 2500
  ) {
    return true;
  }
  return false;
}

/**
 * Computes tamper-resistant, clock-skew-safe response duration in seconds.
 * - Live online submissions anchor around server receipt time (`nowRef`) with up to 1.5s
 *   network transit compensation so slow client clocks can never collapse all times to 0.1s.
 * - Offline outbox submissions (`isOfflineQueued`) retain their server-offset client tap time
 *   clamped safely inside `[questionStartTime, nowRef]`.
 */
export function computeAnswerElapsedSec(params: {
  questionStartTime: number;
  effectiveLimitSec: number;
  serverNow?: number | undefined;
  pausedAt?: number | undefined;
  clientAnsweredAt?: number | undefined;
  isOfflineQueued?: boolean | undefined;
}): { effectiveTimestamp: number; timeTakenSec: number } {
  const rawNow =
    typeof params.serverNow === "number" && Number.isFinite(params.serverNow)
      ? params.serverNow
      : Date.now();
  const nowRef =
    typeof params.pausedAt === "number" && params.pausedAt > 0
      ? Math.min(rawNow, params.pausedAt)
      : rawNow;
  const limit = Math.max(1, params.effectiveLimitSec || 20);

  if (!params.questionStartTime || params.questionStartTime <= 0) {
    return { effectiveTimestamp: nowRef, timeTakenSec: 0.1 };
  }

  const start = Math.min(params.questionStartTime, nowRef);
  const maxLookbackMs = params.isOfflineQueued ? limit * 1000 : 1500;
  const lowerBound = Math.max(start, nowRef - maxLookbackMs);
  const effectiveTimestamp =
    typeof params.clientAnsweredAt === "number" && Number.isFinite(params.clientAnsweredAt)
      ? Math.max(lowerBound, Math.min(nowRef, params.clientAnsweredAt))
      : nowRef;

  const elapsedSec = (effectiveTimestamp - start) / 1000;
  const clampedElapsed = Math.max(0.1, Math.min(limit, elapsedSec));
  const timeTakenSec = Math.round(clampedElapsed * 100) / 100;
  return { effectiveTimestamp, timeTakenSec };
}

export function applyBetweenPhasePause(
  session: Pick<
    GameSession,
    | "phase"
    | "phaseEndsAt"
    | "autoAdvancePaused"
    | "betweenPausedRemainingMs"
    | "settings"
    | "updatedAt"
  >,
  paused: boolean,
  now = Date.now(),
): boolean {
  if (session.phase !== "chart" && session.phase !== "leaderboard") return false;
  if (paused) {
    if (session.autoAdvancePaused) return false;
    session.autoAdvancePaused = true;
    session.betweenPausedRemainingMs =
      typeof session.phaseEndsAt === "number" && session.phaseEndsAt > now
        ? session.phaseEndsAt - now
        : undefined;
    session.phaseEndsAt = undefined;
    session.updatedAt = now;
    return true;
  }
  if (!session.autoAdvancePaused) return false;
  session.autoAdvancePaused = undefined;
  if (
    typeof session.betweenPausedRemainingMs === "number" &&
    session.betweenPausedRemainingMs > 0
  ) {
    session.phaseEndsAt = now + session.betweenPausedRemainingMs;
  } else {
    const delays = splitBetweenQuestionDelays(session.settings?.betweenQuestionSec);
    const sec = session.phase === "chart" ? delays.chartSec : delays.leaderboardSec;
    session.phaseEndsAt = delays.enabled && sec > 0 ? now + sec * 1000 : undefined;
  }
  session.betweenPausedRemainingMs = undefined;
  session.updatedAt = now;
  return true;
}

export function enterBetweenPhase(
  session: ServerLiveSession,
  targetPhase: "chart" | "leaderboard",
  now = Date.now(),
): void {
  const delays = splitBetweenQuestionDelays(session.settings.betweenQuestionSec);
  const sec = targetPhase === "chart" ? delays.chartSec : delays.leaderboardSec;
  session.pausedAt = undefined;
  session.phase = targetPhase;
  session.autoAdvancePaused = undefined;
  session.betweenPausedRemainingMs = undefined;
  session.phaseEndsAt = delays.enabled && sec > 0 ? now + sec * 1000 : undefined;
  recalculateSessionMetrics(session);
}

export function transitionBetweenPhaseIfDue(
  session: ServerLiveSession,
  store: PersistentStoreData,
  now = Date.now(),
): boolean {
  if (session.autoAdvancePaused || !session.phaseEndsAt || now < session.phaseEndsAt - 150) {
    return false;
  }
  if (session.phase === "chart") {
    enterBetweenPhase(session, "leaderboard", now);
    return true;
  }
  if (session.phase === "leaderboard") {
    session.phaseEndsAt = undefined;
    session.autoAdvancePaused = undefined;
    session.betweenPausedRemainingMs = undefined;
    advanceSessionToQuestion(session, store);
    return true;
  }
  return false;
}

export function applyPauseGameToSession(session: ServerLiveSession, now = Date.now()): boolean {
  if (session.pausedAt || session.phase !== "question") return false;
  session.pausedAt = now;
  session.updatedAt = now;
  return true;
}

export function applyResumeGameToSession(session: ServerLiveSession, now = Date.now()): boolean {
  if (!session.pausedAt) return false;
  const pausedMs = Math.max(0, now - session.pausedAt);
  if (typeof session.questionStartTime === "number") {
    session.questionStartTime += pausedMs;
  }
  if (typeof session.questionEndTime === "number") {
    session.questionEndTime += pausedMs;
  }
  const qid = session.currentQuestion?.id;
  const qStarts = session.questionStartTimes;
  const curStart = qid && qStarts ? qStarts[qid] : undefined;
  if (qid && qStarts && typeof curStart === "number") {
    qStarts[qid] = curStart + pausedMs;
  }
  session.pausedAt = undefined;
  session.updatedAt = now;
  return true;
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
  const all = Object.values(session.participants);
  all.forEach((p) => {
    p.totalResponseTimeSec = computeParticipantTotalTimeSec(p);
  });
  const sortParticipants = (arr: Participant[]) => arr.sort(compareParticipantsByMerit);

  const isEnded = session.phase === "podium" || session.phase === "finished";
  const humans = all.filter((p) => !p.isBot);
  const rankSource =
    isEnded && humans.length > 0 ? sortParticipants([...humans]) : sortParticipants([...all]);

  rankSource.forEach((p, idx) => {
    const entry = session.participants[p.id];
    if (entry) entry.rank = idx + 1;
  });

  session.participantCount = rankSource.length;
  const currentQId = session.currentQuestion?.id;
  session.answeredCount = currentQId ? rankSource.filter((p) => !!p.answers[currentQId]).length : 0;
  session.cachedTop5 = rankSource.slice(0, 5).map((p) => {
    const { seatToken: _s, answers: _a, phone: _ph, ...rest } = p;
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
  // O(1) constant-time projection for 500+ concurrent examinees (phone redacted)
  const compactParticipants: Record<string, Participant> = {};
  if (participantId && session.participants[participantId]) {
    const { seatToken: _s, phone: _ph, ...meSafe } = session.participants[participantId];
    compactParticipants[participantId] = meSafe;
  }

  const top5 = session.cachedTop5 || [];
  for (const p of top5) {
    if (!compactParticipants[p.id]) {
      const { seatToken: _s, phone: _ph, ...safeTop } = p;
      compactParticipants[p.id] = safeTop;
    }
  }

  return {
    pin: session.pin,
    quizId: session.quizId,
    quizTitleEn: session.quizTitleEn,
    quizTitleBn: session.quizTitleBn,
    hostId: session.hostId,
    isSelfPractice: !!session.isSelfPractice,
    phase: session.phase,
    currentQuestionIndex: session.currentQuestionIndex,
    currentQuestion:
      session.cachedSanitizedQuestion ??
      sanitizeQuestionForPlayer(session.currentQuestion, session.phase),
    questionStartTime: session.questionStartTime,
    questionEndTime: session.questionEndTime,
    ...(typeof session.countdownStartedAt === "number"
      ? { countdownStartedAt: session.countdownStartedAt }
      : {}),
    ...(typeof session.pausedAt === "number" ? { pausedAt: session.pausedAt } : {}),
    settings: session.settings,
    participants: compactParticipants,
    totalQuestions: session.totalQuestions,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    participantCount: session.participantCount ?? Object.keys(session.participants).length,
    answeredCount: session.answeredCount ?? 0,
    completedQuestions:
      session.phase === "podium" || session.phase === "finished"
        ? session.fullQuiz?.questions
        : undefined,
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
  // Public / solo self-practice sessions must never create official institutional
  // exam sessions, score transcripts, or Ed25519 certificates.
  if (session.isSelfPractice) return;
  const store = getStore();
  const createdAt = new Date().toISOString();
  const participantsList = Object.values(session.participants)
    .filter((p) => !p.isBot)
    .sort(compareParticipantsByMerit);
  const count = participantsList.length;
  if (count === 0) return;

  const retakeOrigSession = session.settings.retakeForSessionId
    ? store.examSessions.find(
        (s) =>
          s.id === session.settings.retakeForSessionId ||
          (!!session.settings.retakeOriginPin && s.pin === session.settings.retakeOriginPin),
      )
    : undefined;

  const targetSessionId = retakeOrigSession ? retakeOrigSession.id : `exam-${session.pin}`;
  const targetPin = retakeOrigSession ? retakeOrigSession.pin : session.pin;

  const quizObj =
    session.fullQuiz ||
    store.customQuizzes.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
    READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId);
  const matchedCourse = quizObj?.courseId
    ? store.courses.find((c) => c.id === quizObj.courseId)
    : undefined;
  const effectivePassThresholdPct = resolvePassThresholdPct({
    sessionThreshold: retakeOrigSession?.passThresholdPct ?? session.settings?.passThresholdPct,
    courseThreshold: matchedCourse?.passThresholdPct,
    brandingDefaultThreshold: store.branding?.defaultPassThresholdPct,
  });
  const totalMarks = computeTotalQuizMarks(quizObj?.questions, session.totalQuestions);

  const builtResults: ExamResultRecord[] = participantsList.map((p, idx) => {
    const answersList = Object.values(p.answers || {});
    const correctCount = answersList.filter((a) => a.isCorrect).length;
    const incorrectCount = answersList.filter(
      (a) =>
        !a.isCorrect &&
        ((a.selectedOptionIds && a.selectedOptionIds.length > 0) || !!a.writtenAnswer),
    ).length;
    const unattemptedCount = Math.max(0, session.totalQuestions - answersList.length);
    const accuracy = computeParticipantAccuracyPct({
      answers: answersList,
      correctCount,
      totalQuestions: session.totalQuestions,
      score: p.score,
      totalMarks,
    });
    const passed = isPassingScore(accuracy, effectivePassThresholdPct);
    const roll = p.rollNumber || `2026-${100 + idx + 1}`;
    const humanRank = idx + 1;

    return {
      id: retakeOrigSession
        ? `res-${targetPin}-${normalizeMatchRoll(roll) || p.id}`
        : `res-${session.pin}-${p.id}`,
      sessionId: targetSessionId,
      pin: targetPin,
      participantId: p.id,
      rollNumber: roll,
      name: p.nickname || p.name || `Candidate ${humanRank}`,
      phone: p.phone || "",
      regionId: p.regionId || "reg-dhaka",
      regionName: p.regionName || "Dhaka Range",
      score: p.score,
      rank: humanRank,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracyPct: accuracy,
      passed,
      answersJson: JSON.stringify(p.answers || {}),
      createdAt,
    };
  });

  let finalResultsForCerts: ExamResultRecord[];
  let totalParticipantsForCerts: number;

  if (retakeOrigSession) {
    const { updatedSession, mergedResults } = mergeRetakeExamResults({
      origSession: retakeOrigSession,
      existingResults: store.examResults,
      makeupResults: builtResults,
      nowIso: createdAt,
    });
    store.examSessions = store.examSessions.map((s) =>
      s.id === updatedSession.id ? updatedSession : s,
    );
    store.examResults = [
      ...store.examResults.filter(
        (r) =>
          r.sessionId !== retakeOrigSession.id &&
          !(!r.sessionId && r.pin === retakeOrigSession.pin),
      ),
      ...mergedResults,
    ];
    finalResultsForCerts = mergedResults;
    totalParticipantsForCerts = mergedResults.length;
  } else {
    const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    const highestScore = participantsList[0]?.score ?? 0;

    const sessionRecord: ExamSessionRecord = {
      id: targetSessionId,
      pin: targetPin,
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
      passThresholdPct: effectivePassThresholdPct,
      createdAt,
    };

    store.examSessions = [
      sessionRecord,
      ...store.examSessions.filter((s) => s.id !== targetSessionId && s.pin !== targetPin),
    ];

    // Remove any previous results for this pin before writing final results
    store.examResults = [...store.examResults.filter((r) => r.pin !== targetPin), ...builtResults];
    finalResultsForCerts = builtResults;
    totalParticipantsForCerts = count;
  }

  // Default industrial policy: do NOT auto-mint quiz-session certificates.
  // Super Admin may re-enable via Admin → Practical → "Enable automatic quiz-session certificates".
  if (store.autoIssueQuizCertificates === true && finalResultsForCerts.length > 0) {
    const issued: CertificateData[] = [];
    let idx = 0;
    for (const result of finalResultsForCerts) {
      if (result.passed === false) continue;
      idx += 1;
      const certNo = makeCertificateNumber(targetPin, result.rollNumber, idx);
      const existing = store.certificates.find(
        (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
      );
      if (existing?.cryptoSignature) continue;
      const unsigned: CertificateData = {
        id: `cert-quiz-${result.id}`,
        certificateNumber: certNo,
        kind: "quiz_session",
        studentName: result.name,
        studentRoll: result.rollNumber,
        regionName: result.regionName || "",
        quizTitle: session.quizTitleEn || "Quiz Session",
        score: result.score,
        scorePct: result.accuracyPct,
        accuracyPercent: result.accuracyPct,
        marksObtained: result.score,
        totalMarks: totalMarks || 100,
        totalPoints: totalMarks || 100,
        rank: result.rank,
        totalParticipants: totalParticipantsForCerts || 1,
        issueDate: new Date().toISOString().slice(0, 10),
        organizationName: resolveOrgName(store.branding),
        institutionName: store.branding?.institutionTitle || "Onnesha Assessment Arena",
        instructorName: "Assessment Host",
        verificationUrl: `/verify/${certNo}`,
        verified: true,
      };
      const sealed = sealCertificateWithLedger(
        unsigned,
        [...issued, ...store.certificates],
        getStorePaths().dataDir,
      );
      issued.push(sealed);
    }
    if (issued.length) {
      store.certificates = [
        ...issued,
        ...store.certificates.filter(
          (c) =>
            !issued.some(
              (i) => i.certificateNumber.toLowerCase() === c.certificateNumber.toLowerCase(),
            ),
        ),
      ];
      triggerBackgroundExternalAnchoring(issued.map((c) => c.certificateNumber));
      // Best-effort quiz certificate emails when roster email exists (Resend → Brevo).
      void Promise.allSettled(
        issued.map((cert) => emailCertificateToStudent({ store, certificate: cert })),
      );
    }
  }
  scheduleDiskPersist();
}

function resolveSessionQuiz(
  session: ServerLiveSession,
  store: PersistentStoreData,
): Quiz | undefined {
  if (session.fullQuiz) return session.fullQuiz;
  const found =
    store.customQuizzes.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
    READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId);
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

  const effectiveLimit = resolveQuestionTimeLimitSec(question, session.settings);
  const effectiveQuestion: Question = {
    ...question,
    timeLimitSec: effectiveLimit,
  };
  const now = Date.now();
  session.phase = "question";
  session.phaseEndsAt = undefined;
  session.autoAdvancePaused = undefined;
  session.betweenPausedRemainingMs = undefined;
  session.currentQuestionIndex = idx;
  session.currentQuestion = effectiveQuestion;
  session.pausedAt = undefined;
  session.questionStartTime = now;
  session.questionEndTime = now + effectiveLimit * 1000;
  session.questionStartTimes = {
    ...(session.questionStartTimes || {}),
    [effectiveQuestion.id]: now,
  };
  recalculateSessionMetrics(session);

  // Simulate bot answers if any bots exist in the session
  Object.values(session.participants).forEach((p) => {
    if (!p.isBot) return;
    const isBotCorrect = Math.random() > 0.3;
    const isWrittenStyle =
      effectiveQuestion.type === "written" || effectiveQuestion.type === "fill_blank";
    const chosen = isWrittenStyle
      ? []
      : isBotCorrect
        ? [...effectiveQuestion.correctOptionIds]
        : [
            effectiveQuestion.options.find(
              (o) => !effectiveQuestion.correctOptionIds.includes(o.id),
            )?.id ||
              effectiveQuestion.options[0]?.id ||
              "opt-none",
          ].filter(Boolean);
    const botWritten = isWrittenStyle
      ? isBotCorrect
        ? effectiveQuestion.acceptedAnswers?.[0] || "1971"
        : "0000"
      : undefined;
    const rawTimeTaken = 1.5 + Math.random() * Math.max(2, effectiveLimit * 0.65);
    const timeTakenSec = Math.round(Math.min(effectiveLimit, rawTimeTaken) * 100) / 100;
    const graded = evaluateQuestionAnswer({
      question: effectiveQuestion,
      selectedOptionIds: chosen,
      writtenAnswer: botWritten || "",
      currentStreak: p.streak,
      timeTakenSec,
      speedBonus: session.settings.speedBonus ?? true,
      negativeMarking: session.settings.negativeMarking || 0,
    });
    p.answers[effectiveQuestion.id] = {
      questionId: effectiveQuestion.id,
      selectedOptionIds: chosen,
      writtenAnswer: botWritten,
      isCorrect: graded.isCorrect,
      timeTakenSec,
      pointsAwarded: graded.pointsAwarded,
      streakCount: graded.newStreak,
      answeredAt: now,
    };
    p.score = computeParticipantTotalScore(p.answers);
    p.streak = graded.newStreak;
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
    courses: isStaff ? store.courses : store.courses.filter((c) => !isCoursePrivate(c)),
    users: isStaff ? store.users.map(sanitizeUserForClient) : [],
    customQuizzes: isStaff
      ? store.customQuizzes
      : store.customQuizzes.filter((q) => !isQuizPrivate(q, store.courses)),
    deletedQuizIds: store.deletedQuizIds || [],
    deletedRegionIds: store.deletedRegionIds || [],
    deletedCourseIds: store.deletedCourseIds || [],
    purgedSampleData: !!store.purgedSampleData,
    hasServerGeminiKey: isStaff
      ? hasAnyConfiguredAiProvider(ensureStoreAiPool(store), store.serverGeminiApiKey)
      : false,
    examSessions: isStaff ? store.examSessions : [],
    examResults: isStaff ? store.examResults : [],
    certificates: isStaff ? store.certificates : [],
    revokedCertificates: isStaff ? store.revokedCertificates || [] : [],
    practicalExams: isStaff ? store.practicalExams || [] : (store.practicalExams || []).filter((p) => p.status === "open" || p.status === "scheduled"),
    practicalSubmissions: isStaff ? store.practicalSubmissions || [] : [],
    finalExamAttempts: isStaff
      ? (store.finalExamAttempts || []).map(({ answers: _a, ...rest }) => rest)
      : [],
    courseMaterials: isStaff ? store.courseMaterials || [] : (store.courseMaterials || []).filter((m) => m.published),
    courseRecordings: isStaff
      ? store.courseRecordings || []
      : (store.courseRecordings || []).filter((r) => r.published),
    courseAnnouncements: isStaff
      ? store.courseAnnouncements || []
      : (store.courseAnnouncements || []).filter((a) => a.published),
    courseKnowledgeBase: isStaff ? store.courseKnowledgeBase || [] : [],
    courseRequirements: store.courseRequirements || [],
    autoIssueQuizCertificates: store.autoIssueQuizCertificates === true,
    transactions: actor?.role === "admin" ? store.transactions : [],
    smsLogs: isStaff ? store.smsLogs : [],
    salesLeads: actor?.role === "admin" ? store.salesLeads : [],
    branding: store.branding,
  };
});

const serverLoginFailureTracker = new Map<string, { count: number; lockedUntil: number }>();

export const serverAuthenticateUser = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const cleanEmail = (data.email || "").trim().toLowerCase();
    const now = Date.now();
    const failureEntry = cleanEmail ? serverLoginFailureTracker.get(cleanEmail) : undefined;
    if (failureEntry && failureEntry.lockedUntil > now) {
      const waitSec = Math.max(1, Math.ceil((failureEntry.lockedUntil - now) / 1000));
      return {
        success: false,
        error: `Too many failed login attempts for this account. Wait ${waitSec} seconds before retrying.`,
      };
    }

    const recordFailedAttempt = () => {
      if (!cleanEmail) return;
      const prev = serverLoginFailureTracker.get(cleanEmail);
      const activePrev = prev && prev.lockedUntil <= now ? prev : undefined;
      const nextCount = (activePrev?.count ?? 0) + 1;
      if (nextCount >= 5) {
        serverLoginFailureTracker.set(cleanEmail, { count: 0, lockedUntil: now + 60 * 1000 });
      } else {
        serverLoginFailureTracker.set(cleanEmail, { count: nextCount, lockedUntil: 0 });
      }
    };

    const foundIdx = store.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    const found = foundIdx >= 0 ? store.users[foundIdx] : undefined;
    if (!found) {
      recordFailedAttempt();
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
      recordFailedAttempt();
      return { success: false, error: "Incorrect password." };
    }
    if (cleanEmail) {
      serverLoginFailureTracker.delete(cleanEmail);
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
    const actor = await getActorFromRequest();
    const cleanEmail = (data.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (!data.password || data.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }
    const roleCheck = resolveSignupRoleForActor(actor, data.role);
    if (!roleCheck.allowed) {
      return {
        success: false,
        error: roleCheck.error,
      };
    }

    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: "An account with this email already exists." };
    }

    const safeRole: ManagedUser["role"] = roleCheck.role;
    const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const normalizedPhone = normalizeBdPhone(data.phone);
    const newUser: ManagedUser = {
      id,
      email: cleanEmail,
      name: (data.name || "").trim() || cleanEmail.split("@")[0] || "Candidate",
      role: safeRole,
      institutionName:
        data.institutionName?.trim() ||
        (safeRole === "candidate" ? "Candidate Self-Sign-In" : "Onnesha Member Institution"),
      institution:
        data.institutionName?.trim() ||
        (safeRole === "candidate" ? "Candidate Self-Sign-In" : "Onnesha Member Institution"),
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      passwordHash: hashPasswordScrypt(data.password),
      plan: safeRole === "instructor" ? "starter" : "free",
      status: "active",
      aiCredits: safeRole === "instructor" ? 50 : 0,
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
    const cleanPhone = normalizeBdPhone(data.phone);
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return {
        success: false,
        error: "Please enter a valid 11-digit Bangladeshi mobile number (01XXXXXXXXX).",
      };
    }

    if (!globalStore.__onneshaPhoneOtps) {
      globalStore.__onneshaPhoneOtps = {};
    }
    const now = Date.now();
    // Prune expired OTP records and cap memory size
    for (const [key, entry] of Object.entries(globalStore.__onneshaPhoneOtps)) {
      if (!entry || entry.expiresAt <= now) {
        delete globalStore.__onneshaPhoneOtps[key];
      }
    }
    const existingOtp = globalStore.__onneshaPhoneOtps[cleanPhone];
    if (existingOtp && now - existingOtp.lastSentAt < 15_000) {
      return {
        success: false,
        error: "Please wait a few seconds before requesting another OTP code.",
      };
    }

    const crypto = getNodeCrypto();
    const otpCode = crypto
      ? crypto.randomInt(100000, 1000000).toString()
      : Math.floor(100000 + Math.random() * 900000).toString();
    const smsToken =
      typeof process !== "undefined" ? process.env["GREENWEB_SMS_TOKEN"]?.trim() : undefined;

    if (smsToken && smsToken.length > 5) {
      try {
        const message = `[Onnesha Arena] Your login verification code is ${otpCode}. Valid for 5 minutes.`;
        const body = new URLSearchParams({ token: smsToken, to: cleanPhone, message });
        const res = await fetch("https://api.greenweb.com.bd/api.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const text = await res.text().catch(() => "");
        if (!res.ok || /^error/i.test(text.trim())) {
          return { success: false, error: "SMS provider returned an error while sending OTP." };
        }
        globalStore.__onneshaPhoneOtps[cleanPhone] = {
          code: otpCode,
          expiresAt: now + 5 * 60 * 1000,
          attempts: 0,
          lastSentAt: now,
        };
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

    if (Object.keys(globalStore.__onneshaPhoneOtps).length >= 500) {
      const oldestKey = Object.keys(globalStore.__onneshaPhoneOtps)[0];
      if (oldestKey) delete globalStore.__onneshaPhoneOtps[oldestKey];
    }
    globalStore.__onneshaPhoneOtps[cleanPhone] = {
      code: otpCode,
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      lastSentAt: now,
    };

    // Development convenience only (never exposed when NODE_ENV === 'production')
    return { success: true, devOtp: otpCode };
  });

export const serverVerifyPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: { phone: string; otp: string }) => data)
  .handler(async ({ data }) => {
    const cleanPhone = normalizeBdPhone(data.phone);
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
    let found = store.users.find((u) => u.phone && normalizeBdPhone(u.phone) === cleanPhone);
    if (!found) {
      const id = `usr-phone-${cleanPhone.slice(-6)}-${Date.now().toString(36)}`;
      found = {
        id,
        email: `${cleanPhone}@mobile.onnesha.app`,
        name: `Candidate (${cleanPhone})`,
        role: "candidate",
        phone: cleanPhone,
        institutionName: "Candidate Self-Sign-In",
        status: "active",
        aiCredits: 0,
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

function getPortalAuthChannel(store: PersistentStoreData): "email" | "mobile" {
  return store.branding?.portalAuthChannel === "mobile" ? "mobile" : "email";
}

async function setStudentPortalCookieForRoster(student: RosterStudent): Promise<void> {
  try {
    const { setCookie } = await getServerHelpers();
    const { dataDir } = getStorePaths();
    const secret = getServerSessionSecret(dataDir);
    const token = signSessionToken(
      {
        uid: `student:${student.id}`,
        role: "candidate",
        exp: Date.now() + 12 * 3600 * 1000,
      },
      secret,
    );
    setCookie(STUDENT_PORTAL_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 3600,
      secure: typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production",
    });
  } catch {
    // cookie optional outside HTTP
  }
}

/** Public: which OTP channel the Student Portal uses (admin-configurable). */
export const serverGetPortalAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  const store = getStore();
  const channel = getPortalAuthChannel(store);
  return {
    success: true as const,
    channel,
    emailConfigured: isPortalEmailConfigured(),
    emailProviders: {
      resend: !!resolveResendApiKey(),
      brevo: !!resolveBrevoApiKey(),
    },
    smsConfigured: !!(
      typeof process !== "undefined" && process.env["GREENWEB_SMS_TOKEN"]?.trim()
    ),
  };
});

export const serverSetPortalAuthChannel = createServerFn({ method: "POST" })
  .validator((data: { channel: "email" | "mobile" }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false as const, error: "Super Admin authentication required." };
    }
    const store = getStore();
    const channel = data.channel === "mobile" ? "mobile" : "email";
    store.branding = mergeBrandingSettings(
      { portalAuthChannel: channel, updatedAt: Date.now() },
      store.branding,
    );
    scheduleDiskPersist();
    return { success: true as const, channel };
  });

/** Student Portal OTP — email (default) or mobile when admin enables it. */
export const serverRequestPortalOtp = createServerFn({ method: "POST" })
  .validator((data: { email?: string | undefined; phone?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const channel = getPortalAuthChannel(store);
    const crypto = getNodeCrypto();
    const otpCode = crypto
      ? crypto.randomInt(100000, 1000000).toString()
      : Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const isProd = typeof process !== "undefined" && process.env["NODE_ENV"] === "production";

    if (channel === "email") {
      const email = normalizePortalEmail(data.email || "");
      if (!isValidPortalEmail(email)) {
        return { success: false as const, error: "Enter a valid email address." };
      }
      const onRoster = store.roster.find(
        (s) => (s.email || "").trim().toLowerCase() === email,
      );
      if (!onRoster) {
        return {
          success: false as const,
          error: "This email is not on the course roster. Ask your admin to add it.",
        };
      }
      if (!globalStore.__onneshaEmailOtps) globalStore.__onneshaEmailOtps = {};
      for (const [key, entry] of Object.entries(globalStore.__onneshaEmailOtps)) {
        if (!entry || entry.expiresAt <= now) delete globalStore.__onneshaEmailOtps[key];
      }
      const existing = globalStore.__onneshaEmailOtps[email];
      if (existing && now - existing.lastSentAt < 20_000) {
        return {
          success: false as const,
          error: "Please wait a few seconds before requesting another OTP.",
        };
      }

      const sent = await sendPortalOtpEmail({ to: email, code: otpCode });
      if (!sent.ok) {
        if (!isProd) {
          globalStore.__onneshaEmailOtps[email] = {
            code: otpCode,
            expiresAt: now + 5 * 60 * 1000,
            attempts: 0,
            lastSentAt: now,
          };
          return { success: true as const, channel: "email" as const, devOtp: otpCode };
        }
        return { success: false as const, error: sent.error };
      }
      globalStore.__onneshaEmailOtps[email] = {
        code: otpCode,
        expiresAt: now + 5 * 60 * 1000,
        attempts: 0,
        lastSentAt: now,
      };
      return { success: true as const, channel: "email" as const };
    }

    // mobile channel
    const cleanPhone = normalizeBdPhone(data.phone || "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return {
        success: false as const,
        error: "Enter a valid 11-digit Bangladeshi mobile (01XXXXXXXXX).",
      };
    }
    const onRoster = store.roster.find(
      (s) =>
        normalizeBdPhone(s.phone || "") === cleanPhone ||
        normalizeBdPhone(s.guardianPhone || "") === cleanPhone,
    );
    if (!onRoster) {
      return {
        success: false as const,
        error: "This mobile is not on the course roster. Ask your admin to add it.",
      };
    }
    if (!globalStore.__onneshaPhoneOtps) globalStore.__onneshaPhoneOtps = {};
    const existingOtp = globalStore.__onneshaPhoneOtps[cleanPhone];
    if (existingOtp && now - existingOtp.lastSentAt < 20_000) {
      return {
        success: false as const,
        error: "Please wait a few seconds before requesting another OTP.",
      };
    }
    const smsToken =
      typeof process !== "undefined" ? process.env["GREENWEB_SMS_TOKEN"]?.trim() : undefined;
    if (smsToken && smsToken.length > 5) {
      try {
        const message = `[Onnesha Arena] Portal code ${otpCode}. Valid 5 min.`;
        const body = new URLSearchParams({ token: smsToken, to: cleanPhone, message });
        const res = await fetch("https://api.greenweb.com.bd/api.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const text = await res.text().catch(() => "");
        if (!res.ok || /^error/i.test(text.trim())) {
          return { success: false as const, error: "SMS provider error while sending OTP." };
        }
        globalStore.__onneshaPhoneOtps[cleanPhone] = {
          code: otpCode,
          expiresAt: now + 5 * 60 * 1000,
          attempts: 0,
          lastSentAt: now,
        };
        return { success: true as const, channel: "mobile" as const };
      } catch {
        return { success: false as const, error: "Failed to reach SMS OTP gateway." };
      }
    }
    if (isProd) {
      return {
        success: false as const,
        error: "SMS OTP gateway (GREENWEB_SMS_TOKEN) is not configured.",
      };
    }
    globalStore.__onneshaPhoneOtps[cleanPhone] = {
      code: otpCode,
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      lastSentAt: now,
    };
    return { success: true as const, channel: "mobile" as const, devOtp: otpCode };
  });

export const serverVerifyPortalOtp = createServerFn({ method: "POST" })
  .validator(
    (data: { email?: string | undefined; phone?: string | undefined; otp: string }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    const channel = getPortalAuthChannel(store);
    const otp = (data.otp || "").trim();
    if (!/^\d{4,8}$/.test(otp)) {
      return { success: false as const, error: "Enter the OTP code from your message." };
    }

    let student: RosterStudent | undefined;

    if (channel === "email") {
      const email = normalizePortalEmail(data.email || "");
      const pending = globalStore.__onneshaEmailOtps?.[email];
      if (!pending) {
        return { success: false as const, error: "OTP not requested or expired." };
      }
      if (Date.now() > pending.expiresAt) {
        delete globalStore.__onneshaEmailOtps?.[email];
        return { success: false as const, error: "OTP expired. Request a new code." };
      }
      pending.attempts += 1;
      if (pending.attempts > 5) {
        delete globalStore.__onneshaEmailOtps?.[email];
        return { success: false as const, error: "Too many invalid attempts. Request a new code." };
      }
      if (pending.code !== otp) {
        return { success: false as const, error: "Invalid OTP verification code." };
      }
      delete globalStore.__onneshaEmailOtps?.[email];
      student = store.roster.find((s) => (s.email || "").trim().toLowerCase() === email);
    } else {
      const cleanPhone = normalizeBdPhone(data.phone || "");
      const pending = globalStore.__onneshaPhoneOtps?.[cleanPhone];
      if (!pending) {
        return { success: false as const, error: "OTP not requested or expired." };
      }
      if (Date.now() > pending.expiresAt) {
        delete globalStore.__onneshaPhoneOtps?.[cleanPhone];
        return { success: false as const, error: "OTP expired. Request a new code." };
      }
      pending.attempts += 1;
      if (pending.attempts > 5) {
        delete globalStore.__onneshaPhoneOtps?.[cleanPhone];
        return { success: false as const, error: "Too many invalid attempts. Request a new code." };
      }
      if (pending.code !== otp) {
        return { success: false as const, error: "Invalid OTP verification code." };
      }
      delete globalStore.__onneshaPhoneOtps?.[cleanPhone];
      student = store.roster.find(
        (s) =>
          normalizeBdPhone(s.phone || "") === cleanPhone ||
          normalizeBdPhone(s.guardianPhone || "") === cleanPhone,
      );
    }

    if (!student) {
      return { success: false as const, error: "Roster match failed after OTP." };
    }
    await setStudentPortalCookieForRoster(student);
    return {
      success: true as const,
      channel,
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        phone: student.phone,
        email: student.email,
        regionId: student.regionId,
        regionName: student.regionName,
      },
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

    const webhookUrl =
      typeof process !== "undefined" ? process.env["SALES_WEBHOOK_URL"]?.trim() : undefined;
    if (webhookUrl && /^https?:\/\//i.test(webhookUrl)) {
      void fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "sales_lead.created",
          lead,
        }),
        signal: AbortSignal.timeout(4000),
      }).catch((err) => console.warn("[OnneshaSales] Webhook dispatch notice:", err));
    }

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
    const verifiedStatus =
      actor?.role === "admin" &&
      (data.status === "completed" || data.status === "pending" || data.status === "failed")
        ? data.status
        : "pending";
    const record: ServerTransactionRecord = {
      id: `trx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      planId: data.planId,
      amount: Number(data.amount) || 0,
      msisdn: (data.msisdn || "").trim(),
      trxId: (data.trxId || "").trim(),
      method: data.method || "bkash",
      status: verifiedStatus,
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

export const serverGetAiGeneratorStatus = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await getActorFromRequest();
  if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
    return {
      hasKey: false,
      source: "none" as const,
      activeNodes: [] as Array<{
        id: string;
        label: string;
        provider: AiProviderId;
        model: string;
        status: string;
      }>,
      strategy: "priority_failover" as AiPoolRoutingStrategy,
    };
  }
  const store = getStore();
  const pool = ensureStoreAiPool(store);
  const sanitized = sanitizeAiPoolConfig(pool, store.serverGeminiApiKey);
  const enabledNodes = sanitized.nodes.filter((n) => n.enabled && n.hasApiKey);
  const resolved = resolveServerGeminiApiKey(store);
  const hasAny = enabledNodes.length > 0;
  return {
    hasKey: hasAny,
    source:
      pool.nodes.some((n) => n.enabled && n.apiKey.trim().length > 0)
        ? ("server" as const)
        : resolved.source === "client"
          ? hasAny
            ? ("env" as const)
            : ("none" as const)
          : resolved.source,
    strategy: sanitized.strategy,
    activeNodes: enabledNodes.map((n) => ({
      id: n.id,
      label: n.label,
      provider: n.provider,
      model: n.model,
      status: n.status,
    })),
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
      preferredNodeId?: string | undefined;
      clientApiKey?: string | undefined;
      clientProvider?: AiProviderId | undefined;
      clientModel?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, quiz: null, error: "Instructor or Admin login required." };
    }

    const store = getStore();
    const pool = ensureStoreAiPool(store);
    const hasProvider =
      hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey) ||
      Boolean(data.clientApiKey && data.clientApiKey.trim().length >= 8);
    if (!hasProvider) {
      return {
        success: false,
        quiz: null,
        error: "GEMINI_API_KEY not configured on server (no AI Pool providers configured)",
      };
    }

    const userIdx = store.users.findIndex((u) => u.id === actor.id);
    const currentCredits = userIdx >= 0 ? (store.users[userIdx]?.aiCredits ?? 50) : 50;
    if (currentCredits <= 0) {
      return {
        success: false,
        quiz: null,
        error: "No AI generation credits remaining for this account.",
      };
    }
    const creditReserved = userIdx >= 0 && !!store.users[userIdx];
    const nextCredits = Math.max(0, currentCredits - 1);
    if (creditReserved && store.users[userIdx]) {
      store.users[userIdx] = {
        ...store.users[userIdx],
        aiCredits: nextCredits,
      };
      scheduleDiskPersist();
    }
    const refundReservedCredit = () => {
      if (creditReserved && store.users[userIdx]) {
        store.users[userIdx] = {
          ...store.users[userIdx],
          aiCredits: (store.users[userIdx]?.aiCredits ?? nextCredits) + 1,
        };
        scheduleDiskPersist();
      }
    };

    try {
      const result = await generateQuizViaAiPool(
        pool,
        {
          topic: data.topic,
          sourceText: data.sourceText,
          questionCount: data.questionCount,
          difficulty: data.difficulty,
          category: data.category,
          courseId: data.courseId,
          courseTitle: data.courseTitle,
          quizNumber: data.quizNumber,
          instructorId: actor.id,
          instructorName: actor.name,
          questionStyleMode: data.questionStyleMode,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          preferredNodeId: data.preferredNodeId,
          clientOverrideKey: data.clientApiKey,
          clientOverrideProvider: data.clientProvider,
          clientOverrideModel: data.clientModel,
          actorName: actor.name,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      result.quiz.author = actor.name;

      return {
        success: true,
        quiz: result.quiz,
        remainingCredits: nextCredits,
        provider: result.provider,
        model: result.model,
        nodeLabel: result.nodeLabel,
        latencyMs: result.latencyMs,
      };
    } catch (err) {
      refundReservedCredit();
      const message =
        err instanceof Error && err.message ? err.message : "AI Pool quiz synthesis failed.";
      return { success: false, quiz: null, error: message };
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
        branding: mergeBrandingSettings(store.branding, DEFAULT_BRANDING),
        didWeb,
        publicKeyMultibase,
      };
    };

    const isRevoked = isCertificateRevoked(store, rawCert);

    if (isRevoked) {
      return {
        success: false,
        revoked: true,
        certificate: null,
        verification: null,
        branding: mergeBrandingSettings(store.branding, DEFAULT_BRANDING),
        didWeb,
        publicKeyMultibase,
      };
    }

    const found = store.certificates.find((c) => c.certificateNumber.toLowerCase() === target);
    if (found) {
      return await resolveVerifiedEnvelope(found);
    }

    // No synthesize-from-results: only explicitly issued credentials verify.
    return {
      success: false,
      certificate: null,
      verification: null,
      branding: mergeBrandingSettings(store.branding, DEFAULT_BRANDING),
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

    const existingEnriched = enrichCertificateWithOtsCheckpoint(found, store.ledgerCheckpoints);
    if (
      existingEnriched.rekorStatus === "anchored" &&
      existingEnriched.otsStatus === "bitcoin_confirmed"
    ) {
      return {
        success: true,
        certificate: existingEnriched,
        verification,
        rekorAnchored: true,
        otsAnchored: true,
      };
    }

    if (!globalStore.__onneshaAnchorCooldowns) {
      globalStore.__onneshaAnchorCooldowns = {};
    }
    const now = Date.now();
    const key = found.certificateNumber.toUpperCase();
    const lastSync = globalStore.__onneshaAnchorCooldowns[key] || 0;
    if (now - lastSync < 15_000) {
      return {
        success: false,
        certificate: existingEnriched,
        verification,
        rekorAnchored: existingEnriched.rekorStatus === "anchored",
        otsAnchored: !!existingEnriched.otsProofBase64,
        rekorError: "Please wait a few seconds before re-syncing transparency anchors.",
      };
    }
    globalStore.__onneshaAnchorCooldowns[key] = now;

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
    const originUrl = (data.origin || "https://arena.onnesha.courses").replace(/\/+$/, "");
    const raw = isCertificateRevoked(store, data.certNo)
      ? undefined
      : store.certificates.find(
          (c) => c.certificateNumber.toLowerCase() === (data.certNo || "").trim().toLowerCase(),
        );
    if (!raw || !certKeys) {
      return { success: false, credential: null, didDocument: null, otsProofBase64: null };
    }
    const verification = verifyCertificateCryptographically(raw, dataDir, store.certificates);
    if (verification.status !== "verified_signed") {
      return {
        success: false,
        error: "Credential failed cryptographic verification.",
        credential: null,
        didDocument: null,
        otsProofBase64: null,
      };
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
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";
  const originUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : `${url.protocol}//${url.host}`;

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
    if (isCertificateRevoked(store, certNo)) {
      return Response.json({ error: "Credential has been revoked" }, { status: 404 });
    }
    const raw = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!raw || !certKeys) {
      return Response.json({ error: "Credential not found" }, { status: 404 });
    }
    const vcVerify = verifyCertificateCryptographically(raw, dataDir, store.certificates);
    if (vcVerify.status !== "verified_signed") {
      return Response.json(
        { error: "Credential failed cryptographic verification" },
        { status: 409 },
      );
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
    if (isCertificateRevoked(store, certNo)) {
      return Response.json({ error: "Credential has been revoked" }, { status: 404 });
    }
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

  if (path === "/api/v1/health") {
    return Response.json(
      {
        status: "ok",
        service: "onnesha-arena",
        updatedAt: store.updatedAt,
        hasSigningKeys: Boolean(certKeys),
      },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  if (path === "/api/v1/courses") {
    const publicCourses = store.courses
      .filter((c) => !isCoursePrivate(c))
      .map((c) => ({
        id: c.id,
        code: c.code,
        titleEn: c.titleEn,
        titleBn: c.titleBn,
        categoryEn: c.categoryEn,
        status: c.status,
      }));
    return Response.json(
      { status: "success", count: publicCourses.length, data: publicCourses },
      { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" } },
    );
  }

  if (path === "/api/v1/quizzes") {
    const deletedSet = new Set(store.deletedQuizIds || []);
    const allById = new Map<string, Quiz>();
    for (const q of READY_MADE_PACKS) {
      if (!deletedSet.has(q.id) && (!q.slug || !deletedSet.has(q.slug))) {
        allById.set(q.id, q);
      }
    }
    for (const q of store.customQuizzes) {
      if (!deletedSet.has(q.id) && (!q.slug || !deletedSet.has(q.slug))) {
        allById.set(q.id, q);
      }
    }
    const publicQuizzes = Array.from(allById.values())
      .filter((q) => !isQuizPrivate(q, store.courses))
      .map((q) => ({
        id: q.id,
        slug: q.slug,
        titleEn: q.titleEn,
        titleBn: q.titleBn,
        categoryEn: q.categoryEn,
        courseId: q.courseId,
        questionCount: q.questions.length,
      }));
    return Response.json(
      { status: "success", count: publicQuizzes.length, data: publicQuizzes },
      { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" } },
    );
  }

  const v1CertMatch = path.match(/^\/api\/v1\/certificates\/([^/]+)$/i);
  if (v1CertMatch && v1CertMatch[1]) {
    const certNo = decodeURIComponent(v1CertMatch[1]).trim();
    if (isCertificateRevoked(store, certNo)) {
      return Response.json(
        { status: "revoked", verified: false, error: "Credential has been revoked" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    const raw = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!raw) {
      return Response.json(
        {
          status: "not_found",
          verified: false,
          error: "Credential not found",
          certificateNumber: certNo,
        },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    const vcVerify = verifyCertificateCryptographically(raw, dataDir, store.certificates);
    const enriched = enrichCertificateWithOtsCheckpoint(raw, store.ledgerCheckpoints);
    return Response.json(
      {
        status: vcVerify.status === "tampered" ? "tampered" : "verified",
        verified: vcVerify.status !== "tampered" && raw.verified !== false,
        verificationStatus: vcVerify.status,
        certificate: {
          certificateNumber: enriched.certificateNumber,
          studentName: enriched.studentName,
          studentRoll: enriched.studentRoll,
          regionName: enriched.regionName,
          quizTitle: enriched.quizTitle,
          score: enriched.score,
          totalMarks: enriched.totalMarks ?? enriched.totalPoints,
          rank: enriched.rank,
          accuracyPercent: enriched.accuracyPercent,
          issueDate: enriched.issueDate,
          chainHash: enriched.chainHash,
          rekorStatus: enriched.rekorStatus,
          otsStatus: enriched.otsStatus,
        },
      },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
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
        | "delete_certificate"
        | "restore_certificate"
        | "update_branding"
        | "update_ai_settings"
        | "update_sales_lead"
        | "update_transaction"
        | "import_store_backup"
        | "purge_dummy_data"
        | "purge_under_50_sessions";
      minExaminees?: number | undefined;
      geminiApiKey?: string | undefined;
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
      certificateNumber?: string | undefined;
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
    let issuedCertificate: CertificateData | undefined;
    let purgeSummary: PurgeExamSummary | undefined;

    const quizLookupKey =
      data.action === "delete_quiz"
        ? data.quizId
        : data.action === "save_quiz"
          ? data.quiz?.id || data.quiz?.slug
          : undefined;
    const targetCustomQuiz = quizLookupKey
      ? store.customQuizzes.find((q) => q.id === quizLookupKey || q.slug === quizLookupKey)
      : undefined;
    const targetReadyQuiz =
      !targetCustomQuiz && quizLookupKey
        ? READY_MADE_PACKS.find((q) => q.id === quizLookupKey || q.slug === quizLookupKey)
        : undefined;
    const effectiveTargetQuiz = targetCustomQuiz || targetReadyQuiz;

    const perm = canActorMutateStoreAction(
      actor ? { id: actor.id, role: actor.role } : null,
      data.action,
      effectiveTargetQuiz ? effectiveTargetQuiz.instructorId || "usr-super-admin" : undefined,
      effectiveTargetQuiz?.isTemplate,
    );
    if (!perm.allowed) {
      return {
        success: false,
        error: perm.reason || "Unauthorized",
        regions: [],
        roster: [],
        courses: [],
        users: [],
        customQuizzes: [],
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
          if (Array.isArray(store.deletedRegionIds)) {
            store.deletedRegionIds = store.deletedRegionIds.filter(
              (rid) => rid !== data.region!.id,
            );
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_region": {
        if (data.regionId) {
          store.regions = store.regions.filter((r) => r.id !== data.regionId);
          const delRegs = new Set(store.deletedRegionIds || []);
          delRegs.add(data.regionId);
          store.deletedRegionIds = Array.from(delRegs);
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
        store.purgedSampleData = true;
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
          if (Array.isArray(store.deletedCourseIds)) {
            store.deletedCourseIds = store.deletedCourseIds.filter(
              (cid) => cid !== data.course!.id,
            );
          }
          store.users = syncCourseInstructorsInStore(store.users, data.course);
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_course": {
        if (data.courseId) {
          store.courses = store.courses.filter((c) => c.id !== data.courseId);
          const delCourses = new Set(store.deletedCourseIds || []);
          delCourses.add(data.courseId);
          store.deletedCourseIds = Array.from(delCourses);
          store.customQuizzes = store.customQuizzes.map((q) =>
            q.courseId === data.courseId
              ? { ...q, courseId: undefined, courseTitle: undefined }
              : q,
          );
          store.users = store.users.map((u) => {
            if (!(u.assignedCourseIds || []).includes(data.courseId!)) return u;
            return {
              ...u,
              assignedCourseIds: (u.assignedCourseIds || []).filter((cid) => cid !== data.courseId),
            };
          });
          scheduleDiskPersist();
        }
        break;
      }
      case "save_user": {
        if (data.user) {
          const result = upsertManagedUserInStore(store.users, data.user);
          if (!result.success || !result.savedUser) {
            return {
              success: false,
              error: result.error || "Failed to save user account.",
              regions: store.regions,
              roster: store.roster,
              courses: store.courses,
              users: store.users.map(sanitizeUserForClient),
              customQuizzes: [],
              branding: store.branding,
            };
          }
          store.users = result.users;
          store.courses = syncUserCoursesInStore(store.courses, store.users, result.savedUser);
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
          clearDeletedQuizTokensInStore(store, quizRecord);
          scheduleDiskPersist();
        }
        break;
      }
      case "delete_quiz": {
        if (data.quizId && deleteQuizInStore(store, data.quizId, READY_MADE_PACKS)) {
          scheduleDiskPersist();
        }
        break;
      }
      case "issue_certificate": {
        if (data.certificate) {
          const certNo = (data.certificate.certificateNumber || "").trim();
          const studentName = (data.certificate.studentName || "").trim();
          const scoreVal = data.certificate.score;
          if (
            !certNo ||
            !studentName ||
            typeof scoreVal !== "number" ||
            !Number.isFinite(scoreVal) ||
            scoreVal < 0
          ) {
            return {
              success: false,
              error:
                "Invalid certificate payload: certificate number, student name, and non-negative numeric score are required.",
              regions: store.regions,
              roster: store.roster,
              courses: store.courses,
              users: store.users.map(sanitizeUserForClient),
              customQuizzes: store.customQuizzes,
              branding: store.branding,
            };
          }
          const existingSealed = store.certificates.find(
            (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
          );
          if (
            existingSealed &&
            existingSealed.chainHash &&
            existingSealed.cryptoSignature &&
            existingSealed.score === data.certificate.score &&
            existingSealed.quizTitle === data.certificate.quizTitle &&
            (existingSealed.studentRoll || "") === (data.certificate.studentRoll || "")
          ) {
            issuedCertificate = enrichCertificateWithOtsCheckpoint(
              existingSealed,
              store.ledgerCheckpoints,
            );
            break;
          }
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
          if (store.revokedCertificates?.length) {
            store.revokedCertificates = store.revokedCertificates.filter(
              (rc) => rc.toLowerCase() !== sealedCert.certificateNumber.toLowerCase(),
            );
          }
          issuedCertificate = sealedCert;
          scheduleDiskPersist();
          triggerBackgroundExternalAnchoring([sealedCert.certificateNumber]);
        }
        break;
      }
      case "delete_certificate": {
        if (deleteCertificateInStore(store, data.certificateNumber || "")) {
          scheduleDiskPersist();
        }
        break;
      }
      case "restore_certificate": {
        if (restoreCertificateInStore(store, data.certificateNumber || "")) {
          scheduleDiskPersist();
        }
        break;
      }
      case "update_branding": {
        if (data.branding) {
          store.branding = mergeBrandingSettings(
            { ...data.branding, updatedAt: Date.now() },
            store.branding,
          );
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
        if (
          data.trxId &&
          data.trxStatus &&
          (["completed", "pending", "failed"] as const).includes(
            data.trxStatus as "completed" | "pending" | "failed",
          )
        ) {
          let matchedUserId: string | undefined;
          let matchedPlan: ManagedUser["plan"] | undefined;
          store.transactions = store.transactions.map((t) => {
            if (t.id === data.trxId || t.trxId === data.trxId) {
              matchedUserId = t.userId;
              matchedPlan =
                t.planId === "enterprise" || t.planId === "pro" || t.planId === "free"
                  ? t.planId
                  : "pro";
              return { ...t, status: data.trxStatus! };
            }
            return t;
          });
          if (data.trxStatus === "completed" && matchedUserId && matchedPlan) {
            store.users = store.users.map((u) =>
              u.id === matchedUserId
                ? {
                    ...u,
                    plan: matchedPlan!,
                    aiCredits:
                      matchedPlan === "enterprise" ? 9999 : Math.max(u.aiCredits ?? 0, 250),
                  }
                : u,
            );
          }
          scheduleDiskPersist();
        }
        break;
      }
      case "import_store_backup": {
        if (data.backup) {
          if (data.backup.regions?.length) store.regions = data.backup.regions;
          if (data.backup.roster?.length) store.roster = data.backup.roster;
          if (data.backup.courses?.length) store.courses = data.backup.courses;
          if (data.backup.users?.length) {
            const existingById = new Map(store.users.map((u) => [u.id, u]));
            const existingByEmail = new Map(store.users.map((u) => [u.email.toLowerCase(), u]));
            const mergedUsers = data.backup.users.map((u) => {
              const existing = existingById.get(u.id) || existingByEmail.get(u.email.toLowerCase());
              const hasValidHash =
                typeof u.passwordHash === "string" && u.passwordHash.startsWith("scrypt:");
              return {
                ...u,
                passwordHash: hasValidHash
                  ? u.passwordHash
                  : existing?.passwordHash || hashPasswordScrypt("instructor123"),
              };
            });
            store.users = ensureDefaultUsers(mergedUsers);
          }
          if (data.backup.customQuizzes) store.customQuizzes = data.backup.customQuizzes;
          if (data.backup.examSessions) store.examSessions = data.backup.examSessions;
          if (data.backup.examResults) store.examResults = data.backup.examResults;
          if (data.backup.certificates) store.certificates = data.backup.certificates;
          if (Array.isArray(data.backup.revokedCertificates)) {
            store.revokedCertificates = data.backup.revokedCertificates;
          }
          if (data.backup.revokedCertificateArchive) {
            store.revokedCertificateArchive = data.backup.revokedCertificateArchive;
          }
          if (data.backup.branding)
            store.branding = mergeBrandingSettings(data.backup.branding, DEFAULT_BRANDING);
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
        store.purgedSampleData = true;
        scheduleDiskPersist();
        break;
      }
      case "purge_under_50_sessions": {
        const threshold =
          typeof data.minExaminees === "number" &&
          Number.isFinite(data.minExaminees) &&
          data.minExaminees >= 1
            ? Math.floor(data.minExaminees)
            : 50;
        const liveSessions = getLiveSessions();
        purgeSummary = purgeUnderThresholdExamsInStore(store, threshold, liveSessions);
        store.purgedUnder50Initial = true;
        scheduleDiskPersist();
        if (purgeSummary.removedLiveSessions > 0) {
          scheduleLiveSessionsPersist();
        }
        console.info(
          `[OnneshaServerStore] Admin <${threshold} examinee purge: sessions=${purgeSummary.removedSessions}, results=${purgeSummary.removedResults}, certs=${purgeSummary.removedCertificates}, revoked=${purgeSummary.removedRevokedCerts}, sms=${purgeSummary.removedSmsLogs}, live=${purgeSummary.removedLiveSessions}, kept=${purgeSummary.keptSessions}`,
        );
        break;
      }
      case "update_ai_settings": {
        if (typeof data.geminiApiKey === "string") {
          const clean = data.geminiApiKey.trim();
          store.serverGeminiApiKey = clean.length >= 10 ? clean : undefined;
          scheduleDiskPersist();
        }
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
      deletedQuizIds: store.deletedQuizIds || [],
      deletedRegionIds: store.deletedRegionIds || [],
      deletedCourseIds: store.deletedCourseIds || [],
      purgedSampleData: !!store.purgedSampleData,
      hasServerGeminiKey: hasAnyConfiguredAiProvider(
        ensureStoreAiPool(store),
        store.serverGeminiApiKey,
      ),
      branding: store.branding,
      salesLeads: actor?.role === "admin" ? store.salesLeads : [],
      transactions: actor?.role === "admin" ? store.transactions : [],
      ...(issuedCertificate ? { certificate: issuedCertificate } : {}),
      ...(purgeSummary ? { purgeSummary } : {}),
    };
  });

// ============================================================================
// 2. CANDIDATE DIRECTORY & NUMBER LOOKUP FOR JOIN TERMINAL
// ============================================================================

export function buildJoinDirectoryForSession(params: {
  roster: RosterStudent[];
  regions: Region[];
  session?:
    Pick<ServerLiveSession, "phase" | "isSelfPractice" | "settings" | "participants"> | undefined;
  examResults?: ExamResultRecord[] | undefined;
}) {
  const { roster, regions, session, examResults } = params;
  if (!session || session.phase === "podium" || session.phase === "finished") {
    return {
      success: false,
      error: "No active examination room found for this PIN.",
      regions: [] as Region[],
      candidates: [] as Array<{
        id: string;
        name: string;
        rollNumber: string;
        regionId: string;
        regionName: string;
        batch: string;
        maskedPhone: string;
        isAlreadyJoined: boolean;
      }>,
      allowedRegionId: "all",
      allowedRegionName: "All Regions",
    };
  }

  const allowedRegionId = session.settings?.allowedRegionId || "all";
  const allowedRegionName = session.settings?.allowedRegionName || "All Regions";
  if (session.isSelfPractice) {
    return {
      success: true,
      regions,
      candidates: [],
      allowedRegionId,
      allowedRegionName,
    };
  }

  const activeSeatRollSet = new Set<string>();
  const activeSeatCandidateIds = new Set<string>();
  Object.values(session.participants || {}).forEach((p) => {
    if (p.rollNumber) activeSeatRollSet.add(normalizeCode(p.rollNumber));
    if (p.candidateId) activeSeatCandidateIds.add(p.candidateId);
  });

  const skipCompletedRetake =
    !!session.settings?.retakeForSessionId &&
    session.settings?.retakeSkipCompleted !== false &&
    Array.isArray(examResults);
  const minCompletedAnswers = resolveRetakeMinCompletedAnswers(
    session.settings?.retakeMinCompletedAnswers,
  );
  const compIdx = skipCompletedRetake
    ? buildOriginalCompletionIndex(
        examResults!,
        session.settings.retakeForSessionId,
        session.settings.retakeOriginPin,
        minCompletedAnswers,
      )
    : null;

  const scopedRoster =
    allowedRegionId && allowedRegionId !== "all"
      ? roster.filter((s) => (s.regionId || "reg-dhaka") === allowedRegionId)
      : roster;

  const eligibleRoster = compIdx
    ? scopedRoster.filter(
        (s) =>
          !findCompletedMatchInIndex(compIdx, {
            rollNumber: s.rollNumber,
            phone: s.phone || s.guardianPhone,
          }),
      )
    : scopedRoster;

  const candidates = eligibleRoster.map((s) => ({
    id: s.id,
    name: s.name,
    rollNumber: s.rollNumber,
    regionId: s.regionId || "reg-dhaka",
    regionName: s.regionName || "Dhaka Range",
    batch: s.batch || "46th BCS & Cadet Batch",
    maskedPhone: maskPhoneHint(s.phone || s.guardianPhone),
    isAlreadyJoined:
      activeSeatCandidateIds.has(s.id) || activeSeatRollSet.has(normalizeCode(s.rollNumber)),
  }));

  return {
    success: true,
    regions,
    candidates,
    allowedRegionId,
    allowedRegionName,
  };
}

export function sanitizeLookupCandidate(matched: RosterStudent, isSeatLocked: boolean) {
  return {
    id: matched.id,
    name: matched.name,
    rollNumber: matched.rollNumber,
    // Never leak full mobile/guardian numbers over unauthenticated lookup endpoints
    phone: "",
    maskedPhone: maskPhoneHint(matched.phone || matched.guardianPhone),
    regionId: matched.regionId || "reg-dhaka",
    regionName: matched.regionName || "Dhaka Range",
    batch: matched.batch || "46th BCS & Cadet Batch",
    isSeatLocked,
  };
}

export function filterActiveRoomsFromSessions(
  sessions: Record<string, ServerLiveSession>,
  cutoffMs = Date.now() - 4 * 3600 * 1000,
) {
  return Object.values(sessions)
    .filter(
      (s) =>
        s.updatedAt >= cutoffMs &&
        s.phase !== "podium" &&
        s.phase !== "finished" &&
        !s.isSelfPractice,
    )
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
}

export const serverGetJoinDirectory = createServerFn({ method: "GET" })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    return buildJoinDirectoryForSession({
      roster: store.roster,
      regions: store.regions,
      session,
      examResults: store.examResults,
    });
  });

export const serverLookupCandidateByNumber = createServerFn({ method: "GET" })
  .validator((data: { pin: string; query: string; regionId?: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const sessions = getLiveSessions();
    const session = sessions[data.pin];

    if (!session || session.phase === "podium" || session.phase === "finished") {
      return {
        success: false,
        error: "No active examination room found for this PIN.",
      };
    }

    if (session.isSelfPractice) {
      return {
        success: false,
        error:
          "Roster lookup is disabled in Self-Practice mode. Please enter your details under New Entry.",
      };
    }

    const rawQuery = (data.query || "").trim();
    const regionScope =
      data.regionId && data.regionId !== "all"
        ? data.regionId
        : session?.settings?.allowedRegionId && session.settings.allowedRegionId !== "all"
          ? session.settings.allowedRegionId
          : undefined;
    const isSerialLookup = !!regionScope && /^\d{1,2}$/.test(rawQuery);

    if (!rawQuery || (!isSerialLookup && rawQuery.length < 2)) {
      return {
        success: false,
        error: "Enter at least 3 digits of your Mobile Number or Roll Number.",
      };
    }

    const matched = findRosterCandidate(store.roster, rawQuery, regionScope);

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

    if (session?.settings?.retakeForSessionId && session.settings.retakeSkipCompleted !== false) {
      const minCompletedAnswers = resolveRetakeMinCompletedAnswers(
        session.settings.retakeMinCompletedAnswers,
      );
      const compIdx = buildOriginalCompletionIndex(
        store.examResults,
        session.settings.retakeForSessionId,
        session.settings.retakeOriginPin,
        minCompletedAnswers,
      );
      const completedRes = findCompletedMatchInIndex(compIdx, {
        rollNumber: matched.rollNumber,
        phone: matched.phone || matched.guardianPhone,
      });
      if (completedRes) {
        const answeredCount = getResultSubmittedAnswersCount(completedRes);
        return {
          success: false,
          error: `Already Completed: ${matched.name} (${matched.rollNumber}) already submitted ${answeredCount} question(s) (threshold >= ${minCompletedAnswers}) in the original exam (PIN ${session.settings.retakeOriginPin || ""}, Score: ${completedRes.score}). No retake is needed — your existing score is preserved.`,
        };
      }
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
      candidate: sanitizeLookupCandidate(matched, !!activeParticipant),
    };
  });

// ============================================================================
// 3. LIVE SESSION LIFECYCLE & 500+ CONCURRENCY DELTA ENGINE
// ============================================================================

export const serverGetActiveRooms = createServerFn({ method: "GET" }).handler(async () => {
  const sessions = getLiveSessions();
  const activeRooms = filterActiveRoomsFromSessions(sessions);

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
      passThresholdPct?: number | undefined;
      isSelfPractice?: boolean | undefined;
      retakeForSessionId?: string | undefined;
      retakeSkipCompleted?: boolean | undefined;
      retakeMinCompletedAnswers?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const actor = await getActorFromRequest();
    const isStaff = !!actor && (actor.role === "admin" || actor.role === "instructor");

    const origSessionForRetake = data.retakeForSessionId
      ? store.examSessions.find((s) => s.id === data.retakeForSessionId)
      : undefined;
    if (data.retakeForSessionId && !origSessionForRetake) {
      return {
        success: false,
        error: "Original assessment session could not be found for supplementary retake.",
        serverNow: Date.now(),
        session: null,
        hostToken: undefined,
      };
    }

    const deletedIdsSet = new Set(store.deletedQuizIds || []);
    const authoritativeQuiz =
      store.customQuizzes.find((q) => q.id === data.quiz?.id || q.slug === data.quiz?.slug) ||
      READY_MADE_PACKS.find(
        (q) =>
          !deletedIdsSet.has(q.id) &&
          !deletedIdsSet.has(q.slug) &&
          (q.id === data.quiz?.id || q.slug === data.quiz?.slug),
      ) ||
      (origSessionForRetake
        ? store.customQuizzes.find(
            (q) => q.id === origSessionForRetake.quizId || q.slug === origSessionForRetake.quizId,
          ) ||
          READY_MADE_PACKS.find(
            (q) => q.id === origSessionForRetake.quizId || q.slug === origSessionForRetake.quizId,
          )
        : undefined) ||
      (isStaff ? data.quiz : undefined);
    const activeQuiz = isStaff
      ? data.quiz?.questions?.length
        ? data.quiz
        : authoritativeQuiz
      : authoritativeQuiz;

    const quizIsPrivate =
      isQuizPrivate(activeQuiz || data.quiz, store.courses) ||
      isQuizPrivate(data.quiz, store.courses);

    if (!isStaff && (quizIsPrivate || !data.isSelfPractice)) {
      return {
        success: false,
        error:
          "Private course examinations can only be started by an authenticated Admin or Instructor.",
        serverNow: Date.now(),
        session: null,
        hostToken: undefined,
      };
    }

    if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) {
      return {
        success: false,
        error: "Quiz not found or has no questions.",
        serverNow: Date.now(),
        session: null,
        hostToken: undefined,
      };
    }

    // Purge stale sessions older than 12 hours
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const key of Object.keys(sessions)) {
      const entry = sessions[key];
      if (!entry || entry.updatedAt < cutoff) {
        delete sessions[key];
      }
    }

    // Only authenticated staff persist new quizzes into server customQuizzes (respecting ownership & templates)
    if (isStaff && activeQuiz && !READY_MADE_PACKS.some((p) => p.id === activeQuiz.id)) {
      const idx = store.customQuizzes.findIndex((q) => q.id === activeQuiz.id);
      if (idx >= 0) {
        const existingQuiz = store.customQuizzes[idx];
        const canOverwrite = canActorMutateStoreAction(
          actor ? { id: actor.id, role: actor.role } : null,
          "save_quiz",
          existingQuiz?.instructorId || "usr-super-admin",
          existingQuiz?.isTemplate,
        );
        if (canOverwrite.allowed) {
          store.customQuizzes[idx] = activeQuiz;
          scheduleDiskPersist();
        }
      } else {
        store.customQuizzes.unshift(activeQuiz);
        scheduleDiskPersist();
      }
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
    const matchedCourse = activeQuiz.courseId
      ? store.courses.find((c) => c.id === activeQuiz.courseId)
      : undefined;
    const effectivePassThreshold = origSessionForRetake
      ? resolvePassThresholdPct({
          sessionThreshold: data.passThresholdPct ?? origSessionForRetake.passThresholdPct,
          courseThreshold: matchedCourse?.passThresholdPct,
          brandingDefaultThreshold: store.branding?.defaultPassThresholdPct,
        })
      : resolvePassThresholdPct({
          sessionThreshold: data.passThresholdPct,
          courseThreshold: matchedCourse?.passThresholdPct,
          brandingDefaultThreshold: store.branding?.defaultPassThresholdPct,
        });

    const newSession: ServerLiveSession = {
      pin,
      quizId: activeQuiz.id,
      quizTitleEn: activeQuiz.titleEn,
      quizTitleBn: activeQuiz.titleBn,
      hostId: actor?.id || `host-${now}`,
      hostToken,
      isSelfPractice: !!data.isSelfPractice,
      phase: "lobby",
      currentQuestionIndex: -1,
      questionStartTime: 0,
      questionEndTime: 0,
      settings: {
        speedBonus: true,
        betweenQuestionSec: 0,
        startCountdownSec: 3,
        negativeMarking: data.negativeMarking ?? (isFormal ? 0.25 : 0),
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: isFormal,
        requireRollNumber: isFormal,
        requireRosterVerification: isFormal && !data.isSelfPractice,
        allowedRegionId: data.allowedRegionId || "all",
        allowedRegionName: data.allowedRegionName || "All Regions (National)",
        enforceFullscreen: enforceFs,
        blockCopyPaste: blockCopy,
        maxProctorViolations: maxViol,
        passThresholdPct: effectivePassThreshold,
        ...(origSessionForRetake
          ? {
              retakeForSessionId: origSessionForRetake.id,
              retakeOriginPin: origSessionForRetake.pin,
              retakeSkipCompleted: data.retakeSkipCompleted ?? true,
              retakeMinCompletedAnswers: resolveRetakeMinCompletedAnswers(
                data.retakeMinCompletedAnswers,
              ),
            }
          : {}),
      },
      participants: {},
      totalQuestions: activeQuiz.questions.length,
      createdAt: now,
      updatedAt: now,
      participantCount: 0,
      answeredCount: 0,
      proctorIncidents: [],
      fullQuiz: activeQuiz,
    };

    sessions[pin] = newSession;
    scheduleLiveSessionsPersist();
    return {
      success: true,
      serverNow: Date.now(),
      session: toHostSessionView(newSession),
      hostToken,
    };
  });

export const serverGetSession = createServerFn({ method: "GET" })
  .validator(
    (data: {
      pin: string;
      role?: "host" | "player" | undefined;
      participantId?: string | undefined;
      sinceUpdatedAt?: number | undefined;
      hostToken?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, notFound: true, serverNow: Date.now(), session: null };
    }

    if (data.role !== "player") {
      const actor = await getActorFromRequest();
      const isAuthorizedHost =
        (!!session.hostToken && data.hostToken === session.hostToken) ||
        actor?.role === "admin" ||
        (!!actor && actor.id === session.hostId);
      if (!isAuthorizedHost) {
        return {
          success: false,
          error: "Unauthorized: host authentication required.",
          serverNow: Date.now(),
          session: null,
        };
      }
    }

    // Notify an examinee immediately when their seat was unlocked / removed by the host
    if (data.role === "player" && data.participantId && !session.participants[data.participantId]) {
      return {
        success: false,
        seatRemoved: true,
        error: "Your exam seat was unlocked or removed by the host.",
        serverNow: Date.now(),
        session: null,
      };
    }

    // Server-authoritative countdown auto-advance so disconnecting host never strands rooms
    if (session.phase === "countdown") {
      const started = session.countdownStartedAt || session.updatedAt;
      const countdownMs = resolveStartCountdownSec(session.settings.startCountdownSec) * 1000;
      if (Date.now() - started >= Math.max(0, countdownMs - 200)) {
        advanceSessionToQuestion(session, store, 0);
        scheduleLiveSessionsPersist();
      }
    } else if (transitionBetweenPhaseIfDue(session, store)) {
      scheduleLiveSessionsPersist();
    }

    // Fast 304-style delta short-circuit if nothing changed since client's last poll
    if (data.sinceUpdatedAt && session.updatedAt <= data.sinceUpdatedAt) {
      return {
        success: true,
        unchanged: true,
        updatedAt: session.updatedAt,
        serverNow: Date.now(),
        session: null,
      };
    }

    if (data.role === "player") {
      return {
        success: true,
        unchanged: false,
        updatedAt: session.updatedAt,
        serverNow: Date.now(),
        session: buildPlayerSessionProjection(session, data.participantId),
      };
    }

    return {
      success: true,
      unchanged: false,
      updatedAt: session.updatedAt,
      serverNow: Date.now(),
      session: toHostSessionView(session),
    };
  });

export const serverSyncSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      session: GameSession & { fullQuiz?: Quiz | undefined };
      hostToken?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    if (!data?.session?.pin || !/^\d{6}$/.test(data.session.pin)) {
      return { success: false, error: "Invalid session PIN format" };
    }
    const actor = await getActorFromRequest();
    const isStaff = !!actor && (actor.role === "admin" || actor.role === "instructor");
    const existing = sessions[data.session.pin];
    if (!existing) {
      const matchedCatalogQuiz =
        store.customQuizzes.find(
          (q) => q.id === data.session.quizId || q.id === data.session.fullQuiz?.id,
        ) ||
        READY_MADE_PACKS.find(
          (q) => q.id === data.session.quizId || q.id === data.session.fullQuiz?.id,
        );
      const quizIsPrivate =
        (matchedCatalogQuiz ? isQuizPrivate(matchedCatalogQuiz, store.courses) : false) ||
        (data.session.fullQuiz ? isQuizPrivate(data.session.fullQuiz, store.courses) : false);
      const canCreate = isStaff || (!!data.session.isSelfPractice && !quizIsPrivate);
      if (!canCreate) {
        return {
          success: false,
          error: quizIsPrivate
            ? "Private course examinations can only be started by an authenticated Admin or Instructor."
            : "Host authorization required.",
        };
      }
      const hostToken = data.hostToken || generateHostToken();
      sessions[data.session.pin] = {
        ...data.session,
        hostToken,
        updatedAt: Date.now(),
      };
      scheduleLiveSessionsPersist();
      return {
        success: true,
        serverNow: Date.now(),
        session: toHostSessionView(sessions[data.session.pin]!),
        hostToken,
      };
    }

    const isAuthorized =
      (existing.hostToken && data.hostToken === existing.hostToken) ||
      actor?.role === "admin" ||
      (!!actor && actor.id === existing.hostId);
    if (!isAuthorized) {
      return { success: false, error: "Host authorization required." };
    }

    const prevPhase = existing.phase;
    const prevQIdx = existing.currentQuestionIndex;
    const nowServer = Date.now();

    existing.phase = data.session.phase;
    existing.currentQuestionIndex = data.session.currentQuestionIndex;
    if (data.session.currentQuestion) {
      existing.currentQuestion = data.session.currentQuestion;
    }

    const sameQuestionWindow =
      prevPhase === data.session.phase &&
      prevQIdx === data.session.currentQuestionIndex &&
      existing.questionStartTime > 0;
    if (!sameQuestionWindow) {
      const safeStart =
        data.session.questionStartTime && data.session.questionStartTime > 0
          ? Math.min(nowServer, data.session.questionStartTime)
          : data.session.phase === "question"
            ? nowServer
            : 0;
      existing.questionStartTime = safeStart;
      existing.questionEndTime = data.session.questionEndTime;
      if (data.session.currentQuestion?.id && safeStart > 0) {
        existing.questionStartTimes = {
          ...(existing.questionStartTimes || {}),
          [data.session.currentQuestion.id]: safeStart,
        };
      }
    }
    existing.pausedAt = data.session.pausedAt;
    existing.settings = { ...existing.settings, ...data.session.settings };
    recalculateSessionMetrics(existing);
    scheduleLiveSessionsPersist();
    return { success: true, serverNow: nowServer, session: toHostSessionView(existing) };
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

    const incoming = { ...data.participant };
    const requestedCandidateId = incoming.candidateId;
    const requestedRoll = normalizeCode(incoming.rollNumber);
    const requestedPhone = normalizeDigits(incoming.phone || data.verificationNumber);

    // 1. If joining as an enrolled Roster Candidate, verify their Mobile / Roll Number ownership
    const rosterMatch = store.roster.find(
      (s) =>
        (requestedCandidateId && s.id === requestedCandidateId) ||
        (requestedRoll && normalizeCode(s.rollNumber) === requestedRoll),
    );

    if (rosterMatch) {
      const enrolledPhone = normalizeBdPhone(rosterMatch.phone || rosterMatch.guardianPhone);
      const enrolledRollToken = normalizeRollToken(rosterMatch.rollNumber);
      const rawVerify = (
        data.verificationNumber ||
        incoming.phone ||
        incoming.rollNumber ||
        ""
      ).trim();
      const verifyInput = normalizeBdPhone(rawVerify);
      const verifyCodeInput = normalizeRollToken(rawVerify);
      const verifyEmailInput = rawVerify.toLowerCase();

      // Verify ownership so Student A cannot pick Student B from the Region dropdown without knowing their number
      const phoneMatches =
        enrolledPhone.length >= 4 &&
        verifyInput.length >= 4 &&
        (enrolledPhone === verifyInput ||
          enrolledPhone.endsWith(verifyInput.slice(-4)) ||
          (enrolledPhone.length >= 8 && verifyInput.endsWith(enrolledPhone)));
      const rollMatches =
        !!enrolledRollToken && !!verifyCodeInput && enrolledRollToken === verifyCodeInput;
      const emailMatches =
        !!rosterMatch.email &&
        verifyEmailInput.includes("@") &&
        rosterMatch.email.toLowerCase() === verifyEmailInput;

      if (!phoneMatches && !rollMatches && !emailMatches) {
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
    } else if (
      !session.isSelfPractice &&
      session.settings.requireRosterVerification !== false &&
      session.settings.isFormalAssessment !== false
    ) {
      return {
        success: false,
        code: "ROSTER_VERIFICATION_REQUIRED",
        error:
          "Roster Verification Required: Your Roll Number or Mobile Number does not match an enrolled candidate in the Trainee Roster. Please check your Roll/Mobile or ask the Host to open walk-in entry.",
      };
    } else if (!session.isSelfPractice && incoming.rollNumber && incoming.name) {
      // Check region eligibility before auto-enrolling walk-in candidate
      if (
        session.settings.allowedRegionId &&
        session.settings.allowedRegionId !== "all" &&
        incoming.regionId !== session.settings.allowedRegionId
      ) {
        return {
          success: false,
          error: `Access Restricted: This examination room is exclusively for ${session.settings.allowedRegionName}.`,
        };
      }
      // Auto-enroll new verified candidate into the Region roster when host allows open registration
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

    // 2. Check Region Restriction AFTER roster verification resolves authoritative regionId
    if (
      session.settings.allowedRegionId &&
      session.settings.allowedRegionId !== "all" &&
      incoming.regionId !== session.settings.allowedRegionId
    ) {
      return {
        success: false,
        error: `Access Restricted: This examination room is exclusively for ${session.settings.allowedRegionName}.`,
      };
    }

    // 2b. Retake Guard: Skip examinees who already submitted >= configured minimum answers in the original exam
    if (session.settings.retakeForSessionId && session.settings.retakeSkipCompleted !== false) {
      const minCompletedAnswers = resolveRetakeMinCompletedAnswers(
        session.settings.retakeMinCompletedAnswers,
      );
      const compIdx = buildOriginalCompletionIndex(
        store.examResults,
        session.settings.retakeForSessionId,
        session.settings.retakeOriginPin,
        minCompletedAnswers,
      );
      const completedMatch = findCompletedMatchInIndex(compIdx, {
        rollNumber: incoming.rollNumber,
        phone: incoming.phone || data.verificationNumber,
      });
      if (completedMatch) {
        const answeredCount = getResultSubmittedAnswersCount(completedMatch);
        return {
          success: false,
          code: "ALREADY_COMPLETED_ORIGINAL",
          error: `You already completed ${answeredCount} question(s) (minimum completion threshold: ${minCompletedAnswers}) in the original examination. Your original merit score and certificate remain valid; this supplementary room is only for examinees from affected centers or below the threshold.`,
        };
      }
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
        scheduleLiveSessionsPersist();
        const { seatToken: _s, ...safeSeat } = existingSeat;
        return {
          success: true,
          reconnected: true,
          serverNow: Date.now(),
          participant: safeSeat,
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

    if (session.phase === "podium" || session.phase === "finished") {
      return {
        success: false,
        code: "EXAM_ENDED",
        error: "This examination has already concluded and is closed to new participants.",
      };
    }

    const safeParticipantId =
      incoming.id && !session.participants[incoming.id]
        ? incoming.id
        : `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const participantRecord: Participant = {
      ...incoming,
      id: safeParticipantId,
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
    scheduleLiveSessionsPersist();

    const { seatToken: _s, ...safeParticipant } = participantRecord;
    return {
      success: true,
      reconnected: false,
      serverNow: Date.now(),
      participant: safeParticipant,
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
      isOfflineQueued?: boolean | undefined;
      // Legacy fallback fields
      answer?: ParticipantAnswer | undefined;
      scoreDelta?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, code: "SESSION_NOT_FOUND", error: "Session not found on server" };
    }

    const p = session.participants[data.participantId];
    if (!p) {
      return {
        success: false,
        code: "PARTICIPANT_NOT_FOUND",
        error: "Participant not found in session",
      };
    }

    if (p.seatToken && data.seatToken !== p.seatToken) {
      return {
        success: false,
        code: "INVALID_SEAT",
        error: "Seat verification token mismatch. Please refresh and rejoin your seat.",
      };
    }

    if (p.isSuspended) {
      return {
        success: false,
        code: "SUSPENDED",
        error: "Exam suspended by Proctor due to focus violations.",
      };
    }

    // Prevent duplicate answer submission for the same question
    if (p.answers[data.questionId]) {
      const { seatToken: _s, ...safeParticipant } = p;
      return {
        success: true,
        alreadyAnswered: true,
        serverNow: Date.now(),
        answer: p.answers[data.questionId],
        participant: safeParticipant,
        session: buildPlayerSessionProjection(session, p.id),
      };
    }

    if (
      session.phase === "lobby" ||
      session.phase === "countdown" ||
      session.phase === "podium" ||
      session.phase === "finished"
    ) {
      return {
        success: false,
        code: "SESSION_NOT_ACCEPTING_ANSWERS",
        error: "This examination is not currently accepting answers.",
      };
    }

    if (isQuestionSubmissionClosed(session, data.questionId)) {
      return {
        success: false,
        code: "QUESTION_CLOSED",
        error: "Answer window has closed for this question.",
      };
    }

    // Authoritative server-side grading using fullQuiz (strictly matching data.questionId)
    const resolvedQuiz = resolveSessionQuiz(session, store);
    const fullQuestion =
      resolvedQuiz?.questions.find((q) => q.id === data.questionId) ||
      (session.currentQuestion?.id === data.questionId ? session.currentQuestion : undefined);

    if (!fullQuestion) {
      return {
        success: false,
        code: "QUESTION_NOT_FOUND",
        error: "Unable to locate question for grading",
      };
    }

    const effectiveLimit = resolveQuestionTimeLimitSec(fullQuestion, session.settings);
    const gradedQuestion: Question = { ...fullQuestion, timeLimitSec: effectiveLimit };
    const selectedIds = data.selectedOptionIds || data.answer?.selectedOptionIds || [];
    const written = (data.writtenAnswer ?? data.answer?.writtenAnswer ?? "").trim();

    // Clock-skew-resistant sub-second elapsed duration using per-question authoritative start time
    const authoritativeQuestionStart =
      session.questionStartTimes?.[data.questionId] ??
      (session.currentQuestion?.id === data.questionId ? session.questionStartTime : 0);
    const { effectiveTimestamp, timeTakenSec } = computeAnswerElapsedSec({
      questionStartTime: authoritativeQuestionStart,
      effectiveLimitSec: effectiveLimit,
      pausedAt: session.pausedAt,
      clientAnsweredAt: data.clientAnsweredAt,
      isOfflineQueued: data.isOfflineQueued,
    });

    const graded = evaluateQuestionAnswer({
      question: gradedQuestion,
      selectedOptionIds: selectedIds,
      writtenAnswer: written,
      currentStreak: p.streak,
      timeTakenSec,
      speedBonus: session.settings.speedBonus ?? true,
      negativeMarking: session.settings.negativeMarking || 0,
    });

    const answerRecord: ParticipantAnswer = {
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
    p.score = computeParticipantTotalScore(p.answers);
    p.streak = graded.newStreak;
    p.lastActive = Date.now();

    recalculateSessionMetrics(session);
    scheduleLiveSessionsPersist();

    const { seatToken: _s, ...safeParticipant } = p;
    return {
      success: true,
      serverNow: Date.now(),
      answer: answerRecord,
      participant: safeParticipant,
      session: buildPlayerSessionProjection(session, p.id),
    };
  });

export const serverReportProctorIncident = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      participantId: string;
      seatToken?: string | undefined;
      type: "tab_switch" | "window_blur" | "fullscreen_exit" | "copy_attempt" | "devtools_attempt";
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    if (!session) return { success: false };

    if (session.phase === "podium" || session.phase === "finished") {
      return { success: false, ignored: true };
    }

    const p = session.participants[data.participantId];
    if (!p) return { success: false };
    if (p.seatToken && data.seatToken !== p.seatToken) {
      return { success: false };
    }
    if (p.isSuspended) {
      return {
        success: true,
        proctorFlags: p.proctorFlags || 0,
        isSuspended: true,
      };
    }

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
    scheduleLiveSessionsPersist();
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
        | "pause_game"
        | "resume_game"
        | "pause_between"
        | "resume_between"
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
        if (session.phase === "lobby") {
          const countdownSec = resolveStartCountdownSec(session.settings.startCountdownSec);
          const now = Date.now();
          session.pausedAt = undefined;
          if (countdownSec === 0) {
            advanceSessionToQuestion(session, store, 0);
          } else {
            session.phase = "countdown";
            session.countdownStartedAt = now;
            session.updatedAt = now;
          }
        }
        break;
      }
      case "next_question": {
        if (session.phase === "podium" || session.phase === "finished") {
          break;
        }
        if (
          typeof data.questionIndex === "number" &&
          data.questionIndex <= session.currentQuestionIndex
        ) {
          break;
        }
        session.pausedAt = undefined;
        session.autoAdvancePaused = undefined;
        session.betweenPausedRemainingMs = undefined;
        advanceSessionToQuestion(session, store, data.questionIndex);
        break;
      }
      case "show_chart": {
        if (
          session.phase === "chart" ||
          session.phase === "podium" ||
          session.phase === "finished"
        ) {
          break;
        }
        enterBetweenPhase(session, "chart");
        break;
      }
      case "show_leaderboard": {
        if (
          session.phase === "leaderboard" ||
          session.phase === "podium" ||
          session.phase === "finished"
        ) {
          break;
        }
        enterBetweenPhase(session, "leaderboard");
        break;
      }
      case "pause_game": {
        applyPauseGameToSession(session);
        break;
      }
      case "resume_game": {
        applyResumeGameToSession(session);
        break;
      }
      case "pause_between": {
        applyBetweenPhasePause(session, true);
        break;
      }
      case "resume_between": {
        applyBetweenPhasePause(session, false);
        break;
      }
      case "end_game": {
        session.pausedAt = undefined;
        session.autoAdvancePaused = undefined;
        session.betweenPausedRemainingMs = undefined;
        session.phaseEndsAt = undefined;
        const alreadyEnded = session.phase === "podium" || session.phase === "finished";
        session.phase = "podium";
        recalculateSessionMetrics(session);
        if (!alreadyEnded) {
          persistCompletedExamToStore(session);
        }
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
          session.settings = mergeSessionSettingsPatch(session.settings, data.settings);
          session.updatedAt = Date.now();
        }
        break;
      }
      case "add_bots": {
        const count = Math.max(1, Math.min(8, Math.round(data.botCount || 8)));
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
      serverNow: Date.now(),
      session: toHostSessionView(session),
    };
  });

// ============================================================================
// PRACTICAL EXAM + COURSE COMPLETION CERTIFICATE + STUDENT PORTAL
// ============================================================================

function writePracticalFileToDisk(params: {
  examId: string;
  rollNumber: string;
  taskId: string;
  fileName: string;
  mime: string;
  base64: string;
}): { ok: true; relPath: string; size: number } | { ok: false; error: string } {
  try {
    const fs = getNodeFs();
    if (!fs) return { ok: false, error: "File storage unavailable on this runtime." };
    const { dataDir } = getStorePaths();
    const safeRoll = normalizeRollToken(params.rollNumber) || "unknown";
    const safeName = (params.fileName || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const relPath = `submissions/${params.examId}/${safeRoll}/${params.taskId}-${safeName}`;
    const absDir = `${dataDir}/submissions/${params.examId}/${safeRoll}`;
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    const buf = Buffer.from(params.base64, "base64");
    fs.writeFileSync(`${dataDir}/${relPath}`, buf);
    return { ok: true, relPath, size: buf.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not store uploaded file.",
    };
  }
}

function resolveQuizResultForStudent(
  store: PersistentStoreData,
  rollNumber: string,
  linkedQuizId?: string,
  requiredQuizIds?: string[],
  identity?: {
    phone?: string | undefined;
    studentName?: string | undefined;
    regionId?: string | undefined;
  },
): ExamResultRecord | undefined {
  return resolveQuizResultMatchForStudent(store, rollNumber, linkedQuizId, requiredQuizIds, identity)
    ?.result;
}

function resolveQuizResultMatchForStudent(
  store: PersistentStoreData,
  rollNumber: string,
  linkedQuizId?: string,
  requiredQuizIds?: string[],
  identity?: {
    phone?: string | undefined;
    studentName?: string | undefined;
    regionId?: string | undefined;
  },
) {
  // Final quiz aliases include Quiz 17 makeup so individually hosted makeups count.
  const allowed = expandFinalQuizIds([linkedQuizId, ...(requiredQuizIds || [])]);
  const sessions = store.examSessions.map((s) => ({ id: s.id, pin: s.pin, quizId: s.quizId }));
  const match = findBestQuizResultMatchForCourse({
    results: store.examResults,
    sessions,
    allowedQuizIds: allowed,
    rollNumber,
    phone: identity?.phone,
    studentName: identity?.studentName,
    regionId: identity?.regionId,
  });
  if (match) return match;

  // Fallback: FinalExamAttempt rows (when fer transcript missing but attempt scored).
  const rollTok = normalizeRollToken(rollNumber);
  const phoneTok = normalizeBdPhone(identity?.phone || "");
  const attempts = (store.finalExamAttempts || []).filter((a) => {
    if (!(a.status === "submitted" || a.status === "graded")) return false;
    if (!allowed.includes(a.quizId)) return false;
    if (rollTok && normalizeRollToken(a.rollNumber) === rollTok) return true;
    if (phoneTok.length >= 10 && normalizeBdPhone(a.phone) === phoneTok) return true;
    return false;
  });
  if (attempts.length === 0) return undefined;
  const bestAttempt = [...attempts].sort(
    (a, b) => (b.accuracyPct || 0) - (a.accuracyPct || 0),
  )[0]!;
  const synthetic: ExamResultRecord = {
    id: bestAttempt.resultId || `fer-${bestAttempt.id}`,
    sessionId: bestAttempt.sessionId || `fes-${bestAttempt.id}`,
    pin: bestAttempt.pin,
    participantId: `fp-${normalizeRollToken(bestAttempt.rollNumber)}`,
    rollNumber: bestAttempt.rollNumber,
    name: bestAttempt.studentName,
    phone: bestAttempt.phone,
    regionId: bestAttempt.regionId,
    regionName: bestAttempt.regionName,
    score: bestAttempt.quizMarks ?? marksFromPct(bestAttempt.accuracyPct || 0, FINAL_QUIZ_MARKS),
    rank: 1,
    correctCount: bestAttempt.correctCount || 0,
    incorrectCount: bestAttempt.incorrectCount || 0,
    unattemptedCount: bestAttempt.unansweredCount || 0,
    accuracyPct: bestAttempt.accuracyPct || 0,
    passed: (bestAttempt.accuracyPct || 0) >= 50,
    createdAt: bestAttempt.submittedAt || bestAttempt.updatedAt || bestAttempt.createdAt,
  };
  return {
    result: synthetic,
    matchedVia:
      rollTok && normalizeRollToken(bestAttempt.rollNumber) === rollTok
        ? ("roll" as const)
        : ("phone" as const),
    attemptId: bestAttempt.id,
  };
}

function buildStudentQuizSnapshot(
  store: PersistentStoreData,
  params: {
    rollNumber: string;
    phone?: string | undefined;
    studentName?: string | undefined;
    regionId?: string | undefined;
    linkedQuizId?: string | undefined;
    requiredQuizIds?: string[] | undefined;
    quizMaxMarks?: number | undefined;
  },
): FinalQuizRecordSnapshot {
  const match = resolveQuizResultMatchForStudent(
    store,
    params.rollNumber,
    params.linkedQuizId,
    params.requiredQuizIds,
    {
      phone: params.phone,
      studentName: params.studentName,
      regionId: params.regionId,
    },
  );
  const quizId = match?.result
    ? store.examSessions.find(
        (s) => s.id === match.result.sessionId || s.pin === match.result.pin,
      )?.quizId || params.linkedQuizId
    : params.linkedQuizId;
  const quizTitle =
    (quizId &&
      (store.customQuizzes.find((q) => q.id === quizId)?.titleEn ||
        store.examSessions.find((s) => s.quizId === quizId)?.quizTitleEn)) ||
    undefined;
  return buildFinalQuizRecordSnapshot({
    result: match?.result,
    matchedVia: match?.matchedVia,
    quizMaxMarks: params.quizMaxMarks,
    quizId,
    quizTitleEn: quizTitle,
    attemptId: (match as { attemptId?: string } | undefined)?.attemptId,
    submissionRoll: params.rollNumber,
  });
}

export const serverSavePracticalExam = createServerFn({ method: "POST" })
  .validator((data: { exam: PracticalExam }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.practicalExams) store.practicalExams = [];
    const weights = normalizeExamWeights(data.exam);
    const exam: PracticalExam = {
      ...data.exam,
      quizWeightPct: weights.quizWeightPct,
      practicalWeightPct: weights.practicalWeightPct,
      tasks: (data.exam.tasks || []).map((t, i) => ({
        ...t,
        id: t.id || `task-${i + 1}-${Date.now()}`,
        maxMarks: Math.max(1, Number(t.maxMarks) || 100),
        sortOrder: t.sortOrder ?? i + 1,
      })),
      updatedAt: new Date().toISOString(),
    };
    if (!exam.tasks.length) {
      return { success: false, error: "Practical exam needs at least one task." };
    }
    const idx = store.practicalExams.findIndex((p) => p.id === exam.id);
    if (idx >= 0) store.practicalExams[idx] = exam;
    else store.practicalExams.unshift(exam);
    // Keep course certificate policy weights in sync with the practical exam.
    if (!store.courseRequirements) store.courseRequirements = [];
    const reqIdx = store.courseRequirements.findIndex((r) => r.courseId === exam.courseId);
    if (reqIdx >= 0) {
      store.courseRequirements[reqIdx] = {
        ...store.courseRequirements[reqIdx]!,
        quizWeightPct: weights.quizWeightPct,
        practicalWeightPct: weights.practicalWeightPct,
      };
    }
    scheduleDiskPersist();
    return { success: true, exam };
  });

export const serverSaveCourseRequirement = createServerFn({ method: "POST" })
  .validator((data: { requirement: CourseCompletionRequirement }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.courseRequirements) store.courseRequirements = [];
    const weights = normalizeExamWeights({
      quizWeightPct: data.requirement.quizWeightPct,
      practicalWeightPct: data.requirement.practicalWeightPct,
    });
    const requirement: CourseCompletionRequirement = {
      ...data.requirement,
      quizWeightPct: weights.quizWeightPct,
      practicalWeightPct: weights.practicalWeightPct,
      requiredQuizIds: (data.requirement.requiredQuizIds || []).filter(Boolean),
    };
    const idx = store.courseRequirements.findIndex((r) => r.courseId === requirement.courseId);
    if (idx >= 0) store.courseRequirements[idx] = requirement;
    else store.courseRequirements.push(requirement);
    // Mirror weights onto the practical exam for this course when present.
    const examIdx = (store.practicalExams || []).findIndex((p) => p.courseId === requirement.courseId);
    if (examIdx >= 0 && store.practicalExams) {
      store.practicalExams[examIdx] = {
        ...store.practicalExams[examIdx]!,
        quizWeightPct: weights.quizWeightPct,
        practicalWeightPct: weights.practicalWeightPct,
        updatedAt: new Date().toISOString(),
      };
    }
    scheduleDiskPersist();
    return { success: true, requirement };
  });

export const serverClearStudentPortal = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { setCookie } = await getServerHelpers();
    setCookie(STUDENT_PORTAL_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      secure: typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production",
    });
  } catch {
    // cookie clear best-effort
  }
  return { success: true };
});

export const serverDownloadPracticalFile = createServerFn({ method: "POST" })
  .validator((data: { submissionId: string; taskId: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    const submission = (store.practicalSubmissions || []).find((s) => s.id === data.submissionId);
    if (!submission) return { success: false, error: "Submission not found." };
    const answer = submission.answers.find((a) => a.taskId === data.taskId);
    if (!answer?.fileRelPath) return { success: false, error: "No file attached to this task." };
    if (answer.fileRelPath.includes("..") || answer.fileRelPath.startsWith("/")) {
      return { success: false, error: "Invalid file path." };
    }
    try {
      const fs = getNodeFs();
      if (!fs) return { success: false, error: "File storage unavailable." };
      const { dataDir } = getStorePaths();
      const abs = `${dataDir}/${answer.fileRelPath}`;
      if (!fs.existsSync(abs)) return { success: false, error: "File missing on disk." };
      const buf = fs.readFileSync(abs);
      return {
        success: true,
        fileName: answer.fileName || "submission.bin",
        fileMime: answer.fileMime || "application/octet-stream",
        fileBase64: buf.toString("base64"),
        size: buf.length,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Could not read file.",
      };
    }
  });

export const serverSetAutoIssueQuizCertificates = createServerFn({ method: "POST" })
  .validator((data: { enabled: boolean }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false, error: "Super Admin required." };
    }
    const store = getStore();
    store.autoIssueQuizCertificates = !!data.enabled;
    scheduleDiskPersist();
    return { success: true, autoIssueQuizCertificates: store.autoIssueQuizCertificates };
  });

export const serverReturnPracticalForResubmit = createServerFn({ method: "POST" })
  .validator((data: { submissionId: string; feedback?: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    const idx = (store.practicalSubmissions || []).findIndex((s) => s.id === data.submissionId);
    if (idx < 0 || !store.practicalSubmissions?.[idx]) {
      return { success: false, error: "Submission not found." };
    }
    const now = new Date().toISOString();
    const prev = store.practicalSubmissions[idx]!;
    store.practicalSubmissions[idx] = {
      ...prev,
      status: "returned",
      grades: undefined,
      practicalScorePct: undefined,
      combinedPct: undefined,
      instructorFeedback: data.feedback || prev.instructorFeedback,
      gradedAt: undefined,
      gradedBy: undefined,
      updatedAt: now,
    };
    scheduleDiskPersist();
    return { success: true, submission: store.practicalSubmissions[idx] };
  });

export const serverSubmitPracticalWork = createServerFn({ method: "POST" })
  .validator(
    (data: {
      practicalExamId: string;
      rollNumber: string;
      phone: string;
      answers: Array<{
        taskId: string;
        textAnswer?: string;
        linkUrl?: string;
        fileName?: string;
        fileMime?: string;
        fileBase64?: string;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const exam = (store.practicalExams || []).find((p) => p.id === data.practicalExamId);
    if (!exam) return { success: false, error: "Practical exam not found." };

    const student = matchRosterIdentity({
      rollNumber: data.rollNumber,
      phone: data.phone,
      roster: store.roster,
    });
    if (!student) {
      return {
        success: false,
        error: "Roll number and mobile number do not match the institutional roster.",
      };
    }

    if (!store.practicalSubmissions) store.practicalSubmissions = [];
    const existingIdx = store.practicalSubmissions.findIndex(
      (s) =>
        s.practicalExamId === exam.id &&
        normalizeRollToken(s.rollNumber) === normalizeRollToken(student.rollNumber),
    );
    const existing = existingIdx >= 0 ? store.practicalSubmissions[existingIdx] : undefined;
    if (existing?.status === "graded") {
      return {
        success: false,
        error: "This practical is already graded. Ask an instructor to return it before resubmitting.",
      };
    }

    const answersMeta = data.answers.map((a) => {
      const size = a.fileBase64 ? Math.ceil((a.fileBase64.length * 3) / 4) : undefined;
      return {
        taskId: a.taskId,
        ...(a.textAnswer !== undefined ? { textAnswer: a.textAnswer } : {}),
        ...(a.linkUrl !== undefined ? { linkUrl: a.linkUrl } : {}),
        ...(a.fileName !== undefined ? { fileName: a.fileName } : {}),
        ...(a.fileMime !== undefined ? { fileMime: a.fileMime } : {}),
        ...(size !== undefined ? { fileSizeBytes: size } : {}),
      };
    });
    const validation = validateSubmissionPayload({
      exam,
      taskAnswers: answersMeta,
      allowReturnedResubmit: existing?.status === "returned",
    });
    if (!validation.ok) return { success: false, error: validation.error };

    const now = new Date().toISOString();
    const late = isPracticalPastDeadline(exam, now);
    const requirement = (store.courseRequirements || []).find((r) => r.courseId === exam.courseId);
    const persistedAnswers: PracticalTaskAnswer[] = [];
    for (const a of data.answers) {
      let fileRelPath: string | undefined;
      let fileSizeBytes: number | undefined;
      if (a.fileBase64 && a.fileName) {
        const saved = writePracticalFileToDisk({
          examId: exam.id,
          rollNumber: student.rollNumber,
          taskId: a.taskId,
          fileName: a.fileName,
          mime: a.fileMime || "application/octet-stream",
          base64: a.fileBase64,
        });
        if (!saved.ok) return { success: false, error: saved.error };
        fileRelPath = saved.relPath;
        fileSizeBytes = saved.size;
      } else if (existing) {
        const prevAns = existing.answers.find((x) => x.taskId === a.taskId);
        fileRelPath = prevAns?.fileRelPath;
        fileSizeBytes = prevAns?.fileSizeBytes;
      }
      persistedAnswers.push({
        taskId: a.taskId,
        textAnswer: (a.textAnswer || "").trim() || undefined,
        linkUrl: (a.linkUrl || "").trim() || undefined,
        fileName: a.fileName || existing?.answers.find((x) => x.taskId === a.taskId)?.fileName,
        fileMime: a.fileMime || existing?.answers.find((x) => x.taskId === a.taskId)?.fileMime,
        fileSizeBytes,
        fileRelPath,
      });
    }

    const quizResult = resolveQuizResultForStudent(
      store,
      student.rollNumber,
      exam.linkedQuizId,
      requirement?.requiredQuizIds,
      {
        phone: student.phone,
        studentName: student.name,
        regionId: student.regionId,
      },
    );
    const submission: PracticalSubmission = {
      id: existing?.id || `psub-${exam.id}-${normalizeRollToken(student.rollNumber)}`,
      practicalExamId: exam.id,
      courseId: exam.courseId,
      rosterStudentId: student.id,
      rollNumber: student.rollNumber,
      studentName: student.name,
      phone: student.phone,
      regionId: student.regionId,
      regionName: student.regionName,
      answers: persistedAnswers,
      grades: undefined,
      status: late ? "late" : "submitted",
      quizAccuracyPct: quizResult?.accuracyPct,
      submittedAt: now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existingIdx >= 0) store.practicalSubmissions[existingIdx] = submission;
    else store.practicalSubmissions.unshift(submission);
    scheduleDiskPersist();
    return { success: true, submission };
  });

export const serverGradePracticalSubmission = createServerFn({ method: "POST" })
  .validator(
    (data: {
      submissionId: string;
      grades: PracticalGrade[];
      instructorFeedback?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    const idx = (store.practicalSubmissions || []).findIndex((s) => s.id === data.submissionId);
    if (idx < 0 || !store.practicalSubmissions?.[idx]) {
      return { success: false, error: "Submission not found." };
    }
    const submission = store.practicalSubmissions[idx]!;
    const exam = (store.practicalExams || []).find((p) => p.id === submission.practicalExamId);
    if (!exam) return { success: false, error: "Practical exam missing." };

    const now = new Date().toISOString();
    const grades = data.grades.map((g) => ({
      ...g,
      gradedBy: actor.id,
      gradedAt: now,
    }));
    const stats = computePracticalScorePct(exam.tasks, grades);
    const requirement = (store.courseRequirements || []).find((r) => r.courseId === exam.courseId);
    const quizResult = resolveQuizResultForStudent(
      store,
      submission.rollNumber,
      exam.linkedQuizId,
      requirement?.requiredQuizIds,
      {
        phone: submission.phone,
        studentName: submission.studentName,
        regionId: submission.regionId,
      },
    );
    const quizPct = quizResult?.accuracyPct ?? submission.quizAccuracyPct ?? 0;
    const combinedPct = computeCombinedFinalPct({
      quizAccuracyPct: quizPct,
      practicalScorePct: stats.pct,
      quizWeightPct: exam.quizWeightPct,
      practicalWeightPct: exam.practicalWeightPct,
    });

    store.practicalSubmissions[idx] = {
      ...submission,
      grades,
      status: "graded",
      practicalScorePct: stats.pct,
      quizAccuracyPct: quizPct,
      combinedPct,
      // Preserve prior overall feedback when caller omits / sends blank unintentionally.
      instructorFeedback:
        typeof data.instructorFeedback === "string"
          ? data.instructorFeedback
          : submission.instructorFeedback,
      gradedAt: now,
      gradedBy: actor.id,
      updatedAt: now,
    };
    scheduleDiskPersist();
    return { success: true, submission: store.practicalSubmissions[idx] };
  });

/** Recompute quizAccuracyPct + combinedPct using roll/phone/name quiz linking. */
export const serverRefreshPracticalQuizScores = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      dryRun?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false as const, error: "Final practical exam not found." };
    const requirement = (store.courseRequirements || []).find((r) => r.courseId === courseId);
    const now = new Date().toISOString();
    let updated = 0;
    let unchanged = 0;
    const sample: Array<{
      rollNumber: string;
      from: number | null;
      to: number;
      matchedVia?: string;
      matchedRoll?: string;
    }> = [];

    for (let i = 0; i < (store.practicalSubmissions || []).length; i++) {
      const sub = store.practicalSubmissions![i]!;
      if (sub.practicalExamId !== exam.id && sub.courseId !== courseId) continue;
      const match = resolveQuizResultMatchForStudent(
        store,
        sub.rollNumber,
        exam.linkedQuizId,
        requirement?.requiredQuizIds,
        {
          phone: sub.phone,
          studentName: sub.studentName,
          regionId: sub.regionId,
        },
      );
      const quizPct = match?.result.accuracyPct ?? 0;
      const prev = typeof sub.quizAccuracyPct === "number" ? sub.quizAccuracyPct : null;
      if (prev != null && Math.abs(prev - quizPct) < 0.05) {
        unchanged += 1;
        continue;
      }
      const combinedPct =
        typeof sub.practicalScorePct === "number"
          ? computeCombinedFinalPct({
              quizAccuracyPct: quizPct,
              practicalScorePct: sub.practicalScorePct,
              quizWeightPct: exam.quizWeightPct,
              practicalWeightPct: exam.practicalWeightPct,
            })
          : sub.combinedPct;
      if (!data.dryRun) {
        store.practicalSubmissions![i] = {
          ...sub,
          quizAccuracyPct: quizPct,
          combinedPct,
          updatedAt: now,
        };
      }
      updated += 1;
      if (sample.length < 20) {
        sample.push({
          rollNumber: sub.rollNumber,
          from: prev,
          to: quizPct,
          ...(match?.matchedVia ? { matchedVia: match.matchedVia } : {}),
          ...(match?.result?.rollNumber ? { matchedRoll: match.result.rollNumber } : {}),
        });
      }
    }

    if (!data.dryRun && updated > 0) scheduleDiskPersist();
    return {
      success: true as const,
      dryRun: !!data.dryRun,
      updated,
      unchanged,
      sample,
    };
  });

/** Staff: detailed Final Quiz record for one practical student (marks breakdown). */
export const serverGetStudentFinalQuizRecord = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      submissionId?: string | undefined;
      rollNumber?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false as const, error: "Final exam not found." };
    const requirement = (store.courseRequirements || []).find((r) => r.courseId === courseId);
    const sub = (store.practicalSubmissions || []).find((s) =>
      data.submissionId
        ? s.id === data.submissionId
        : data.rollNumber
          ? normalizeRollToken(s.rollNumber) === normalizeRollToken(data.rollNumber) &&
            (s.practicalExamId === exam.id || s.courseId === courseId)
          : false,
    );
    if (!sub) return { success: false as const, error: "Submission not found." };
    const snapshot = buildStudentQuizSnapshot(store, {
      rollNumber: sub.rollNumber,
      phone: sub.phone,
      studentName: sub.studentName,
      regionId: sub.regionId,
      linkedQuizId: exam.linkedQuizId,
      requiredQuizIds: requirement?.requiredQuizIds,
      quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
    });
    return {
      success: true as const,
      submissionId: sub.id,
      rollNumber: sub.rollNumber,
      studentName: sub.studentName,
      quiz: snapshot,
      practicalScorePct: sub.practicalScorePct,
      combinedPct:
        typeof sub.practicalScorePct === "number"
          ? computeCombinedFinalPct({
              quizAccuracyPct: snapshot.accuracyPct,
              practicalScorePct: sub.practicalScorePct,
              quizWeightPct: exam.quizWeightPct,
              practicalWeightPct: exam.practicalWeightPct,
            })
          : sub.combinedPct,
      weights: {
        ...(typeof exam.quizWeightPct === "number" ? { quizWeightPct: exam.quizWeightPct } : {}),
        ...(typeof exam.practicalWeightPct === "number" ? { practicalWeightPct: exam.practicalWeightPct } : {}),
        quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
        practicalMaxMarks: exam.practicalMaxMarks || FINAL_PRACTICAL_MARKS,
        totalMaxMarks: exam.totalMaxMarks || FINAL_TOTAL_MARKS,
      },
    };
  });

/** Staff: full Final Exam gradesheet (quiz /30 + practical /40 + total /70) for all submissions. */
export const serverGetFinalGradeSheet = createServerFn({ method: "POST" })
  .validator((data: { courseId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false as const, error: "Final exam not found." };
    const course = (store.courses || []).find((c) => c.id === courseId);
    const requirement = (store.courseRequirements || []).find((r) => r.courseId === courseId);
    const submissions = (store.practicalSubmissions || []).filter(
      (s) => s.practicalExamId === exam.id || s.courseId === courseId,
    );
    const quizByRoll = new Map<string, { accuracyPct: number; found: boolean }>();
    for (const sub of submissions) {
      const tok = normalizeRollToken(sub.rollNumber);
      if (quizByRoll.has(tok)) continue;
      const match = resolveQuizResultMatchForStudent(
        store,
        sub.rollNumber,
        exam.linkedQuizId,
        requirement?.requiredQuizIds,
        {
          phone: sub.phone,
          studentName: sub.studentName,
          regionId: sub.regionId,
        },
      );
      quizByRoll.set(tok, {
        accuracyPct: match?.result.accuracyPct ?? 0,
        found: !!match,
      });
    }
    const rows: FinalGradeSheetRow[] = buildFinalGradeSheetRows({
      exam,
      submissions,
      quizByRoll,
      normalizeRoll: normalizeRollToken,
    });
    const graded = rows.filter((r) => r.practicalGraded).length;
    const withQuiz = rows.filter((r) => r.quizFound).length;
    return {
      success: true as const,
      courseId,
      courseCode: course?.code || "",
      courseTitle: course?.titleEn || exam.titleEn,
      examTitle: exam.titleEn,
      quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
      practicalMaxMarks: exam.practicalMaxMarks || FINAL_PRACTICAL_MARKS,
      totalMaxMarks: exam.totalMaxMarks || FINAL_TOTAL_MARKS,
      generatedAt: new Date().toISOString(),
      counts: {
        total: rows.length,
        graded,
        withQuiz,
      },
      rows,
    };
  });

type GoogleFormPracticalRow = {
  phone: string;
  name?: string;
  brandName?: string;
  brandNameLink?: string;
  marketResearch?: string;
  fbCreatives?: string;
  adScript?: string;
  adScriptLink?: string;
  adVideo?: string;
  adVideoLink?: string;
  landingPage?: string;
  landingUrl?: string;
  bonusAi?: string;
  bonusShot?: string;
};

function buildAnswersFromGoogleFormProps(
  row: GoogleFormPracticalRow,
): PracticalTaskAnswer[] {
  const fileNote = (name: string | undefined) => {
    const n = (name || "").trim();
    if (!n) return undefined;
    if (/^https?:\/\//i.test(n)) return undefined;
    // Treat non-URL blobs as uploaded file names from the Google Form.
    if (n.includes(".") || n.length > 8) return n.split("\n")[0]?.trim();
    return undefined;
  };
  return [
    {
      taskId: "task-brand-name",
      textAnswer: (row.brandName || "").trim() || undefined,
      linkUrl: (row.brandNameLink || "").trim() || undefined,
    },
    {
      taskId: "task-market-research",
      textAnswer: (row.marketResearch || "").trim() || undefined,
      fileName: fileNote(row.marketResearch),
    },
    {
      taskId: "task-fb-creatives",
      textAnswer: (row.fbCreatives || "").trim() || undefined,
      fileName: fileNote((row.fbCreatives || "").split("\n").find((l) => l.includes("."))),
    },
    {
      taskId: "task-ad-script",
      textAnswer: (row.adScript || "").trim() || undefined,
      linkUrl: (row.adScriptLink || "").trim() || undefined,
    },
    {
      taskId: "task-ad-video",
      textAnswer: (row.adVideo || "").trim() || undefined,
      linkUrl: (row.adVideoLink || "").trim() || undefined,
      fileName: fileNote(row.adVideo),
    },
    {
      taskId: "task-landing-page",
      textAnswer: (row.landingPage || "").trim() || undefined,
      linkUrl: (row.landingUrl || "").trim() || undefined,
    },
  ];
}

type ReviewedPracticalGradeRow = {
  submissionId: string;
  rollNumber?: string;
  grades: PracticalGrade[];
  instructorFeedback?: string;
};

/**
 * Apply a pre-reviewed practical grade sheet (bilingual EN/BN comments).
 * Loads scripts/data/practical-grades-reviewed.json when rows omitted.
 * Skips already-graded unless regrade=true. Staff can still edit marks in the desk.
 */
export const serverApplyReviewedPracticalGrades = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      dryRun?: boolean | undefined;
      regrade?: boolean | undefined;
      rows?: ReviewedPracticalGradeRow[] | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false as const, error: "Final practical exam not found for course." };

    let rows = data.rows;
    if (!rows || rows.length === 0) {
      try {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const filePath = join(process.cwd(), "scripts/data/practical-grades-reviewed.json");
        const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
          rows?: ReviewedPracticalGradeRow[];
        };
        rows = parsed.rows || [];
      } catch {
        return {
          success: false as const,
          error: "No rows provided and could not read scripts/data/practical-grades-reviewed.json",
        };
      }
    }

    const requirement = (store.courseRequirements || []).find((r) => r.courseId === courseId);
    const regrade = data.regrade === true;
    const now = new Date().toISOString();
    let applied = 0;
    let skippedGraded = 0;
    let missing = 0;
    const sample: Array<{ rollNumber: string; earned: number; max: number; pct: number }> = [];

    for (const row of rows) {
      const idx = (store.practicalSubmissions || []).findIndex((s) => s.id === row.submissionId);
      if (idx < 0 || !store.practicalSubmissions?.[idx]) {
        missing += 1;
        continue;
      }
      const sub = store.practicalSubmissions[idx]!;
      if (!regrade && sub.status === "graded") {
        skippedGraded += 1;
        continue;
      }
      if (!row.grades?.length) {
        missing += 1;
        continue;
      }

      const grades = row.grades.map((g) => ({
        taskId: g.taskId,
        marks: Math.max(0, Number(g.marks) || 0),
        maxMarks: Math.max(1, Number(g.maxMarks) || 1),
        comment: g.comment,
        gradedBy: actor.id,
        gradedAt: now,
      }));
      const stats = computePracticalScorePct(exam.tasks, grades);
      const quizResult = resolveQuizResultForStudent(
        store,
        sub.rollNumber,
        exam.linkedQuizId,
        requirement?.requiredQuizIds,
        {
          phone: sub.phone,
          studentName: sub.studentName,
          regionId: sub.regionId,
        },
      );
      const quizPct = quizResult?.accuracyPct ?? sub.quizAccuracyPct ?? 0;
      const combinedPct = computeCombinedFinalPct({
        quizAccuracyPct: quizPct,
        practicalScorePct: stats.pct,
        quizWeightPct: exam.quizWeightPct,
        practicalWeightPct: exam.practicalWeightPct,
      });

      if (!data.dryRun) {
        store.practicalSubmissions[idx] = {
          ...sub,
          grades,
          status: "graded",
          practicalScorePct: stats.pct,
          quizAccuracyPct: quizPct,
          combinedPct,
          instructorFeedback: row.instructorFeedback || sub.instructorFeedback,
          gradedAt: now,
          gradedBy: actor.id,
          updatedAt: now,
        };
      }
      applied += 1;
      if (sample.length < 15) {
        sample.push({
          rollNumber: sub.rollNumber,
          earned: stats.earned,
          max: stats.max,
          pct: stats.pct,
        });
      }
    }

    if (!data.dryRun && applied > 0) scheduleDiskPersist();
    return {
      success: true as const,
      dryRun: !!data.dryRun,
      applied,
      skippedGraded,
      missing,
      sample,
    };
  });

/**
 * Merge Quiz 17 makeup results into the Final Exam package for students who
 * missed the original final window and sat Quiz 17 individually (live host or desk).
 * Upgrades weak final attempts, mints missing attempts, refreshes practical quiz %.
 */
export const serverMergeQuiz17IntoFinal = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      dryRun?: boolean | undefined;
      makeupQuizId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false as const, error: "Final practical exam not found for course." };

    const reqIdx = (store.courseRequirements || []).findIndex((r) => r.courseId === courseId);
    const requirement =
      reqIdx >= 0
        ? store.courseRequirements![reqIdx]!
        : buildDefaultCourseRequirement(courseId);
    const makeupQuizId = data.makeupQuizId || SANJIBON_QUIZ17_MAKEUP_ID;
    const merged = mergeMakeupQuizIntoFinalExam({
      exam,
      requirement,
      makeupQuizIds: [makeupQuizId],
      results: store.examResults || [],
      sessions: store.examSessions || [],
      attempts: (store.finalExamAttempts || []).filter((a) => a.practicalExamId === exam.id),
      submissions: (store.practicalSubmissions || []).filter(
        (s) => s.practicalExamId === exam.id || s.courseId === courseId,
      ),
    });

    if (data.dryRun) {
      return {
        success: true as const,
        dryRun: true as const,
        attemptsCreated: merged.attemptsCreated,
        attemptsUpgraded: merged.attemptsUpgraded,
        attemptsSkipped: merged.attemptsSkipped,
        submissionsUpdated: merged.submissionsUpdated,
        resultsLinked: merged.resultsLinked,
        requiredQuizIds: merged.requirementRequiredQuizIds,
        sample: merged.sample,
      };
    }

    // Apply requirement + linked quiz aliases
    const nextReq = {
      ...requirement,
      requiredQuizIds: merged.requirementRequiredQuizIds,
    };
    if (!store.courseRequirements) store.courseRequirements = [];
    if (reqIdx >= 0) store.courseRequirements[reqIdx] = nextReq;
    else store.courseRequirements.push(nextReq);

    const examIdx = (store.practicalExams || []).findIndex((p) => p.id === exam.id);
    if (examIdx >= 0 && store.practicalExams) {
      // Keep current linked paper if set; otherwise point at Quiz 17 makeup.
      store.practicalExams[examIdx] = {
        ...exam,
        linkedQuizId: exam.linkedQuizId || makeupQuizId,
        updatedAt: new Date().toISOString(),
      };
    }

    // Replace course-scoped attempts/submissions; keep other courses intact.
    const otherAttempts = (store.finalExamAttempts || []).filter(
      (a) => a.practicalExamId !== exam.id,
    );
    store.finalExamAttempts = [...merged.attempts, ...otherAttempts];
    rebuildFinalAttemptIndex(store);

    const otherSubs = (store.practicalSubmissions || []).filter(
      (s) => s.practicalExamId !== exam.id && s.courseId !== courseId,
    );
    store.practicalSubmissions = [...merged.submissions, ...otherSubs];

    // Sessions/results are global — write the merged arrays (merge only adds/updates).
    store.examSessions = merged.sessions;
    store.examResults = merged.results;
    scheduleDiskPersist();

    return {
      success: true as const,
      dryRun: false as const,
      attemptsCreated: merged.attemptsCreated,
      attemptsUpgraded: merged.attemptsUpgraded,
      attemptsSkipped: merged.attemptsSkipped,
      submissionsUpdated: merged.submissionsUpdated,
      resultsLinked: merged.resultsLinked,
      requiredQuizIds: merged.requirementRequiredQuizIds,
      sample: merged.sample,
    };
  });

/**
 * Merge Google Form practical backup responses into Final Exam submissions.
 * Matches roster by mobile; skips already-graded rows; marks imports as late.
 */
export const serverImportGoogleFormPracticals = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      dryRun?: boolean | undefined;
      /** When omitted, loads scripts/data/google-form-practical-ai-dm.json from disk. */
      rows?: GoogleFormPracticalRow[] | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const courseId = data.courseId || "course-sanjibon-ai-dm";
    const exam = (store.practicalExams || []).find((p) => p.courseId === courseId);
    if (!exam) return { success: false, error: "Final practical exam not found for course." };

    let rows = data.rows;
    if (!rows || rows.length === 0) {
      try {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const filePath = join(
          process.cwd(),
          "scripts/data/google-form-practical-ai-dm.json",
        );
        rows = JSON.parse(readFileSync(filePath, "utf8")) as GoogleFormPracticalRow[];
      } catch {
        return {
          success: false,
          error: "No rows provided and could not read scripts/data/google-form-practical-ai-dm.json",
        };
      }
    }

    if (!store.practicalSubmissions) store.practicalSubmissions = [];
    const now = new Date().toISOString();
    const summary = {
      imported: 0,
      updated: 0,
      skippedGraded: 0,
      unmatchedPhone: [] as string[],
      matched: [] as Array<{ phone: string; rollNumber: string; name: string; action: string }>,
    };

    for (const row of rows) {
      const phone = normalizeBdPhone(row.phone || "");
      if (!phone) {
        summary.unmatchedPhone.push(row.phone || "(empty)");
        continue;
      }
      const student = (store.roster || []).find(
        (s) =>
          normalizeBdPhone(s.phone) === phone ||
          normalizeBdPhone(s.guardianPhone) === phone,
      );
      if (!student) {
        summary.unmatchedPhone.push(`${row.phone} (${row.name || "?"})`);
        continue;
      }

      const answers = buildAnswersFromGoogleFormProps(row);
      const existingIdx = store.practicalSubmissions.findIndex(
        (s) =>
          s.practicalExamId === exam.id &&
          normalizeRollToken(s.rollNumber) === normalizeRollToken(student.rollNumber),
      );
      const existing =
        existingIdx >= 0 ? store.practicalSubmissions[existingIdx] : undefined;
      if (existing?.status === "graded") {
        summary.skippedGraded += 1;
        summary.matched.push({
          phone: row.phone,
          rollNumber: student.rollNumber,
          name: student.name,
          action: "skipped_graded",
        });
        continue;
      }

      const quizResult = resolveQuizResultForStudent(
        store,
        student.rollNumber,
        exam.linkedQuizId,
        (store.courseRequirements || []).find((r) => r.courseId === courseId)?.requiredQuizIds,
        {
          phone: student.phone,
          studentName: student.name,
          regionId: student.regionId,
        },
      );
      const feedbackBits = [
        "Imported from Google Form backup (exam app submit failed).",
        row.bonusAi ? `AI assistant bonus: ${row.bonusAi}` : "",
        "Original files stay in the Google Form / Drive — download from the form if needed.",
      ]
        .filter(Boolean)
        .join(" ");

      const submission: PracticalSubmission = {
        id:
          existing?.id ||
          `psub-${exam.id}-${normalizeRollToken(student.rollNumber)}`,
        practicalExamId: exam.id,
        courseId: exam.courseId,
        rosterStudentId: student.id,
        rollNumber: student.rollNumber,
        studentName: student.name || row.name || "Student",
        phone: student.phone || phone,
        regionId: student.regionId,
        regionName: student.regionName,
        answers,
        grades: undefined,
        status: "late",
        quizAccuracyPct: quizResult?.accuracyPct ?? existing?.quizAccuracyPct,
        instructorFeedback: feedbackBits,
        submittedAt: existing?.submittedAt || now,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      if (data.dryRun) {
        summary.matched.push({
          phone: row.phone,
          rollNumber: student.rollNumber,
          name: student.name,
          action: existing ? "would_update" : "would_create",
        });
        continue;
      }

      if (existingIdx >= 0) {
        store.practicalSubmissions[existingIdx] = submission;
        summary.updated += 1;
        summary.matched.push({
          phone: row.phone,
          rollNumber: student.rollNumber,
          name: student.name,
          action: "updated",
        });
      } else {
        store.practicalSubmissions.unshift(submission);
        summary.imported += 1;
        summary.matched.push({
          phone: row.phone,
          rollNumber: student.rollNumber,
          name: student.name,
          action: "created",
        });
      }
    }

    if (!data.dryRun && (summary.imported > 0 || summary.updated > 0)) {
      scheduleDiskPersist();
    }
    return {
      success: true,
      dryRun: !!data.dryRun,
      courseId,
      examId: exam.id,
      totalRows: rows.length,
      ...summary,
    };
  });

function issueCourseCertificateInStore(params: {
  store: PersistentStoreData;
  courseId: string;
  rollNumber: string;
  instructorName: string;
}): {
  success: boolean;
  certificate?: CertificateData;
  alreadyIssued?: boolean;
  error?: string;
  snapshot?: ReturnType<typeof evaluateCourseCompletion>;
} {
  const { store } = params;
  ensureFinalPracticalSeeded(store);
  const course = store.courses.find((c) => c.id === params.courseId);
  if (!course) return { success: false, error: "Course not found." };
  const requirement =
    (store.courseRequirements || []).find((r) => r.courseId === course.id) ||
    buildDefaultCourseRequirement(course.id);
  const practicalExam = (store.practicalExams || []).find((p) => p.courseId === course.id);
  const submission = (store.practicalSubmissions || []).find(
    (s) =>
      s.courseId === course.id &&
      normalizeRollToken(s.rollNumber) === normalizeRollToken(params.rollNumber),
  );
  const quizResult = resolveQuizResultForStudent(
    store,
    params.rollNumber,
    practicalExam?.linkedQuizId || requirement.requiredQuizIds?.[0],
    requirement.requiredQuizIds,
  );
  const snap = evaluateCourseCompletion({
    course,
    requirement,
    practicalExam,
    submission,
    quizResult,
  });
  if (!snap.eligibleForCourseCertificate) {
    return {
      success: false,
      error: `Not eligible for course certificate. Missing: ${snap.missing.join(", ")}`,
      snapshot: snap,
    };
  }

  const certNo = makeCourseCertificateNumber(course.code, snap.rollNumber);
  const existing = store.certificates.find(
    (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
  );
  if (existing?.cryptoSignature) {
    return { success: true, certificate: existing, alreadyIssued: true, snapshot: snap };
  }

  const titleEn = requirement.certificateTitleEn || "Certificate of Course Completion";
  const unsigned: CertificateData = {
    id: `cert-course-${course.id}-${normalizeRollToken(snap.rollNumber)}`,
    certificateNumber: certNo,
    kind: "course_completion",
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.titleEn,
    studentName: snap.studentName,
    studentRoll: snap.rollNumber,
    regionName: submission?.regionName || quizResult?.regionName || "",
    quizTitle: `${course.code} — ${titleEn}`,
    quizAccuracyPct: snap.quizAccuracyPct,
    practicalScorePct: snap.practicalScorePct,
    combinedScorePct: snap.combinedPct,
    score: snap.combinedPct,
    scorePct: snap.combinedPct,
    accuracyPercent: snap.combinedPct,
    marksObtained: snap.combinedPct,
    totalMarks: 100,
    totalPoints: 100,
    rank: 1,
    totalParticipants: 1,
    issueDate: new Date().toISOString().slice(0, 10),
    organizationName: resolveOrgName(store.branding),
    institutionName: store.branding?.institutionTitle || "Onnesha Assessment Arena",
    instructorName: params.instructorName || "Chief Assessment Officer",
    verificationUrl: `/verify/${certNo}`,
    verified: true,
    credentialStatementEn: `This certifies that the learner has successfully completed the full course ${course.titleEn} (${course.code}), including the Final Quiz and Final Practical Examination, with a combined score of ${snap.combinedPct}%.`,
    credentialStatementBn: `এই সনদপত্র দ্বারা প্রত্যয়িত হচ্ছে যে শিক্ষার্থী ${course.titleBn} (${course.code}) কোর্সের চূড়ান্ত কুইজ ও প্রায়োগিক পরীক্ষা সম্পন্ন করে সম্মিলিত ${snap.combinedPct}% নম্বর অর্জন করেছেন।`,
  };
  const sealed = sealCertificateWithLedger(unsigned, store.certificates, getStorePaths().dataDir);
  store.certificates = [
    sealed,
    ...store.certificates.filter(
      (c) => c.certificateNumber.toLowerCase() !== sealed.certificateNumber.toLowerCase(),
    ),
  ];
  scheduleDiskPersist();
  triggerBackgroundExternalAnchoring([sealed.certificateNumber]);
  return { success: true, certificate: sealed, snapshot: snap };
}

function resolvePublicOrigin(): string {
  if (typeof process !== "undefined") {
    const fromEnv =
      process.env["PUBLIC_APP_ORIGIN"]?.trim() ||
      process.env["APP_ORIGIN"]?.trim() ||
      process.env["RENDER_EXTERNAL_URL"]?.trim();
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
  }
  return "https://arena.onnesha.courses";
}

function findRosterEmailForRoll(
  store: PersistentStoreData,
  rollNumber: string,
): string | undefined {
  const rollTok = normalizeRollToken(rollNumber);
  const student = store.roster.find((s) => normalizeRollToken(s.rollNumber) === rollTok);
  const email = (student?.email || "").trim().toLowerCase();
  return isValidPortalEmail(email) ? email : undefined;
}

async function emailCertificateToStudent(params: {
  store: PersistentStoreData;
  certificate: CertificateData;
}): Promise<
  | { emailed: true; to: string; provider: string }
  | { emailed: false; reason: string }
> {
  const to = findRosterEmailForRoll(params.store, params.certificate.studentRoll || "");
  if (!to) {
    return {
      emailed: false,
      reason: "No roster email for this roll — add email on roster to send certificate mail.",
    };
  }
  const origin = resolvePublicOrigin();
  const certNo = params.certificate.certificateNumber;
  const verifyPath =
    params.certificate.verificationUrl?.startsWith("http")
      ? params.certificate.verificationUrl
      : `${origin}/verify/${certNo}`;
  const portalUrl = `${origin}/portal`;
  const kind =
    params.certificate.kind === "course_completion" ? "course_completion" : "quiz_session";
  const design = getCertificateDesignProfile(params.store.branding, kind);
  const content =
    kind === "course_completion"
      ? buildCourseCertificateEmail({
          studentName: params.certificate.studentName || "Student",
          courseTitle: params.certificate.courseTitle || "Course",
          courseCode: params.certificate.courseCode || "",
          certificateNumber: certNo,
          combinedScorePct:
            params.certificate.combinedScorePct ?? params.certificate.accuracyPercent,
          verifyUrl: verifyPath,
          portalUrl,
          badgeTitle: design.certBadgeTitle,
        })
      : buildQuizCertificateEmail({
          studentName: params.certificate.studentName || "Student",
          quizTitle: params.certificate.quizTitle || "Quiz Session",
          certificateNumber: certNo,
          scorePct:
            params.certificate.scorePct ??
            params.certificate.accuracyPercent ??
            undefined,
          rank: params.certificate.rank,
          totalParticipants: params.certificate.totalParticipants,
          verifyUrl: verifyPath,
          portalUrl,
          badgeTitle: design.certBadgeTitle,
        });
  const sent = await sendTransactionalEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  if (!sent.ok) return { emailed: false, reason: sent.error };
  return { emailed: true, to, provider: sent.provider };
}

/** @deprecated Prefer emailCertificateToStudent — kept for call-site clarity. */
async function emailCourseCertificateToStudent(params: {
  store: PersistentStoreData;
  certificate: CertificateData;
}): Promise<
  | { emailed: true; to: string; provider: string }
  | { emailed: false; reason: string }
> {
  return emailCertificateToStudent(params);
}

export const serverIssueCourseCertificate = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId: string;
      rollNumber: string;
      /** Default true — email certificate when roster email exists. */
      sendEmail?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required." };
    }
    const store = getStore();
    const res = issueCourseCertificateInStore({
      store,
      courseId: data.courseId,
      rollNumber: data.rollNumber,
      instructorName: actor.name || "Chief Assessment Officer",
    });
    if (!res.success || !res.certificate) return res;
    const wantEmail = data.sendEmail !== false;
    if (!wantEmail) return { ...res, email: { emailed: false as const, reason: "skipped" } };
    const email = await emailCourseCertificateToStudent({
      store,
      certificate: res.certificate,
    });
    return { ...res, email };
  });

export const serverBulkIssueCourseCertificates = createServerFn({ method: "POST" })
  .validator(
    (data: { courseId: string; sendEmail?: boolean | undefined }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, error: "Staff authentication required for bulk issuance." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const requirement =
      (store.courseRequirements || []).find((r) => r.courseId === data.courseId) ||
      buildDefaultCourseRequirement(data.courseId);

    let candidateRolls: string[] = [];
    if (requirement.requirePractical !== false) {
      candidateRolls = Array.from(
        new Set(
          (store.practicalSubmissions || [])
            .filter((s) => s.courseId === data.courseId && s.status === "graded")
            .map((s) => s.rollNumber),
        ),
      );
    } else {
      const allowed = requirement.requiredQuizIds || [];
      const sessions = store.examSessions.filter((s) => allowed.includes(s.quizId));
      const sessionIds = new Set(sessions.map((s) => s.id));
      const pins = new Set(sessions.map((s) => s.pin));
      candidateRolls = Array.from(
        new Set(
          store.examResults
            .filter((r) => sessionIds.has(r.sessionId) || pins.has(r.pin))
            .map((r) => r.rollNumber),
        ),
      );
    }

    const wantEmail = data.sendEmail !== false;
    const issued: string[] = [];
    const emailed: string[] = [];
    const skipped: Array<{ roll: string; reason: string }> = [];
    for (const roll of candidateRolls) {
      const res = issueCourseCertificateInStore({
        store,
        courseId: data.courseId,
        rollNumber: roll,
        instructorName: actor.name || "Chief Assessment Officer",
      });
      if (res.success && res.certificate) {
        issued.push(res.certificate.certificateNumber);
        if (wantEmail) {
          const mail = await emailCourseCertificateToStudent({
            store,
            certificate: res.certificate,
          });
          if (mail.emailed) emailed.push(mail.to);
          else if (!res.alreadyIssued) {
            skipped.push({ roll, reason: `issued but email failed: ${mail.reason}` });
          }
        }
      } else skipped.push({ roll, reason: res.error || "skipped" });
    }
    return {
      success: true,
      issuedCount: issued.length,
      emailedCount: emailed.length,
      issued,
      emailed,
      skipped,
    };
  });

/**
 * Send (or resend) certificate email for an already-issued cert.
 * Picks quiz vs course template from `certificate.kind`.
 */
export const serverSendCertificateEmail = createServerFn({ method: "POST" })
  .validator((data: { certificateNumber: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const certNo = (data.certificateNumber || "").trim();
    const certificate = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!certificate) return { success: false as const, error: "Certificate not found." };
    const mail = await emailCertificateToStudent({ store, certificate });
    if (!mail.emailed) return { success: false as const, error: mail.reason };
    return {
      success: true as const,
      to: mail.to,
      provider: mail.provider,
      kind: certificate.kind === "course_completion" ? "course_completion" : "quiz_session",
    };
  });

/** Resend course-completion certificate email for an already-issued cert. */
export const serverSendCourseCertificateEmail = createServerFn({ method: "POST" })
  .validator((data: { certificateNumber: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const certNo = (data.certificateNumber || "").trim();
    const certificate = store.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase(),
    );
    if (!certificate) return { success: false as const, error: "Certificate not found." };
    const mail = await emailCertificateToStudent({ store, certificate });
    if (!mail.emailed) return { success: false as const, error: mail.reason };
    return { success: true as const, to: mail.to, provider: mail.provider };
  });

export const serverGetStudentPortal = createServerFn({ method: "POST" })
  .validator(
    (data: {
      rollNumber?: string | undefined;
      phone?: string | undefined;
      query?: string | undefined;
      courseId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    ensureLmsContentSeeded(store);
    // Portal requires OTP login cookie — no open phone/roll unlock.
    const student = await getRosterStudentFromPortalCookie(store);
    if (!student) {
      return {
        success: false,
        error: "Sign in with OTP first (email or mobile, per admin settings).",
      };
    }

    const course =
      (data.courseId ? store.courses.find((c) => c.id === data.courseId) : undefined) ||
      store.courses.find((c) => c.id === SANJIBON_COURSE.id) ||
      store.courses[0] ||
      SANJIBON_COURSE;
    const practicalExam = (store.practicalExams || []).find((p) => p.courseId === course.id);
    const submission = (store.practicalSubmissions || []).find(
      (s) =>
        s.courseId === course.id &&
        normalizeRollToken(s.rollNumber) === normalizeRollToken(student.rollNumber),
    );
    const requirement =
      (store.courseRequirements || []).find((r) => r.courseId === course.id) ||
      buildDefaultCourseRequirement(course.id);
    const quizResult = resolveQuizResultForStudent(
      store,
      student.rollNumber,
      practicalExam?.linkedQuizId || requirement.requiredQuizIds?.[0],
      requirement.requiredQuizIds,
    );
    const snap = evaluateCourseCompletion({
      course,
      requirement,
      practicalExam,
      submission,
      quizResult,
    });
    const courseCert = store.certificates.find(
      (c) =>
        c.kind === "course_completion" &&
        c.courseId === course.id &&
        normalizeRollToken(c.studentRoll || "") === normalizeRollToken(student.rollNumber),
    );

    const quizProgress = READY_MADE_PACKS.filter((q) => q.courseId === course.id).map((q) => {
      const sessions = store.examSessions.filter((s) => s.quizId === q.id || s.quizId === q.slug);
      const sessionIds = new Set(sessions.map((s) => s.id));
      const best = store.examResults
        .filter(
          (r) =>
            normalizeRollToken(r.rollNumber) === normalizeRollToken(student.rollNumber) &&
            (sessionIds.has(r.sessionId) || sessions.some((s) => s.pin === r.pin)),
        )
        .sort((a, b) => b.accuracyPct - a.accuracyPct)[0];
      return {
        quizId: q.id,
        quizNumber: q.quizNumber,
        titleEn: q.titleEn,
        titleBn: q.titleBn,
        questionCount: q.questions.length,
        bestAccuracyPct: best?.accuracyPct,
        passed: best?.passed,
        resultId: best?.id,
      };
    });

    const materials = (store.courseMaterials || [])
      .filter((m) => m.courseId === course.id && m.published)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const recordings = (store.courseRecordings || [])
      .filter((r) => r.courseId === course.id && r.published)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const announcements = (store.courseAnnouncements || [])
      .filter((a) => a.courseId === course.id && a.published)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const finalAttempt = (store.finalExamAttempts || [])
      .filter(
        (a) =>
          a.courseId === course.id &&
          normalizeRollToken(a.rollNumber) === normalizeRollToken(student.rollNumber),
      )
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];

    return {
      success: true,
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        phone: student.phone,
        email: student.email,
        regionId: student.regionId,
        regionName: student.regionName,
      },
      course: {
        id: course.id,
        code: course.code,
        titleEn: course.titleEn,
        titleBn: course.titleBn,
        descriptionEn: course.descriptionEn,
        descriptionBn: course.descriptionBn,
        passThresholdPct: course.passThresholdPct ?? 50,
      },
      courses: store.courses
        .filter((c) => c.status !== "archived")
        .map((c) => ({
          id: c.id,
          code: c.code,
          titleEn: c.titleEn,
          titleBn: c.titleBn,
        })),
      quizProgress,
      practicalExam,
      submission,
      completion: snap,
      materials,
      recordings,
      announcements,
      finalAttempt: finalAttempt
        ? {
            id: finalAttempt.id,
            status: finalAttempt.status,
            quizMarks: finalAttempt.quizMarks,
            quizMaxMarks: finalAttempt.quizMaxMarks,
            accuracyPct: finalAttempt.accuracyPct,
            submittedAt: finalAttempt.submittedAt,
            endsAt: finalAttempt.endsAt,
          }
        : null,
      hasAiTutor: hasAnyConfiguredAiProvider(
        ensureStoreAiPool(store),
        store.serverGeminiApiKey,
      ),
      courseKbCount: (store.courseKnowledgeBase || []).filter(
        (k) => k.courseId === course.id && k.enabled,
      ).length,
      courseCertificate: courseCert
        ? {
            ...courseCert,
            certificateNumber: courseCert.certificateNumber,
            issueDate: courseCert.issueDate,
            combinedScorePct: courseCert.combinedScorePct ?? courseCert.accuracyPercent,
            verificationUrl: courseCert.verificationUrl,
          }
        : null,
      requirement,
      autoIssueQuizCertificates: store.autoIssueQuizCertificates === true,
    };
  });

// ============================================================================
// TIMED FINAL EXAM (PIN join + overall countdown MCQ — not per-question)
// ============================================================================

function resolveQuizForFinalExam(store: PersistentStoreData, quizId: string | undefined): Quiz | undefined {
  if (!quizId) return undefined;
  const fromCustom = (store.customQuizzes || []).find((q) => q.id === quizId || q.slug === quizId);
  if (fromCustom) return fromCustom;
  return SANJIBON_QUIZZES.find((q) => q.id === quizId || q.slug === quizId);
}

function stripQuizForCandidate(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: (quiz.questions || []).map((q) => ({
      ...q,
      correctOptionIds: [],
      acceptedAnswers: undefined,
      explanationEn: undefined,
      explanationBn: undefined,
      options: (q.options || []).map((o) => ({
        id: o.id,
        textEn: o.textEn,
        textBn: o.textBn,
        // never leak isCorrect to candidates
      })),
    })),
  };
}

function findFinalExamByPin(store: PersistentStoreData, pinRaw: string): PracticalExam | undefined {
  const pin = String(pinRaw || "").replace(/\D/g, "").trim();
  if (pin.length < 4) return undefined;
  return (store.practicalExams || []).find((e) => (e.joinPin || "").replace(/\D/g, "") === pin);
}

function isFinalExamJoinWindowOpen(exam: PracticalExam, nowIso = new Date().toISOString()): boolean {
  if (exam.status === "archived" || exam.status === "draft") return false;
  if (exam.quizWindowOpen === false) return false;
  if (exam.status === "closed" && exam.quizWindowOpen !== true) return false;
  if (exam.opensAt && nowIso < exam.opensAt) return false;
  if (exam.closesAt && nowIso > exam.closesAt) return false;
  if (exam.quizWindowOpen === true) return true;
  return exam.status === "open" || exam.status === "scheduled";
}

export const serverLookupFinalExamByPin = createServerFn({ method: "POST" })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const exam = findFinalExamByPin(store, data.pin);
    if (!exam) return { success: false as const, error: "Invalid Final Exam PIN." };
    const course = store.courses.find((c) => c.id === exam.courseId);
    const quiz = resolveQuizForFinalExam(store, exam.linkedQuizId);
    const nowIso = new Date().toISOString();
    const windowOpen = isFinalExamJoinWindowOpen(exam, nowIso);
    return {
      success: true as const,
      exam: {
        id: exam.id,
        courseId: exam.courseId,
        titleEn: exam.titleEn,
        titleBn: exam.titleBn,
        descriptionEn: exam.descriptionEn,
        descriptionBn: exam.descriptionBn,
        joinPin: exam.joinPin,
        linkedQuizId: exam.linkedQuizId,
        quizDurationMinutes: exam.quizDurationMinutes || 10,
        quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
        practicalMaxMarks: exam.practicalMaxMarks || 40,
        totalMaxMarks: exam.totalMaxMarks || FINAL_TOTAL_MARKS,
        status: exam.status,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
        tasks: exam.tasks,
        passThresholdPct: exam.passThresholdPct,
      },
      course: course
        ? { id: course.id, code: course.code, titleEn: course.titleEn, titleBn: course.titleBn }
        : null,
      quizMeta: quiz
        ? {
            id: quiz.id,
            titleEn: quiz.titleEn,
            titleBn: quiz.titleBn,
            questionCount: quiz.questions?.length || 0,
          }
        : null,
      windowOpen,
      nowIso,
    };
  });

function resolveFinalExamStudent(
  store: PersistentStoreData,
  data: { query?: string | undefined; rollNumber?: string | undefined; phone?: string | undefined },
) {
  const query = (data.query || "").trim();
  if (query.length >= 2) {
    const byQuery = findRosterCandidate(store.roster, query);
    if (byQuery) return byQuery;
  }
  if ((data.rollNumber || "").trim() && (data.phone || "").trim()) {
    return matchRosterIdentity({
      rollNumber: data.rollNumber || "",
      phone: data.phone || "",
      roster: store.roster,
    });
  }
  return null;
}

/** Quiz-style mobile/roll search for Final Exam (no live arena session required). */
export const serverLookupFinalExamCandidate = createServerFn({ method: "POST" })
  .validator((data: { pin: string; query: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const exam = findFinalExamByPin(store, data.pin);
    if (!exam) return { success: false as const, error: "Invalid Final Exam PIN." };
    const rawQuery = (data.query || "").trim();
    if (!rawQuery || rawQuery.length < 2) {
      return {
        success: false as const,
        error: "Enter your mobile number (or roll) to search the roster.",
      };
    }
    const matched = findRosterCandidate(store.roster, rawQuery);
    if (!matched) {
      return {
        success: false as const,
        error: "No enrolled candidate matched this Mobile / Roll Number.",
      };
    }
    return {
      success: true as const,
      candidate: sanitizeLookupCandidate(matched, false),
    };
  });

export const serverJoinFinalExam = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      query?: string | undefined;
      rollNumber?: string | undefined;
      phone?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const exam = findFinalExamByPin(store, data.pin);
    if (!exam) return { success: false as const, error: "Invalid Final Exam PIN." };
    if (!isFinalExamJoinWindowOpen(exam)) {
      return { success: false as const, error: "Final Exam is outside the scheduled window." };
    }
    const student = resolveFinalExamStudent(store, data);
    if (!student) {
      return {
        success: false as const,
        error: "Mobile / roll not found on roster. Search your registered mobile number.",
      };
    }
    const quiz = resolveQuizForFinalExam(store, exam.linkedQuizId);
    if (!quiz || !(quiz.questions || []).length) {
      return { success: false as const, error: "Final quiz is not configured." };
    }
    if (!store.finalExamAttempts) store.finalExamAttempts = [];
    const rollTok = normalizeRollToken(student.rollNumber);
    const existing = store.finalExamAttempts.find(
      (a) =>
        a.practicalExamId === exam.id &&
        normalizeRollToken(a.rollNumber) === rollTok &&
        (a.status === "submitted" || a.status === "graded"),
    );
    const inProgress = store.finalExamAttempts.find(
      (a) =>
        a.practicalExamId === exam.id &&
        normalizeRollToken(a.rollNumber) === rollTok &&
        a.status === "in_progress" &&
        a.endsAt > new Date().toISOString(),
    );
    const submission = (store.practicalSubmissions || []).find(
      (s) =>
        s.practicalExamId === exam.id && normalizeRollToken(s.rollNumber) === rollTok,
    );
    // Continuous journey: portal session cookie so /portal opens without re-OTP after exam.
    await setStudentPortalCookieForRoster(student);

    return {
      success: true as const,
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        phone: student.phone,
        email: student.email,
        regionId: student.regionId,
        regionName: student.regionName,
      },
      exam: {
        id: exam.id,
        courseId: exam.courseId,
        titleEn: exam.titleEn,
        titleBn: exam.titleBn,
        descriptionEn: exam.descriptionEn,
        descriptionBn: exam.descriptionBn,
        joinPin: exam.joinPin,
        quizDurationMinutes: exam.quizDurationMinutes || 10,
        quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
        practicalMaxMarks: exam.practicalMaxMarks || 40,
        totalMaxMarks: exam.totalMaxMarks || FINAL_TOTAL_MARKS,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
        status: exam.status,
        tasks: exam.tasks,
        maxFileBytes: exam.maxFileBytes,
        allowedMimeTypes: exam.allowedMimeTypes,
        passThresholdPct: exam.passThresholdPct,
      },
      quizMeta: {
        id: quiz.id,
        titleEn: quiz.titleEn,
        titleBn: quiz.titleBn,
        questionCount: quiz.questions.length,
      },
      quizAlreadySubmitted: !!existing,
      priorAttempt: existing
        ? {
            accuracyPct: existing.accuracyPct,
            quizMarks: existing.quizMarks,
            quizMaxMarks: existing.quizMaxMarks,
            submittedAt: existing.submittedAt,
          }
        : null,
      inProgressAttempt: inProgress
        ? { id: inProgress.id, endsAt: inProgress.endsAt, startedAt: inProgress.startedAt }
        : null,
      practicalSubmission: submission || null,
    };
  });

export const serverStartFinalQuizAttempt = createServerFn({ method: "POST" })
  .validator(
    (data: {
      pin: string;
      query?: string | undefined;
      rollNumber?: string | undefined;
      phone?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    const exam = findFinalExamByPin(store, data.pin);
    if (!exam) return { success: false as const, error: "Invalid Final Exam PIN." };
    if (!isFinalExamJoinWindowOpen(exam)) {
      return { success: false as const, error: "Final Exam window is closed." };
    }
    const student = resolveFinalExamStudent(store, data);
    if (!student) {
      return {
        success: false as const,
        error: "Mobile / roll not found on roster. Search your registered mobile number.",
      };
    }
    const quiz = resolveQuizForFinalExam(store, exam.linkedQuizId);
    if (!quiz?.questions?.length) {
      return { success: false as const, error: "Final quiz is not configured." };
    }
    if (!store.finalExamAttempts) store.finalExamAttempts = [];
    const rollTok = normalizeRollToken(student.rollNumber);
    const already = store.finalExamAttempts.find(
      (a) =>
        a.practicalExamId === exam.id &&
        normalizeRollToken(a.rollNumber) === rollTok &&
        (a.status === "submitted" || a.status === "graded"),
    );
    if (already) {
      return { success: false as const, error: "You already submitted the Final Quiz for this PIN." };
    }
    const live = store.finalExamAttempts.find(
      (a) =>
        a.practicalExamId === exam.id &&
        normalizeRollToken(a.rollNumber) === rollTok &&
        a.status === "in_progress",
    );
    const durationMin = Math.max(1, Math.min(180, exam.quizDurationMinutes || 10));
    const now = Date.now();
    if (live) {
      const liveEnds = new Date(live.endsAt).getTime();
      if (liveEnds > now) {
        return {
          success: true as const,
          attempt: { id: live.id, startedAt: live.startedAt, endsAt: live.endsAt },
          quiz: stripQuizForCandidate(quiz),
          quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
          durationMinutes: durationMin,
          resumed: true,
          answers: live.answers || {},
        };
      }
      // Expired in-progress: finalize as expired — do NOT mint a second attempt.
      const liveIdx = store.finalExamAttempts.findIndex((a) => a.id === live.id);
      if (liveIdx >= 0) {
        store.finalExamAttempts[liveIdx] = {
          ...live,
          status: "expired",
          submittedAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        };
        scheduleDiskPersist();
      }
      return {
        success: false as const,
        error:
          "Your previous attempt timer already ended. Ask an instructor if a retake is allowed.",
      };
    }
    const startedAt = new Date(now).toISOString();
    const endsAt = new Date(now + durationMin * 60 * 1000).toISOString();
    const attempt: FinalExamAttempt = {
      id: `fea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      practicalExamId: exam.id,
      courseId: exam.courseId,
      quizId: quiz.id,
      pin: exam.joinPin || data.pin,
      rollNumber: student.rollNumber,
      studentName: student.name,
      phone: student.phone,
      regionId: student.regionId,
      regionName: student.regionName,
      startedAt,
      endsAt,
      status: "in_progress",
      answers: {},
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    store.finalExamAttempts.unshift(attempt);
    rebuildFinalAttemptIndex(store);
    scheduleDiskPersist();
    return {
      success: true as const,
      attempt: { id: attempt.id, startedAt, endsAt },
      quiz: stripQuizForCandidate(quiz),
      quizMaxMarks: exam.quizMaxMarks || FINAL_QUIZ_MARKS,
      durationMinutes: durationMin,
      resumed: false,
      answers: {},
    };
  });

/** Autosave Final Quiz answers during the overall countdown (industrial resume). */
export const serverSaveFinalQuizAnswers = createServerFn({ method: "POST" })
  .validator(
    (data: {
      attemptId: string;
      rollNumber: string;
      answers: Record<string, string[]>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    if (!store.finalExamAttempts) store.finalExamAttempts = [];
    const idx = findFinalAttemptIndex(store, data.attemptId);
    if (idx < 0) return { success: false as const, error: "Attempt not found." };
    const attempt = store.finalExamAttempts[idx]!;
    if (normalizeRollToken(attempt.rollNumber) !== normalizeRollToken(data.rollNumber)) {
      return { success: false as const, error: "Attempt does not match roll number." };
    }
    if (attempt.status !== "in_progress") {
      return { success: false as const, error: "Attempt is no longer editable." };
    }
    const nowIso = new Date().toISOString();
    store.finalExamAttempts[idx] = {
      ...attempt,
      answers: data.answers || {},
      updatedAt: nowIso,
    };
    rememberFinalAttemptIndex(data.attemptId, idx);
    // Defer disk rewrite — answer maps are hot under concurrent rooms.
    scheduleDiskPersist(5000);
    return {
      success: true as const,
      savedAt: nowIso,
      endsAt: attempt.endsAt,
    };
  });

export const serverSubmitFinalQuizAttempt = createServerFn({ method: "POST" })
  .validator(
    (data: {
      attemptId: string;
      pin: string;
      rollNumber: string;
      answers: Record<string, string[]>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    if (!store.finalExamAttempts) store.finalExamAttempts = [];
    const attemptIdx = findFinalAttemptIndex(store, data.attemptId);
    if (attemptIdx < 0) return { success: false as const, error: "Attempt not found." };
    const attempt = store.finalExamAttempts[attemptIdx]!;
    if (normalizeRollToken(attempt.rollNumber) !== normalizeRollToken(data.rollNumber)) {
      return { success: false as const, error: "Attempt does not match roll number." };
    }
    if (attempt.status === "submitted" || attempt.status === "graded") {
      return {
        success: true as const,
        alreadySubmitted: true,
        accuracyPct: attempt.accuracyPct ?? 0,
        quizMarks: attempt.quizMarks ?? 0,
        quizMaxMarks: attempt.quizMaxMarks || FINAL_QUIZ_MARKS,
        correctCount: attempt.correctCount ?? 0,
        incorrectCount: attempt.incorrectCount ?? 0,
        unansweredCount: attempt.unansweredCount ?? 0,
      };
    }
    const exam = (store.practicalExams || []).find((e) => e.id === attempt.practicalExamId);
    const quiz = resolveQuizForFinalExam(store, attempt.quizId || exam?.linkedQuizId);
    if (!quiz?.questions?.length) {
      return { success: false as const, error: "Quiz missing for grading." };
    }
    const now = Date.now();
    const ended = new Date(attempt.endsAt).getTime() < now - 5000; // 5s grace
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    for (const q of quiz.questions) {
      const selected = data.answers[q.id] || [];
      if (!selected.length) {
        unanswered += 1;
        continue;
      }
      const graded = evaluateQuestionAnswer({
        question: q,
        selectedOptionIds: selected,
        writtenAnswer: "",
        currentStreak: 0,
        timeTakenSec: 0,
        speedBonus: false,
        negativeMarking: 0,
      });
      if (graded.isCorrect) correct += 1;
      else incorrect += 1;
    }
    const totalQ = quiz.questions.length;
    const accuracyPct = totalQ > 0 ? Math.round((correct / totalQ) * 1000) / 10 : 0;
    const quizMax = exam?.quizMaxMarks || FINAL_QUIZ_MARKS;
    const quizMarks = marksFromPct(accuracyPct, quizMax);
    const threshold = resolvePassThresholdPct({
      sessionThreshold: exam?.passThresholdPct,
      courseThreshold: store.courses.find((c) => c.id === attempt.courseId)?.passThresholdPct,
      brandingDefaultThreshold: store.branding?.defaultPassThresholdPct,
    });
    const passed = isPassingScore(accuracyPct, threshold);
    const submittedAt = new Date().toISOString();
    const sessionId = `fes-${attempt.id}`;
    const resultId = `fer-${attempt.id}`;
    const session: ExamSessionRecord = {
      id: sessionId,
      pin: attempt.pin,
      quizId: quiz.id,
      quizTitleEn: quiz.titleEn,
      quizTitleBn: quiz.titleBn,
      hostId: "final-exam-desk",
      totalQuestions: totalQ,
      participantCount: 1,
      averageScore: quizMarks,
      highestScore: quizMarks,
      passThresholdPct: threshold,
      createdAt: attempt.startedAt,
    };
    const result: ExamResultRecord = {
      id: resultId,
      sessionId,
      pin: attempt.pin,
      participantId: `fp-${normalizeRollToken(attempt.rollNumber)}`,
      rollNumber: attempt.rollNumber,
      name: attempt.studentName,
      phone: attempt.phone,
      regionId: attempt.regionId,
      regionName: attempt.regionName,
      score: quizMarks,
      rank: 1,
      correctCount: correct,
      incorrectCount: incorrect,
      unattemptedCount: unanswered,
      accuracyPct,
      passed,
      answersJson: JSON.stringify(data.answers),
      createdAt: submittedAt,
    };
    store.examSessions.unshift(session);
    store.examResults.unshift(result);
    store.finalExamAttempts[attemptIdx] = {
      ...attempt,
      status: ended ? "expired" : "submitted",
      submittedAt,
      answers: data.answers,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      accuracyPct,
      quizMarks,
      quizMaxMarks: quizMax,
      resultId,
      sessionId,
      updatedAt: submittedAt,
    };
    // Normalize expired-but-auto-submitted to submitted for certificate eligibility.
    if (store.finalExamAttempts[attemptIdx]!.status === "expired") {
      store.finalExamAttempts[attemptIdx]!.status = "submitted";
    }
    rememberFinalAttemptIndex(data.attemptId, attemptIdx);
    scheduleDiskPersist();
    return {
      success: true as const,
      alreadySubmitted: false,
      accuracyPct,
      quizMarks,
      quizMaxMarks: quizMax,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      passed,
      timedOut: ended,
    };
  });

export const serverOpenFinalExamWindow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      examId: string;
      durationHours?: number | undefined;
      quizDurationMinutes?: number | undefined;
      regeneratePin?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.practicalExams) store.practicalExams = [];
    const idx = store.practicalExams.findIndex((e) => e.id === data.examId);
    if (idx < 0) return { success: false as const, error: "Exam not found." };
    const prev = store.practicalExams[idx]!;
    const hours = Math.max(0.5, Math.min(72, data.durationHours || 3));
    const quizMins = Math.max(1, Math.min(180, data.quizDurationMinutes || prev.quizDurationMinutes || 10));
    const now = new Date();
    const opensAt = now.toISOString();
    const closesAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
    const upgraded = upgradeFinalExamPackage(prev);
    const exam: PracticalExam = {
      ...upgraded,
      status: "open",
      opensAt,
      closesAt,
      quizWindowOpen: true,
      practicalWindowOpen: true,
      quizDurationMinutes: quizMins,
      joinPin:
        data.regeneratePin || !upgraded.joinPin
          ? generateFinalExamJoinPin()
          : upgraded.joinPin,
      updatedAt: opensAt,
    };
    store.practicalExams[idx] = exam;
    scheduleDiskPersist();
    return { success: true as const, exam };
  });

/** Staff live desk: exam window + quiz attempts (answers stripped). */
export const serverGetFinalExamDesk = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId?: string | undefined;
      examId?: string | undefined;
      /** When false, skip full quiz paper (poll path). Default true. */
      includeQuiz?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureFinalPracticalSeeded(store);
    let exam = (store.practicalExams || []).find((e) =>
      data.examId ? e.id === data.examId : data.courseId ? e.courseId === data.courseId : false,
    );
    if (!exam && data.courseId) {
      const course = store.courses.find((c) => c.id === data.courseId);
      if (course) {
        exam = buildDefaultFinalPracticalExam(course);
        store.practicalExams = store.practicalExams || [];
        store.practicalExams.unshift(exam);
        scheduleDiskPersist();
      }
    }
    if (!exam) return { success: false as const, error: "Final exam not found for this course." };
    const attempts = (store.finalExamAttempts || [])
      .filter((a) => a.practicalExamId === exam!.id)
      .map(({ answers: _a, ...rest }) => rest)
      .sort((a, b) => (b.updatedAt || b.startedAt || "").localeCompare(a.updatedAt || a.startedAt || ""));
    const course = store.courses.find((c) => c.id === exam!.courseId);
    const includeQuiz = data.includeQuiz !== false;
    const quiz = includeQuiz ? resolveQuizForFinalExam(store, exam.linkedQuizId) : null;
    const nowIso = new Date().toISOString();
    const practicalByRoll = new Map<string, { status: string; practicalScorePct?: number | undefined }>();
    for (const sub of store.practicalSubmissions || []) {
      if (sub.practicalExamId !== exam.id && sub.courseId !== exam.courseId) continue;
      practicalByRoll.set(normalizeRollToken(sub.rollNumber), {
        status: sub.status,
        practicalScorePct: sub.practicalScorePct,
      });
    }
    const attemptsWithPractical = attempts.map((a) => {
      const p = practicalByRoll.get(normalizeRollToken(a.rollNumber));
      return {
        ...a,
        practicalStatus: p?.status || "none",
        practicalScorePct: p?.practicalScorePct,
      };
    });
    return {
      success: true as const,
      exam,
      course: course
        ? { id: course.id, code: course.code, titleEn: course.titleEn, titleBn: course.titleBn }
        : null,
      /** Full paper for staff projector / screen-share (includes isCorrect for optional reveal). */
      quiz:
        includeQuiz && quiz
          ? {
              id: quiz.id,
              titleEn: quiz.titleEn,
              titleBn: quiz.titleBn,
              quizNumber: quiz.quizNumber,
              questions: (quiz.questions || []).map((q) => ({
                id: q.id,
                textEn: q.textEn,
                textBn: q.textBn,
                type: q.type,
                timeLimitSec: q.timeLimitSec,
                options: (q.options || []).map((o) => ({
                  id: o.id,
                  textEn: o.textEn,
                  textBn: o.textBn,
                  isCorrect: !!o.isCorrect,
                })),
              })),
            }
          : null,
      attempts: attemptsWithPractical,
      windowOpen: isFinalExamJoinWindowOpen(exam, nowIso),
      nowIso,
      joinPath: "/final-exam",
      counts: {
        total: attempts.length,
        inProgress: attempts.filter((a) => a.status === "in_progress").length,
        submitted: attempts.filter(
          (a) => a.status === "submitted" || a.status === "graded" || a.status === "expired",
        ).length,
        practicalSubmitted: attemptsWithPractical.filter((a) => a.practicalStatus !== "none").length,
      },
    };
  });

export const serverCloseFinalExamWindow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      examId: string;
      /** Default: close quiz join only — keep practical open for Part B. */
      alsoClosePractical?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const idx = (store.practicalExams || []).findIndex((e) => e.id === data.examId);
    if (idx < 0) return { success: false as const, error: "Exam not found." };
    const prev = store.practicalExams![idx]!;
    const now = new Date().toISOString();
    const closePractical = data.alsoClosePractical === true;
    const exam: PracticalExam = {
      ...prev,
      quizWindowOpen: false,
      practicalWindowOpen: closePractical ? false : prev.practicalWindowOpen !== false,
      // Keep status open if practical still accepting work so portal Part B works.
      status: closePractical ? "closed" : prev.status === "draft" ? "open" : prev.status,
      closesAt: closePractical ? now : prev.closesAt,
      updatedAt: now,
    };
    store.practicalExams![idx] = exam;
    scheduleDiskPersist();
    return { success: true as const, exam };
  });

/** Staff: extend an in-progress Final Exam attempt timer by N minutes. */
export const serverExtendFinalExamAttempt = createServerFn({ method: "POST" })
  .validator(
    (data: {
      attemptId: string;
      extraMinutes: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const extra = Math.max(1, Math.min(120, Math.floor(Number(data.extraMinutes) || 0)));
    if (!extra) {
      return { success: false as const, error: "extraMinutes must be a positive number." };
    }
    const store = getStore();
    const attempts = store.finalExamAttempts || [];
    const idx = attempts.findIndex((a) => a.id === data.attemptId);
    if (idx < 0) return { success: false as const, error: "Attempt not found." };
    const prev = attempts[idx]!;
    if (prev.status !== "in_progress") {
      return { success: false as const, error: "Only in-progress attempts can be extended." };
    }
    const baseMs = prev.endsAt ? new Date(prev.endsAt).getTime() : Date.now();
    const from = Number.isFinite(baseMs) ? Math.max(baseMs, Date.now()) : Date.now();
    const endsAt = new Date(from + extra * 60_000).toISOString();
    const updated = {
      ...prev,
      endsAt,
      updatedAt: new Date().toISOString(),
    };
    attempts[idx] = updated;
    store.finalExamAttempts = attempts;
    scheduleDiskPersist();
    return { success: true as const, attempt: updated };
  });

/** Admin-only: reset every admin → admin123, every instructor → instructor123. */
export const serverResetAllStaffPasswords = createServerFn({ method: "POST" })
  .validator((data: { confirm?: string | undefined } = {}) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false as const, error: "Super Admin authentication required." };
    }
    if ((data.confirm || "").trim().toUpperCase() !== "RESET") {
      return {
        success: false as const,
        error: 'Type RESET to confirm bulk staff password reset.',
      };
    }
    const store = getStore();
    const summary = resetAllStaffPasswordsInStore(store);
    store.staffPasswordsResetV1 = true;
    scheduleDiskPersist();
    return {
      success: true as const,
      ...summary,
      adminPassword: DEFAULT_ADMIN_PASSWORD,
      instructorPassword: DEFAULT_INSTRUCTOR_PASSWORD,
    };
  });

// ============================================================================
// LMS — materials, recordings, announcements, AI course tutor
// ============================================================================

export const serverSaveCourseMaterial = createServerFn({ method: "POST" })
  .validator((data: { material: CourseMaterial }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.courseMaterials) store.courseMaterials = [];
    const now = new Date().toISOString();
    const incoming = {
      ...data.material,
      id: data.material.id || newLmsId("mat"),
      updatedAt: now,
      createdAt: data.material.createdAt || now,
    };
    const idx = store.courseMaterials.findIndex((m) => m.id === incoming.id);
    if (idx >= 0) {
      const existing = store.courseMaterials[idx]!;
      store.courseMaterials[idx] = {
        ...incoming,
        resources: incoming.resources !== undefined ? incoming.resources : existing.resources,
      };
    } else store.courseMaterials.unshift(incoming);
    scheduleDiskPersist();
    return { success: true as const, material: incoming };
  });

export const serverDeleteCourseMaterial = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    store.courseMaterials = (store.courseMaterials || []).filter((m) => m.id !== data.id);
    scheduleDiskPersist();
    return { success: true as const };
  });

export const serverSaveCourseRecording = createServerFn({ method: "POST" })
  .validator((data: { recording: CourseRecording }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.courseRecordings) store.courseRecordings = [];
    const now = new Date().toISOString();
    const incoming = {
      ...data.recording,
      id: data.recording.id || newLmsId("rec"),
      updatedAt: now,
      createdAt: data.recording.createdAt || now,
    };
    const idx = store.courseRecordings.findIndex((m) => m.id === incoming.id);
    if (idx >= 0) store.courseRecordings[idx] = incoming;
    else store.courseRecordings.unshift(incoming);
    scheduleDiskPersist();
    return { success: true as const, recording: incoming };
  });

export const serverDeleteCourseRecording = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    store.courseRecordings = (store.courseRecordings || []).filter((m) => m.id !== data.id);
    scheduleDiskPersist();
    return { success: true as const };
  });

export const serverSaveCourseAnnouncement = createServerFn({ method: "POST" })
  .validator((data: { announcement: CourseAnnouncement }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    if (!store.courseAnnouncements) store.courseAnnouncements = [];
    const now = new Date().toISOString();
    const incoming = {
      ...data.announcement,
      id: data.announcement.id || newLmsId("ann"),
      updatedAt: now,
      createdAt: data.announcement.createdAt || now,
    };
    const idx = store.courseAnnouncements.findIndex((m) => m.id === incoming.id);
    if (idx >= 0) store.courseAnnouncements[idx] = incoming;
    else store.courseAnnouncements.unshift(incoming);
    scheduleDiskPersist();
    return { success: true as const, announcement: incoming };
  });

export const serverAskCourseTutor = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId: string;
      question: string;
      rollNumber?: string | undefined;
      lang?: "en" | "bn" | undefined;
      mode?: TutorStudyMode | undefined;
      history?: TutorHistoryTurn[] | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const store = getStore();
    ensureLmsContentSeeded(store);
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error:
          "AI Tutor is offline. Admin must add an AI provider (OpenRouter, Gemini, OpenAI, Claude, Groq, etc.) in Admin → AI Pool.",
      };
    }
    const course = store.courses.find((c) => c.id === data.courseId);
    const kbEntries = (store.courseKnowledgeBase || []).filter(
      (k) => k.courseId === data.courseId && k.enabled,
    );
    const materials = (store.courseMaterials || []).filter(
      (m) => m.courseId === data.courseId && m.published,
    );
    const recordings = (store.courseRecordings || []).filter(
      (r) => r.courseId === data.courseId && r.published,
    );
    const announcements = (store.courseAnnouncements || []).filter(
      (a) => a.courseId === data.courseId && a.published,
    );
    const practicalExam = (store.practicalExams || []).find((e) => e.courseId === data.courseId);
    const retrieved = retrieveCourseKnowledgeContext({
      course,
      kbEntries,
      materials,
      recordings,
      announcements,
      practicalExam,
      query: data.question,
    });
    const fallbackContext =
      retrieved.context.trim() ||
      buildAiTutorContext({
        materials,
        courseTitle: course?.titleEn,
      });
    try {
      const res = await askCourseTutorViaAiPool(
        pool,
        {
          question: data.question,
          context: fallbackContext,
          lang: data.lang,
          mode: data.mode,
          history: data.history,
          actorName: data.rollNumber ? `Student ${data.rollNumber}` : "Student Portal",
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      return {
        success: true as const,
        answer: res.answer,
        model: res.model,
        provider: res.provider,
        nodeLabel: res.nodeLabel,
        latencyMs: res.latencyMs,
        sourcesUsed: retrieved.sourcesUsed,
      };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI tutor failed.",
      };
    }
  });

// ============================================================================
// MULTI-PROVIDER AI POOL MANAGEMENT & INSTITUTIONAL AI COPILOTS
// ============================================================================

export const serverGetAiPoolConfig = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await getActorFromRequest();
  if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
    return { success: false as const, error: "Staff authentication required." };
  }
  const store = getStore();
  const pool = ensureStoreAiPool(store);
  return {
    success: true as const,
    role: actor.role,
    config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
  };
});

export const serverSaveAiPoolPolicy = createServerFn({ method: "POST" })
  .validator(
    (data: {
      strategy?: AiPoolRoutingStrategy | undefined;
      cooldownSeconds?: number | undefined;
      maxFailoverAttempts?: number | undefined;
      defaultTimeoutMs?: number | undefined;
      taskPreferredNodeIds?: Partial<Record<AiTaskCapability, string>> | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false as const, error: "Super Admin access required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    if (data.strategy) pool.strategy = data.strategy;
    if (typeof data.cooldownSeconds === "number" && Number.isFinite(data.cooldownSeconds)) {
      pool.cooldownSeconds = Math.min(600, Math.max(10, Math.round(data.cooldownSeconds)));
    }
    if (
      typeof data.maxFailoverAttempts === "number" &&
      Number.isFinite(data.maxFailoverAttempts)
    ) {
      pool.maxFailoverAttempts = Math.min(12, Math.max(1, Math.round(data.maxFailoverAttempts)));
    }
    if (typeof data.defaultTimeoutMs === "number" && Number.isFinite(data.defaultTimeoutMs)) {
      pool.defaultTimeoutMs = Math.min(120_000, Math.max(5_000, Math.round(data.defaultTimeoutMs)));
    }
    if (data.taskPreferredNodeIds && typeof data.taskPreferredNodeIds === "object") {
      const cleaned: Partial<Record<AiTaskCapability, string>> = {};
      for (const [k, v] of Object.entries(data.taskPreferredNodeIds)) {
        if (v && typeof v === "string" && v.trim()) {
          cleaned[k as AiTaskCapability] = v.trim();
        }
      }
      pool.taskPreferredNodeIds = cleaned;
    }
    pool.updatedAt = new Date().toISOString();
    scheduleDiskPersist();
    return {
      success: true as const,
      config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
    };
  });

export const serverUpsertAiPoolNode = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string | undefined;
      label: string;
      provider: AiProviderId;
      apiKey?: string | undefined;
      baseUrl?: string | undefined;
      model: string;
      fallbackModels?: string[] | undefined;
      enabled?: boolean | undefined;
      priority?: number | undefined;
      weight?: number | undefined;
      capabilities?: AiTaskCapability[] | undefined;
      temperature?: number | undefined;
      maxTokens?: number | undefined;
      timeoutMs?: number | undefined;
      notes?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false as const, error: "Super Admin access required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    const provider: AiProviderId =
      data.provider in AI_PROVIDER_CATALOG ? data.provider : "openrouter";
    const preset = AI_PROVIDER_CATALOG[provider];
    const nowIso = new Date().toISOString();

    const existingIdx = data.id ? pool.nodes.findIndex((n) => n.id === data.id) : -1;
    const existing = existingIdx >= 0 ? pool.nodes[existingIdx] : undefined;

    const incomingKey = (data.apiKey || "").trim();
    const resolvedKey = incomingKey || existing?.apiKey || "";
    if (!resolvedKey && !preset.supportsKeyless) {
      return {
        success: false as const,
        error: `An API key is required for ${preset.name}.`,
      };
    }

    const cleanModel = (data.model || preset.defaultModel).trim();
    if (!cleanModel) {
      return { success: false as const, error: "Model ID is required." };
    }

    const nextNode: AiPoolNode = {
      id: existing?.id || `ainode-${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: (data.label || `${preset.name} (${cleanModel})`).trim(),
      provider,
      apiKey: resolvedKey,
      baseUrl: (data.baseUrl || preset.defaultBaseUrl).trim(),
      model: cleanModel,
      fallbackModels: Array.isArray(data.fallbackModels)
        ? data.fallbackModels.map((m) => m.trim()).filter(Boolean)
        : existing?.fallbackModels,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : existing?.enabled ?? true,
      priority:
        typeof data.priority === "number" && Number.isFinite(data.priority)
          ? Math.max(1, Math.round(data.priority))
          : existing?.priority ?? pool.nodes.length + 1,
      weight:
        typeof data.weight === "number" && Number.isFinite(data.weight)
          ? Math.min(100, Math.max(1, Math.round(data.weight)))
          : existing?.weight ?? 10,
      capabilities:
        Array.isArray(data.capabilities) && data.capabilities.length > 0
          ? data.capabilities
          : undefined,
      temperature: typeof data.temperature === "number" ? data.temperature : existing?.temperature,
      maxTokens: typeof data.maxTokens === "number" ? data.maxTokens : existing?.maxTokens,
      timeoutMs: typeof data.timeoutMs === "number" ? data.timeoutMs : existing?.timeoutMs,
      notes: data.notes !== undefined ? data.notes.trim() || undefined : existing?.notes,
      status: incomingKey ? "untested" : existing?.status || "untested",
      cooldownUntil: incomingKey ? undefined : existing?.cooldownUntil,
      lastLatencyMs: existing?.lastLatencyMs,
      avgLatencyMs: existing?.avgLatencyMs,
      totalRequests: existing?.totalRequests || 0,
      totalFailures: existing?.totalFailures || 0,
      totalInputTokens: existing?.totalInputTokens || 0,
      totalOutputTokens: existing?.totalOutputTokens || 0,
      lastSuccessAt: existing?.lastSuccessAt,
      lastErrorAt: existing?.lastErrorAt,
      lastError: incomingKey ? undefined : existing?.lastError,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      pool.nodes[existingIdx] = nextNode;
    } else {
      pool.nodes.push(nextNode);
    }
    pool.nodes.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    pool.updatedAt = nowIso;
    scheduleDiskPersist();

    return {
      success: true as const,
      nodeId: nextNode.id,
      config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
    };
  });

export const serverDeleteAiPoolNode = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || actor.role !== "admin") {
      return { success: false as const, error: "Super Admin access required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    pool.nodes = pool.nodes.filter((n) => n.id !== data.id);
    if (pool.taskPreferredNodeIds) {
      for (const [k, v] of Object.entries(pool.taskPreferredNodeIds)) {
        if (v === data.id) {
          delete pool.taskPreferredNodeIds[k as AiTaskCapability];
        }
      }
    }
    pool.updatedAt = new Date().toISOString();
    scheduleDiskPersist();
    return {
      success: true as const,
      config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
    };
  });

export const serverTestAiPoolNode = createServerFn({ method: "POST" })
  .validator((data: { nodeId?: string | undefined; testAll?: boolean | undefined }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    const effective = buildEffectivePoolNodes(pool, store.serverGeminiApiKey);
    const targets = data.testAll
      ? effective.filter((n) => n.enabled)
      : effective.filter((n) => n.id === data.nodeId);

    if (targets.length === 0) {
      return { success: false as const, error: "No matching AI pool node found to test." };
    }

    const results: Array<{
      nodeId: string;
      label: string;
      provider: AiProviderId;
      model: string;
      ok: boolean;
      latencyMs: number;
      reply?: string | undefined;
      error?: string | undefined;
    }> = [];

    for (const target of targets) {
      const ping = await pingAiPoolNode(target);
      const persisted = pool.nodes.find((n) => n.id === target.id);
      if (persisted) {
        persisted.lastLatencyMs = ping.latencyMs;
        if (ping.ok) {
          persisted.status = "healthy";
          persisted.cooldownUntil = undefined;
          persisted.lastSuccessAt = new Date().toISOString();
          persisted.lastError = undefined;
          persisted.avgLatencyMs = persisted.avgLatencyMs
            ? Math.round(persisted.avgLatencyMs * 0.6 + ping.latencyMs * 0.4)
            : ping.latencyMs;
        } else {
          persisted.status = "error";
          persisted.lastErrorAt = new Date().toISOString();
          persisted.lastError = ping.error || "Health check failed";
        }
        persisted.updatedAt = new Date().toISOString();
      }
      results.push({
        nodeId: target.id,
        label: target.label,
        provider: target.provider,
        model: ping.model,
        ok: ping.ok,
        latencyMs: ping.latencyMs,
        reply: ping.reply,
        error: ping.error,
      });
    }

    scheduleDiskPersist();
    return {
      success: true as const,
      results,
      config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
    };
  });

export const serverResetAiPoolTelemetry = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await getActorFromRequest();
  if (!actor || actor.role !== "admin") {
    return { success: false as const, error: "Super Admin access required." };
  }
  const store = getStore();
  const pool = ensureStoreAiPool(store);
  for (const node of pool.nodes) {
    node.cooldownUntil = undefined;
    if (node.status === "cooldown" || node.status === "error") {
      node.status = "untested";
    }
    node.lastError = undefined;
    node.totalRequests = 0;
    node.totalFailures = 0;
    node.totalInputTokens = 0;
    node.totalOutputTokens = 0;
  }
  pool.logs = [];
  pool.updatedAt = new Date().toISOString();
  scheduleDiskPersist();
  return {
    success: true as const,
    config: sanitizeAiPoolConfig(pool, store.serverGeminiApiKey),
  };
});

export const serverAiSuggestPracticalGrade = createServerFn({ method: "POST" })
  .validator(
    (data: { submissionId: string; preferredNodeId?: string | undefined }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error: "No AI provider configured. Add OpenRouter, Gemini, OpenAI, or Claude in Admin → AI Pool.",
      };
    }
    const submission = (store.practicalSubmissions || []).find((s) => s.id === data.submissionId);
    if (!submission) {
      return { success: false as const, error: "Practical submission not found." };
    }
    const exam = (store.practicalExams || []).find((e) => e.id === submission.practicalExamId);
    if (!exam) {
      return { success: false as const, error: "Associated practical exam not found." };
    }
    try {
      const suggestion = await suggestPracticalGradeViaAiPool(
        pool,
        {
          exam,
          submission,
          preferredNodeId: data.preferredNodeId,
          actorName: actor.name,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      return { success: true as const, suggestion };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI practical grading suggestion failed.",
      };
    }
  });

export const serverAiDraftLmsContent = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId: string;
      kind: "material" | "announcement";
      topic: string;
      sessionLabel?: string | undefined;
      extraNotes?: string | undefined;
      preferredNodeId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error: "No AI provider configured. Add OpenRouter, Gemini, OpenAI, or Claude in Admin → AI Pool.",
      };
    }
    const course = store.courses.find((c) => c.id === data.courseId);
    try {
      const draft = await draftLmsContentViaAiPool(
        pool,
        {
          kind: data.kind,
          topic: data.topic,
          courseTitle: course?.titleEn,
          sessionLabel: data.sessionLabel,
          extraNotes: data.extraNotes,
          preferredNodeId: data.preferredNodeId,
          actorName: actor.name,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      return { success: true as const, draft };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI LMS drafting failed.",
      };
    }
  });

export const serverAiAnalyzeExamSession = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      preferredNodeId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error: "No AI provider configured. Add OpenRouter, Gemini, OpenAI, or Claude in Admin → AI Pool.",
      };
    }
    const session = store.examSessions.find(
      (s) => s.id === data.sessionId || s.pin === data.sessionId,
    );
    if (!session) {
      return { success: false as const, error: "Exam session not found." };
    }
    const results = store.examResults.filter(
      (r) => r.sessionId === session.id || r.pin === session.pin,
    );
    if (results.length === 0) {
      return {
        success: false as const,
        error: "This session has no candidate results yet to analyze.",
      };
    }
    const passThresholdPct =
      session.passThresholdPct ?? store.branding.defaultPassThresholdPct ?? 40;
    try {
      const report = await analyzeExamSessionViaAiPool(
        pool,
        {
          session,
          results,
          passThresholdPct,
          preferredNodeId: data.preferredNodeId,
          actorName: actor.name,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      return { success: true as const, report };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI cohort diagnostic failed.",
      };
    }
  });

// ============================================================================
// DEDICATED PER-COURSE KNOWLEDGE BASE CRUD & GLOBAL FLOATING AI ASSISTANT
// ============================================================================

export const serverGetCourseKnowledgeBase = createServerFn({ method: "GET" })
  .validator((data: { courseId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureLmsContentSeeded(store);
    const all = store.courseKnowledgeBase || [];
    const entries = data.courseId ? all.filter((e) => e.courseId === data.courseId) : all;
    entries.sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    );
    return {
      success: true as const,
      entries,
    };
  });

export const serverSaveCourseKnowledgeEntry = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string | undefined;
      courseId: string;
      titleEn: string;
      titleBn?: string | undefined;
      category: CourseKnowledgeCategory;
      content: string;
      tags?: string[] | undefined;
      sourceFileName?: string | undefined;
      enabled?: boolean | undefined;
      pinned?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const cleanTitle = (data.titleEn || "").trim();
    const cleanContent = (data.content || "").trim();
    if (!data.courseId || !cleanTitle || cleanContent.length < 10) {
      return {
        success: false as const,
        error: "Course, title, and knowledge content (at least 10 characters) are required.",
      };
    }

    const store = getStore();
    ensureLmsContentSeeded(store);
    if (!store.courseKnowledgeBase) store.courseKnowledgeBase = [];
    const nowIso = new Date().toISOString();
    const idx = data.id ? store.courseKnowledgeBase.findIndex((e) => e.id === data.id) : -1;
    const prev = idx >= 0 ? store.courseKnowledgeBase[idx] : undefined;

    const next: CourseKnowledgeEntry = {
      id: prev?.id || newLmsId("kb"),
      courseId: data.courseId,
      titleEn: cleanTitle,
      titleBn: data.titleBn?.trim() || undefined,
      category: data.category || "reference",
      content: cleanContent.slice(0, 60_000),
      tags: Array.isArray(data.tags)
        ? data.tags.map((t) => t.trim()).filter(Boolean).slice(0, 12)
        : prev?.tags,
      sourceFileName: data.sourceFileName?.trim() || prev?.sourceFileName,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : prev?.enabled ?? true,
      pinned: data.pinned !== undefined ? Boolean(data.pinned) : prev?.pinned ?? false,
      createdBy: prev?.createdBy || actor.name,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (idx >= 0) {
      store.courseKnowledgeBase[idx] = next;
    } else {
      store.courseKnowledgeBase.unshift(next);
    }
    scheduleDiskPersist();
    return { success: true as const, entry: next };
  });

export const serverDeleteCourseKnowledgeEntry = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    store.courseKnowledgeBase = (store.courseKnowledgeBase || []).filter((e) => e.id !== data.id);
    scheduleDiskPersist();
    return { success: true as const };
  });

export const serverAiGenerateCourseKbEntry = createServerFn({ method: "POST" })
  .validator(
    (data: {
      courseId: string;
      topic: string;
      category: CourseKnowledgeCategory;
      rawNotes?: string | undefined;
      pinned?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false as const, error: "Staff authentication required." };
    }
    const store = getStore();
    ensureLmsContentSeeded(store);
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error: "No AI provider configured in Admin → AI Pool.",
      };
    }
    const course = store.courses.find((c) => c.id === data.courseId);
    try {
      const draft = await draftLmsContentViaAiPool(
        pool,
        {
          kind: "material",
          topic: data.topic,
          courseTitle: course?.titleEn,
          sessionLabel: `Course KB (${data.category})`,
          extraNotes: data.rawNotes,
          actorName: actor.name,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      const nowIso = new Date().toISOString();
      const entry: CourseKnowledgeEntry = {
        id: newLmsId("kb"),
        courseId: data.courseId,
        titleEn: draft.titleEn,
        titleBn: draft.titleBn,
        category: data.category || "reference",
        content: [draft.bodyEn, draft.bodyBn ? `\n---\nবাংলা সারসংক্ষেপ:\n${draft.bodyBn}` : ""]
          .filter(Boolean)
          .join("\n"),
        tags: [data.category, "AI Generated"],
        enabled: true,
        pinned: Boolean(data.pinned),
        createdBy: `${actor.name} (via ${draft.provider})`,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      if (!store.courseKnowledgeBase) store.courseKnowledgeBase = [];
      store.courseKnowledgeBase.unshift(entry);
      scheduleDiskPersist();
      return {
        success: true as const,
        entry,
        provider: draft.provider,
        model: draft.model,
        latencyMs: draft.latencyMs,
      };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI Knowledge Base generation failed.",
      };
    }
  });

/**
 * Open to ALL students, visitors, and staff so the floating AI Assist widget everywhere
 * knows which dedicated Course Knowledge Bases are available for the current user.
 */
export const serverGetFloatingAiContext = createServerFn({ method: "GET" }).handler(async () => {
  const store = getStore();
  ensureLmsContentSeeded(store);
  const pool = ensureStoreAiPool(store);
  const online = hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey);

  const actor = await getActorFromRequest();
  const isStaff = Boolean(actor && (actor.role === "admin" || actor.role === "instructor"));
  const portalStudent = await getRosterStudentFromPortalCookie(store);

  // Signed-in students and staff can query every active course's dedicated KB;
  // anonymous visitors can query public courses + Onnesha Platform Support KB.
  const visibleCourses = store.courses.filter(
    (c) => c.status !== "archived" && (isStaff || Boolean(portalStudent) || !isCoursePrivate(c)),
  );

  const availableCourses = visibleCourses.map((c) => {
    const kbDocs = (store.courseKnowledgeBase || []).filter(
      (k) => k.courseId === c.id && k.enabled,
    ).length;
    const matDocs = (store.courseMaterials || []).filter(
      (m) => m.courseId === c.id && m.published,
    ).length;
    return {
      id: c.id,
      code: c.code,
      titleEn: c.titleEn,
      titleBn: c.titleBn,
      kbDocCount: kbDocs + matDocs,
      dedicatedKbCount: kbDocs,
    };
  });

  const defaultCourseId =
    availableCourses.find((c) => c.id === SANJIBON_COURSE.id)?.id ||
    availableCourses[0]?.id ||
    "platform";

  return {
    success: true as const,
    online,
    availableCourses,
    defaultCourseId,
    studentName: portalStudent?.name || actor?.name || undefined,
    studentRoll: portalStudent?.rollNumber || undefined,
    isStaff,
  };
});

/**
 * Universal Floating AI Support & Course Knowledge Base Assistant.
 * Available to ALL students, visitors, and staff across the platform.
 * Enforces strict academic integrity (refuses live exam answer requests).
 */
export const serverAskFloatingAiAssistant = createServerFn({ method: "POST" })
  .validator(
    (data: {
      question: string;
      courseId?: string | undefined;
      lang?: "en" | "bn" | undefined;
      mode?: TutorStudyMode | undefined;
      history?: TutorHistoryTurn[] | undefined;
      currentPath?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const cleanQ = (data.question || "").trim();
    if (cleanQ.length < 2) {
      return { success: false as const, error: "Please type a question first." };
    }
    if (cleanQ.length > 2000) {
      return { success: false as const, error: "Question is too long (max 2,000 characters)." };
    }

    const store = getStore();
    ensureLmsContentSeeded(store);
    const pool = ensureStoreAiPool(store);
    if (!hasAnyConfiguredAiProvider(pool, store.serverGeminiApiKey)) {
      return {
        success: false as const,
        error:
          "AI Assistant is currently offline. Administrator needs to connect an AI provider (OpenRouter, Gemini, OpenAI, Claude, or Groq) in Admin → AI Pool.",
      };
    }

    const actor = await getActorFromRequest();
    const isStaff = Boolean(actor && (actor.role === "admin" || actor.role === "instructor"));
    const portalStudent = await getRosterStudentFromPortalCookie(store);

    const requestedCourseId = data.courseId?.trim();
    const targetCourse =
      requestedCourseId && requestedCourseId !== "platform"
        ? store.courses.find(
            (c) =>
              c.id === requestedCourseId &&
              c.status !== "archived" &&
              (isStaff || Boolean(portalStudent) || !isCoursePrivate(c)),
          )
        : undefined;

    let contextText: string;
    let sourcesUsed: Array<{ id: string; title: string; kind: string }> = [];
    let scopeLabel = "Onnesha Platform Support";

    if (targetCourse) {
      scopeLabel = `[${targetCourse.code}] ${targetCourse.titleEn}`;
      const kbEntries = (store.courseKnowledgeBase || []).filter(
        (k) => k.courseId === targetCourse.id && k.enabled,
      );
      const materials = (store.courseMaterials || []).filter(
        (m) => m.courseId === targetCourse.id && m.published,
      );
      const recordings = (store.courseRecordings || []).filter(
        (r) => r.courseId === targetCourse.id && r.published,
      );
      const announcements = (store.courseAnnouncements || []).filter(
        (a) => a.courseId === targetCourse.id && a.published,
      );
      const practicalExam = (store.practicalExams || []).find(
        (e) => e.courseId === targetCourse.id,
      );
      const retrieved = retrieveCourseKnowledgeContext({
        course: targetCourse,
        kbEntries,
        materials,
        recordings,
        announcements,
        practicalExam,
        query: cleanQ,
      });
      const platformCtx = buildPlatformSupportContext([targetCourse]);
      contextText = `${retrieved.context}\n\n${platformCtx}`;
      sourcesUsed = retrieved.sourcesUsed;
    } else {
      const publicCourses = store.courses.filter(
        (c) => c.status !== "archived" && (isStaff || Boolean(portalStudent) || !isCoursePrivate(c)),
      );
      contextText = buildPlatformSupportContext(publicCourses);
      sourcesUsed = [{ id: "platform-kb", title: "Onnesha Platform Support KB", kind: "platform" }];
    }

    const actorLabel = portalStudent
      ? `Student ${portalStudent.rollNumber}`
      : actor
        ? `${actor.role}: ${actor.name}`
        : `Visitor (${data.currentPath || "/"})`;

    try {
      const res = await askCourseTutorViaAiPool(
        pool,
        {
          question: cleanQ,
          context: contextText,
          lang: data.lang,
          mode: data.mode || "explain",
          history: data.history,
          actorName: actorLabel,
        },
        {
          legacyServerGeminiKey: store.serverGeminiApiKey,
          onMutate: () => scheduleDiskPersist(),
        },
      );
      return {
        success: true as const,
        answer: res.answer,
        scopeLabel,
        sourcesUsed,
        provider: res.provider,
        model: res.model,
        nodeLabel: res.nodeLabel,
        latencyMs: res.latencyMs,
      };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "AI Assistant failed to respond.",
      };
    }
  });

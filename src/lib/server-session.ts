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
  Quiz,
  Region,
  RosterStudent,
} from "./types";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "./branding";
import { purgeUnderThresholdExamsInStore, type PurgeExamSummary } from "./exam-purge";
import { generateQuizViaGeminiRest, resolveEnvGeminiApiKey } from "./ai-quiz-core";
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
  READY_MADE_PACKS,
  SAMPLE_ROSTER,
} from "./mock-data";
import {
  isCoursePrivate,
  isQuizPrivate,
  normalizeBdPhone,
  normalizeRollToken,
  SANJIBON_COURSE,
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
  purgedSampleData?: boolean | undefined;
  purgedUnder50Initial?: boolean | undefined;
  migratedSanjibonS03V2?: boolean | undefined;
  migratedSanjibonS05V4?: boolean | undefined;
  serverGeminiApiKey?: string | undefined;
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
  __onneshaAnchorCooldowns?: Record<string, number>;
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
            purgedSampleData: purged,
            purgedUnder50Initial: !!parsed.purgedUnder50Initial,
            migratedSanjibonS03V2: !!parsed.migratedSanjibonS03V2,
            migratedSanjibonS05V4: !!parsed.migratedSanjibonS05V4,
            serverGeminiApiKey: parsed.serverGeminiApiKey,
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
    deletedQuizIds: [],
    deletedRegionIds: [],
    deletedCourseIds: [],
    examSessions: [],
    examResults: [],
    certificates: [],
    revokedCertificates: [],
    revokedCertificateArchive: {},
    purgedSampleData: false,
    purgedUnder50Initial: true,
    migratedSanjibonS03V2: true,
    migratedSanjibonS05V4: true,
    ledgerCheckpoints: [],
    transactions: [],
    smsLogs: [],
    salesLeads: [],
    branding: { ...DEFAULT_BRANDING },
    updatedAt: Date.now(),
  });
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

// Debounced non-blocking atomic disk write (handles 500+ req/sec without I/O contention)
function scheduleDiskPersist() {
  ensureShutdownHooks();
  const store = getStore();
  store.updatedAt = Date.now();
  if (globalStore.__onneshaSaveBusy) {
    globalStore.__onneshaSaveDirty = true;
  }
  if (globalStore.__onneshaSaveTimer) return;

  globalStore.__onneshaSaveTimer = setTimeout(() => {
    globalStore.__onneshaSaveTimer = null;
    void flushStoreToDisk();
  }, 350);
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
  session: Pick<GameSession, "phase" | "currentQuestion">,
  questionId: string,
): boolean {
  return (
    (session.phase === "chart" || session.phase === "leaderboard") &&
    session.currentQuestion?.id === questionId
  );
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

  const mintedCertNumbers: string[] = [];
  const mintedCerts: CertificateData[] = [];
  const mintedCertUpper = new Set<string>();
  const dataDir = getStorePaths().dataDir;

  // Locate current ledger tail once so sealing N certificates runs in O(N) instead of O(N^2)
  let currentTailCert: CertificateData | undefined;
  for (const c of store.certificates) {
    if (typeof c.ledgerIndex === "number" && c.chainHash) {
      if (!currentTailCert || (c.ledgerIndex || 0) > (currentTailCert.ledgerIndex || 0)) {
        currentTailCert = c;
      }
    }
  }

  finalResultsForCerts.forEach((r, idx) => {
    const passed = !!r.passed;
    if (!passed) return;

    const roll = r.rollNumber || `2026-${100 + idx + 1}`;
    const humanRank = r.rank || idx + 1;
    const certNo = makeCertificateNumber(targetPin, roll, humanRank);
    const isRevoked = (store.revokedCertificates || []).some(
      (rc) => rc.toLowerCase() === certNo.toLowerCase(),
    );
    if (isRevoked) return;

    // Never re-sign or mutate an already-sealed certificate in the ledger (preserves Run 1 QR codes)
    const existingSealed = store.certificates.find(
      (c) =>
        c.certificateNumber.toLowerCase() === certNo.toLowerCase() &&
        !!c.cryptoSignature &&
        (!!retakeOrigSession ||
          (c.score === r.score && c.rank === humanRank && c.studentRoll === roll)),
    );
    if (existingSealed) return;

    const unsignedCert: CertificateData = {
      id: `cert-${targetPin}-${r.participantId || idx + 1}`,
      certificateNumber: certNo,
      studentName: r.name || `Candidate ${humanRank}`,
      studentRoll: roll,
      regionName: r.regionName || "Dhaka Range",
      quizTitle: session.quizTitleBn || session.quizTitleEn || "Institutional Assessment",
      score: r.score,
      marksObtained: r.score,
      totalPoints: totalMarks,
      totalMarks,
      rank: humanRank,
      totalParticipants: totalParticipantsForCerts,
      accuracyPercent: r.accuracyPct,
      scorePct: r.accuracyPct,
      issueDate: createdAt.slice(0, 10),
      organizationName: resolveOrgName(store.branding),
      institutionName: store.branding?.institutionTitle || "Onnesha Assessment Arena",
      instructorName: "Chief Assessment Officer",
      verificationUrl: `/verify/${certNo}`,
      verified: true,
    };

    const certRecord = sealCertificateWithLedger(
      unsignedCert,
      currentTailCert ? [currentTailCert] : [],
      dataDir,
    );
    if (typeof certRecord.ledgerIndex === "number" && certRecord.chainHash) {
      currentTailCert = certRecord;
    }

    mintedCerts.unshift(certRecord);
    mintedCertUpper.add(certNo.toUpperCase());
    mintedCertNumbers.push(certNo);
  });

  if (mintedCerts.length > 0) {
    store.certificates = [
      ...mintedCerts,
      ...store.certificates.filter((c) => !mintedCertUpper.has(c.certificateNumber.toUpperCase())),
    ];
  }

  scheduleDiskPersist();
  if (mintedCertNumbers.length > 0) {
    triggerBackgroundExternalAnchoring(mintedCertNumbers);
  }
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
  session.currentQuestionIndex = idx;
  session.currentQuestion = effectiveQuestion;
  session.pausedAt = undefined;
  session.questionStartTime = now;
  session.questionEndTime = now + effectiveLimit * 1000;
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
    p.score = Math.max(0, p.score + graded.pointsAwarded);
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
    hasServerGeminiKey: isStaff ? resolveServerGeminiApiKey(store).source !== "none" : false,
    examSessions: isStaff ? store.examSessions : [],
    examResults: isStaff ? store.examResults : [],
    certificates: isStaff ? store.certificates : [],
    revokedCertificates: isStaff ? store.revokedCertificates || [] : [],
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
    return { hasKey: false, source: "none" as const };
  }
  const store = getStore();
  const resolved = resolveServerGeminiApiKey(store);
  return {
    hasKey: resolved.source !== "none",
    source: resolved.source === "client" ? ("none" as const) : resolved.source,
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
      clientApiKey?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const actor = await getActorFromRequest();
    if (!actor || (actor.role !== "admin" && actor.role !== "instructor")) {
      return { success: false, quiz: null, error: "Instructor or Admin login required." };
    }

    const store = getStore();
    const { apiKey } = resolveServerGeminiApiKey(store, data.clientApiKey);
    if (!apiKey) {
      return { success: false, quiz: null, error: "GEMINI_API_KEY not configured on server" };
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
      const quiz = await generateQuizViaGeminiRest(apiKey, {
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
      });
      quiz.author = actor.name;

      return {
        success: true,
        quiz,
        remainingCredits: nextCredits,
      };
    } catch (err) {
      refundReservedCredit();
      const message =
        err instanceof Error && err.message ? err.message : "Gemini synthesis failed.";
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

    // Check if it matches a deterministic ONN-<PIN>-<ROLL> pattern backed by a passing exam result
    const match = rawCert.toUpperCase().match(/^ONN-([A-Z0-9]{4})-([A-Z0-9]{4,6})$/);
    if (!isRevoked && match && match[1] && match[2]) {
      const pinPrefix = match[1];
      const rollSuffix = match[2];
      const matchingResults = store.examResults.filter((r) => {
        const cleanRoll = (r.rollNumber || "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(-6)
          .padStart(4, "0");
        return r.pin.startsWith(pinPrefix) && cleanRoll === rollSuffix;
      });
      matchingResults.sort((a, b) => {
        const aPass = a.passed ? 1 : 0;
        const bPass = b.passed ? 1 : 0;
        if (bPass !== aPass) return bPass - aPass;
        return b.createdAt.localeCompare(a.createdAt);
      });
      const matchedResult = matchingResults[0];

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
        const matchedCourse = quizObj?.courseId
          ? store.courses.find((c) => c.id === quizObj.courseId)
          : undefined;
        const threshold = resolvePassThresholdPct({
          sessionThreshold: matchedSession?.passThresholdPct,
          courseThreshold: matchedCourse?.passThresholdPct,
          brandingDefaultThreshold: store.branding?.defaultPassThresholdPct,
        });
        const didPass =
          typeof matchedResult.passed === "boolean"
            ? matchedResult.passed
            : isPassingScore(matchedResult.accuracyPct, threshold);

        if (didPass) {
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
    }

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
      hasServerGeminiKey: resolveServerGeminiApiKey(store).source !== "none",
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
    } else if (
      session.phase === "chart" &&
      session.phaseEndsAt &&
      Date.now() >= session.phaseEndsAt - 150
    ) {
      const delays = splitBetweenQuestionDelays(session.settings.betweenQuestionSec);
      const lbSec = delays.enabled ? delays.leaderboardSec : 0;
      session.phase = "leaderboard";
      session.phaseEndsAt = lbSec > 0 ? Date.now() + lbSec * 1000 : undefined;
      recalculateSessionMetrics(session);
      scheduleLiveSessionsPersist();
    } else if (
      session.phase === "leaderboard" &&
      session.phaseEndsAt &&
      Date.now() >= session.phaseEndsAt - 150
    ) {
      session.phaseEndsAt = undefined;
      advanceSessionToQuestion(session, store);
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

    existing.phase = data.session.phase;
    existing.currentQuestionIndex = data.session.currentQuestionIndex;
    if (data.session.currentQuestion) {
      existing.currentQuestion = data.session.currentQuestion;
    }
    existing.questionStartTime = data.session.questionStartTime;
    existing.questionEndTime = data.session.questionEndTime;
    existing.pausedAt = data.session.pausedAt;
    existing.settings = { ...existing.settings, ...data.session.settings };
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

    // Support offline-queued answers with fair timestamp clamping & sub-second speed precision
    const effectiveTimestamp = data.clientAnsweredAt
      ? Math.max(
          session.questionStartTime || Date.now(),
          Math.min(Date.now(), data.clientAnsweredAt),
        )
      : Date.now();
    const elapsedSec =
      (effectiveTimestamp - (session.questionStartTime || effectiveTimestamp)) / 1000;
    const clampedElapsed = Math.max(0.1, Math.min(effectiveLimit, elapsedSec));
    const timeTakenSec = Math.round(clampedElapsed * 100) / 100;

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
    p.score = Math.max(0, p.score + graded.pointsAwarded);
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
        if (
          typeof data.questionIndex === "number" &&
          data.questionIndex === 0 &&
          session.currentQuestionIndex >= 0
        ) {
          break;
        }
        session.pausedAt = undefined;
        advanceSessionToQuestion(session, store, data.questionIndex);
        break;
      }
      case "show_chart": {
        session.pausedAt = undefined;
        session.phase = "chart";
        const delays = splitBetweenQuestionDelays(session.settings.betweenQuestionSec);
        const chartSec = delays.enabled ? delays.chartSec : 0;
        session.phaseEndsAt = chartSec > 0 ? Date.now() + chartSec * 1000 : undefined;
        recalculateSessionMetrics(session);
        break;
      }
      case "show_leaderboard": {
        session.pausedAt = undefined;
        session.phase = "leaderboard";
        const delays = splitBetweenQuestionDelays(session.settings.betweenQuestionSec);
        const lbSec = delays.enabled ? delays.leaderboardSec : 0;
        session.phaseEndsAt = lbSec > 0 ? Date.now() + lbSec * 1000 : undefined;
        recalculateSessionMetrics(session);
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
      case "end_game": {
        session.pausedAt = undefined;
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

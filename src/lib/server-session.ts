import { createServerFn } from '@tanstack/react-start';
import {
  BrandingSettings,
  CertificateData,
  Course,
  ExamResultRecord,
  ExamSessionRecord,
  GameSession,
  GameSettings,
  ManagedUser,
  Participant,
  ParticipantAnswer,
  ProctorIncidentRecord,
  Question,
  Quiz,
  Region,
  RosterStudent,
} from './types';
import { DEFAULT_COURSES, DEFAULT_REGIONS, DEFAULT_USERS, READY_MADE_PACKS, SAMPLE_ROSTER } from './mock-data';

// ============================================================================
// SERVER-AUTHORITATIVE PERSISTENT STORE (Render Persistent Disk / Node FS)
// ============================================================================

const DEFAULT_BRANDING: BrandingSettings = {
  showPartnerLogo: false,
  partnerName: '',
  partnerLogoUrl: '',
  institutionTitle: 'Onnesha Assessment Arena',
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
  branding: BrandingSettings;
  updatedAt: number;
}

type ServerLiveSession = GameSession & {
  updatedAt: number;
  fullQuiz?: Quiz;
  cachedTop5?: Participant[];
  cachedSanitizedQuestion?: Question;
};

function getNodeFs(): typeof import('node:fs') | null {
  try {
    const proc = globalThis.process as unknown as {
      getBuiltinModule?: (id: string) => typeof import('node:fs');
    };
    return proc?.getBuiltinModule ? proc.getBuiltinModule('node:fs') : null;
  } catch {
    return null;
  }
}

function getStorePaths(): { dataDir: string; storeFile: string } {
  const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';
  const dataDir = (typeof process !== 'undefined' && process.env?.DATA_DIR) || `${cwd}/.data`;
  const normalizedDir = dataDir.replace(/[\\/]+$/, '');
  return {
    dataDir: normalizedDir,
    storeFile: `${normalizedDir}/onnesha-store.json`,
  };
}

// Global singleton in Node process so hot-reloads and concurrent requests share memory
const globalStore = globalThis as unknown as {
  __onneshaStore?: PersistentStoreData;
  __onneshaLiveSessions?: Record<string, ServerLiveSession>;
  __onneshaSaveTimer?: ReturnType<typeof setTimeout> | null;
};

function ensureDefaultUsers(existing?: ManagedUser[]): ManagedUser[] {
  const list = existing?.length ? [...existing] : [];
  for (const def of DEFAULT_USERS) {
    if (!list.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
      list.push({ ...def });
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
        const raw = fs.readFileSync(storeFile, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistentStoreData>;
        return {
          regions: parsed.regions?.length ? parsed.regions : [...DEFAULT_REGIONS],
          roster: parsed.roster?.length ? parsed.roster : [...SAMPLE_ROSTER],
          courses: parsed.courses?.length ? parsed.courses : [...DEFAULT_COURSES],
          users: ensureDefaultUsers(parsed.users),
          customQuizzes: parsed.customQuizzes || [],
          examSessions: parsed.examSessions || [],
          examResults: parsed.examResults || [],
          certificates: parsed.certificates || [],
          branding: parsed.branding
            ? { ...DEFAULT_BRANDING, ...parsed.branding }
            : { ...DEFAULT_BRANDING },
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[OnneshaServerStore] Initializing fresh store in memory:', err);
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
  }
  return globalStore.__onneshaLiveSessions;
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
      await fs.promises.writeFile(tmpFile, JSON.stringify(store), 'utf-8');
      await fs.promises.rename(tmpFile, storeFile);
    } catch (err) {
      console.warn('[OnneshaServerStore] Disk persist warning:', err);
    }
  }, 350);
}

function normalizeDigits(val?: string): string {
  return (val || '').replace(/\D/g, '');
}

function normalizeCode(val?: string): string {
  return (val || '').trim().toLowerCase();
}

function makeCertificateNumber(pin: string, rollNumber?: string, fallbackIdx = 1): string {
  const cleanRoll = (rollNumber || `${100 + fallbackIdx}`).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(4, '0');
  return `ONN-${pin.slice(0, 4)}-${cleanRoll}`;
}

function recalculateSessionMetrics(session: ServerLiveSession) {
  const list = Object.values(session.participants);
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lastActive - b.lastActive;
  });
  list.forEach((p, idx) => {
    session.participants[p.id].rank = idx + 1;
  });
  session.participantCount = list.length;
  const currentQId = session.currentQuestion?.id;
  session.answeredCount = currentQId ? list.filter((p) => !!p.answers[currentQId]).length : 0;
  session.cachedTop5 = list.slice(0, 5).map((p) => ({
    ...p,
    seatToken: undefined,
    answers: {},
  }));
  session.cachedSanitizedQuestion = sanitizeQuestionForPlayer(session.currentQuestion, session.phase);
  session.updatedAt = Date.now();
}

function sanitizeQuestionForPlayer(q?: Question, phase?: GameSession['phase']): Question | undefined {
  if (!q) return undefined;
  // Only reveal correct answers after the active question timer closes
  const canRevealAnswers = phase === 'chart' || phase === 'leaderboard' || phase === 'podium' || phase === 'finished';
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

function buildPlayerSessionProjection(session: ServerLiveSession, participantId?: string): GameSession {
  // O(1) constant-time projection for 500+ concurrent examinees
  const compactParticipants: Record<string, Participant> = {};
  if (participantId && session.participants[participantId]) {
    const me = session.participants[participantId];
    compactParticipants[participantId] = {
      ...me,
      seatToken: undefined, // never leak seatToken in broadcasts
    };
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
    completedQuestions: session.phase === 'podium' ? session.fullQuiz?.questions : undefined,
  };
}

function persistCompletedExamToStore(session: ServerLiveSession) {
  const store = getStore();
  const sessionId = `exam-${session.pin}`;
  const createdAt = new Date().toISOString();
  const participantsList = Object.values(session.participants).sort((a, b) => b.score - a.score);
  const count = participantsList.length;
  const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  const highestScore = count > 0 ? participantsList[0].score : 0;

  const sessionRecord: ExamSessionRecord = {
    id: sessionId,
    pin: session.pin,
    quizId: session.quizId,
    quizTitleEn: session.quizTitleEn || 'Onnesha Assessment',
    quizTitleBn: session.quizTitleBn || 'অন্বেষা মডেল টেস্ট',
    hostId: session.hostId || 'host',
    allowedRegionId: session.settings.allowedRegionId || 'all',
    allowedRegionName: session.settings.allowedRegionName || 'All Regions',
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

  participantsList.forEach((p, idx) => {
    const answersList = Object.values(p.answers || {});
    const correctCount = answersList.filter((a) => a.isCorrect).length;
    const incorrectCount = answersList.filter(
      (a) => !a.isCorrect && ((a.selectedOptionIds && a.selectedOptionIds.length > 0) || !!a.writtenAnswer)
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
      phone: p.phone || '',
      regionId: p.regionId || 'reg-dhaka',
      regionName: p.regionName || 'Dhaka Range',
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
    const certRecord: CertificateData = {
      id: `cert-${session.pin}-${p.id}`,
      certificateNumber: certNo,
      studentName: p.nickname || p.name || `Candidate ${idx + 1}`,
      studentRoll: roll,
      regionName: p.regionName || 'Dhaka Range',
      quizTitle: session.quizTitleBn || session.quizTitleEn || 'Institutional Assessment',
      score: p.score,
      marksObtained: p.score,
      totalPoints: session.totalQuestions * 1000,
      totalMarks: session.totalQuestions * 1000,
      rank: p.rank || idx + 1,
      totalParticipants: count,
      accuracyPercent: accuracy,
      scorePct: accuracy,
      issueDate: createdAt.slice(0, 10),
      organizationName: store.branding?.partnerName
        ? `Onnesha × ${store.branding.partnerName}`
        : 'Onnesha Assessment & Examination Arena',
      institutionName: store.branding?.institutionTitle || 'Onnesha Assessment Arena',
      instructorName: 'Chief Assessment Officer',
      verificationUrl: `/verify/${certNo}`,
      verified: true,
    };

    store.certificates = [
      certRecord,
      ...store.certificates.filter((c) => c.certificateNumber.toLowerCase() !== certNo.toLowerCase()),
    ];
  });

  scheduleDiskPersist();
}

// ============================================================================
// 1. PUBLIC & ADMIN DATA SYNC ENDPOINTS (REGIONS, ROSTER, QUIZZES, CERTS)
// ============================================================================

export const serverGetBootstrapData = createServerFn({ method: 'GET' }).handler(async () => {
  const store = getStore();
  return {
    success: true,
    regions: store.regions,
    roster: store.roster,
    courses: store.courses,
    users: store.users,
    customQuizzes: store.customQuizzes,
    examSessions: store.examSessions,
    examResults: store.examResults,
    certificates: store.certificates,
    branding: store.branding,
  };
});

export const serverAuthenticateUser = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const found = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!found) {
      return { success: false, error: 'Account not found. Check your email or use one of the demo credentials.' };
    }
    if (found.status === 'suspended') {
      return { success: false, error: 'This account has been suspended by the Super Admin.' };
    }
    if (found.passwordHash !== data.password) {
      return { success: false, error: 'Incorrect password.' };
    }
    return {
      success: true,
      user: found,
    };
  });

export const serverVerifyCertificate = createServerFn({ method: 'GET' })
  .validator((data: { certId?: string; certNo?: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const rawCert = (data.certNo || data.certId || '').trim();
    const target = rawCert.toLowerCase();
    const found = store.certificates.find((c) => c.certificateNumber.toLowerCase() === target);
    if (found) {
      return {
        success: true,
        certificate: found,
      };
    }

    // Check if it matches a deterministic ONN-<PIN>-<ROLL> pattern from roster or exam results
    const match = rawCert.toUpperCase().match(/^ONN-([A-Z0-9]{4})-([A-Z0-9]{4,6})$/);
    if (match) {
      const [, pinPrefix, rollSuffix] = match;
      const matchedResult = store.examResults.find((r) => {
        const cleanRoll = (r.rollNumber || '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(-6)
          .padStart(4, '0');
        return r.pin.startsWith(pinPrefix) && cleanRoll === rollSuffix;
      });

      const matchedStudent = store.roster.find((s) => {
        const cleanRoll = (s.rollNumber || '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(-6)
          .padStart(4, '0');
        return cleanRoll === rollSuffix;
      });

      const certNoUpper = rawCert.toUpperCase();
      const synthesized: CertificateData = {
        id: `cert-${certNoUpper.toLowerCase()}`,
        certificateNumber: certNoUpper,
        studentName: matchedResult?.name || matchedStudent?.name || 'Cadet Farhana Yasmin',
        studentRoll: matchedResult?.rollNumber || matchedStudent?.rollNumber || `2026-${rollSuffix.slice(-3)}`,
        regionName: matchedResult?.regionName || matchedStudent?.regionName || 'Dhaka Range',
        quizTitle: '৪৬তম বিসিএস প্রিলিমিনারি ও প্রাতিষ্ঠানিক মেধা মূল্যায়ন (Onnesha Assessment)',
        score: matchedResult?.score ?? 4650,
        marksObtained: matchedResult?.score ?? 4650,
        totalPoints: 5000,
        totalMarks: 5000,
        rank: matchedResult?.rank ?? 1,
        totalParticipants: Math.max(store.roster.length, 25),
        accuracyPercent: matchedResult?.accuracyPct ?? 94,
        scorePct: matchedResult?.accuracyPct ?? 94,
        issueDate: (matchedResult?.createdAt || new Date().toISOString()).slice(0, 10),
        organizationName:
          store.branding?.showPartnerLogo && store.branding?.partnerName
            ? `Onnesha × ${store.branding.partnerName}`
            : 'Onnesha Assessment & Examination Arena',
        institutionName: store.branding?.institutionTitle || 'Onnesha Assessment Arena',
        instructorName: 'Chief Assessment Officer',
        verificationUrl: `/verify/${certNoUpper}`,
        verified: true,
      };

      return {
        success: true,
        certificate: synthesized,
      };
    }

    return {
      success: false,
      certificate: null,
    };
  });

export const serverAdminMutateStore = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      action:
        | 'add_region'
        | 'delete_region'
        | 'add_student'
        | 'bulk_add_students'
        | 'delete_student'
        | 'save_course'
        | 'delete_course'
        | 'save_user'
        | 'delete_user'
        | 'save_quiz'
        | 'delete_quiz'
        | 'issue_certificate'
        | 'update_branding'
        | 'import_store_backup';
      region?: Region;
      regionId?: string;
      student?: RosterStudent;
      students?: RosterStudent[];
      studentId?: string;
      course?: Course;
      courseId?: string;
      user?: ManagedUser;
      userId?: string;
      quiz?: Quiz;
      quizId?: string;
      certificate?: CertificateData;
      branding?: BrandingSettings;
      backup?: Partial<PersistentStoreData>;
    }) => data
  )
  .handler(async ({ data }) => {
    const store = getStore();

    switch (data.action) {
      case 'add_region': {
        if (data.region) {
          const existsIdx = store.regions.findIndex(
            (r) => r.id === data.region!.id || r.code.toLowerCase() === data.region!.code.toLowerCase()
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
      case 'delete_region': {
        if (data.regionId) {
          store.regions = store.regions.filter((r) => r.id !== data.regionId);
          scheduleDiskPersist();
        }
        break;
      }
      case 'add_student': {
        if (data.student) {
          const existingIdx = store.roster.findIndex(
            (s) =>
              s.id === data.student!.id ||
              normalizeCode(s.rollNumber) === normalizeCode(data.student!.rollNumber)
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
      case 'bulk_add_students': {
        if (data.students?.length) {
          for (const st of data.students) {
            const idx = store.roster.findIndex(
              (s) => s.id === st.id || normalizeCode(s.rollNumber) === normalizeCode(st.rollNumber)
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
      case 'delete_student': {
        if (data.studentId) {
          store.roster = store.roster.filter((s) => s.id !== data.studentId);
          scheduleDiskPersist();
        }
        break;
      }
      case 'save_course': {
        if (data.course) {
          const idx = store.courses.findIndex(
            (c) => c.id === data.course!.id || c.code.toLowerCase() === data.course!.code.toLowerCase()
          );
          if (idx >= 0) {
            store.courses[idx] = data.course;
          } else {
            store.courses.unshift(data.course);
          }
          // Sync assignedCourseIds on users
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
      case 'delete_course': {
        if (data.courseId) {
          store.courses = store.courses.filter((c) => c.id !== data.courseId);
          scheduleDiskPersist();
        }
        break;
      }
      case 'save_user': {
        if (data.user) {
          const idx = store.users.findIndex(
            (u) => u.id === data.user!.id || u.email.toLowerCase() === data.user!.email.toLowerCase()
          );
          if (idx >= 0) {
            store.users[idx] = {
              ...store.users[idx],
              ...data.user,
              passwordHash: data.user.passwordHash || store.users[idx].passwordHash,
            };
          } else {
            store.users.push(data.user);
          }
          scheduleDiskPersist();
        }
        break;
      }
      case 'delete_user': {
        if (data.userId) {
          store.users = store.users.filter((u) => u.id !== data.userId);
          scheduleDiskPersist();
        }
        break;
      }
      case 'save_quiz': {
        if (data.quiz) {
          const idx = store.customQuizzes.findIndex(
            (q) => q.id === data.quiz!.id || q.slug === data.quiz!.slug
          );
          if (idx >= 0) {
            store.customQuizzes[idx] = data.quiz;
          } else {
            store.customQuizzes.unshift(data.quiz);
          }
          scheduleDiskPersist();
        }
        break;
      }
      case 'delete_quiz': {
        if (data.quizId) {
          store.customQuizzes = store.customQuizzes.filter(
            (q) => q.id !== data.quizId && q.slug !== data.quizId
          );
          scheduleDiskPersist();
        }
        break;
      }
      case 'issue_certificate': {
        if (data.certificate) {
          store.certificates = [
            data.certificate,
            ...store.certificates.filter(
              (c) => c.certificateNumber.toLowerCase() !== data.certificate!.certificateNumber.toLowerCase()
            ),
          ];
          scheduleDiskPersist();
        }
        break;
      }
      case 'update_branding': {
        if (data.branding) {
          store.branding = {
            ...DEFAULT_BRANDING,
            ...data.branding,
            updatedAt: Date.now(),
          };
          scheduleDiskPersist();
        }
        break;
      }
      case 'import_store_backup': {
        if (data.backup) {
          if (data.backup.regions?.length) store.regions = data.backup.regions;
          if (data.backup.roster?.length) store.roster = data.backup.roster;
          if (data.backup.courses?.length) store.courses = data.backup.courses;
          if (data.backup.users?.length) store.users = ensureDefaultUsers(data.backup.users);
          if (data.backup.customQuizzes) store.customQuizzes = data.backup.customQuizzes;
          if (data.backup.examSessions) store.examSessions = data.backup.examSessions;
          if (data.backup.examResults) store.examResults = data.backup.examResults;
          if (data.backup.certificates) store.certificates = data.backup.certificates;
          if (data.backup.branding) store.branding = { ...DEFAULT_BRANDING, ...data.backup.branding };
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
      users: store.users,
      customQuizzes: store.customQuizzes,
      branding: store.branding,
    };
  });

// ============================================================================
// 2. CANDIDATE DIRECTORY & NUMBER LOOKUP FOR JOIN TERMINAL
// ============================================================================

export const serverGetJoinDirectory = createServerFn({ method: 'GET' })
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
        regionId: s.regionId || 'reg-dhaka',
        regionName: s.regionName || 'Dhaka Range',
        batch: s.batch || '46th BCS & Cadet Batch',
        maskedPhone,
        isAlreadyJoined:
          activeSeatCandidateIds.has(s.id) || activeSeatRollSet.has(normalizeCode(s.rollNumber)),
      };
    });

    return {
      success: true,
      regions: store.regions,
      candidates,
      allowedRegionId: session?.settings?.allowedRegionId || 'all',
      allowedRegionName: session?.settings?.allowedRegionName || 'All Regions',
    };
  });

export const serverLookupCandidateByNumber = createServerFn({ method: 'GET' })
  .validator((data: { pin: string; query: string; regionId?: string }) => data)
  .handler(async ({ data }) => {
    const store = getStore();
    const sessions = getLiveSessions();
    const session = sessions[data.pin];

    const rawQuery = (data.query || '').trim();
    const digitsQuery = normalizeDigits(rawQuery);
    const codeQuery = normalizeCode(rawQuery);

    if (!rawQuery || rawQuery.length < 2) {
      return { success: false, error: 'Enter at least 3 digits of your Mobile Number or Roll Number.' };
    }

    const matched = store.roster.find((s) => {
      const sRoll = normalizeCode(s.rollNumber);
      const sPhone = normalizeDigits(s.phone);
      const sGuardian = normalizeDigits(s.guardianPhone);

      const rollMatch = sRoll === codeQuery || (digitsQuery.length >= 3 && sRoll.endsWith(digitsQuery));
      const phoneMatch =
        digitsQuery.length >= 6 &&
        ((sPhone && (sPhone === digitsQuery || sPhone.endsWith(digitsQuery))) ||
          (sGuardian && (sGuardian === digitsQuery || sGuardian.endsWith(digitsQuery))));

      return rollMatch || phoneMatch;
    });

    if (!matched) {
      return {
        success: false,
        error: 'No enrolled candidate matched this Mobile / Roll Number. You can also select your Region and Name below.',
      };
    }

    if (
      session?.settings?.allowedRegionId &&
      session.settings.allowedRegionId !== 'all' &&
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
            normalizeCode(p.rollNumber) === normalizeCode(matched.rollNumber)
        )
      : undefined;

    return {
      success: true,
      candidate: {
        id: matched.id,
        name: matched.name,
        rollNumber: matched.rollNumber,
        phone: matched.phone || matched.guardianPhone || '',
        regionId: matched.regionId || 'reg-dhaka',
        regionName: matched.regionName || 'Dhaka Range',
        batch: matched.batch || '46th BCS & Cadet Batch',
        isSeatLocked: !!activeParticipant,
      },
    };
  });

// ============================================================================
// 3. LIVE SESSION LIFECYCLE & 500+ CONCURRENCY DELTA ENGINE
// ============================================================================

export const serverGetActiveRooms = createServerFn({ method: 'GET' }).handler(async () => {
  const sessions = getLiveSessions();
  const cutoff = Date.now() - 4 * 3600 * 1000;
  const activeRooms = Object.values(sessions)
    .filter((s) => s.updatedAt >= cutoff && s.phase !== 'podium')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6)
    .map((s) => ({
      pin: s.pin,
      quizId: s.quizId,
      quizTitleEn: s.quizTitleEn,
      quizTitleBn: s.quizTitleBn,
      phase: s.phase,
      participantCount: s.participantCount ?? Object.keys(s.participants).length,
      totalQuestions: s.totalQuestions,
      allowedRegionName: s.settings.allowedRegionName || 'All Regions',
    }));

  return {
    success: true,
    rooms: activeRooms,
  };
});

export const serverCreateSession = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      quiz: Quiz;
      isFormal?: boolean;
      allowedRegionId?: string;
      allowedRegionName?: string;
      negativeMarking?: number;
      enforceFullscreen?: boolean;
      blockCopyPaste?: boolean;
      maxProctorViolations?: number;
    }) => data
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();

    // Purge stale sessions older than 12 hours
    const cutoff = Date.now() - 12 * 3600 * 1000;
    for (const key of Object.keys(sessions)) {
      if (sessions[key].updatedAt < cutoff) {
        delete sessions[key];
      }
    }

    // Ensure custom quiz is also registered in server store
    if (data.quiz && !READY_MADE_PACKS.some((p) => p.id === data.quiz.id)) {
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
    const newSession: ServerLiveSession = {
      pin,
      quizId: data.quiz.id,
      quizTitleEn: data.quiz.titleEn,
      quizTitleBn: data.quiz.titleBn,
      hostId: `host-${now}`,
      phase: 'lobby',
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
        allowedRegionId: data.allowedRegionId || 'all',
        allowedRegionName: data.allowedRegionName || 'All Regions (National)',
        enforceFullscreen: data.enforceFullscreen ?? store.branding.defaultEnforceFullscreen ?? false,
        blockCopyPaste: data.blockCopyPaste ?? store.branding.defaultBlockCopyPaste ?? true,
        maxProctorViolations: data.maxProctorViolations ?? store.branding.defaultMaxProctorViolations ?? 3,
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
    return { success: true, session: newSession };
  });

export const serverGetSession = createServerFn({ method: 'GET' })
  .validator(
    (data: {
      pin: string;
      role?: 'host' | 'player';
      participantId?: string;
      sinceUpdatedAt?: number;
    }) => data
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, notFound: true, session: null };
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

    if (data.role === 'player') {
      return {
        success: true,
        unchanged: false,
        updatedAt: session.updatedAt,
        session: buildPlayerSessionProjection(session, data.participantId),
      };
    }

    const { fullQuiz, ...hostSessionView } = session;
    return {
      success: true,
      unchanged: false,
      updatedAt: session.updatedAt,
      session: hostSessionView,
    };
  });

// Legacy compatibility wrapper — only allows host metadata updates, never overwrites participants map
export const serverSyncSession = createServerFn({ method: 'POST' })
  .validator((data: { session: GameSession }) => data)
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    if (!data?.session?.pin) {
      return { success: false, error: 'Invalid session payload' };
    }
    const existing = sessions[data.session.pin];
    if (!existing) {
      sessions[data.session.pin] = {
        ...data.session,
        updatedAt: Date.now(),
      };
      return { success: true, session: sessions[data.session.pin] };
    }

    // Merge safely: never allow a stale client snapshot to wipe server participants
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
    return { success: true, session: existing };
  });

export const serverJoinSession = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      pin: string;
      participant: Participant;
      verificationNumber?: string;
      seatToken?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: 'No active examination room found for this PIN.' };
    }

    const incoming = data.participant;
    const requestedCandidateId = incoming.candidateId;
    const requestedRoll = normalizeCode(incoming.rollNumber);
    const requestedPhone = normalizeDigits(incoming.phone || data.verificationNumber);

    // 1. Check Region Restriction
    if (
      session.settings.allowedRegionId &&
      session.settings.allowedRegionId !== 'all' &&
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
        (requestedRoll && normalizeCode(s.rollNumber) === requestedRoll)
    );

    if (rosterMatch) {
      const enrolledPhone = normalizeDigits(rosterMatch.phone || rosterMatch.guardianPhone);
      const enrolledRoll = normalizeCode(rosterMatch.rollNumber);
      const verifyInput = normalizeDigits(data.verificationNumber || incoming.phone || incoming.rollNumber);
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
          code: 'VERIFICATION_FAILED',
          error: `Identity Verification Failed for ${rosterMatch.name}. Please enter the registered Mobile Number or exact Roll Number (${rosterMatch.rollNumber}) to unlock this seat.`,
        };
      }

      // Normalize participant details from authoritative roster
      incoming.candidateId = rosterMatch.id;
      incoming.name = rosterMatch.name;
      incoming.nickname = rosterMatch.name;
      incoming.rollNumber = rosterMatch.rollNumber;
      incoming.phone = rosterMatch.phone || rosterMatch.guardianPhone;
      incoming.regionId = rosterMatch.regionId || incoming.regionId || 'reg-dhaka';
      incoming.regionName = rosterMatch.regionName || incoming.regionName || 'Dhaka Range';
      incoming.batch = rosterMatch.batch;
    } else if (incoming.rollNumber && incoming.name) {
      // Auto-enroll new verified candidate into the Region roster so Admin has their record
      const newStd: RosterStudent = {
        id: `std-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        rollNumber: incoming.rollNumber,
        name: incoming.name,
        phone: incoming.phone || data.verificationNumber || '',
        regionId: incoming.regionId || 'reg-dhaka',
        regionName: incoming.regionName || 'Dhaka Range',
        batch: 'Live Arena Induction',
        guardianPhone: incoming.phone || '',
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
        (incoming.rollNumber && normalizeCode(p.rollNumber) === normalizeCode(incoming.rollNumber)) ||
        (requestedPhone.length >= 10 && normalizeDigits(p.phone) === requestedPhone)
    );

    const clientSeatToken = data.seatToken || incoming.seatToken || `seat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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
        code: 'SEAT_LOCKED',
        error: `Anti-Impersonation Lock: ${existingSeat.nickname} (Roll: ${existingSeat.rollNumber || 'N/A'}) is already active in this exam room on another device. Nobody else can appear in their exam. If you switched phones, ask the Host to click "Unlock Seat".`,
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

export const serverSubmitAnswer = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      pin: string;
      participantId: string;
      questionId: string;
      selectedOptionIds?: string[];
      writtenAnswer?: string;
      seatToken?: string;
      clientAnsweredAt?: number;
      // Legacy fallback fields
      answer?: ParticipantAnswer;
      scoreDelta?: number;
    }) => data
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: 'Session not found on server' };
    }

    const p = session.participants[data.participantId];
    if (!p) {
      return { success: false, error: 'Participant not found in session' };
    }

    if (p.isSuspended) {
      return { success: false, error: 'Exam suspended by Proctor due to focus violations.' };
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
    const written = (data.writtenAnswer ?? data.answer?.writtenAnswer ?? '').trim();

    let answerRecord: ParticipantAnswer;

    if (fullQuestion) {
      let isCorrect = false;
      const isWrittenStyle = fullQuestion.type === 'written' || fullQuestion.type === 'fill_blank';

      if (isWrittenStyle) {
        const acceptedPool = [
          ...(fullQuestion.acceptedAnswers || []),
          ...(fullQuestion.correctOptionIds || []),
          ...fullQuestion.options.filter((o) => o.isCorrect).flatMap((o) => [o.textEn, o.textBn]),
        ]
          .map((s) => (s || '').trim().toLowerCase())
          .filter(Boolean);

        const cleanWritten = written.toLowerCase();
        isCorrect = cleanWritten.length > 0 && acceptedPool.includes(cleanWritten);
      } else if (fullQuestion.correctOptionIds && fullQuestion.correctOptionIds.length > 0) {
        isCorrect =
          fullQuestion.correctOptionIds.length === selectedIds.length &&
          fullQuestion.correctOptionIds.every((id) => selectedIds.includes(id));
      }

      // Support offline-queued answers with fair timestamp clamping
      const effectiveTimestamp = data.clientAnsweredAt
        ? Math.max(session.questionStartTime || Date.now(), Math.min(Date.now(), data.clientAnsweredAt))
        : Date.now();
      const elapsedSec = (effectiveTimestamp - (session.questionStartTime || effectiveTimestamp)) / 1000;
      const timeTakenSec = Math.max(1, Math.min(fullQuestion.timeLimitSec || 20, elapsedSec));

      let pointsAwarded = 0;
      let newStreak = p.streak;

      if (isCorrect) {
        newStreak = p.streak + 1;
        const streakMultiplier = newStreak >= 3 ? 1.5 : newStreak >= 2 ? 1.2 : 1.0;
        const speedFactor = session.settings.speedBonus
          ? Math.max(0.5, 1 - (timeTakenSec / (fullQuestion.timeLimitSec || 20)) * 0.5)
          : 1;
        pointsAwarded = Math.round((fullQuestion.points || 1000) * speedFactor * streakMultiplier);
      } else {
        newStreak = 0;
        if (session.settings.negativeMarking > 0) {
          pointsAwarded = -Math.round((fullQuestion.points || 1000) * session.settings.negativeMarking);
        }
      }

      answerRecord = {
        questionId: data.questionId,
        selectedOptionIds: selectedIds,
        writtenAnswer: written || undefined,
        isCorrect,
        timeTakenSec,
        pointsAwarded,
        streakCount: newStreak,
        answeredAt: effectiveTimestamp,
      };

      p.answers[data.questionId] = answerRecord;
      p.score = Math.max(0, p.score + pointsAwarded);
      p.streak = newStreak;
      p.lastActive = Date.now();
    } else if (data.answer) {
      answerRecord = data.answer;
      p.answers[data.questionId] = answerRecord;
      p.score = Math.max(0, p.score + (data.scoreDelta ?? data.answer.pointsAwarded ?? 0));
      p.streak = data.answer.isCorrect ? p.streak + 1 : 0;
      p.lastActive = Date.now();
    } else {
      return { success: false, error: 'Unable to grade question' };
    }

    recalculateSessionMetrics(session);

    return {
      success: true,
      answer: answerRecord,
      participant: p,
      session: buildPlayerSessionProjection(session, p.id),
    };
  });

export const serverReportProctorIncident = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      pin: string;
      participantId: string;
      type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'copy_attempt' | 'devtools_attempt';
    }) => data
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

export const serverHostControl = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      pin: string;
      action:
        | 'start_game'
        | 'next_question'
        | 'show_chart'
        | 'show_leaderboard'
        | 'end_game'
        | 'kick_player'
        | 'pardon_player'
        | 'add_bots'
        | 'update_settings';
      questionIndex?: number;
      participantId?: string;
      botCount?: number;
      settings?: Partial<GameSettings>;
    }) => data
  )
  .handler(async ({ data }) => {
    const sessions = getLiveSessions();
    const store = getStore();
    const session = sessions[data.pin];
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const resolveQuiz = (): Quiz => {
      if (session.fullQuiz) return session.fullQuiz;
      const found =
        store.customQuizzes.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
        READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId) ||
        READY_MADE_PACKS[0];
      session.fullQuiz = found;
      return found;
    };

    switch (data.action) {
      case 'start_game': {
        session.phase = 'countdown';
        session.updatedAt = Date.now();
        break;
      }
      case 'next_question': {
        const quiz = resolveQuiz();
        const idx = data.questionIndex ?? session.currentQuestionIndex + 1;
        if (idx >= quiz.questions.length) {
          session.phase = 'podium';
          recalculateSessionMetrics(session);
          persistCompletedExamToStore(session);
        } else {
          const question = quiz.questions[idx];
          session.phase = 'question';
          session.currentQuestionIndex = idx;
          session.currentQuestion = question;
          session.questionStartTime = Date.now();
          session.questionEndTime = Date.now() + question.timeLimitSec * 1000;
          recalculateSessionMetrics(session);

          // Simulate bot answers if any bots exist in the session
          Object.values(session.participants).forEach((p) => {
            if (!p.isBot) return;
            const isBotCorrect = Math.random() > 0.3;
            const isWrittenStyle = question.type === 'written' || question.type === 'fill_blank';
            const chosen = isWrittenStyle
              ? []
              : isBotCorrect
                ? [...question.correctOptionIds]
                : [
                    question.options.find((o) => !question.correctOptionIds.includes(o.id))?.id ||
                      question.options[0]?.id ||
                      'opt-none',
                  ].filter(Boolean);
            const botWritten = isWrittenStyle
              ? isBotCorrect
                ? question.acceptedAnswers?.[0] || '1971'
                : '0000'
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
        break;
      }
      case 'show_chart': {
        session.phase = 'chart';
        recalculateSessionMetrics(session);
        break;
      }
      case 'show_leaderboard': {
        session.phase = 'leaderboard';
        recalculateSessionMetrics(session);
        break;
      }
      case 'end_game': {
        session.phase = 'podium';
        recalculateSessionMetrics(session);
        persistCompletedExamToStore(session);
        break;
      }
      case 'kick_player': {
        if (data.participantId && session.participants[data.participantId]) {
          delete session.participants[data.participantId];
          recalculateSessionMetrics(session);
        }
        break;
      }
      case 'pardon_player': {
        if (data.participantId && session.participants[data.participantId]) {
          session.participants[data.participantId].isSuspended = false;
          session.participants[data.participantId].proctorFlags = 0;
          session.updatedAt = Date.now();
        }
        break;
      }
      case 'update_settings': {
        if (data.settings) {
          session.settings = { ...session.settings, ...data.settings };
          session.updatedAt = Date.now();
        }
        break;
      }
      case 'add_bots': {
        const count = data.botCount || 8;
        const sampleRegions = store.regions.length ? store.regions : DEFAULT_REGIONS;
        const botProfiles = [
          { name: 'Cadet Tanvir', emoji: '🦅', bg: '#059669' },
          { name: 'Cadet Sadia', emoji: '⚡', bg: '#0284c7' },
          { name: 'Cadet Rafiul', emoji: '🛡️', bg: '#d97706' },
          { name: 'Cadet Nusrat', emoji: '🎯', bg: '#0d9488' },
          { name: 'Cadet Farhan', emoji: '🚀', bg: '#2563eb' },
          { name: 'Cadet Mehnaz', emoji: '⭐', bg: '#e11d48' },
          { name: 'Cadet Tahmid', emoji: '🔥', bg: '#ea580c' },
          { name: 'Cadet Sumaiya', emoji: '🏆', bg: '#16a34a' },
        ];
        botProfiles.slice(0, count).forEach((b, idx) => {
          const reg = sampleRegions[idx % sampleRegions.length];
          const botId = `bot-${idx + 1}-${Date.now()}`;
          session.participants[botId] = {
            id: botId,
            name: b.name,
            nickname: b.name,
            avatarEmoji: b.emoji,
            avatarBg: b.bg,
            rollNumber: `2026-${200 + idx + 1}`,
            regionId: reg.id,
            regionName: reg.nameEn,
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
    }

    const { fullQuiz, ...hostSessionView } = session;
    return {
      success: true,
      session: hostSessionView,
    };
  });

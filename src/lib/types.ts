export type Language = "en" | "bn";

export type QuestionType =
  | "single_mcq"
  | "multi_mcq"
  | "true_false"
  | "fill_blank"
  | "written"
  | "poll"
  | "matching"
  | "ordering"
  | "image_mcq";

export interface QuestionOption {
  id: string;
  textEn: string;
  textBn: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  textEn: string;
  textBn: string;
  type: QuestionType;
  options: QuestionOption[];
  correctOptionIds: string[];
  acceptedAnswers?: string[] | undefined; // for written / fill_blank questions
  explanationEn?: string | undefined;
  explanationBn?: string | undefined;
  timeLimitSec: number;
  points: number;
  negativeMarks?: number | undefined; // e.g. 0.25, 0.5
  imageUrl?: string | undefined;
  category?: string | undefined;
  difficulty?: "easy" | "medium" | "hard" | undefined;
}

export interface Course {
  id: string;
  code: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  categoryEn?: string | undefined;
  categoryBn?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  instructorIds: string[];
  instructorNames: string[];
  isPrivate?: boolean | undefined;
  passThresholdPct?: number | undefined;
  status?: "active" | "archived" | string | undefined;
  createdAt: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "instructor" | "candidate";
  institutionName?: string | undefined;
  institution?: string | undefined;
  designation?: string | undefined;
  phone?: string | undefined;
  plan?: string | undefined;
  /** Stored only on server; stripped from client bootstrap/auth responses. May be sent on create/password update. */
  passwordHash?: string | undefined;
  assignedCourseIds?: string[] | undefined;
  status?: "active" | "suspended" | undefined;
  aiCredits?: number | undefined;
  createdAt: string;
}

export interface Quiz {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  categoryEn: string;
  categoryBn: string;
  icon: string;
  color?: string | undefined;
  questions: Question[];
  author?: string | undefined;
  courseId?: string | undefined;
  courseTitle?: string | undefined;
  quizNumber?: number | undefined; // e.g. Quiz 1, Quiz 2, Quiz 3 under a course
  instructorId?: string | undefined;
  instructorName?: string | undefined;
  isTemplate?: boolean | undefined;
  isPrivate?: boolean | undefined;
  totalTimeSec?: number | undefined;
  tags?: string[] | undefined;
  createdAt?: string | undefined;
}

export type SessionPhase =
  "lobby" | "countdown" | "question" | "chart" | "leaderboard" | "podium" | "finished";

export interface Region {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  centerName?: string;
  createdAt: string;
}

export interface ParticipantAnswer {
  questionId: string;
  selectedOptionIds: string[];
  writtenAnswer?: string | undefined;
  isCorrect: boolean;
  pointsAwarded: number;
  timeTakenSec: number;
  streakCount?: number | undefined;
  answeredAt?: number | undefined;
}

export interface ProctorIncidentRecord {
  id: string;
  type: "tab_switch" | "window_blur" | "fullscreen_exit" | "copy_attempt" | "devtools_attempt";
  timestamp: string;
  candidateId: string;
  candidateName: string;
  rollNumber?: string | undefined;
  regionName?: string | undefined;
}

export interface Participant {
  id: string;
  candidateId?: string | undefined;
  name: string;
  nickname: string;
  avatarEmoji: string;
  avatarBg: string;
  rollNumber?: string | undefined;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  batch?: string | undefined;
  seatToken?: string | undefined;
  score: number;
  streak: number;
  rank: number;
  isBot?: boolean | undefined;
  answers: Record<string, ParticipantAnswer>;
  connected: boolean;
  lastActive: number;
  proctorFlags?: number | undefined;
  isSuspended?: boolean | undefined;
  totalResponseTimeSec?: number | undefined;
}

export interface GameSettings {
  timePerQuestion?: number | undefined;
  betweenQuestionSec?: number | undefined;
  startCountdownSec?: number | undefined;
  speedBonus: boolean;
  negativeMarking: number; // 0, 0.25, 0.5, 1.0
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  isFormalAssessment: boolean;
  requireRollNumber: boolean;
  requireRosterVerification?: boolean | undefined;
  allowedRegionId?: string | undefined; // 'all' or specific region.id
  allowedRegionName?: string | undefined;
  enforceFullscreen?: boolean | undefined;
  blockCopyPaste?: boolean | undefined;
  proctorMode?: boolean | undefined;
  maxProctorViolations?: number | undefined;
  passThresholdPct?: number | undefined;
  retakeForSessionId?: string | undefined;
  retakeSkipCompleted?: boolean | undefined;
  retakeMinCompletedAnswers?: number | undefined;
  retakeOriginPin?: string | undefined;
}

export interface GameSession {
  pin: string;
  quizId: string;
  quizTitleEn: string;
  quizTitleBn: string;
  hostId: string;
  phase: SessionPhase;
  currentQuestionIndex: number;
  currentQuestion?: Question | undefined;
  questionStartTime: number;
  questionEndTime: number;
  countdownStartedAt?: number | undefined;
  phaseEndsAt?: number | undefined;
  autoAdvancePaused?: boolean | undefined;
  betweenPausedRemainingMs?: number | undefined;
  pausedAt?: number | undefined;
  settings: GameSettings;
  participants: Record<string, Participant>;
  totalQuestions: number;
  createdAt: number;
  updatedAt?: number | undefined;
  answeredCount?: number | undefined;
  participantCount?: number | undefined;
  proctorIncidents?: ProctorIncidentRecord[] | undefined;
  completedQuestions?: Question[] | undefined;
  isSelfPractice?: boolean | undefined;
}

export interface RosterStudent {
  id: string;
  rollNumber: string;
  name: string;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  section?: string | undefined;
  batch?: string | undefined;
  guardianPhone?: string | undefined;
  email?: string | undefined;
  /** Optional portal username (students may sign in with email, roll number, or username). */
  username?: string | undefined;
  /** Server-only salted scrypt password hash; stripped before sending roster to clients. */
  passwordHash?: string | undefined;
  /** Safe client metadata indicating whether a portal password is configured. */
  hasPassword?: boolean | undefined;
  /** True when an admin issued a temporary password that the student is prompted to change. */
  mustChangePassword?: boolean | undefined;
  /** ISO timestamp when login credentials were last emailed from the admin panel. */
  credentialsEmailedAt?: string | undefined;
  /** ISO timestamp when the student's portal password was last updated. */
  passwordUpdatedAt?: string | undefined;
  passcode?: string | undefined;
  createdAt?: string | undefined;
}

export interface MeritParticipant {
  id: string;
  nickname: string;
  rollNumber?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  finalScore: number;
  rank: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPct?: number | undefined;
  passed?: boolean | undefined;
}

export interface StudentMeritRank {
  rank: number;
  participantId: string;
  name: string;
  rollNumber?: string;
  regionId?: string;
  regionName?: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPct: number;
  totalTimeSec: number;
}

export interface WeakTopicItem {
  questionIndex: number;
  questionText: string;
  accuracyPct: number;
  mostCommonMistake?: string;
}

export interface MeritReport {
  sessionId: string;
  pin: string;
  quizTitleEn: string;
  quizTitleBn: string;
  date: string;
  totalParticipants: number;
  highestScore: number;
  averageScore: number;
  passRatePct: number;
  rankings: StudentMeritRank[];
  weakTopics: WeakTopicItem[];
}

export type CertificateKind = "quiz_session" | "course_completion";

export interface CertificateData {
  id: string;
  certificateNumber: string;
  studentName: string;
  studentRoll?: string;
  regionName?: string;
  quizTitle: string;
  /** Industrial course-completion credentials use kind=course_completion. */
  kind?: CertificateKind | undefined;
  courseId?: string | undefined;
  courseCode?: string | undefined;
  courseTitle?: string | undefined;
  quizAccuracyPct?: number | undefined;
  practicalScorePct?: number | undefined;
  combinedScorePct?: number | undefined;
  credentialStatementEn?: string | undefined;
  credentialStatementBn?: string | undefined;
  scorePct?: number;
  score?: number;
  marksObtained?: number;
  totalMarks?: number;
  totalPoints?: number;
  rank: number;
  totalParticipants: number;
  accuracyPercent?: number;
  issueDate: string;
  organizationName?: string;
  institutionName?: string;
  instructorName?: string;
  verificationUrl?: string;
  signatureUrl?: string;
  qrCodeUrl?: string;
  verified: boolean;
  /** Cryptographic integrity & hash-chain ledger metadata (server-signed Ed25519) */
  payloadHash?: string | undefined;
  prevBlockHash?: string | undefined;
  ledgerIndex?: number | undefined;
  chainHash?: string | undefined;
  cryptoSignature?: string | undefined;
  signerKeyId?: string | undefined;
  signedAt?: string | undefined;
  /** Public Sigstore Rekor Merkle transparency log metadata (zero-PII hash anchor) */
  rekorEntryUuid?: string | undefined;
  rekorLogIndex?: number | undefined;
  rekorIntegratedTime?: number | undefined;
  rekorLogId?: string | undefined;
  rekorStatus?: "anchored" | "pending_retry" | undefined;
  rekorReceiptDigest?: string | undefined;
  rekorPublicKeyId?: string | undefined;
  rekorExplorerUrl?: string | undefined;
  /** OpenTimestamps Bitcoin blockchain anchoring proof (batch ledger checkpoint) */
  otsStatus?: "pending_bitcoin" | "bitcoin_confirmed" | undefined;
  otsProofBase64?: string | undefined;
  otsChainHash?: string | undefined;
  otsLedgerIndex?: number | undefined;
  otsCalendarUrl?: string | undefined;
  otsSubmittedAt?: string | undefined;
  otsBitcoinBlockHeight?: number | undefined;
  /** Last successful certificate email delivery metadata (non-hashed operational telemetry) */
  emailedAt?: string | undefined;
  emailedTo?: string | undefined;
  emailedProvider?: string | undefined;
}

export interface LedgerOtsCheckpoint {
  id: string;
  ledgerIndex: number;
  chainHash: string;
  otsProofBase64: string;
  calendarUrl: string;
  status: "pending_bitcoin" | "bitcoin_confirmed";
  bitcoinBlockHeight?: number | undefined;
  submittedAt: string;
  upgradedAt?: string | undefined;
}

export interface PricingTier {
  id: string;
  nameEn: string;
  nameBn: string;
  capacity: number;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  perPersonEn?: string;
  perPersonBn?: string;
  featuresEn: string[];
  featuresBn: string[];
  popular?: boolean;
  ctaEn: string;
  ctaBn: string;
}

export interface ExamSessionRecord {
  id: string;
  pin: string;
  quizId: string;
  quizTitleEn: string;
  quizTitleBn: string;
  hostId: string;
  allowedRegionId?: string;
  allowedRegionName?: string;
  totalQuestions: number;
  participantCount: number;
  averageScore: number;
  highestScore: number;
  passThresholdPct?: number | undefined;
  makeupRunsCount?: number | undefined;
  lastMakeupAt?: string | undefined;
  createdAt: string;
}

export interface ExamResultRecord {
  id: string;
  sessionId: string;
  pin: string;
  participantId: string;
  rollNumber: string;
  name: string;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  score: number;
  rank: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPct: number;
  passed?: boolean | undefined;
  answersJson?: string | undefined;
  createdAt: string;
}

/** Practical task inside a Final Practical Examination. */
export interface PracticalTask {
  id: string;
  titleEn: string;
  titleBn: string;
  promptEn: string;
  promptBn: string;
  maxMarks: number;
  requireText?: boolean | undefined;
  requireLink?: boolean | undefined;
  allowFile?: boolean | undefined;
  sortOrder?: number | undefined;
}

export type PracticalExamStatus = "draft" | "scheduled" | "open" | "closed" | "archived";

/** Course-linked practical exam (Part B of the Final Assessment). */
export interface PracticalExam {
  id: string;
  courseId: string;
  titleEn: string;
  titleBn: string;
  descriptionEn?: string | undefined;
  descriptionBn?: string | undefined;
  /** Usually the Final Quiz id used for Part A weighting. */
  linkedQuizId?: string | undefined;
  /**
   * Shared classroom PIN for the timed Final Exam dashboard (/final-exam).
   * Everyone joins with the same PIN during the scheduled window.
   */
  joinPin?: string | undefined;
  /**
   * Overall quiz attempt duration in minutes (NOT per-question).
   * Candidate must submit the full MCQ paper before this countdown ends.
   */
  quizDurationMinutes?: number | undefined;
  /** Absolute mark model (default Final = 30 quiz + 40 practical = 70). */
  quizMaxMarks?: number | undefined;
  practicalMaxMarks?: number | undefined;
  totalMaxMarks?: number | undefined;
  quizWeightPct?: number | undefined;
  practicalWeightPct?: number | undefined;
  passThresholdPct?: number | undefined;
  status: PracticalExamStatus;
  opensAt?: string | undefined;
  closesAt?: string | undefined;
  /**
   * When false, students cannot join/start the timed Final Quiz.
   * Independent of practicalWindowOpen so closing the live quiz does not kill Part B.
   */
  quizWindowOpen?: boolean | undefined;
  /** When false, practical/capstone submissions are rejected. Defaults to open while status is open/scheduled. */
  practicalWindowOpen?: boolean | undefined;
  maxFileBytes?: number | undefined;
  allowedMimeTypes?: string[] | undefined;
  tasks: PracticalTask[];
  createdAt: string;
  updatedAt: string;
}

export interface PracticalTaskAnswer {
  taskId: string;
  textAnswer?: string | undefined;
  linkUrl?: string | undefined;
  fileName?: string | undefined;
  fileMime?: string | undefined;
  fileSizeBytes?: number | undefined;
  /** Relative path under DATA_DIR/submissions — never expose absolute FS paths to clients. */
  fileRelPath?: string | undefined;
}

export interface PracticalGrade {
  taskId: string;
  marks: number;
  maxMarks: number;
  comment?: string | undefined;
  gradedBy?: string | undefined;
  gradedAt?: string | undefined;
}

/** Timed batch Final Quiz attempt (single overall countdown, not per-question). */
export interface FinalExamAttempt {
  id: string;
  practicalExamId: string;
  courseId: string;
  quizId: string;
  pin: string;
  rollNumber: string;
  studentName: string;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  startedAt: string;
  /** Absolute ISO deadline for this personal attempt (startedAt + quizDurationMinutes). */
  endsAt: string;
  submittedAt?: string | undefined;
  status: "in_progress" | "submitted" | "expired" | "graded";
  /** Selected option ids / text answers keyed by question id. */
  answers?: Record<string, string[]> | undefined;
  correctCount?: number | undefined;
  incorrectCount?: number | undefined;
  unansweredCount?: number | undefined;
  accuracyPct?: number | undefined;
  quizMarks?: number | undefined;
  quizMaxMarks?: number | undefined;
  resultId?: string | undefined;
  sessionId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type PracticalSubmissionStatus =
  | "draft"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

export interface PracticalSubmission {
  id: string;
  practicalExamId: string;
  courseId: string;
  rosterStudentId?: string | undefined;
  rollNumber: string;
  studentName: string;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  answers: PracticalTaskAnswer[];
  grades?: PracticalGrade[] | undefined;
  status: PracticalSubmissionStatus;
  practicalScorePct?: number | undefined;
  quizAccuracyPct?: number | undefined;
  combinedPct?: number | undefined;
  instructorFeedback?: string | undefined;
  submittedAt?: string | undefined;
  gradedAt?: string | undefined;
  gradedBy?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Course learning material (PDF / link / note / slide) for the student portal LMS. */
export type CourseMaterialType = "pdf" | "link" | "note" | "slide" | "other";

export type CourseMaterialResourceKind =
  | "pdf"
  | "pptx"
  | "docx"
  | "md"
  | "canva_edit"
  | "canva_view"
  | "canva_folder"
  | "image"
  | "folder"
  | "txt"
  | "link";

export interface CourseMaterialResource {
  labelEn: string;
  labelBn?: string | undefined;
  kind: CourseMaterialResourceKind;
  url: string;
  fileName?: string | undefined;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  sessionLabel?: string | undefined;
  titleEn: string;
  titleBn: string;
  descriptionEn?: string | undefined;
  descriptionBn?: string | undefined;
  type: CourseMaterialType;
  /** External or CDN URL (Drive, PDF link, etc.). */
  url?: string | undefined;
  /** Inline note body (used as AI tutor grounding too). */
  bodyEn?: string | undefined;
  bodyBn?: string | undefined;
  /** Optional multi-file resource attachments (Slides PDF/PPTX, DOCX/MD notes, Canva links, Visuals, Drive folder). */
  resources?: CourseMaterialResource[] | undefined;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRecording {
  id: string;
  courseId: string;
  sessionLabel?: string | undefined;
  titleEn: string;
  titleBn: string;
  descriptionEn?: string | undefined;
  descriptionBn?: string | undefined;
  /** Zoom / YouTube / Drive / Vimeo / direct URL. */
  url: string;
  provider?: "zoom" | "youtube" | "drive" | "vimeo" | "other" | undefined;
  /** Optional Zoom recording passcode when not embedded in URL. */
  passcode?: string | undefined;
  /** Optional companion meeting notes URL (e.g. Zoom Docs). */
  notesUrl?: string | undefined;
  durationMin?: number | undefined;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseAnnouncement {
  id: string;
  courseId: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CourseKnowledgeCategory =
  | "syllabus"
  | "lecture_notes"
  | "faq"
  | "practical_rubric"
  | "policy"
  | "toolkit"
  | "reference";

/** Dedicated Knowledge Base document scoped to a single course for Student AI Tutor & Global AI Assist. */
export interface CourseKnowledgeEntry {
  id: string;
  courseId: string;
  titleEn: string;
  titleBn?: string | undefined;
  category: CourseKnowledgeCategory;
  content: string;
  tags?: string[] | undefined;
  sourceFileName?: string | undefined;
  enabled: boolean;
  pinned?: boolean | undefined;
  createdBy?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Policy for issuing an industrial course-completion certificate (not quiz-wise). */
export interface CourseCompletionRequirement {
  courseId: string;
  requireQuiz: boolean;
  requirePractical: boolean;
  requiredQuizIds?: string[] | undefined;
  quizWeightPct?: number | undefined;
  practicalWeightPct?: number | undefined;
  certificateTitleEn?: string | undefined;
  certificateTitleBn?: string | undefined;
}

export type CertificateThemePreset =
  "emerald_gold" | "dhaka_ai_navy" | "bangla_heritage" | "sovereign_slate" | "custom";

export interface CertificatePartnerLogo {
  id: string;
  name: string;
  logoUrl: string;
}

export interface CertificateSignatory {
  id: string;
  name: string;
  title: string;
  signatureText?: string | undefined;
  signatureImageUrl?: string | undefined;
  signatureStyle?: "script" | "formal" | "mono" | undefined;
  /** Optional optical scale multiplier for custom signature graphic (0.5..1.8, default 1). */
  signatureScale?: number | undefined;
}

export type CertificateScoreDisplayMode =
  | "merit_only"
  | "pure_percentage"
  | "percentage_only"
  | "full_scores"
  | "none";

/** Per-kind certificate visual design (quiz session vs course completion). */
export interface CertificateDesignProfile {
  certThemePreset?: CertificateThemePreset;
  certShowBangladeshAiMap?: boolean;
  certMapOpacity?: number;
  certBgPrimaryColor?: string;
  certBgSecondaryColor?: string;
  certAccentColor?: string;
  certBorderColor?: string;
  certCustomBgUrl?: string;
  certCustomBgOpacity?: number;
  certBadgeTitle?: string;
  certAuthoritySubtitle?: string;
  certScoreDisplayMode?: CertificateScoreDisplayMode;
  certSignatories?: CertificateSignatory[];
}

export interface BrandingSettings {
  showPartnerLogo: boolean;
  partnerName: string;
  partnerLogoUrl: string;
  institutionTitle?: string | undefined;
  leftLogoUrl?: string | undefined;
  leftLogoLabel?: string | undefined;
  rightLogoUrl?: string | undefined;
  rightLogoLabel?: string | undefined;
  rightSecondaryLogoUrl?: string | undefined;
  rightSecondaryLogoLabel?: string | undefined;
  partnerLogos?: CertificatePartnerLogo[] | undefined;
  /** @deprecated Legacy quiz-certificate fields — prefer quizCertificate. Used as quiz fallback. */
  certThemePreset?: CertificateThemePreset | undefined;
  certShowBangladeshAiMap?: boolean | undefined;
  certMapOpacity?: number | undefined;
  certBgPrimaryColor?: string | undefined;
  certBgSecondaryColor?: string | undefined;
  certAccentColor?: string | undefined;
  certBorderColor?: string | undefined;
  certCustomBgUrl?: string | undefined;
  certCustomBgOpacity?: number | undefined;
  certBadgeTitle?: string | undefined;
  certAuthoritySubtitle?: string | undefined;
  certScoreDisplayMode?: CertificateScoreDisplayMode | undefined;
  certSignatories?: CertificateSignatory[] | undefined;
  /** Design for normal quiz-session certificates. Falls back to top-level cert* when unset. */
  quizCertificate?: CertificateDesignProfile | undefined;
  /** Design for course completion / final-exam package certificates. */
  courseCertificate?: CertificateDesignProfile | undefined;
  defaultEnforceFullscreen?: boolean | undefined;
  defaultBlockCopyPaste?: boolean | undefined;
  defaultMaxProctorViolations?: number | undefined;
  defaultPassThresholdPct?: number | undefined;
  enforceFullscreenDefault?: boolean | undefined;
  blockCopyPasteDefault?: boolean | undefined;
  maxProctorViolationsDefault?: number | undefined;
  /**
   * Student Portal sign-in mode.
   * - password (default): Roll/Username/Email + Password (OTP used only for password reset, minimal mail load)
   * - password_or_otp: Password primary with optional one-time code tab
   * - otp_only: Legacy passwordless OTP sign-in only
   */
  portalAuthMode?: "password" | "password_or_otp" | "otp_only" | undefined;
  /**
   * Student Portal OTP / password-reset delivery channel.
   * - email (default): verification & reset codes sent via Resend/Brevo email
   * - mobile: verification & reset codes sent via SMS (GREENWEB)
   */
  portalAuthChannel?: "email" | "mobile" | undefined;
  updatedAt?: number | undefined;
}

// ============================================================================
// MULTI-PROVIDER AI POOL & ORCHESTRATION TYPES
// ============================================================================

export type AiProviderId =
  | "openrouter"
  | "gemini"
  | "openai"
  | "anthropic"
  | "groq"
  | "deepseek"
  | "mistral"
  | "xai"
  | "together"
  | "custom";

export type AiPoolRoutingStrategy =
  | "priority_failover"
  | "round_robin"
  | "weighted_random"
  | "fastest_latency";

export type AiTaskCapability =
  | "quiz_generation"
  | "course_tutor"
  | "practical_grading"
  | "lms_authoring"
  | "exam_analytics";

export type AiNodeHealthStatus = "healthy" | "degraded" | "cooldown" | "error" | "untested";

export interface AiPoolNode {
  id: string;
  label: string;
  provider: AiProviderId;
  apiKey: string;
  baseUrl?: string | undefined;
  model: string;
  fallbackModels?: string[] | undefined;
  enabled: boolean;
  priority: number;
  weight: number;
  capabilities?: AiTaskCapability[] | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  timeoutMs?: number | undefined;
  notes?: string | undefined;
  status: AiNodeHealthStatus;
  cooldownUntil?: number | undefined;
  lastLatencyMs?: number | undefined;
  avgLatencyMs?: number | undefined;
  totalRequests: number;
  totalFailures: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastSuccessAt?: string | undefined;
  lastErrorAt?: string | undefined;
  lastError?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedAiPoolNode extends Omit<AiPoolNode, "apiKey"> {
  hasApiKey: boolean;
  apiKeyMasked: string;
  source: "pool" | "env" | "legacy_gemini";
  readOnly?: boolean | undefined;
}

export interface AiPoolExecutionLog {
  id: string;
  timestamp: string;
  task: AiTaskCapability;
  nodeId: string;
  nodeLabel: string;
  provider: AiProviderId;
  model: string;
  success: boolean;
  latencyMs: number;
  failoverAttempts: number;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  error?: string | undefined;
  actorName?: string | undefined;
}

export interface AiPoolConfig {
  strategy: AiPoolRoutingStrategy;
  cooldownSeconds: number;
  maxFailoverAttempts: number;
  defaultTimeoutMs: number;
  taskPreferredNodeIds?: Partial<Record<AiTaskCapability, string>> | undefined;
  nodes: AiPoolNode[];
  logs: AiPoolExecutionLog[];
  updatedAt?: string | undefined;
}

export interface SanitizedAiPoolConfig {
  strategy: AiPoolRoutingStrategy;
  cooldownSeconds: number;
  maxFailoverAttempts: number;
  defaultTimeoutMs: number;
  taskPreferredNodeIds: Partial<Record<AiTaskCapability, string>>;
  nodes: SanitizedAiPoolNode[];
  logs: AiPoolExecutionLog[];
  summary: {
    totalNodes: number;
    enabledNodes: number;
    healthyNodes: number;
    cooldownNodes: number;
    totalRequests: number;
    totalFailures: number;
    successRatePct: number;
    avgLatencyMs: number;
    providersActive: AiProviderId[];
  };
  updatedAt?: string | undefined;
}

export type Language = 'en' | 'bn';

export type QuestionType =
  | 'single_mcq'
  | 'multi_mcq'
  | 'true_false'
  | 'fill_blank'
  | 'written'
  | 'poll'
  | 'matching'
  | 'ordering'
  | 'image_mcq';

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
  difficulty?: 'easy' | 'medium' | 'hard' | undefined;
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
  status?: 'active' | 'archived' | string | undefined;
  createdAt: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instructor' | 'candidate';
  institutionName?: string | undefined;
  institution?: string | undefined;
  designation?: string | undefined;
  phone?: string | undefined;
  plan?: string | undefined;
  /** Stored only on server; stripped from client bootstrap/auth responses. May be sent on create/password update. */
  passwordHash?: string | undefined;
  assignedCourseIds?: string[] | undefined;
  status?: 'active' | 'suspended' | undefined;
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
  totalTimeSec?: number | undefined;
  tags?: string[] | undefined;
  createdAt?: string | undefined;
}

export type SessionPhase =
  | 'lobby'
  | 'countdown'
  | 'question'
  | 'chart'
  | 'leaderboard'
  | 'podium'
  | 'finished';

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
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'copy_attempt' | 'devtools_attempt';
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
}

export interface GameSettings {
  timePerQuestion?: number | undefined;
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

export interface CertificateData {
  id: string;
  certificateNumber: string;
  studentName: string;
  studentRoll?: string;
  regionName?: string;
  quizTitle: string;
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
  answersJson?: string | undefined;
  createdAt: string;
}

export interface BrandingSettings {
  showPartnerLogo: boolean;
  partnerName: string;
  partnerLogoUrl: string;
  institutionTitle?: string | undefined;
  defaultEnforceFullscreen?: boolean | undefined;
  defaultBlockCopyPaste?: boolean | undefined;
  defaultMaxProctorViolations?: number | undefined;
  enforceFullscreenDefault?: boolean | undefined;
  blockCopyPasteDefault?: boolean | undefined;
  maxProctorViolationsDefault?: number | undefined;
  updatedAt?: number | undefined;
}


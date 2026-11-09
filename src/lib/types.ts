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
  explanationEn?: string;
  explanationBn?: string;
  timeLimitSec: number;
  points: number;
  negativeMarks?: number; // e.g. 0.25, 0.5
  imageUrl?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
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
  color?: string;
  questions: Question[];
  author?: string;
  isTemplate?: boolean;
  totalTimeSec?: number;
  tags?: string[];
  createdAt?: string;
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
  writtenAnswer?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  timeTakenSec: number;
  streakCount?: number;
  answeredAt?: number;
}

export interface ProctorIncidentRecord {
  id: string;
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit';
  timestamp: string;
  candidateId: string;
  candidateName: string;
  rollNumber?: string;
  regionName?: string;
}

export interface Participant {
  id: string;
  candidateId?: string;
  name: string;
  nickname: string;
  avatarEmoji: string;
  avatarBg: string;
  rollNumber?: string;
  phone?: string;
  regionId?: string;
  regionName?: string;
  batch?: string;
  seatToken?: string;
  score: number;
  streak: number;
  rank: number;
  isBot?: boolean;
  answers: Record<string, ParticipantAnswer>;
  connected: boolean;
  lastActive: number;
  proctorFlags?: number;
  isSuspended?: boolean;
}

export interface GameSettings {
  timePerQuestion?: number;
  speedBonus: boolean;
  negativeMarking: number; // 0, 0.25, 0.5, 1.0
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  isFormalAssessment: boolean;
  requireRollNumber: boolean;
  requireRosterVerification?: boolean;
  allowedRegionId?: string; // 'all' or specific region.id
  allowedRegionName?: string;
}

export interface GameSession {
  pin: string;
  quizId: string;
  quizTitleEn: string;
  quizTitleBn: string;
  hostId: string;
  phase: SessionPhase;
  currentQuestionIndex: number;
  currentQuestion?: Question;
  questionStartTime: number;
  questionEndTime: number;
  settings: GameSettings;
  participants: Record<string, Participant>;
  totalQuestions: number;
  createdAt: number;
  updatedAt?: number;
  answeredCount?: number;
  participantCount?: number;
  proctorIncidents?: ProctorIncidentRecord[];
}

export interface RosterStudent {
  id: string;
  rollNumber: string;
  name: string;
  phone?: string;
  regionId?: string;
  regionName?: string;
  section?: string;
  batch?: string;
  guardianPhone?: string;
  email?: string;
  passcode?: string;
  createdAt?: string;
}

export interface MeritParticipant {
  id: string;
  nickname: string;
  rollNumber?: string;
  regionId?: string;
  regionName?: string;
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
  phone?: string;
  regionId?: string;
  regionName?: string;
  score: number;
  rank: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracyPct: number;
  answersJson?: string;
  createdAt: string;
}

export interface BrandingSettings {
  showPartnerLogo: boolean;
  partnerName: string;
  partnerLogoUrl: string;
  institutionTitle?: string;
  updatedAt?: number;
}


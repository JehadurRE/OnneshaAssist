import { BrandingSettings, Question } from "./types";

export function computeTotalQuizMarks(
  questions?: Pick<Question, "points">[] | null,
  fallbackTotalQuestions = 5,
): number {
  if (questions && questions.length > 0) {
    const sum = questions.reduce((acc, q) => acc + (q.points || 1000), 0);
    if (sum > 0) return sum;
  }
  return Math.max(1, fallbackTotalQuestions) * 1000;
}

export function resolveOrgName(branding?: BrandingSettings): string {
  if (branding?.showPartnerLogo && branding?.partnerName?.trim()) {
    return `Onnesha × ${branding.partnerName.trim()}`;
  }
  return "Onnesha Assessment & Examination Arena";
}

export interface EvaluateAnswerInput {
  question: Question;
  selectedOptionIds?: string[];
  writtenAnswer?: string;
  currentStreak: number;
  timeTakenSec: number;
  speedBonus: boolean;
  negativeMarking: number;
}

export interface EvaluateAnswerResult {
  isCorrect: boolean;
  pointsAwarded: number;
  newStreak: number;
}

/**
 * Pure server/domain grading function used by live & practice exam scoring.
 */
export function evaluateQuestionAnswer(input: EvaluateAnswerInput): EvaluateAnswerResult {
  const {
    question,
    selectedOptionIds = [],
    writtenAnswer = "",
    currentStreak,
    timeTakenSec,
    speedBonus,
    negativeMarking,
  } = input;

  let isCorrect = false;
  const isWrittenStyle = question.type === "written" || question.type === "fill_blank";

  if (isWrittenStyle) {
    const acceptedPool = [
      ...(question.acceptedAnswers || []),
      ...(question.correctOptionIds || []),
      ...question.options.filter((o) => o.isCorrect).flatMap((o) => [o.textEn, o.textBn]),
    ]
      .map((s) => (s || "").trim().toLowerCase())
      .filter(Boolean);

    const cleanWritten = writtenAnswer.trim().toLowerCase();
    isCorrect = cleanWritten.length > 0 && acceptedPool.includes(cleanWritten);
  } else if (question.correctOptionIds && question.correctOptionIds.length > 0) {
    isCorrect =
      question.correctOptionIds.length === selectedOptionIds.length &&
      question.correctOptionIds.every((id) => selectedOptionIds.includes(id));
  }

  let pointsAwarded = 0;
  let newStreak = currentStreak;

  if (isCorrect) {
    newStreak = currentStreak + 1;
    const streakMultiplier = newStreak >= 3 ? 1.5 : newStreak >= 2 ? 1.2 : 1.0;
    const clampedTime = Math.max(1, Math.min(question.timeLimitSec || 20, timeTakenSec));
    const speedFactor = speedBonus
      ? Math.max(0.5, 1 - (clampedTime / (question.timeLimitSec || 20)) * 0.5)
      : 1;
    pointsAwarded = Math.round((question.points || 1000) * speedFactor * streakMultiplier);
  } else {
    newStreak = 0;
    if (negativeMarking > 0) {
      pointsAwarded = -Math.round((question.points || 1000) * negativeMarking);
    }
  }

  return {
    isCorrect,
    pointsAwarded,
    newStreak,
  };
}

export interface OmrGradingResult {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  rawScore: number;
  negativeDeduction: number;
  netScore: number;
  maxPossibleScore: number;
  accuracyPct: number;
}

/**
 * Computes OMR optical grading marks using per-question weight and negative mark fraction.
 * Scales 1000-point online questions down to 1.0-mark OMR equivalents while preserving ratios
 * when custom weights are assigned.
 */
export function gradeOmrSubmission(
  questions: Question[],
  filledBubbles: Record<number, string>,
  defaultNegativeRate = 0.25,
): OmrGradingResult {
  let correct = 0;
  let incorrect = 0;
  let attempted = 0;
  let rawScore = 0;
  let negativeDeduction = 0;
  let maxPossibleScore = 0;

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const rawPts = q.points || 1000;
    const weight = rawPts >= 100 ? rawPts / 1000 : rawPts;
    const negRate =
      typeof q.negativeMarks === "number" && q.negativeMarks >= 0
        ? q.negativeMarks
        : defaultNegativeRate;

    maxPossibleScore += weight;
    const selected = filledBubbles[qNum];
    if (!selected) return;

    attempted++;
    const isWrittenStyle = q.type === "written" || q.type === "fill_blank";
    let isRight = false;

    if (isWrittenStyle) {
      // Support both explicit examiner Pass marker ('PASS') and legacy bubble 'A'
      isRight = selected === "PASS" || selected === "A";
    } else {
      const optionIndex = ["A", "B", "C", "D"].indexOf(selected);
      const opt = q.options[optionIndex];
      isRight = Boolean(opt && (q.correctOptionIds.includes(opt.id) || opt.isCorrect));
    }

    if (isRight) {
      correct++;
      rawScore += weight;
    } else {
      incorrect++;
      negativeDeduction += weight * negRate;
    }
  });

  const netScore = Math.max(0, rawScore - negativeDeduction);
  const accuracyPct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  return {
    totalQuestions: questions.length,
    attempted,
    correct,
    incorrect,
    rawScore,
    negativeDeduction,
    netScore,
    maxPossibleScore: maxPossibleScore || questions.length,
    accuracyPct,
  };
}

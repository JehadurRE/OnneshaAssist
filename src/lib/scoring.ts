import { BrandingSettings, GameSettings, Participant, Question } from "./types";

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

export const DEFAULT_PASS_THRESHOLD_PCT = 50;

export function clampPassThresholdPct(
  value: number | undefined | null,
  fallback = DEFAULT_PASS_THRESHOLD_PCT,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return Math.max(0, Math.min(100, Math.round(fallback)));
  }
  return DEFAULT_PASS_THRESHOLD_PCT;
}

export function resolvePassThresholdPct(options?: {
  sessionThreshold?: number | null | undefined;
  courseThreshold?: number | null | undefined;
  brandingDefaultThreshold?: number | null | undefined;
}): number {
  if (typeof options?.sessionThreshold === "number" && Number.isFinite(options.sessionThreshold)) {
    return clampPassThresholdPct(options.sessionThreshold);
  }
  if (typeof options?.courseThreshold === "number" && Number.isFinite(options.courseThreshold)) {
    return clampPassThresholdPct(options.courseThreshold);
  }
  if (
    typeof options?.brandingDefaultThreshold === "number" &&
    Number.isFinite(options.brandingDefaultThreshold)
  ) {
    return clampPassThresholdPct(options.brandingDefaultThreshold);
  }
  return DEFAULT_PASS_THRESHOLD_PCT;
}

export function isPassingScore(
  accuracyPct: number | undefined | null,
  thresholdPct?: number | null,
): boolean {
  const safeThreshold = clampPassThresholdPct(thresholdPct);
  const safeAccuracy =
    typeof accuracyPct === "number" && Number.isFinite(accuracyPct) ? accuracyPct : 0;
  return safeAccuracy >= safeThreshold;
}

export function computeParticipantAccuracyPct(params: {
  answers?: Array<{ isCorrect?: boolean | undefined } | null | undefined> | undefined;
  correctCount?: number | undefined;
  totalQuestions?: number | undefined;
  score?: number | undefined;
  totalMarks?: number | undefined;
}): number {
  const answersLen = params.answers?.length ?? 0;
  const totalQuestions = Math.max(params.totalQuestions ?? 0, answersLen, 0);
  const correct =
    typeof params.correctCount === "number" && Number.isFinite(params.correctCount)
      ? Math.max(0, params.correctCount)
      : (params.answers?.filter((a) => Boolean(a?.isCorrect)).length ?? 0);

  const questionPct =
    totalQuestions > 0 ? Math.min(100, Math.round((correct / totalQuestions) * 100)) : 0;

  if (
    typeof params.score === "number" &&
    Number.isFinite(params.score) &&
    params.score > 0 &&
    typeof params.totalMarks === "number" &&
    Number.isFinite(params.totalMarks) &&
    params.totalMarks > 0
  ) {
    const avgMarkPerQuestion = totalQuestions > 0 ? params.totalMarks / totalQuestions : 1000;
    const scoreExceedsLoggedAnswers =
      answersLen === 0
        ? correct === 0
        : params.score > Math.max(1, correct) * avgMarkPerQuestion * 1.5;

    if (scoreExceedsLoggedAnswers) {
      return Math.max(0, Math.min(100, Math.round((params.score / params.totalMarks) * 100)));
    }
  }

  return questionPct;
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
  const basePoints =
    typeof question.points === "number" && question.points > 0 ? question.points : 1000;
  const roundMarks = (val: number) =>
    basePoints < 100 ? Math.round(val * 100) / 100 : Math.round(val);

  if (isCorrect) {
    newStreak = currentStreak + 1;
    const streakMultiplier = newStreak >= 3 ? 1.5 : newStreak >= 2 ? 1.2 : 1.0;
    const limit = Math.max(1, question.timeLimitSec || 20);
    const clampedTime = Math.max(0.1, Math.min(limit, timeTakenSec));
    const speedFactor = speedBonus ? Math.max(0.5, 1 - (clampedTime / limit) * 0.5) : 1;
    pointsAwarded = roundMarks(basePoints * speedFactor * streakMultiplier);
  } else {
    newStreak = 0;
    if (negativeMarking > 0) {
      pointsAwarded = -roundMarks(basePoints * negativeMarking);
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
    } else if (q.type === "multi_mcq") {
      const letters = ["A", "B", "C", "D"];
      const expectedLetters = new Set(
        q.options
          .map((opt, oIdx) =>
            q.correctOptionIds.includes(opt.id) || opt.isCorrect ? letters[oIdx] : null,
          )
          .filter((l): l is string => Boolean(l)),
      );
      const selectedLetters = new Set(
        selected
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => letters.includes(s)),
      );
      isRight =
        expectedLetters.size > 0 &&
        selectedLetters.size === expectedLetters.size &&
        [...expectedLetters].every((l) => selectedLetters.has(l));
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

export const DEFAULT_START_COUNTDOWN_SEC = 3;

export function resolveQuestionTimeLimitSec(
  question?: Pick<Question, "timeLimitSec"> | null,
  settings?: Pick<GameSettings, "timePerQuestion"> | null,
): number {
  const override = settings?.timePerQuestion;
  if (typeof override === "number" && Number.isFinite(override) && override >= 5) {
    return Math.max(5, Math.min(600, Math.round(override)));
  }
  const qLimit = question?.timeLimitSec;
  if (typeof qLimit === "number" && Number.isFinite(qLimit) && qLimit >= 5) {
    return Math.max(5, Math.min(600, Math.round(qLimit)));
  }
  return 20;
}

export function resolveStartCountdownSec(startCountdownSec?: number | null): number {
  if (typeof startCountdownSec === "number" && Number.isFinite(startCountdownSec)) {
    return Math.max(0, Math.min(30, Math.round(startCountdownSec)));
  }
  return DEFAULT_START_COUNTDOWN_SEC;
}

export function splitBetweenQuestionDelays(betweenQuestionSec?: number | null): {
  enabled: boolean;
  totalSec: number;
  chartSec: number;
  leaderboardSec: number;
} {
  if (
    typeof betweenQuestionSec !== "number" ||
    !Number.isFinite(betweenQuestionSec) ||
    betweenQuestionSec <= 0
  ) {
    return { enabled: false, totalSec: 0, chartSec: 0, leaderboardSec: 0 };
  }
  const totalSec = Math.max(2, Math.min(120, Math.round(betweenQuestionSec)));
  const chartSec = Math.max(1, Math.ceil(totalSec / 2));
  const leaderboardSec = Math.max(1, totalSec - chartSec);
  return { enabled: true, totalSec, chartSec, leaderboardSec };
}

export function computeSpeedBonusPct(
  timeTakenSec: number,
  timeLimitSec: number,
  speedBonus: boolean,
): number {
  if (!speedBonus) return 100;
  const limit = Math.max(1, timeLimitSec || 20);
  const clamped = Math.max(0.1, Math.min(limit, timeTakenSec || limit));
  const factor = Math.max(0.5, 1 - (clamped / limit) * 0.5);
  return Math.round(factor * 100);
}

export function computeParticipantTotalTimeSec(
  participant: Pick<Participant, "answers" | "totalResponseTimeSec">,
): number {
  const answersList = Object.values(participant.answers || {});
  if (answersList.length > 0) {
    const sum = answersList.reduce(
      (acc, ans) =>
        acc +
        (typeof ans?.timeTakenSec === "number" && Number.isFinite(ans.timeTakenSec)
          ? Math.max(0, ans.timeTakenSec)
          : 0),
      0,
    );
    return Math.round(sum * 100) / 100;
  }
  if (
    typeof participant.totalResponseTimeSec === "number" &&
    Number.isFinite(participant.totalResponseTimeSec) &&
    participant.totalResponseTimeSec >= 0
  ) {
    return Math.round(participant.totalResponseTimeSec * 100) / 100;
  }
  return 0;
}

/**
 * Ranks examinees deterministically by total marks first, then accuracy count,
 * then faster cumulative response time (speed tie-breaker), then earliest activity.
 */
export function compareParticipantsByMerit(
  a: Pick<Participant, "score" | "answers" | "totalResponseTimeSec" | "lastActive">,
  b: Pick<Participant, "score" | "answers" | "totalResponseTimeSec" | "lastActive">,
): number {
  if (b.score !== a.score) return b.score - a.score;

  const ansA = Object.values(a.answers || {});
  const ansB = Object.values(b.answers || {});
  if (ansA.length > 0 || ansB.length > 0) {
    const correctA = ansA.filter((ans) => ans?.isCorrect).length;
    const correctB = ansB.filter((ans) => ans?.isCorrect).length;
    if (correctB !== correctA) return correctB - correctA;
  }

  const timeA = computeParticipantTotalTimeSec(a);
  const timeB = computeParticipantTotalTimeSec(b);
  const hasTimedA = timeA > 0;
  const hasTimedB = timeB > 0;
  if (hasTimedA && hasTimedB && Math.abs(timeA - timeB) > 0.005) {
    return timeA - timeB;
  }
  if (hasTimedA !== hasTimedB) {
    return hasTimedA ? -1 : 1;
  }

  return a.lastActive - b.lastActive;
}

export function mergeSessionSettingsPatch(
  current: GameSettings,
  patch: Partial<GameSettings>,
): GameSettings {
  const next: GameSettings = { ...current, ...patch };

  if (typeof patch.passThresholdPct === "number" && Number.isFinite(patch.passThresholdPct)) {
    next.passThresholdPct = clampPassThresholdPct(patch.passThresholdPct);
  }
  if (typeof patch.negativeMarking === "number" && Number.isFinite(patch.negativeMarking)) {
    next.negativeMarking = Math.max(0, Math.min(10, Math.round(patch.negativeMarking * 100) / 100));
  }
  if (
    typeof patch.maxProctorViolations === "number" &&
    Number.isFinite(patch.maxProctorViolations)
  ) {
    next.maxProctorViolations = Math.max(1, Math.min(20, Math.round(patch.maxProctorViolations)));
  }
  if ("speedBonus" in patch && typeof patch.speedBonus === "boolean") {
    next.speedBonus = patch.speedBonus;
  }
  if ("timePerQuestion" in patch) {
    if (
      typeof patch.timePerQuestion === "number" &&
      Number.isFinite(patch.timePerQuestion) &&
      patch.timePerQuestion > 0
    ) {
      next.timePerQuestion = Math.max(5, Math.min(600, Math.round(patch.timePerQuestion)));
    } else {
      delete next.timePerQuestion;
    }
  }
  if ("betweenQuestionSec" in patch) {
    if (
      typeof patch.betweenQuestionSec === "number" &&
      Number.isFinite(patch.betweenQuestionSec) &&
      patch.betweenQuestionSec > 0
    ) {
      next.betweenQuestionSec = Math.max(2, Math.min(120, Math.round(patch.betweenQuestionSec)));
    } else {
      next.betweenQuestionSec = 0;
    }
  }
  if ("startCountdownSec" in patch) {
    next.startCountdownSec = resolveStartCountdownSec(patch.startCountdownSec);
  }
  if ("retakeSkipCompleted" in patch && typeof patch.retakeSkipCompleted === "boolean") {
    next.retakeSkipCompleted = patch.retakeSkipCompleted;
  }
  if (
    "retakeMinCompletedAnswers" in patch &&
    typeof patch.retakeMinCompletedAnswers === "number" &&
    Number.isFinite(patch.retakeMinCompletedAnswers)
  ) {
    next.retakeMinCompletedAnswers = Math.max(
      1,
      Math.min(500, Math.round(patch.retakeMinCompletedAnswers)),
    );
  }

  return next;
}

/**
 * Recomputes a participant's cumulative live score across all submitted answers.
 * Clamping only the final total at 0 guarantees negative-marking is order-independent.
 */
export function computeParticipantTotalScore(answers: Participant["answers"] | undefined): number {
  const sum = Object.values(answers || {}).reduce(
    (acc, ans) =>
      acc +
      (typeof ans?.pointsAwarded === "number" && Number.isFinite(ans.pointsAwarded)
        ? ans.pointsAwarded
        : 0),
    0,
  );
  return Math.max(0, Math.round(sum * 100) / 100);
}

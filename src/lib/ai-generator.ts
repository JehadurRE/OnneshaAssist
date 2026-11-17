import { generateQuizViaGeminiRest, CoreAiQuizRequest } from "./ai-quiz-core";
import { Quiz } from "./types";
import { serverGenerateQuizWithAi } from "./server-session";

export interface AiGenerateParams {
  topic: string;
  sourceText?: string | undefined;
  questionCount: number; // 3, 5, 10, 20
  language: "bn" | "en" | "both";
  difficulty: "easy" | "medium" | "hard";
  category: string;
  courseId?: string | undefined;
  courseTitle?: string | undefined;
  quizNumber?: number | undefined;
  instructorId?: string | undefined;
  instructorName?: string | undefined;
  questionStyleMode?: "mixed_all_4" | "single_mcq" | undefined;
  apiKey?: string | undefined;
}

export function getAiCredits(): number {
  if (typeof window === "undefined") return 50;
  try {
    const credits = localStorage.getItem("onnesha_ai_credits");
    return credits !== null ? parseInt(credits, 10) : 50;
  } catch {
    return 50;
  }
}

export function deductAiCredits(amount: number): number {
  if (typeof window === "undefined") return 50;
  try {
    const current = getAiCredits();
    const next = Math.max(0, current - amount);
    localStorage.setItem("onnesha_ai_credits", next.toString());
    return next;
  } catch {
    return 50;
  }
}

export function getStoredLocalGeminiKey(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("onnesha_gemini_key")?.trim();
    return raw && raw.length >= 10 ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Generates a real bilingual quiz via live Gemini models (`gemini-2.5-flash` -> `gemini-2.0-flash`).
 * Never silently falls back to hardcoded dummy questions on missing keys or API failures.
 */
export async function generateQuizWithAi(params: AiGenerateParams): Promise<Quiz> {
  const count = Math.min(20, Math.max(3, params.questionCount || 5));
  const styleMode = params.questionStyleMode || "mixed_all_4";
  const clientApiKey = params.apiKey?.trim() || getStoredLocalGeminiKey();

  const coreRequest: CoreAiQuizRequest = {
    topic: params.topic,
    sourceText: params.sourceText,
    questionCount: count,
    difficulty: params.difficulty,
    category: params.category,
    courseId: params.courseId,
    courseTitle: params.courseTitle,
    quizNumber: params.quizNumber,
    instructorId: params.instructorId,
    instructorName: params.instructorName,
    questionStyleMode: styleMode,
  };

  let serverKeyMissing = false;
  let serverError: string | undefined;

  // Prefer server-side synthesis first so shared Admin/env keys stay confidential on the server
  try {
    const serverRes = await serverGenerateQuizWithAi({
      data: {
        topic: params.topic,
        sourceText: params.sourceText,
        questionCount: count,
        difficulty: params.difficulty,
        category: params.category,
        courseId: params.courseId,
        courseTitle: params.courseTitle,
        quizNumber: params.quizNumber,
        questionStyleMode: styleMode,
        ...(clientApiKey ? { clientApiKey } : {}),
      },
    });
    if (serverRes.success && serverRes.quiz) {
      if (typeof serverRes.remainingCredits === "number" && typeof window !== "undefined") {
        localStorage.setItem("onnesha_ai_credits", serverRes.remainingCredits.toString());
      }
      return serverRes.quiz;
    }
    if (serverRes.error) {
      if (serverRes.error.includes("GEMINI_API_KEY")) {
        serverKeyMissing = true;
      } else {
        serverError = serverRes.error;
      }
    }
  } catch (err) {
    // Only fall back to direct REST call if Start RPC endpoint itself is unreachable (e.g., unit/offline mode)
    const msg = err instanceof Error ? err.message : "";
    if (
      msg &&
      !msg.toLowerCase().includes("fetch") &&
      !msg.toLowerCase().includes("start context")
    ) {
      serverError = msg;
    }
  }

  if (serverError) {
    throw new Error(serverError);
  }

  // Fallback direct client Gemini call ONLY when server RPC was unreachable & user supplied a local key
  if (clientApiKey && !serverKeyMissing) {
    const quiz = await generateQuizViaGeminiRest(clientApiKey, coreRequest);
    deductAiCredits(1);
    return quiz;
  }

  throw new Error(
    "No Google Gemini API key is configured. Enter your Google AI Studio key (AIza...) below or configure GEMINI_API_KEY on the server — off-topic dummy fallback is disabled.",
  );
}

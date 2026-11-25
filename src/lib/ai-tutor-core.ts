import { stripMarkdownJsonFence } from "./ai-quiz-core";
import { executeAiPoolRequest, type AiChatMessage } from "./ai-pool";
import type { AiPoolConfig, AiProviderId } from "./types";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

export type TutorStudyMode = "explain" | "practice" | "capstone" | "summary";

export interface TutorHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildTutorSystemPrompt(params: {
  context: string;
  lang?: "en" | "bn" | undefined;
  mode?: TutorStudyMode | undefined;
}): string {
  const langLine =
    params.lang === "bn"
      ? "Prefer answering in clear, natural Bangladeshi Bengali; keep technical tool names in English when needed."
      : "Answer in clear, crisp English; include brief Bengali key terms when helpful for learners in Bangladesh.";

  const modeLine =
    params.mode === "practice"
      ? "Mode: Exam Practice Coach. Answer clearly, then add 2 short exam-style self-check questions (with hidden/compact answers at the bottom) based strictly on the course materials."
      : params.mode === "capstone"
        ? "Mode: Capstone & Practical Checklist Coach. Give a step-by-step actionable deliverable checklist, grading tips, and common pitfalls to avoid."
        : params.mode === "summary"
          ? "Mode: Rapid Revision Summary. Provide structured bullet points, key formulas/workflows, and a 3-point exam takeaway box."
          : "Mode: Concept Tutor. Explain clearly with practical examples directly tied to the course materials.";

  return `You are Onnesha Course Tutor for an applied AI, digital marketing, and institutional training platform in Bangladesh.
${langLine}
${modeLine}
Ground EVERY answer ONLY in the COURSE MATERIALS below. If the materials do not cover a detail, state clearly what is missing and point to the closest relevant session to study — NEVER invent syllabus facts.
Be concise, encouraging, well-structured (use short headings or bullet lists), and exam-helpful.

COURSE MATERIALS:
"""
${params.context}
"""`;
}

export async function askCourseTutorViaAiPool(
  pool: AiPoolConfig,
  params: {
    question: string;
    context: string;
    lang?: "en" | "bn" | undefined;
    mode?: TutorStudyMode | undefined;
    history?: TutorHistoryTurn[] | undefined;
    preferredNodeId?: string | undefined;
    actorName?: string | undefined;
  },
  options?: {
    legacyServerGeminiKey?: string | undefined;
    onMutate?: () => void;
  },
): Promise<{
  answer: string;
  model: string;
  provider: AiProviderId;
  nodeLabel: string;
  latencyMs: number;
}> {
  const q = params.question.trim();
  if (q.length < 2) throw new Error("Ask a real question about your course materials.");
  if (!params.context.trim()) {
    throw new Error(
      "No published course materials yet. Ask your instructor to add Learning Content.",
    );
  }

  const systemPrompt = buildTutorSystemPrompt({
    context: params.context,
    lang: params.lang,
    mode: params.mode,
  });

  const recentHistory: AiChatMessage[] = (params.history || [])
    .slice(-8)
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && h.content.trim())
    .map((h) => ({
      role: h.role,
      content: h.content.trim().slice(0, 2000),
    }));

  const messages: AiChatMessage[] = [...recentHistory, { role: "user", content: q }];

  const res = await executeAiPoolRequest(
    pool,
    {
      task: "course_tutor",
      systemPrompt,
      messages,
      jsonMode: false,
      temperature: 0.35,
      maxTokens: 1600,
      preferredNodeId: params.preferredNodeId,
      actorName: params.actorName,
    },
    options,
  );

  return {
    answer: stripMarkdownJsonFence(res.text).trim(),
    model: res.model,
    provider: res.provider,
    nodeLabel: res.nodeLabel,
    latencyMs: res.latencyMs,
  };
}

export async function askCourseTutorViaGemini(params: {
  apiKey: string;
  question: string;
  context: string;
  lang?: "en" | "bn" | undefined;
}): Promise<{ answer: string; model: string }> {
  const cleanKey = params.apiKey.trim();
  if (cleanKey.length < 10) throw new Error("A valid Google Gemini API key is required.");
  const q = params.question.trim();
  if (q.length < 2) throw new Error("Ask a real question about your course materials.");
  if (!params.context.trim()) {
    throw new Error("No published course materials yet. Ask your instructor to add Learning Content.");
  }

  const prompt = `${buildTutorSystemPrompt({
    context: params.context,
    lang: params.lang,
    mode: "explain",
  })}\n\nSTUDENT QUESTION:\n${q}\n\nReturn plain helpful text (no JSON).`;

  let lastError = "AI tutor failed.";
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i]!;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35 },
        }),
      },
    );
    if (!response.ok) {
      lastError = `Gemini API HTTP ${response.status}`;
      if ((response.status === 404 || response.status === 503) && i < GEMINI_MODELS.length - 1) {
        continue;
      }
      throw new Error(lastError);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText?.trim()) {
      lastError = `Empty response from ${model}`;
      if (i < GEMINI_MODELS.length - 1) continue;
      throw new Error(lastError);
    }
    return { answer: stripMarkdownJsonFence(rawText).trim(), model };
  }
  throw new Error(lastError);
}

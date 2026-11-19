import { stripMarkdownJsonFence } from "./ai-quiz-core";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

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

  const langLine =
    params.lang === "bn"
      ? "Prefer answering in clear Bangladeshi Bengali; keep tool names in English when needed."
      : "Answer in clear English; you may add a short Bengali summary if helpful.";

  const prompt = `You are Onnesha Course Tutor for an applied AI / digital marketing course in Bangladesh.
${langLine}
Ground EVERY answer ONLY in the COURSE MATERIALS below. If the materials do not cover the question, say what is missing and suggest what section to study — do NOT invent syllabus facts.
Be concise, practical, and exam-helpful (Final Exam = timed MCQ + capstone package).

COURSE MATERIALS:
"""
${params.context}
"""

STUDENT QUESTION:
${q}

Return plain helpful text (no JSON).`;

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

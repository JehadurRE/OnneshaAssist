import { Question, QuestionType, Quiz } from "./types";

export interface CoreAiQuizRequest {
  topic: string;
  sourceText?: string | undefined;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  courseId?: string | undefined;
  courseTitle?: string | undefined;
  quizNumber?: number | undefined;
  instructorId?: string | undefined;
  instructorName?: string | undefined;
  questionStyleMode?: "mixed_all_4" | "single_mcq" | undefined;
}

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

export function resolveEnvGeminiApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const raw = process.env["GEMINI_API_KEY"]?.trim() || process.env["GOOGLE_API_KEY"]?.trim();
  return raw && raw.length >= 10 ? raw : undefined;
}

export function buildGeminiQuizPrompt(data: CoreAiQuizRequest, count: number): string {
  const styleMode = data.questionStyleMode || "mixed_all_4";
  const styleInstructions =
    styleMode === "mixed_all_4"
      ? `Include a balanced mix of question types: "single_mcq" (4 options, 1 correct), "true_false" (2 options: True/সত্য and False/মিথ্যা), "multi_mcq" (4 options, 2 or 3 correct), and "written" (options: [], acceptedAnswers: ["answer in English", "বাংলায় উত্তর"]).`
      : `All questions must be "single_mcq" with 4 distinct options and exactly 1 correct option.`;

  const sourceBlock = data.sourceText?.trim()
    ? `Source Syllabus / Lecture Notes (PRIORITIZE & GROUND all questions in these exact concepts, tools, workflows, and metrics):\n"""\n${data.sourceText.trim()}\n"""`
    : `Focus strictly on authentic, rigorous domain questions about "${data.topic}" (do NOT fall back to generic off-topic trivia).`;

  return `You are a senior academic & technical assessment author in Bangladesh.
Generate an exact ${count}-question bilingual (English + natural Bangladeshi Bengali) exam on the topic: "${data.topic}".
Course context: "${data.courseTitle || data.category}".
Difficulty: ${data.difficulty}.
${sourceBlock}

Style requirements:
${styleInstructions}
- Avoid trivial copy-paste recall when difficulty is "medium" or "hard"; write clear scenario-based or applied conceptual questions with plausible distractors.
- Every MCQ/Multi option must have balanced, distinct distractors and an accurate explanation in both English and Bengali.

Return ONLY a valid JSON object matching this exact schema (no markdown commentary):
{
  "titleEn": "string",
  "titleBn": "string",
  "descriptionEn": "string",
  "descriptionBn": "string",
  "categoryEn": "string",
  "categoryBn": "string",
  "questions": [
    {
      "type": "single_mcq" | "true_false" | "multi_mcq" | "written",
      "textEn": "Question in English",
      "textBn": "বাংলায় প্রশ্ন",
      "options": [
        { "textEn": "Option A in English", "textBn": "অপশন ক", "isCorrect": true },
        { "textEn": "Option B in English", "textBn": "অপশন খ", "isCorrect": false }
      ],
      "acceptedAnswers": ["exact short answer EN", "সংক্ষিপ্ত উত্তর"],
      "explanationEn": "Explanation in English",
      "explanationBn": "বাংলায় বিস্তারিত ব্যাখ্যা"
    }
  ]
}`;
}

export function stripMarkdownJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced && fenced[1] ? fenced[1].trim() : trimmed;
}

interface RawGeminiQuizPayload {
  titleEn?: string;
  titleBn?: string;
  descriptionEn?: string;
  descriptionBn?: string;
  categoryEn?: string;
  categoryBn?: string;
  questions?: Array<{
    type?: string;
    textEn?: string;
    textBn?: string;
    options?: Array<{ textEn?: string; textBn?: string; isCorrect?: boolean }>;
    acceptedAnswers?: string[];
    explanationEn?: string;
    explanationBn?: string;
  }>;
}

export function normalizeGeneratedQuizPayload(
  parsed: RawGeminiQuizPayload,
  data: CoreAiQuizRequest,
): Quiz {
  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (rawQuestions.length === 0) {
    throw new Error(
      "Gemini returned zero questions. Refine your topic or syllabus notes and try again.",
    );
  }

  const nowTs = Date.now();
  const id = `ai-quiz-${nowTs}`;
  const slugBase = data.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 25);
  const slug = `ai-${slugBase || "assessment"}-${nowTs % 10000}`;
  const styleMode = data.questionStyleMode || "mixed_all_4";

  const questions: Question[] = rawQuestions.map((q, idx) => {
    const qId = `q-ai-${idx + 1}-${nowTs % 10000}`;
    const rawType: QuestionType =
      q.type === "true_false" || q.type === "multi_mcq" || q.type === "written"
        ? q.type
        : "single_mcq";
    const qType: QuestionType = styleMode === "single_mcq" ? "single_mcq" : rawType;

    if (qType === "written") {
      const accepted =
        Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0
          ? q.acceptedAnswers.map((a) => String(a).trim()).filter(Boolean)
          : ["Answer"];
      return {
        id: qId,
        textEn: q.textEn?.trim() || `${data.topic} Short Answer #${idx + 1}`,
        textBn:
          q.textBn?.trim() || q.textEn?.trim() || `${data.topic} সংক্ষিপ্ত প্রশ্ন #${idx + 1}`,
        type: "written",
        timeLimitSec: 30,
        points: 1000,
        negativeMarks: 0,
        options: [],
        correctOptionIds: [],
        acceptedAnswers: accepted,
        explanationEn: q.explanationEn,
        explanationBn: q.explanationBn,
        category: data.category,
        difficulty: data.difficulty,
      };
    }

    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const options = rawOpts.map((opt, optIdx) => ({
      id: `o-${qId}-${optIdx + 1}`,
      textEn: opt.textEn?.trim() || `Option ${optIdx + 1}`,
      textBn: opt.textBn?.trim() || opt.textEn?.trim() || `অপশন ${optIdx + 1}`,
      isCorrect: !!opt.isCorrect,
    }));
    const correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);
    if (correctOptionIds.length === 0 && options[0]) {
      options[0].isCorrect = true;
      correctOptionIds.push(options[0].id);
    }

    return {
      id: qId,
      textEn: q.textEn?.trim() || `${data.topic} Question #${idx + 1}`,
      textBn: q.textBn?.trim() || q.textEn?.trim() || `${data.topic} প্রশ্ন #${idx + 1}`,
      type: qType,
      timeLimitSec: qType === "multi_mcq" ? 30 : 25,
      points: 1000,
      negativeMarks: 0.25,
      options,
      correctOptionIds,
      explanationEn: q.explanationEn,
      explanationBn: q.explanationBn,
      category: data.category,
      difficulty: data.difficulty,
    };
  });

  const prefixEn = data.quizNumber ? `Quiz ${data.quizNumber} — ` : "";
  const prefixBn = data.quizNumber ? `কুইজ ${data.quizNumber} — ` : "";

  return {
    id,
    slug,
    courseId: data.courseId,
    courseTitle: data.courseTitle,
    quizNumber: data.quizNumber,
    instructorId: data.instructorId || "usr-instructor-1",
    instructorName: data.instructorName || "Course Instructor",
    icon: "✨",
    titleEn: parsed.titleEn?.trim() || `${prefixEn}${data.topic}`,
    titleBn: parsed.titleBn?.trim() || `${prefixBn}${data.topic}`,
    descriptionEn:
      parsed.descriptionEn?.trim() ||
      `AI-generated assessment (${questions.length} Qs) on ${data.topic}${data.courseTitle ? ` under ${data.courseTitle}` : ""}.`,
    descriptionBn:
      parsed.descriptionBn?.trim() ||
      `${data.topic} বিষয়ের ওপর Gemini AI নির্মিত ${questions.length}টি প্রশ্নের মূল্যায়ন।`,
    categoryEn: parsed.categoryEn?.trim() || data.category || "AI Assessment",
    categoryBn: parsed.categoryBn?.trim() || data.category || "AI মডেল টেস্ট",
    color: "from-violet-500/20 to-fuchsia-500/20",
    tags: ["Gemini AI", data.difficulty, data.category],
    questions,
    isTemplate: false,
    createdAt: new Date(nowTs).toISOString(),
  };
}

export async function generateQuizViaGeminiRest(
  apiKey: string,
  data: CoreAiQuizRequest,
): Promise<Quiz> {
  const cleanKey = apiKey.trim();
  if (cleanKey.length < 10) {
    throw new Error("A valid Google Gemini API key is required.");
  }

  const count = Math.min(20, Math.max(3, data.questionCount || 5));
  const prompt = buildGeminiQuizPrompt(data, count);

  let lastError = "Failed to generate quiz with Gemini API.";
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i]!;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      let apiErrMsg = `Gemini API HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as { error?: { message?: string } };
        if (errBody?.error?.message) {
          apiErrMsg = `Gemini API (${response.status}): ${errBody.error.message}`;
        }
      } catch {
        // ignore JSON error body parse failure
      }
      lastError = apiErrMsg;
      // Retry next model only if this model endpoint is unavailable or overloaded
      if ((response.status === 404 || response.status === 503) && i < GEMINI_MODELS.length - 1) {
        continue;
      }
      throw new Error(apiErrMsg);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      lastError = `Gemini model "${model}" returned an empty response.`;
      if (i < GEMINI_MODELS.length - 1) continue;
      throw new Error(lastError);
    }

    const cleanJson = stripMarkdownJsonFence(rawText);
    const parsed = JSON.parse(cleanJson) as RawGeminiQuizPayload;
    return normalizeGeneratedQuizPayload(parsed, data);
  }

  throw new Error(lastError);
}

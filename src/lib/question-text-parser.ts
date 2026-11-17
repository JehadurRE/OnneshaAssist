import { Question, QuestionOption, QuestionType, Quiz } from "./types";

export interface ParsedQuestionsResult {
  questions: Question[];
  detectedTitle?: string | undefined;
  missingAnswerIndices: number[];
  stats: {
    total: number;
    withAnswers: number;
    withExplanations: number;
  };
}

export interface BuildQuizFromTextOptions {
  rawText: string;
  title?: string | undefined;
  courseId?: string | undefined;
  courseTitle?: string | undefined;
  quizNumber?: number | undefined;
  category?: string | undefined;
  instructorId?: string | undefined;
  instructorName?: string | undefined;
  isPrivate?: boolean | undefined;
  defaultTimeLimitSec?: number | undefined;
  defaultPoints?: number | undefined;
  defaultNegativeMarks?: number | undefined;
}

const BANGLA_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const OPTION_LETTER_TO_INDEX: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  ক: 0,
  খ: 1,
  গ: 2,
  ঘ: 3,
  ঙ: 4,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
};

export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d);
}

function stripOuterMarkdown(text: string): string {
  return text
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

function resolveOptionIndexToken(token: string): number | null {
  const clean = toAsciiDigits(token.trim())
    .toUpperCase()
    .replace(/[^A-Eক-ঙ1-5]/g, "");
  if (!clean) return null;
  const idx = OPTION_LETTER_TO_INDEX[clean];
  return typeof idx === "number" ? idx : null;
}

function parseAnswerIndexList(rawAnswer: string): number[] {
  const normalized = toAsciiDigits(rawAnswer).trim();
  if (!normalized) return [];
  const indices: number[] = [];
  const tokens = normalized.split(/[,/|&+\s]+|(?:এবং|ও|and)/i).filter(Boolean);
  for (const tok of tokens) {
    const clean = tok.replace(/[().:;[\]]/g, "");
    // Only interpret single option tokens A-E / ক-ঙ / 1-5 unless paired with commas
    if (/^[A-Ea-eকখগঘঙ1-5]$/.test(clean)) {
      const idx = resolveOptionIndexToken(clean);
      if (idx !== null && !indices.includes(idx)) {
        indices.push(idx);
      }
    }
  }
  return indices;
}

function parseAnswerKeyMap(lines: string[]): {
  keyMap: Map<number, number[]>;
  contentEndLineIdx: number;
} {
  const keyMap = new Map<number, number[]>();
  let answerSectionStart = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = toAsciiDigits(lines[i] || "").trim();
    if (
      /^(?:#{1,4}\s*)?(?:\*{1,2})?(?:answer\s*key|answers|উত্তরমালা|উত্তরপত্র|সঠিক\s*উত্তর\s*তালিকা)\b(?::|ঃ|\s|-)*/i.test(
        line,
      )
    ) {
      answerSectionStart = i;
      break;
    }
  }

  // Also detect trailing markdown answer tables like "| ১ | B | ১১ | D |" even without a heading
  if (answerSectionStart === lines.length) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = toAsciiDigits(lines[i] || "").trim();
      if (!line) continue;
      const isTableRow = line.startsWith("|") && line.includes("|");
      const isRuleFooter = /^(?:\*{1,2})?(?:মূল্যায়নের\s*নিয়ম|scoring|note|মোট\s*নম্বর)/i.test(
        line,
      );
      if (isTableRow || isRuleFooter) {
        if (isTableRow && /\|\s*\d+\s*\|\s*[A-Da-dকখগঘ]\s*\|/.test(line)) {
          answerSectionStart = Math.min(answerSectionStart, i);
        }
      } else if (answerSectionStart < lines.length) {
        break;
      }
    }
    // Include table header above first numeric row if present
    if (answerSectionStart < lines.length) {
      while (answerSectionStart > 0) {
        const prev = (lines[answerSectionStart - 1] || "").trim();
        if (prev.startsWith("|") || /^[-:\s|]+$/.test(prev)) {
          answerSectionStart--;
        } else {
          break;
        }
      }
    }
  }

  if (answerSectionStart < lines.length) {
    for (let i = answerSectionStart; i < lines.length; i++) {
      const rawLine = toAsciiDigits(lines[i] || "").trim();
      if (!rawLine || /^[\s|:-]+$/.test(rawLine)) continue;

      // Case 1: Markdown table row "| 1 | B | 11 | D |"
      if (rawLine.includes("|")) {
        const cells = rawLine
          .split("|")
          .map((c) => stripOuterMarkdown(c).trim())
          .filter(Boolean);
        for (let c = 0; c + 1 < cells.length; c++) {
          const qNumMatch = cells[c]!.match(/^(\d{1,3})$/);
          const ansList = parseAnswerIndexList(cells[c + 1]!);
          if (qNumMatch && ansList.length > 0 && /^[A-Ea-eক-ঙ,\s]+$/.test(cells[c + 1]!)) {
            keyMap.set(parseInt(qNumMatch[1]!, 10), ansList);
            c++;
          }
        }
        continue;
      }

      // Case 2: Inline pairs "1. B, 2. C" or "1 - B" or "1: A, C"
      const pairRegex =
        /(?:^|[\s,;])(\d{1,3})\s*[.):\-–—]\s*([A-Ea-eক-ঙ](?:\s*,\s*[A-Ea-eক-ঙ])*)(?=$|[\s,;])/g;
      let match: RegExpExecArray | null;
      while ((match = pairRegex.exec(rawLine)) !== null) {
        const qNum = parseInt(match[1]!, 10);
        const idxs = parseAnswerIndexList(match[2]!);
        if (idxs.length > 0) keyMap.set(qNum, idxs);
      }
    }
  }

  return { keyMap, contentEndLineIdx: answerSectionStart };
}

function splitInlineOptionsIfAny(line: string): string[] {
  const trimmed = line.trim();
  // Detect multiple options on a single line like "(A) Foo (B) Bar (C) Baz (D) Qux" or "A. Foo  B. Bar"
  const splitParts = trimmed
    .split(/\s+(?=(?:\([A-Da-dক-ঘ]\)|[A-Da-dক-ঘ][.)])\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return splitParts.length >= 2 ? splitParts : [trimmed];
}

interface JsonOptionLike {
  id?: string | undefined;
  textEn?: string | undefined;
  textBn?: string | undefined;
  text?: string | undefined;
  label?: string | undefined;
  isCorrect?: boolean | undefined;
}

interface JsonQuestionLike {
  id?: string | undefined;
  textEn?: string | undefined;
  textBn?: string | undefined;
  question?: string | undefined;
  prompt?: string | undefined;
  type?: QuestionType | undefined;
  options?: Array<JsonOptionLike | string> | undefined;
  correctOptionIds?: string[] | undefined;
  answer?: string | undefined;
  acceptedAnswers?: unknown[] | undefined;
  explanationEn?: string | undefined;
  explanationBn?: string | undefined;
  explanation?: string | undefined;
  timeLimitSec?: number | undefined;
  points?: number | undefined;
  negativeMarks?: number | undefined;
}

function tryParseJsonQuestions(
  rawText: string,
  defaultLimit: number,
  defaultPts: number,
): Question[] | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{") && !trimmed.startsWith("```")) {
    return null;
  }
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!unfenced.startsWith("[") && !unfenced.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(unfenced) as JsonQuestionLike[] | { questions?: JsonQuestionLike[] };
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
        ? parsed.questions
        : null;
    if (!list || list.length === 0) return null;

    const stamp = Date.now().toString(36);
    const out: Question[] = [];
    list.forEach((item, idx) => {
      const qId = String(item.id || `imp-${stamp}-${idx + 1}`);
      const textEn = String(
        item.textEn || item.question || item.prompt || item.textBn || "",
      ).trim();
      const textBn = String(item.textBn || item.question || item.prompt || textEn).trim();
      if (!textEn && !textBn) return;

      const rawOpts = Array.isArray(item.options) ? item.options : [];
      const options: QuestionOption[] = rawOpts.map((o, oIdx) => {
        if (typeof o === "string") {
          return { id: `${qId}-o${oIdx + 1}`, textEn: o, textBn: o };
        }
        return {
          id: String(o.id || `${qId}-o${oIdx + 1}`),
          textEn: String(o.textEn || o.text || o.label || o.textBn || `Option ${oIdx + 1}`),
          textBn: String(o.textBn || o.text || o.label || o.textEn || `অপশন ${oIdx + 1}`),
          ...(typeof o.isCorrect === "boolean" ? { isCorrect: o.isCorrect } : {}),
        };
      });

      let correctOptionIds: string[] = Array.isArray(item.correctOptionIds)
        ? (item.correctOptionIds as string[]).filter((id) => options.some((o) => o.id === id))
        : [];
      if (correctOptionIds.length === 0) {
        correctOptionIds = options.filter((o) => o.isCorrect).map((o) => o.id);
      }
      if (correctOptionIds.length === 0 && typeof item.answer === "string") {
        for (const i of parseAnswerIndexList(item.answer)) {
          if (options[i]) {
            options[i]!.isCorrect = true;
            correctOptionIds.push(options[i]!.id);
          }
        }
      }

      const acceptedAnswers = Array.isArray(item.acceptedAnswers)
        ? (item.acceptedAnswers as unknown[]).map((v) => String(v).trim()).filter(Boolean)
        : undefined;
      const qType: QuestionType =
        (item.type as QuestionType) ||
        (options.length === 0
          ? "written"
          : correctOptionIds.length > 1
            ? "multi_mcq"
            : options.length === 2
              ? "true_false"
              : "single_mcq");

      out.push({
        id: qId,
        textEn,
        textBn,
        type: qType,
        options,
        correctOptionIds:
          correctOptionIds.length > 0 ? correctOptionIds : options[0] ? [options[0].id] : [],
        ...(acceptedAnswers?.length ? { acceptedAnswers } : {}),
        explanationEn: item.explanationEn
          ? String(item.explanationEn)
          : item.explanation
            ? String(item.explanation)
            : undefined,
        explanationBn: item.explanationBn
          ? String(item.explanationBn)
          : item.explanation
            ? String(item.explanation)
            : undefined,
        timeLimitSec: Number(item.timeLimitSec) || defaultLimit,
        points: Number(item.points) || defaultPts,
        negativeMarks: typeof item.negativeMarks === "number" ? item.negativeMarks : 0.25,
      });
    });
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Parses human-written or AI-generated questions from plain text, Markdown, or JSON
 * (supporting both inline answers/explanations and bottom Answer Key tables).
 */
export function parseQuestionsFromText(
  rawText: string,
  options?: {
    defaultTimeLimitSec?: number | undefined;
    defaultPoints?: number | undefined;
    defaultNegativeMarks?: number | undefined;
  },
): ParsedQuestionsResult {
  const defaultLimit = options?.defaultTimeLimitSec || 25;
  const defaultPts = options?.defaultPoints || 1000;
  const defaultNeg = options?.defaultNegativeMarks ?? 0.25;

  const jsonQuestions = tryParseJsonQuestions(rawText, defaultLimit, defaultPts);
  if (jsonQuestions) {
    const withAns = jsonQuestions.filter((q) =>
      q.type === "written" || q.type === "fill_blank"
        ? (q.acceptedAnswers?.length || 0) > 0
        : q.correctOptionIds.length > 0,
    ).length;
    const withExp = jsonQuestions.filter((q) => q.explanationEn || q.explanationBn).length;
    return {
      questions: jsonQuestions,
      missingAnswerIndices: [],
      stats: {
        total: jsonQuestions.length,
        withAnswers: withAns,
        withExplanations: withExp,
      },
    };
  }

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const { keyMap, contentEndLineIdx } = parseAnswerKeyMap(lines);

  let detectedTitle: string | undefined;
  let globalTimeLimit = defaultLimit;

  interface DraftBlock {
    qNum: number;
    promptLines: string[];
    options: Array<{ text: string; markedCorrect: boolean }>;
    inlineAnswerText?: string | undefined;
    inlineIndices: number[];
    explanationLines: string[];
    explicitType?: QuestionType | undefined;
    timeLimitSec?: number | undefined;
  }

  const blocks: DraftBlock[] = [];
  let current: DraftBlock | null = null;
  let activeField: "prompt" | "explanation" = "prompt";

  const flushCurrent = () => {
    if (!current) return;
    if (current.promptLines.length > 0) {
      blocks.push(current);
    }
    current = null;
    activeField = "prompt";
  };

  for (let idx = 0; idx < contentEndLineIdx; idx++) {
    const rawLine = lines[idx] || "";
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Optional metadata before first question
    const titleMatch = trimmed.match(
      /^(?:#{1,3}\s*)?(?:quiz\s*title|title|শিরোনাম)\s*(?::|ঃ)\s*(.+)$/i,
    );
    if (titleMatch && blocks.length === 0 && !current) {
      detectedTitle = stripOuterMarkdown(titleMatch[1]!);
      continue;
    }
    const globalTimeMatch = toAsciiDigits(trimmed).match(
      /(?:time\s*per\s*question|time\s*limit|প্রতি\s*প্রশ্ন(?:ের)?\s*সময়)\s*(?::|ঃ)?\s*(\d+)\s*(?:s|sec|seconds|সেকেন্ড)?/i,
    );
    if (globalTimeMatch && !current) {
      const parsed = parseInt(globalTimeMatch[1]!, 10);
      if (parsed >= 5 && parsed <= 300) globalTimeLimit = parsed;
      continue;
    }

    const asciiTrimmed = toAsciiDigits(trimmed);

    // 1. Question Header Detection
    // Matches: "প্রশ্ন 1", "প্রশ্ন ১:", "**প্রশ্ন 2:**", "Q1.", "Q.1)", "1.", "1)", "**1.**", "Question 1:"
    const qHeaderWithWord = asciiTrimmed.match(
      /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:প্রশ্ন|question|q)\s*[#.-]?\s*(\d{1,3})\s*(?:[).:\-–—]+|\*{1,2})?\s*(.*)$/i,
    );
    const qHeaderNumeric =
      current === null ||
      current.options.length > 0 ||
      current.inlineIndices.length > 0 ||
      current.inlineAnswerText ||
      current.explanationLines.length > 0
        ? asciiTrimmed.match(/^(?:#{1,6}\s*)?(?:\*{1,2})?(\d{1,3})\s*[).:\-–—]\s+(?:\*{1,2})?(.+)$/)
        : null;

    if (qHeaderWithWord || qHeaderNumeric) {
      const match = (qHeaderWithWord || qHeaderNumeric)!;
      const numVal = parseInt(match[1]!, 10);
      let restText = stripOuterMarkdown((match[2] || "").trim());
      if (restText.startsWith(":") || restText.startsWith("-")) {
        restText = restText.slice(1).trim();
      }
      flushCurrent();
      current = {
        qNum: Number.isFinite(numVal) ? numVal : blocks.length + 1,
        promptLines: restText ? [restText] : [],
        options: [],
        inlineIndices: [],
        explanationLines: [],
      };
      activeField = "prompt";
      continue;
    }

    if (!current) {
      // Allow plain markdown heading at top to become detectedTitle
      if (trimmed.startsWith("#") && !detectedTitle) {
        detectedTitle = stripOuterMarkdown(trimmed);
      }
      continue;
    }

    // 2. Explanation Line
    const expMatch = trimmed.match(
      /^(?:-\s*)?(?:\*{1,2})?(?:explanation|rationale|why|ব্যাখ্যা|সমাধান|কারণ)\s*(?::|ঃ|-|–|—)\s*(?:\*{1,2})?\s*(.*)$/i,
    );
    if (expMatch) {
      activeField = "explanation";
      const text = stripOuterMarkdown(expMatch[1] || "");
      if (text) current.explanationLines.push(text);
      continue;
    }

    // 3. Inline Answer Line ("Answer: B", "Ans: A, C", "উত্তর: খ", "সঠিক উত্তর: B. Text")
    const ansMatch = trimmed.match(
      /^(?:-\s*)?(?:\*{1,2})?(?:correct\s*answer|answer|ans|correct|সঠিক\s*উত্তর|উত্তর)\s*(?::|ঃ|-|–|—)\s*(?:\*{1,2})?\s*(.+)$/i,
    );
    if (ansMatch) {
      activeField = "prompt";
      const rawAns = stripOuterMarkdown(ansMatch[1]!);
      current.inlineAnswerText = rawAns;
      const leadLetterMatch = toAsciiDigits(rawAns).match(
        /^([A-Ea-eক-ঙ](?:\s*[,/&+]\s*[A-Ea-eক-ঙ])*)(?:$|\s*[).:\-–—])/,
      );
      if (leadLetterMatch) {
        current.inlineIndices = parseAnswerIndexList(leadLetterMatch[1]!);
      } else {
        const directIndices = parseAnswerIndexList(rawAns);
        if (directIndices.length > 0) {
          current.inlineIndices = directIndices;
        }
      }
      continue;
    }

    // 4. Optional Per-Question Metadata ("Time: 30s", "Type: multi_mcq")
    const qMetaMatch = asciiTrimmed.match(/^(?:time|সময়)\s*(?::|ঃ)\s*(\d+)\s*(?:s|sec)?$/i);
    if (qMetaMatch) {
      const sec = parseInt(qMetaMatch[1]!, 10);
      if (sec >= 5 && sec <= 300) current.timeLimitSec = sec;
      continue;
    }

    // 5. Option Lines ("A. ...", "B) ...", "(C) ...", "ক. ...", "- A. ...", plus inline multi-options)
    const subParts = splitInlineOptionsIfAny(trimmed);
    const firstOptMatch = subParts[0]?.match(
      /^(?:[-*•]\s*)?(?:\*{1,2})?\(?([A-Ea-eকখগঘঙ])\)?[.)\]:\s]\s*(.+)$/,
    );
    if (firstOptMatch) {
      activeField = "prompt";
      for (const part of subParts) {
        const om = part.match(/^(?:[-*•]\s*)?(?:\*{1,2})?\(?([A-Ea-eকখগঘঙ])\)?[.)\]:\s]\s*(.+)$/);
        if (!om) continue;
        let optBody = stripOuterMarkdown(om[2]!);
        const markedCorrect =
          /[✓✔✅]|(?:\(\s*(?:correct|সঠিক)\s*\))|(?:\[\s*(?:✓|✔|x|correct)\s*\])/i.test(optBody);
        optBody = optBody
          .replace(/[✓✔✅]/g, "")
          .replace(/\(\s*(?:correct|সঠিক)\s*\)/gi, "")
          .replace(/\[\s*(?:✓|✔|x|correct)\s*\]/gi, "")
          .trim();
        current.options.push({ text: optBody, markedCorrect });
      }
      continue;
    }

    // 6. Continuation line for prompt or explanation
    const cleanedLine = stripOuterMarkdown(trimmed);
    if (cleanedLine) {
      if (activeField === "explanation") {
        current.explanationLines.push(cleanedLine);
      } else if (current.options.length === 0) {
        current.promptLines.push(cleanedLine);
      } else {
        // Continuation of previous option text
        const lastOpt = current.options[current.options.length - 1];
        if (lastOpt) {
          lastOpt.text = `${lastOpt.text} ${cleanedLine}`.trim();
        }
      }
    }
  }

  flushCurrent();

  const stamp = Date.now().toString(36);
  const missingAnswerIndices: number[] = [];
  let withAnswers = 0;
  let withExplanations = 0;

  const questions: Question[] = blocks.map((b, idx) => {
    const qId = `imp-${stamp}-${idx + 1}`;
    const promptText = b.promptLines.join("\n").trim();

    if (b.options.length === 0) {
      const accepted = b.inlineAnswerText
        ? b.inlineAnswerText
            .split(/[,/|]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      if (accepted.length > 0) withAnswers++;
      else missingAnswerIndices.push(idx + 1);
      const exp = b.explanationLines.join(" ").trim() || undefined;
      if (exp) withExplanations++;
      return {
        id: qId,
        textEn: promptText,
        textBn: promptText,
        type: "written",
        options: [],
        correctOptionIds: [],
        acceptedAnswers: accepted,
        ...(exp ? { explanationEn: exp, explanationBn: exp } : {}),
        timeLimitSec: b.timeLimitSec || globalTimeLimit,
        points: defaultPts,
        negativeMarks: defaultNeg,
      };
    }

    // Determine correct option indices (inline marker > inline Ans > bottom Key Table)
    let resolvedIndices = b.options
      .map((o, oIdx) => (o.markedCorrect ? oIdx : -1))
      .filter((i) => i >= 0);

    if (resolvedIndices.length === 0 && b.inlineIndices.length > 0) {
      resolvedIndices = b.inlineIndices.filter((i) => i >= 0 && i < b.options.length);
    }

    // Fallback: match answer text against option text if Ans: wasn't A-D
    if (resolvedIndices.length === 0 && b.inlineAnswerText) {
      const targetNorm = b.inlineAnswerText.toLowerCase();
      const textIdx = b.options.findIndex((o) => o.text.toLowerCase() === targetNorm);
      if (textIdx >= 0) resolvedIndices = [textIdx];
    }

    if (resolvedIndices.length === 0) {
      const tableIndices = keyMap.get(b.qNum) || keyMap.get(idx + 1);
      if (tableIndices && tableIndices.length > 0) {
        resolvedIndices = tableIndices.filter((i) => i >= 0 && i < b.options.length);
      }
    }

    if (resolvedIndices.length > 0) {
      withAnswers++;
    } else {
      missingAnswerIndices.push(idx + 1);
    }

    const correctSet = new Set(resolvedIndices);
    const questionOptions: QuestionOption[] = b.options.map((o, oIdx) => ({
      id: `${qId}-o${oIdx + 1}`,
      textEn: o.text,
      textBn: o.text,
      ...(correctSet.has(oIdx) ? { isCorrect: true } : {}),
    }));

    const correctOptionIds =
      resolvedIndices.length > 0
        ? resolvedIndices.map((i) => questionOptions[i]!.id)
        : questionOptions[0]
          ? [questionOptions[0].id]
          : [];
    if (resolvedIndices.length === 0 && questionOptions[0]) {
      questionOptions[0].isCorrect = true;
    }

    const qType: QuestionType =
      b.explicitType ||
      (correctOptionIds.length > 1
        ? "multi_mcq"
        : questionOptions.length === 2
          ? "true_false"
          : "single_mcq");

    const exp = b.explanationLines.join(" ").trim() || undefined;
    if (exp) withExplanations++;

    return {
      id: qId,
      textEn: promptText,
      textBn: promptText,
      type: qType,
      options: questionOptions,
      correctOptionIds,
      ...(exp ? { explanationEn: exp, explanationBn: exp } : {}),
      timeLimitSec: b.timeLimitSec || globalTimeLimit,
      points: defaultPts,
      negativeMarks: defaultNeg,
    };
  });

  return {
    questions,
    detectedTitle,
    missingAnswerIndices,
    stats: {
      total: questions.length,
      withAnswers,
      withExplanations,
    },
  };
}

export function buildQuizFromParsedText(opts: BuildQuizFromTextOptions): {
  quiz: Quiz | null;
  parsed: ParsedQuestionsResult;
} {
  const parsed = parseQuestionsFromText(opts.rawText, {
    defaultTimeLimitSec: opts.defaultTimeLimitSec,
    defaultPoints: opts.defaultPoints,
    defaultNegativeMarks: opts.defaultNegativeMarks,
  });

  if (parsed.questions.length === 0) {
    return { quiz: null, parsed };
  }

  const nowTs = Date.now();
  const qNum = opts.quizNumber || 1;
  const resolvedTitle =
    opts.title?.trim() ||
    parsed.detectedTitle?.trim() ||
    (opts.courseTitle ? `${opts.courseTitle} — Quiz #${qNum}` : `Imported Quiz #${qNum}`);

  const quiz: Quiz = {
    id: `imported-quiz-${nowTs}`,
    slug: `imported-${nowTs.toString(36)}`,
    courseId: opts.courseId,
    courseTitle: opts.courseTitle,
    quizNumber: qNum,
    instructorId: opts.instructorId || "usr-instructor-1",
    instructorName: opts.instructorName || "Course Instructor",
    icon: "📋",
    titleEn: resolvedTitle,
    titleBn: resolvedTitle,
    descriptionEn: `${opts.courseTitle ? `${opts.courseTitle} · Quiz #${qNum} · ` : ""}${parsed.questions.length} imported questions.`,
    descriptionBn: `${opts.courseTitle ? `${opts.courseTitle} · কুইজ #${qNum} · ` : ""}${parsed.questions.length}টি ইম্পোর্টকৃত প্রশ্ন।`,
    categoryEn: opts.category || "Custom Assessment",
    categoryBn: opts.category || "মডেল টেস্ট",
    tags: ["Quick Import", `Quiz ${qNum}`],
    questions: parsed.questions,
    isTemplate: false,
    ...(typeof opts.isPrivate === "boolean" ? { isPrivate: opts.isPrivate } : {}),
    createdAt: new Date(nowTs).toISOString(),
  };

  return { quiz, parsed };
}

export function buildCopyableAiPrompt(
  lang: "en" | "bn",
  meta?: {
    topic?: string | undefined;
    count?: number | undefined;
    difficulty?: string | undefined;
  },
): string {
  const count = meta?.count || 15;
  const topicText =
    meta?.topic?.trim() ||
    (lang === "bn" ? "[এখানে আপনার বিষয় বা নোট লিখুন]" : "[PASTE YOUR TOPIC OR NOTES HERE]");
  const diffLabel = meta?.difficulty || "Hard";

  if (lang === "bn") {
    return `নিচের বিষয়ের ওপর ${count}টি ${diffLabel} মানের পরীক্ষা-উপযোগী MCQ প্রশ্ন তৈরি করে দাও।
দয়া করে হুবহু নিচের ফরম্যাট অনুসরণ করবে (প্রতিটি প্রশ্নে প্রশ্ন, ৪টি অপশন, সঠিক উত্তর ও সংক্ষিপ্ত ব্যাখ্যা থাকবে):

বিষয়: ${topicText}

Quiz Title: [সংক্ষিপ্ত কুইজ শিরোনাম]

প্রশ্ন 1
[প্রশ্নের মূল লেখা]
A. [অপশন ১]
B. [অপশন ২]
C. [অপশন ৩]
D. [অপশন ৪]
উত্তর: B
ব্যাখ্যা: [কেন B সঠিক তার ১-২ লাইনের স্পষ্ট ব্যাখ্যা]

শর্তাবলি:
- সবসময় A., B., C., D. ব্যবহার করবে।
- একাধিক সঠিক উত্তর হলে উত্তর: A, C লিখবে।
- কোনো বাড়তি ভূমিকা ছাড়াই শুধু প্রশ্নগুলো দেবে যেন কপি-পেস্ট করা যায়।`;
  }

  return `Generate ${count} exam-grade (${diffLabel}) MCQ questions on this topic/material:
Topic: ${topicText}

Follow this EXACT format strictly so it imports cleanly in one click:

Quiz Title: [Short Descriptive Title]

1. [Question text]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Answer: B
Explanation: [1-2 concise sentences explaining why B is correct]

Rules:
- Always label options A., B., C., D.
- For Multi-Select MCQs, write e.g. Answer: A, C
- Always include Answer: and Explanation: for every single question, with no extra intro text.`;
}

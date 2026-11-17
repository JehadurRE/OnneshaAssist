import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { generateQuizWithAi, getAiCredits, getStoredLocalGeminiKey } from "@/lib/ai-generator";
import {
  buildCopyableAiPrompt,
  buildQuizFromParsedText,
  parseQuestionsFromText,
} from "@/lib/question-text-parser";
import { serverGetAiGeneratorStatus } from "@/lib/server-session";
import { Course, Quiz } from "@/lib/types";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  PenTool,
  Sparkles,
  Upload,
  Wand2,
  X,
  Zap,
} from "lucide-react";

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizGenerated: (quiz: Quiz) => void;
  onLoadIntoEditor?: (quiz: Quiz) => void;
  defaultCourseId?: string;
}

export const AiQuizModal: React.FC<AiQuizModalProps> = ({
  isOpen,
  onClose,
  onQuizGenerated,
  onLoadIntoEditor,
  defaultCourseId,
}) => {
  const { lang } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [quizNumber, setQuizNumber] = useState<number>(1);
  const [quizTitle, setQuizTitle] = useState("");
  const [mainText, setMainText] = useState("");

  // UX Helpers (Copy Prompt Format, Format Guide, Collapsible Gemini AI section)
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Optional Gemini AI Generator State
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionStyleMode, setQuestionStyleMode] = useState<"mixed_all_4" | "single_mcq">(
    "single_mcq",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [genError, setGenError] = useState<string | null>(null);
  const [hasServerKey, setHasServerKey] = useState<boolean>(() => db.hasServerGeminiKey());
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [saveKeyServerWide, setSaveKeyServerWide] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    setGenError(null);
    const localKey = getStoredLocalGeminiKey() || "";
    setApiKeyInput(localKey);
    let active = true;
    serverGetAiGeneratorStatus()
      .then((res) => {
        if (!active) return;
        const srv = Boolean(res?.hasKey);
        setHasServerKey(srv);
        if (!srv && !localKey) {
          setShowKeyInput(true);
        }
      })
      .catch(() => {
        if (active && !db.hasServerGeminiKey() && !localKey) {
          setShowKeyInput(true);
        }
      });

    const allCourses = db.getCourses();
    const isAdmin = user?.role === "admin";
    const assignedSet = new Set(user?.assignedCourseIds || []);
    const loadedCourses = isAdmin
      ? allCourses
      : allCourses.filter(
          (c) => assignedSet.has(c.id) || (c.instructorIds || []).includes(user?.id || ""),
        );
    const allQuizzes = db.getQuizzes();
    setCourses(loadedCourses);

    const hasDefaultInScope =
      defaultCourseId &&
      defaultCourseId !== "all" &&
      loadedCourses.some((c) => c.id === defaultCourseId);
    const initialCourseId = hasDefaultInScope ? defaultCourseId! : loadedCourses[0]?.id || "";
    setSelectedCourseId(initialCourseId);

    if (initialCourseId) {
      const courseQuizzes = allQuizzes.filter((q) => q.courseId === initialCourseId);
      const nextNum = courseQuizzes.reduce((max, q) => Math.max(max, q.quizNumber || 0), 0) + 1;
      setQuizNumber(nextNum);
    }
    return () => {
      active = false;
    };
  }, [isOpen, defaultCourseId, user?.role, user?.id, user?.assignedCourseIds]);

  const parsedPreview = useMemo(() => parseQuestionsFromText(mainText), [mainText]);

  const handleCourseChange = (cid: string) => {
    setSelectedCourseId(cid);
    const allQuizzes = db.getQuizzes();
    const courseQuizzes = allQuizzes.filter((q) => q.courseId === cid);
    const nextNum = courseQuizzes.reduce((max, q) => Math.max(max, q.quizNumber || 0), 0) + 1;
    setQuizNumber(nextNum);
  };

  if (!isOpen) return null;

  const credits = typeof user?.aiCredits === "number" ? user.aiCredits : getAiCredits();
  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const trimmedKeyInput = apiKeyInput.trim();
  const isAiReady = hasServerKey || trimmedKeyInput.length >= 10;
  const detectedCount = parsedPreview.stats.total;

  const handleCopyPromptFormat = async () => {
    const promptText = buildCopyableAiPrompt(lang, {
      topic: quizTitle.trim() || undefined,
      count: questionCount,
      difficulty,
    });
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(promptText);
      }
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setMainText(promptText);
    }
  };

  const handleDirectImport = (openInEditor = false) => {
    setGenError(null);
    const { quiz, parsed } = buildQuizFromParsedText({
      rawText: mainText,
      title: quizTitle.trim() || undefined,
      courseId: activeCourse?.id,
      courseTitle: activeCourse?.titleEn,
      quizNumber,
      category: activeCourse?.categoryEn || "Custom Assessment",
      instructorId: user?.id || "usr-instructor-1",
      instructorName: user?.name || "Course Instructor",
    });

    if (!quiz || parsed.questions.length === 0) {
      setGenError(
        lang === "bn"
          ? 'কোনো প্রশ্ন শনাক্ত করা যায়নি। "Copy Prompt Format" দিয়ে AI থেকে ফরম্যাট নিন বা নিচে উদাহরণ দেখুন।'
          : 'No formatted questions detected. Click "Copy Prompt Format" for an AI template or "See Format".',
      );
      setShowFormatGuide(true);
      return;
    }

    if (openInEditor && onLoadIntoEditor) {
      onLoadIntoEditor(quiz);
      onClose();
      return;
    }

    onQuizGenerated(quiz);
    onClose();
  };

  const handleGenerateWithGemini = async () => {
    const effectiveTopic = quizTitle.trim() || mainText.trim().split("\n")[0]?.slice(0, 120) || "";
    if (!effectiveTopic || isGenerating) {
      setGenError(
        lang === "bn"
          ? "AI দিয়ে তৈরি করতে কুইজের শিরোনাম বা টেক্সট বক্সে একটি টপিক/নোট লিখুন।"
          : "Enter a quiz title or paste a topic/notes in the text box to generate with AI.",
      );
      return;
    }

    setGenError(null);
    setIsGenerating(true);
    setGenerationStep(
      lang === "bn"
        ? "Gemini AI দিয়ে প্রশ্ন, অপশন ও ব্যাখ্যা তৈরি হচ্ছে..."
        : "Synthesizing live bilingual questions, options, and answer explanations with Gemini...",
    );

    try {
      if (trimmedKeyInput.length >= 10 && typeof window !== "undefined") {
        localStorage.setItem("onnesha_gemini_key", trimmedKeyInput);
        if (user?.role === "admin" && saveKeyServerWide) {
          const savedRes = await db.saveServerAiKey(trimmedKeyInput);
          if (savedRes.success) setHasServerKey(true);
        }
      }

      const generated = await generateQuizWithAi({
        topic: effectiveTopic,
        sourceText: mainText.trim() || undefined,
        questionCount,
        difficulty,
        category: activeCourse?.categoryEn || "BCS & Government Jobs",
        language: "both",
        courseId: activeCourse?.id,
        courseTitle: activeCourse?.titleEn,
        quizNumber,
        instructorId: user?.id || "usr-instructor-1",
        instructorName: user?.name || "Course Instructor",
        questionStyleMode,
        ...(trimmedKeyInput.length >= 10 ? { apiKey: trimmedKeyInput } : {}),
      });
      setIsGenerating(false);
      void refreshUser();
      onQuizGenerated(generated);
      onClose();
    } catch (err) {
      console.error("Quiz generation error:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to generate exam paper. Check Gemini API settings or try Paste Import above.";
      setGenError(errMsg);
      if (errMsg.toLowerCase().includes("api key")) {
        setShowAiPanel(true);
        setShowKeyInput(true);
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-2xl max-h-[93vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute right-4 top-4 rounded-xl border border-border p-1.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Clean Minimal Header */}
        <div className="flex items-center justify-between pr-9">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold text-foreground">
                {lang === "bn" ? "সহজ প্রশ্ন পেস্ট ও AI ইম্পোর্ট" : "Quick Text & AI Quiz Import"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === "bn"
                  ? "যেকোনো AI (ChatGPT, Claude, Gemini) থেকে কপি করে নিচের বক্সে পেস্ট করলেই কুইজ তৈরি হবে"
                  : "Copy questions from ChatGPT, Claude, Gemini, or Docs & paste directly below — zero API key required"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {/* Compact Single Row: Course, Quiz #, Title */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 rounded-2xl border border-border bg-background/60 p-3">
            <div className="sm:col-span-5">
              <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3 w-3 text-primary" />
                <span>{lang === "bn" ? "কোর্স" : "Course"}</span>
              </label>
              <select
                disabled={isGenerating}
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {lang === "bn" ? c.titleBn : c.titleEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {lang === "bn" ? "কুইজ #" : "Quiz #"}
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                disabled={isGenerating}
                value={quizNumber}
                onChange={(e) => setQuizNumber(Number(e.target.value) || 1)}
                className="w-full rounded-xl border border-border bg-card px-2.5 py-2 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {lang === "bn" ? "কুইজ শিরোনাম (ঐচ্ছিক)" : "Quiz Title (Optional)"}
              </label>
              <input
                type="text"
                disabled={isGenerating}
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder={
                  parsedPreview.detectedTitle ||
                  (lang === "bn" ? `কুইজ #${quizNumber}` : `Quiz #${quizNumber}`)
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Hero Section: Best-in-Class Spacious Text Box + Prompt Format Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                  {lang === "bn" ? "প্রশ্ন বক্স (এখানে পেস্ট করুন)" : "Question Text Box"}
                </span>
                {detectedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>
                      {detectedCount} Qs · {parsedPreview.stats.withAnswers} Ans ·{" "}
                      {parsedPreview.stats.withExplanations} Exp
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {lang === "bn"
                      ? "প্রশ্ন + উত্তর পেস্ট করুন"
                      : "Paste formatted Qs or AI output"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPromptFormat}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
                  title="Copy prompt template to paste into ChatGPT, Claude, or Gemini"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {lang === "bn" ? "প্রম্পট কপি হয়েছে!" : "Prompt Copied!"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{lang === "bn" ? "Copy AI Prompt Format" : "Copy Prompt Format"}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowFormatGuide((v) => !v)}
                  className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
                >
                  {showFormatGuide
                    ? lang === "bn"
                      ? "উদাহরণ লুকান"
                      : "Hide Example"
                    : lang === "bn"
                      ? "উদাহরণ"
                      : "Example"}
                </button>
              </div>
            </div>

            {showFormatGuide && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    {lang === "bn"
                      ? "সমর্থিত সহজ ফরম্যাট (বাংলা/ইংরেজি, নিচে উত্তর টেবিলও চলবে):"
                      : "Supported Clean Format (inline Ans/Exp or bottom Answer Key table):"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMainText(
                        lang === "bn"
                          ? `প্রশ্ন 1\nবাংলাদেশের সংবিধান কত তারিখে কার্যকর হয়?\nA. ১৬ ডিসেম্বর ১৯৭১\nB. ১৬ ডিসেম্বর ১৯৭২\nC. ২৬ মার্চ ১৯৭১\nD. ৪ নভেম্বর ১৯৭২\nউত্তর: B\nব্যাখ্যা: ১৯৭২ সালের ১৬ ডিসেম্বর বাংলাদেশের সংবিধান কার্যকর হয়।\n\nপ্রশ্ন 2\nGoogle AI Studio ব্যবহার করে বাংলা উচ্চারণ ঠিক করার সেরা উপায় কোনটি?\nA. স্পিড বাড়ানো\nB. ধ্বনিগতভাবে বা উচ্চারণ অনুযায়ী বানান ভেঙে লেখা\nC. ভয়েস মডেল পরিবর্তন করা\nD. অডিও ট্রানজিশন দেওয়া\nউত্তর: B\nব্যাখ্যা: নির্দিষ্ট শব্দের ধ্বনিগত বানান দিলে TTS উচ্চারণ নির্ভুল হয়।`
                          : `1. When did the Constitution of Bangladesh take effect?\nA. 16 December 1971\nB. 16 December 1972\nC. 26 March 1971\nD. 4 November 1972\nAnswer: B\nExplanation: The Constitution of Bangladesh came into effect on 16 December 1972.\n\n2. Which approach maintains product visual consistency across multiple scenes?\nA. Separate text-to-video per scene\nB. Reusing the last frame of each clip as the next scene's Start Frame\nC. Increasing playback speed\nD. Removing lighting prompts\nAnswer: B\nExplanation: Chaining the prior scene's end frame preserves product geometry and color.`,
                      );
                      setShowFormatGuide(false);
                    }}
                    className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    {lang === "bn" ? "স্যাম্পল পেস্ট করুন" : "Insert Sample"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-card p-2.5 font-mono text-[11px] text-muted-foreground border border-border/80">
                  {`1. Question text here...
A. Option one
B. Option two
C. Option three
D. Option four
Answer: B
Explanation: Short reason why B is correct.`}
                </pre>
              </div>
            )}

            <textarea
              rows={10}
              autoFocus
              disabled={isGenerating}
              value={mainText}
              onChange={(e) => setMainText(e.target.value)}
              placeholder={
                lang === "bn"
                  ? `এখানে সরাসরি প্রশ্ন পেস্ট করুন (ChatGPT / Claude / Gemini / Docs থেকে)...\n\nযেমন:\nপ্রশ্ন 1\nপ্রশ্নের লেখা এখানে...\nA. অপশন ১\nB. অপশন ২\nC. অপশন ৩\nD. অপশন ৪\nউত্তর: B\nব্যাখ্যা: সংক্ষিপ্ত ব্যাখ্যা এখানে...\n\n(অথবা শেষে | ১ | B | ১১ | D | টেবিল দিলেও অটো কাজ করবে!)`
                  : `Paste questions directly here (from ChatGPT, Claude, Gemini, or Docs)...\n\n1. Your question text?\nA. Option 1\nB. Option 2\nC. Option 3\nD. Option 4\nAnswer: B\nExplanation: Brief rationale...\n\n(Also supports Bangla প্রশ্ন ১, Markdown tables | 1 | B |, True/False, Written & JSON!)`
              }
              className="min-h-[240px] w-full resize-y rounded-2xl border-2 border-border bg-background p-4 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            />
          </div>

          {genError && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              {genError}
            </div>
          )}

          {isGenerating && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 flex items-center gap-3 animate-in fade-in">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <div className="text-xs font-semibold text-primary">{generationStep}</div>
            </div>
          )}

          {/* Primary Instant Import Buttons (Zero API Key Needed) */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={isGenerating || detectedCount === 0}
              onClick={() => handleDirectImport(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              <span>
                {detectedCount > 0
                  ? lang === "bn"
                    ? `${detectedCount}টি প্রশ্ন ইম্পোর্ট ও সেভ করুন (Quiz #${quizNumber})`
                    : `Import ${detectedCount} Questions & Save Quiz #${quizNumber}`
                  : lang === "bn"
                    ? "প্রশ্ন পেস্ট করে ইম্পোর্ট করুন"
                    : "Paste Questions Above to Import"}
              </span>
            </button>

            {onLoadIntoEditor && detectedCount > 0 && (
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleDirectImport(true)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3.5 text-xs font-bold text-foreground hover:bg-accent transition"
                title="Open parsed questions in Manual Editor before saving"
              >
                <PenTool className="h-4 w-4 text-primary" />
                <span>{lang === "bn" ? "এডিটরে নিন" : "Edit First"}</span>
              </button>
            )}
          </div>

          {/* Clean Collapsible Gemini AI Generator (Optional — never clutters paste workflow) */}
          <div className="rounded-2xl border border-border/80 bg-background/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAiPanel((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>
                  {lang === "bn"
                    ? "অথবা Gemini AI দিয়ে স্বয়ংক্রিয় প্রশ্ন তৈরি করুন (ঐচ্ছিক)"
                    : "Or Auto-Generate New Questions with Gemini AI (Optional)"}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-3 w-3" />
                  {credits} Credits
                </span>
                {showAiPanel ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            {showAiPanel && (
              <div className="border-t border-border/70 p-4 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      {lang === "bn" ? "প্রশ্ন সংখ্যা" : "Count"}
                    </label>
                    <select
                      disabled={isGenerating}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-card p-2 text-xs font-bold text-foreground outline-none"
                    >
                      <option value={5}>5 Questions</option>
                      <option value={10}>10 Questions</option>
                      <option value={15}>15 Questions</option>
                      <option value={20}>20 Questions</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      {lang === "bn" ? "ধরন" : "Style"}
                    </label>
                    <select
                      disabled={isGenerating}
                      value={questionStyleMode}
                      onChange={(e) =>
                        setQuestionStyleMode(e.target.value as "mixed_all_4" | "single_mcq")
                      }
                      className="w-full rounded-xl border border-border bg-card p-2 text-xs font-bold text-foreground outline-none"
                    >
                      <option value="single_mcq">Single MCQ Only</option>
                      <option value="mixed_all_4">Mixed (MCQ, T/F, Written)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      {lang === "bn" ? "কঠিনতা" : "Difficulty"}
                    </label>
                    <select
                      disabled={isGenerating}
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                      className="w-full rounded-xl border border-border bg-card p-2 text-xs font-bold text-foreground outline-none"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {isAiReady
                        ? lang === "bn"
                          ? "Gemini Key সংযুক্ত আছে"
                          : "Gemini Key Ready"
                        : lang === "bn"
                          ? "Gemini Key প্রয়োজন"
                          : "Gemini API Key Required"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKeyInput((v) => !v)}
                    className="font-mono text-[11px] font-bold text-primary hover:underline"
                  >
                    {showKeyInput ? "Hide Key" : isAiReady ? "Change Key" : "Enter Key"}
                  </button>
                </div>

                {(showKeyInput || !isAiReady) && (
                  <div className="space-y-2">
                    <input
                      type="password"
                      disabled={isGenerating}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Paste Google AI Studio key (AIza...)"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                    {user?.role === "admin" && (
                      <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={saveKeyServerWide}
                          onChange={(e) => setSaveKeyServerWide(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span>Save key on server for all instructors</span>
                      </label>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateWithGemini}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/15 py-2.5 text-xs font-extrabold text-primary hover:bg-primary/25 transition disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>
                    {lang === "bn"
                      ? `Gemini AI দিয়ে Quiz #${quizNumber} তৈরি করুন (1 Credit)`
                      : `Generate Quiz #${quizNumber} with Gemini AI (1 Credit)`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

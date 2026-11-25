import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { generateQuizWithAi, getAiCredits, getStoredLocalGeminiKey } from "@/lib/ai-generator";
import { AI_PROVIDER_CATALOG } from "@/lib/ai-pool";
import {
  buildCopyableAiPrompt,
  buildQuizFromParsedText,
  parseQuestionsFromText,
} from "@/lib/question-text-parser";
import { serverGetAiGeneratorStatus } from "@/lib/server-session";
import { AiProviderId, Course, Quiz } from "@/lib/types";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import {
  Check,
  CheckCircle2,
  Copy,
  Cpu,
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

interface ActivePoolNodeOption {
  id: string;
  label: string;
  provider: AiProviderId;
  model: string;
  status: string;
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
  const [mode, setMode] = useState<"ai_pool" | "paste_import">("ai_pool");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [quizNumber, setQuizNumber] = useState<number>(1);
  const [quizTitle, setQuizTitle] = useState("");
  const [mainText, setMainText] = useState("");

  // UX Helpers
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // AI Pool Generator State
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionStyleMode, setQuestionStyleMode] = useState<"mixed_all_4" | "single_mcq">(
    "single_mcq",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [genError, setGenError] = useState<string | null>(null);
  const [hasServerPool, setHasServerPool] = useState<boolean>(() => db.hasServerGeminiKey());
  const [poolStrategy, setPoolStrategy] = useState<string>("priority_failover");
  const [activeNodes, setActiveNodes] = useState<ActivePoolNodeOption[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [clientProvider, setClientProvider] = useState<AiProviderId>("openrouter");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

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
        setHasServerPool(srv);
        if (res?.strategy) setPoolStrategy(res.strategy);
        if (Array.isArray(res?.activeNodes)) {
          setActiveNodes(res.activeNodes);
        }
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
  const isAiReady = hasServerPool || trimmedKeyInput.length >= 10;
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
          ? 'কোনো প্রশ্ন শনাক্ত করা যায়নি। "Copy Prompt Format" দিয়ে AI থেকে ফরম্যাট নিন বা নিচে উদাহরণ দেখুন।'
          : 'No formatted questions detected. Click "Copy Prompt Format" for an AI template or "Example".',
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

  const handleGenerateWithAiPool = async (openInEditor = false) => {
    const effectiveTopic = quizTitle.trim() || mainText.trim().split("\n")[0]?.slice(0, 120) || "";
    if (!effectiveTopic || isGenerating) {
      setGenError(
        lang === "bn"
          ? "AI দিয়ে তৈরি করতে কুইজের শিরোনাম বা সিলেবাস/টপিক লিখুন।"
          : "Enter a quiz title or topic/syllabus notes to synthesize with the AI Pool.",
      );
      return;
    }

    setGenError(null);
    setIsGenerating(true);
    const selectedNode = activeNodes.find((n) => n.id === selectedNodeId);
    setGenerationStep(
      lang === "bn"
        ? `AI Pool (${selectedNode ? selectedNode.label : poolStrategy}) দিয়ে ${questionCount}টি দ্বিভাষিক প্রশ্ন তৈরি হচ্ছে…`
        : `Synthesizing ${questionCount} bilingual questions via AI Pool (${selectedNode ? `${selectedNode.label} · ${selectedNode.model}` : poolStrategy.replace("_", " ")})…`,
    );

    try {
      if (trimmedKeyInput.length >= 10 && typeof window !== "undefined") {
        localStorage.setItem("onnesha_gemini_key", trimmedKeyInput);
      }

      const generated = await generateQuizWithAi({
        topic: effectiveTopic,
        sourceText: mainText.trim() || undefined,
        questionCount,
        difficulty,
        category: activeCourse?.categoryEn || "Institutional Assessment",
        language: "both",
        courseId: activeCourse?.id,
        courseTitle: activeCourse?.titleEn,
        quizNumber,
        instructorId: user?.id || "usr-instructor-1",
        instructorName: user?.name || "Course Instructor",
        questionStyleMode,
        ...(selectedNodeId ? { preferredNodeId: selectedNodeId } : {}),
        ...(trimmedKeyInput.length >= 10
          ? { apiKey: trimmedKeyInput, provider: clientProvider }
          : {}),
      });
      setIsGenerating(false);
      void refreshUser();
      if (openInEditor && onLoadIntoEditor) {
        onLoadIntoEditor(generated);
      } else {
        onQuizGenerated(generated);
      }
      onClose();
    } catch (err) {
      console.error("AI Pool quiz generation error:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to generate exam paper. Check Admin → AI Pool or try Paste Import.";
      setGenError(errMsg);
      if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("no ai provider")) {
        setShowKeyInput(true);
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-2xl max-h-[93vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute right-4 top-4 rounded-xl border border-border p-1.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Studio Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-9">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-black text-foreground">
                  {lang === "bn" ? "AI অ্যাসেসমেন্ট ও ইম্পোর্ট স্টুডিও" : "AI Assessment & Import Studio"}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                    isAiReady
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <Cpu className="h-3 w-3" />
                  {activeNodes.length > 0
                    ? `${activeNodes.length} Pool Node${activeNodes.length === 1 ? "" : "s"} Online`
                    : isAiReady
                      ? "Key Ready"
                      : "No Key"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === "bn"
                  ? "OpenRouter, Gemini, OpenAI, Claude, Groq AI Pool দিয়ে প্রশ্ন তৈরি করুন অথবা সরাসরি পেস্ট করুন"
                  : "Generate via Multi-Provider AI Pool (OpenRouter, Gemini, OpenAI, Claude, Groq) or paste formatted text"}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 self-start sm:self-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <Zap className="h-3 w-3" />
            {credits} Credits
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("ai_pool")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${
              mode === "ai_pool"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>{lang === "bn" ? "AI Pool জেনারেটর" : "AI Pool Generator"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("paste_import")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${
              mode === "paste_import"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>
              {lang === "bn" ? "দ্রুত টেক্সট পেস্ট ইম্পোর্ট" : "Quick Text Paste Import"}
              {detectedCount > 0 ? ` (${detectedCount})` : ""}
            </span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Course, Quiz #, Title Row */}
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
                {mode === "ai_pool"
                  ? lang === "bn"
                    ? "টপিক / কুইজ শিরোনাম *"
                    : "Topic / Quiz Title *"
                  : lang === "bn"
                    ? "কুইজ শিরোনাম (ঐচ্ছিক)"
                    : "Quiz Title (Optional)"}
              </label>
              <input
                type="text"
                disabled={isGenerating}
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder={
                  mode === "ai_pool"
                    ? lang === "bn"
                      ? "যেমন: Meta Ads Targeting ও Prompt Engineering"
                      : "e.g. Prompt Engineering & Digital Ad Analytics"
                    : parsedPreview.detectedTitle || `Quiz #${quizNumber}`
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {mode === "ai_pool" ? (
            <div className="space-y-4">
              {/* AI Pool Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    {lang === "bn" ? "প্রশ্ন সংখ্যা" : "Questions"}
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
                    {lang === "bn" ? "প্রশ্নের ধরন" : "Style"}
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

                <div>
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    {lang === "bn" ? "AI Pool রুট" : "AI Pool Route"}
                  </label>
                  <select
                    disabled={isGenerating}
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card p-2 text-xs font-bold text-foreground outline-none"
                  >
                    <option value="">
                      Auto ({poolStrategy.replace("_", " ")})
                    </option>
                    {activeNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {AI_PROVIDER_CATALOG[n.provider]?.shortName}: {n.model.slice(0, 20)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Syllabus / Notes Textarea */}
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-foreground">
                  {lang === "bn"
                    ? "সিলেবাস / লেকচার নোট (ঐচ্ছিক — নির্ভুল প্রশ্নের জন্য পেস্ট করুন)"
                    : "Source Syllabus / Lecture Notes (Optional — paste for grounded questions)"}
                </label>
                <textarea
                  rows={6}
                  disabled={isGenerating}
                  value={mainText}
                  onChange={(e) => setMainText(e.target.value)}
                  placeholder={
                    lang === "bn"
                      ? "স্লাইড, লেকচার নোট বা অধ্যায়ের মূল পয়েন্ট এখানে পেস্ট করলে AI ঠিক এখান থেকেই প্রশ্ন ও ব্যাখ্যা তৈরি করবে…"
                      : "Paste lecture slides, chapter outline, or key frameworks here so the AI Pool grounds every question and explanation directly in your syllabus…"
                  }
                  className="min-h-[150px] w-full resize-y rounded-2xl border border-border bg-background p-3.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>

              {/* Optional Local Key Override */}
              <div className="rounded-2xl border border-border/80 bg-muted/25 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {activeNodes.length > 0
                        ? `Server AI Pool active (${activeNodes.map((n) => AI_PROVIDER_CATALOG[n.provider]?.shortName).filter((v, i, a) => a.indexOf(v) === i).join(", ")})`
                        : isAiReady
                          ? "Local override API key ready"
                          : "No Server AI Pool node configured — enter a key or configure Admin → AI Pool"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKeyInput((v) => !v)}
                    className="font-mono text-[11px] font-bold text-primary hover:underline"
                  >
                    {showKeyInput ? "Hide Override" : "Personal Key Override"}
                  </button>
                </div>

                {(showKeyInput || !isAiReady) && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                    <select
                      value={clientProvider}
                      onChange={(e) => setClientProvider(e.target.value as AiProviderId)}
                      className="sm:col-span-4 rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-bold text-foreground outline-none"
                    >
                      <option value="openrouter">OpenRouter</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="groq">Groq</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                    <input
                      type="password"
                      disabled={isGenerating}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={AI_PROVIDER_CATALOG[clientProvider].keyPlaceholder}
                      className="sm:col-span-8 rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                )}
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

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleGenerateWithAiPool(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-40"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>
                    {lang === "bn"
                      ? `AI Pool দিয়ে Quiz #${quizNumber} তৈরি ও সেভ করুন (1 Credit)`
                      : `Generate & Save Quiz #${quizNumber} via AI Pool (1 Credit)`}
                  </span>
                </button>
                {onLoadIntoEditor && (
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => void handleGenerateWithAiPool(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3.5 text-xs font-bold text-foreground hover:bg-accent transition disabled:opacity-40"
                  >
                    <PenTool className="h-4 w-4 text-primary" />
                    <span>{lang === "bn" ? "তৈরি করে এডিট করুন" : "Generate & Edit"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* QUICK TEXT PASTE IMPORT TAB */
            <div className="space-y-3">
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
                      {lang === "bn" ? "প্রশ্ন + উত্তর পেস্ট করুন" : "Paste formatted Qs or AI output"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyPromptFormat}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
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
                        <span>Copy Prompt Format</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFormatGuide((v) => !v)}
                    className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
                  >
                    {showFormatGuide ? "Hide Example" : "Example"}
                  </button>
                </div>
              </div>

              {showFormatGuide && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      Supported Clean Format (EN/BN, inline answers or bottom answer key table):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMainText(
                          `1. When did the Constitution of Bangladesh take effect?\nA. 16 December 1971\nB. 16 December 1972\nC. 26 March 1971\nD. 4 November 1972\nAnswer: B\nExplanation: The Constitution of Bangladesh came into effect on 16 December 1972.`,
                        );
                        setShowFormatGuide(false);
                      }}
                      className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Insert Sample
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
                rows={9}
                disabled={isGenerating}
                value={mainText}
                onChange={(e) => setMainText(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? `এখানে সরাসরি প্রশ্ন পেস্ট করুন (ChatGPT / Claude / Gemini / Docs থেকে)...`
                    : `Paste questions directly here (from ChatGPT, Claude, Gemini, or Docs)...`
                }
                className="min-h-[210px] w-full resize-y rounded-2xl border-2 border-border bg-background p-4 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />

              {genError && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                  {genError}
                </div>
              )}

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
                      ? `Import ${detectedCount} Questions & Save Quiz #${quizNumber}`
                      : "Paste Questions Above to Import"}
                  </span>
                </button>
                {onLoadIntoEditor && detectedCount > 0 && (
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => handleDirectImport(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3.5 text-xs font-bold text-foreground hover:bg-accent transition"
                  >
                    <PenTool className="h-4 w-4 text-primary" />
                    <span>Edit First</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

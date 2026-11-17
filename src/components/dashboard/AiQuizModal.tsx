import React, { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { generateQuizWithAi, getAiCredits, getStoredLocalGeminiKey } from "@/lib/ai-generator";
import { serverGetAiGeneratorStatus } from "@/lib/server-session";
import { Course, Quiz } from "@/lib/types";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, KeyRound, Layers, Loader2, Sparkles, Wand2, X, Zap } from "lucide-react";

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizGenerated: (quiz: Quiz) => void;
  defaultCourseId?: string;
}

export const AiQuizModal: React.FC<AiQuizModalProps> = ({
  isOpen,
  onClose,
  onQuizGenerated,
  defaultCourseId,
}) => {
  const { lang } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [quizNumber, setQuizNumber] = useState<number>(1);
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [questionCount, setQuestionCount] = useState(6);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionStyleMode, setQuestionStyleMode] = useState<"mixed_all_4" | "single_mcq">(
    "mixed_all_4",
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setGenError(null);
    setIsGenerating(true);
    setGenerationStep(
      lang === "bn"
        ? "Gemini AI দিয়ে মৌলিক দ্বিভাষিক প্রশ্ন, অপশন ও ব্যাখ্যা তৈরি হচ্ছে..."
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
        topic: topic.trim(),
        sourceText: sourceText.trim() || undefined,
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
          : "Failed to generate exam paper. Check Gemini API settings or try again.";
      setGenError(errMsg);
      if (errMsg.toLowerCase().includes("api key")) {
        setShowKeyInput(true);
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isGenerating}
          className="absolute right-4 top-4 rounded-xl border border-border p-1.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "AI কুইজ ও প্রশ্নপত্র জেনারেটর" : "AI Assessment Studio"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === "bn"
                  ? "কোর্স ও ধারাবাহিক কুইজ নম্বর অনুযায়ী স্বয়ংক্রিয় প্রশ্নপত্র তৈরি"
                  : "Generate course-aligned sequential quizzes in seconds"}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
            <Zap className="h-3 w-3" />
            <span>{credits} Credits</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="mt-5 space-y-4">
          {/* Live Gemini Engine Status + Inline API Key Setup */}
          <div
            className={`rounded-2xl border p-3 text-xs ${
              isAiReady
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/40 bg-amber-500/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                {isAiReady ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {hasServerKey
                        ? lang === "bn"
                          ? "লাইভ Gemini AI সার্ভার সংযুক্ত (Ready)"
                          : "Live Gemini AI Connected (Server Ready)"
                        : lang === "bn"
                          ? "স্থানীয় Gemini API Key সক্রিয়"
                          : "Live Gemini AI Connected (Local Key Active)"}
                    </span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                      {lang === "bn"
                        ? "AI প্রশ্ন তৈরির জন্য Gemini API Key প্রয়োজন"
                        : "Gemini API Key Required for Real AI Generation"}
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowKeyInput((v) => !v)}
                className="font-mono text-[11px] font-bold text-primary hover:underline"
              >
                {showKeyInput ? "Hide Key" : isAiReady ? "Change API Key" : "Enter Key"}
              </button>
            </div>

            {(showKeyInput || !isAiReady) && (
              <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
                <input
                  type="password"
                  disabled={isGenerating}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste Google AI Studio key (AIza...) — free at aistudio.google.com/apikey"
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
                    <span>
                      {lang === "bn"
                        ? "সব প্রশিক্ষকের জন্য সার্ভারে সংরক্ষণ করুন"
                        : "Save key on server for all instructors (Super Admin)"}
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Course & Quiz Number Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-border bg-background/60 p-3.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" />
                <span>{lang === "bn" ? "কোর্স নির্বাচন করুন" : "Assign to Course"}</span>
              </label>
              <select
                disabled={isGenerating}
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {lang === "bn" ? c.titleBn : c.titleEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === "bn" ? "কুইজ ক্রম (Quiz #)" : "Quiz Number"}
              </label>
              <div className="flex items-center gap-1.5">
                <span className="rounded-xl bg-primary/10 px-2.5 py-2 font-mono text-xs font-black text-primary">
                  #
                </span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  disabled={isGenerating}
                  value={quizNumber}
                  onChange={(e) => setQuizNumber(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-border bg-card p-2 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {lang === "bn"
                ? "বিষয় বা সিলেবাস টপিক (Topic / Prompt) *"
                : "Quiz Topic / Subject Prompt *"}
            </label>
            <input
              type="text"
              required
              disabled={isGenerating}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                lang === "bn"
                  ? "যেমন: ৪৬তম বিসিএস মুক্তিযুদ্ধ ও সংবিধান, সাইবার নিরাপত্তা..."
                  : "e.g. Bangladesh Liberation War & Constitution, Cyber Security..."
              }
              className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {lang === "bn"
                ? "ঐচ্ছিক: লেকচার নোট বা অনুচ্ছেদ পেস্ট করুন"
                : "Optional: Paste lecture notes or syllabus excerpt"}
            </label>
            <textarea
              rows={2}
              disabled={isGenerating}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={
                lang === "bn"
                  ? "এখানে অনুচ্ছেদ বা কারিকুলাম পেস্ট করুন..."
                  : "Paste text snippet or syllabus excerpts..."
              }
              className="w-full rounded-2xl border-2 border-border bg-background p-3 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === "bn" ? "প্রশ্ন সংখ্যা" : "Question Count"}
              </label>
              <select
                disabled={isGenerating}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value={4}>4 Questions (Express)</option>
                <option value={6}>6 Questions (Standard)</option>
                <option value={10}>10 Questions (Complete)</option>
                <option value={20}>20 Questions (Full Paper)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === "bn" ? "প্রশ্নের ধরন (Style)" : "Question Styles"}
              </label>
              <select
                disabled={isGenerating}
                value={questionStyleMode}
                onChange={(e) =>
                  setQuestionStyleMode(e.target.value as "mixed_all_4" | "single_mcq")
                }
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value="mixed_all_4">All 4 Styles (MCQ, T/F, Multi, Written)</option>
                <option value="single_mcq">Single Best MCQ Only (OMR)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === "bn" ? "কঠিনতার মাত্রা" : "Difficulty Level"}
              </label>
              <select
                disabled={isGenerating}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value="easy">Easy (প্রিলিমিনারি)</option>
                <option value="medium">Medium (স্ট্যান্ডার্ড)</option>
                <option value="hard">Hard (ক্যাডার লেভেল)</option>
              </select>
            </div>
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

          <button
            type="submit"
            disabled={!topic.trim() || isGenerating}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Exam Paper...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>Generate Quiz #{quizNumber} with AI (1 Credit)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useLanguage } from "@/lib/i18n";
import { shouldSuppressFloatingAiChat } from "@/lib/course-kb";
import {
  serverAskFloatingAiAssistant,
  serverGetFloatingAiContext,
} from "@/lib/server-session";
import type { TutorStudyMode } from "@/lib/ai-tutor-core";
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Database,
  Globe2,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface FloatingCourseOption {
  id: string;
  code: string;
  titleEn: string;
  titleBn: string;
  kbDocCount: number;
  dedicatedKbCount: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  scopeLabel?: string;
  sourcesUsed?: Array<{ id: string; title: string; kind: string }>;
  provider?: string;
  model?: string;
  latencyMs?: number;
  error?: boolean;
}

export const FloatingAiAssistant: React.FC = () => {
  const { lang } = useLanguage();
  const location = useLocation();
  const pathname = location.pathname || "/";
  const suppressed = shouldSuppressFloatingAiChat(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [online, setOnline] = useState<boolean>(true);
  const [courses, setCourses] = useState<FloatingCourseOption[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("platform");
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const [mode, setMode] = useState<TutorStudyMode>("explain");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadContext = async () => {
    try {
      const res = await serverGetFloatingAiContext();
      if (res.success) {
        setOnline(res.online);
        setCourses(res.availableCourses || []);
        if (res.studentName) {
          setStudentLabel(
            res.studentRoll ? `${res.studentName} (${res.studentRoll})` : res.studentName,
          );
        }
        setSelectedScope((prev) => {
          if (prev && prev !== "platform" && res.availableCourses.some((c) => c.id === prev)) {
            return prev;
          }
          if (!contextLoaded && res.defaultCourseId) {
            return res.defaultCourseId;
          }
          return prev || "platform";
        });
        setContextLoaded(true);
      }
    } catch {
      // ignore transient offline errors
    }
  };

  useEffect(() => {
    if (suppressed) return;
    if (isOpen) {
      void loadContext();
    }
  }, [isOpen, pathname, suppressed]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, isOpen]);

  if (suppressed) return null;

  const activeCourse = courses.find((c) => c.id === selectedScope);

  const sendMessage = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || busy) return;

    const history = messages
      .filter((m) => !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: clean },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await serverAskFloatingAiAssistant({
        data: {
          question: clean,
          courseId: selectedScope,
          lang: lang === "bn" ? "bn" : "en",
          mode,
          history,
          currentPath: pathname,
        },
      });
      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.answer,
            scopeLabel: res.scopeLabel,
            sourcesUsed: res.sourcesUsed,
            provider: res.provider,
            model: res.model,
            latencyMs: res.latencyMs,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: res.error || "AI Assistant could not respond right now.",
            error: true,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "Network error while contacting AI.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const quickStarters = activeCourse
    ? lang === "bn"
      ? [
          `${activeCourse.code} কোর্সের ফাইনাল পরীক্ষা ও মার্কিং নিয়ম কী?`,
          `ক্যাপস্টোন প্র্যাকটিক্যাল জমার চেকলিস্ট দাও`,
          `পরীক্ষার প্রস্তুতির জন্য ৩টি দ্রুত প্র্যাকটিস প্রশ্ন করো`,
        ]
      : [
          `Explain ${activeCourse.code} assessment & passing rules`,
          `Give me the capstone practical checklist`,
          `Quiz me with 3 practice questions from this course KB`,
        ]
    : lang === "bn"
      ? [
          "স্টুডেন্ট পোর্টালে কীভাবে লগইন করব?",
          "লাইভ কুইজে PIN দিয়ে কীভাবে যোগ দেব?",
          "সার্টিফিকেট কীভাবে যাচাই (Verify) করব?",
        ]
      : [
          "How do I sign in to the Student Portal?",
          "How do I join a live quiz with a 6-digit PIN?",
          "How do I verify an official Onnesha certificate?",
        ];

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end">
      {/* EXPANDED FLOATING CHAT PANEL */}
      {isOpen && (
        <div
          className={`mb-3 flex flex-col overflow-hidden rounded-3xl border border-border/90 bg-card/98 backdrop-blur-2xl shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 ${
            expanded
              ? "w-[min(95vw,560px)] h-[min(82vh,700px)]"
              : "w-[min(93vw,410px)] h-[min(74vh,580px)]"
          }`}
        >
          {/* Top Gradient Header */}
          <div className="relative bg-gradient-to-r from-primary/15 via-card to-violet-500/15 border-b border-border/80 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display text-sm font-black text-foreground truncate">
                      {lang === "bn" ? "অন্বেষা AI অ্যাসিস্ট্যান্ট" : "Onnesha AI Assist"}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        online
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      {online ? "Live" : "Offline"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {studentLabel
                      ? `${studentLabel} · Course KB Grounded`
                      : lang === "bn"
                        ? "সকল শিক্ষার্থী ও কোর্সের জন্য সার্বক্ষণিক AI সহায়তা"
                        : "24/7 Course Knowledge Base & Platform Support"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    title="Clear conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="hidden sm:inline-flex rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                  title={expanded ? "Compact size" : "Expand size"}
                >
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                  title="Close AI Assist"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Dedicated Course Knowledge Base Selector */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                {selectedScope === "platform" ? (
                  <Globe2 className="h-3.5 w-3.5" />
                ) : (
                  <Database className="h-3.5 w-3.5" />
                )}
              </div>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-border bg-background/90 px-2.5 py-1.5 text-[11px] font-bold text-foreground outline-none focus:border-primary"
                aria-label="Select Course Knowledge Base"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {lang === "bn" ? c.titleBn : c.titleEn} ({c.kbDocCount} KB docs)
                  </option>
                ))}
                <option value="platform">
                  {lang === "bn" ? "🌐 অন্বেষা প্ল্যাটফর্ম সাপোর্ট" : "🌐 Onnesha Platform Support"}
                </option>
              </select>
            </div>

            {/* Compact Mode Pills */}
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [
                  ["explain", lang === "bn" ? "ব্যাখ্যা" : "Explain"],
                  ["practice", lang === "bn" ? "প্র্যাকটিস" : "Practice"],
                  ["capstone", lang === "bn" ? "ক্যাপস্টোন" : "Capstone"],
                  ["summary", lang === "bn" ? "সারসংক্ষেপ" : "Summary"],
                ] as Array<[TutorStudyMode, string]>
              ).map(([mId, lbl]) => (
                <button
                  key={mId}
                  type="button"
                  onClick={() => setMode(mId)}
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                    mode === mId
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/70 text-muted-foreground hover:text-foreground border border-border/70"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3 bg-muted/15">
            {!online && (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                AI Pool is currently offline. Admin can connect OpenRouter, Gemini, OpenAI, Claude,
                or Groq in Admin → AI Pool.
              </div>
            )}

            {messages.length === 0 ? (
              <div className="py-5 text-center space-y-3.5">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1 px-2">
                  <p className="font-display text-xs font-extrabold text-foreground">
                    {activeCourse
                      ? lang === "bn"
                        ? `${activeCourse.titleBn} — ডেডিকেটেড নলেজবেস`
                        : `${activeCourse.titleEn} — Dedicated Knowledge Base`
                      : lang === "bn"
                        ? "কীভাবে আপনাকে সাহায্য করতে পারি?"
                        : "How can I assist you today?"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {activeCourse
                      ? lang === "bn"
                        ? `এই কোর্সের ${activeCourse.kbDocCount}টি নলেজবেস ডকুমেন্ট ও ম্যাটেরিয়াল থেকে নির্ভুল উত্তর পাবেন।`
                        : `Grounded in ${activeCourse.kbDocCount} dedicated course KB docs & materials.`
                      : lang === "bn"
                        ? "পোর্টাল লগইন, লাইভ পরীক্ষা, ফাইনাল ক্যাপস্টোন বা সার্টিফিকেট নিয়ে যেকোনো প্রশ্ন করুন।"
                        : "Ask about Student Portal login, live quizzes, capstone uploads, or certificates."}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  {quickStarters.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendMessage(q)}
                      className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/5 transition text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : msg.error
                          ? "border border-destructive/35 bg-destructive/10 text-destructive rounded-tl-sm"
                          : "border border-border bg-card text-foreground rounded-tl-sm"
                    }`}
                  >
                    <div>{msg.content}</div>
                    {msg.role === "assistant" && !msg.error && (
                      <div className="mt-2 pt-1.5 border-t border-border/60 space-y-1.5">
                        {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <BookOpen className="h-2.5 w-2.5 text-primary shrink-0" />
                            {msg.sourcesUsed.slice(0, 3).map((src) => (
                              <span
                                key={src.id}
                                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary max-w-[160px] truncate"
                                title={src.title}
                              >
                                {src.title}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-muted-foreground">
                          <span className="truncate">
                            {msg.provider ? `${msg.provider} · ` : ""}
                            {msg.model || "AI Pool"}
                            {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(msg.content);
                                setCopiedId(msg.id);
                                window.setTimeout(() => setCopiedId(null), 1600);
                              } catch {
                                // ignore
                              }
                            }}
                            className="inline-flex items-center gap-0.5 font-sans font-bold text-primary hover:underline shrink-0"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-2.5 w-2.5" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {lang === "bn"
                    ? "কোর্স নলেজবেস থেকে উত্তর তৈরি হচ্ছে…"
                    : "Searching course knowledge base…"}
                </span>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Composer Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="border-t border-border/80 bg-card p-2.5 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === "bn" ? "যেকোনো প্রশ্ন লিখুন…" : "Ask anything about your course…"
              }
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-40"
              aria-label="Send message"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}

      {/* FLOATING LAUNCHER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close AI Assistant" : "Open Onnesha AI Assistant"}
        className="group relative flex items-center gap-2 rounded-full bg-gradient-to-tr from-primary via-emerald-600 to-violet-600 px-4 py-3 text-white shadow-xl shadow-primary/30 hover:scale-[1.03] active:scale-[0.98] transition-all border border-white/20"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300 border border-emerald-900" />
              </span>
            </>
          )}
        </span>
        <span className="hidden sm:inline font-display text-xs font-extrabold tracking-tight">
          {isOpen
            ? lang === "bn"
              ? "বন্ধ করুন"
              : "Close AI"
            : lang === "bn"
              ? "AI সহায়তা"
              : "AI Assist"}
        </span>
      </button>
    </div>
  );
};

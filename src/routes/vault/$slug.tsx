import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { db } from "@/lib/db";
import { OmrSheetView } from "@/components/common/OmrSheetView";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Download, Eye, EyeOff, FileText, Play, Printer, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/vault/$slug")({
  head: ({ params }) => {
    const pack = db.getQuizBySlug(params.slug) || READY_MADE_PACKS.find((p) => p.slug === params.slug) || READY_MADE_PACKS[0];
    return {
      meta: [
        { title: `${pack?.titleBn || pack?.titleEn || 'Curriculum'} — Verified Curriculum Assessment · Onnesha Arena` },
        {
          name: "description",
          content: `${pack?.titleBn || 'Onnesha Curriculum'} - ${pack?.questions.length || 0} verified assessment items with pedagogical rationale.`,
        },
      ],
    };
  },
  component: SingleCurriculumDetailPage,
});

function SingleCurriculumDetailPage() {
  const { slug } = Route.useParams();
  const { lang, t } = useLanguage();
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [showOmrModal, setShowOmrModal] = useState(false);

  const pack = db.getQuizBySlug(slug) || READY_MADE_PACKS.find((p) => p.slug === slug);

  if (!pack) {
    throw notFound();
  }

  const toggleReveal = (qId: string) => {
    setRevealedAnswers((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const optionLetters = ['ক', 'খ', 'গ', 'ঘ'];
  const optionLettersEn = ['A', 'B', 'C', 'D'];

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-10">
        {/* Back Link */}
        <Link
          to="/vault"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === "bn" ? "← সকল নলেজ ভল্ট" : "← Back to Knowledge Vault"}</span>
        </Link>

        {/* Hero Card */}
        <div className="bento-card p-6 sm:p-8 shadow-glow">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{pack.icon}</span>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-bold text-primary">
                  {lang === "bn" ? pack.categoryBn : pack.categoryEn}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Verified Curriculum</span>
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {lang === "bn" ? pack.titleBn : pack.titleEn}
              </h1>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                {lang === "bn" ? pack.descriptionBn : pack.descriptionEn}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
              <Link
                to="/play"
                search={{ practice: pack.slug || pack.id }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {lang === "bn" ? "নিজে পরীক্ষা দিন (Practice)" : "Practice Exam Now"}
                </span>
              </Link>

              <Link
                to="/host/$quizId"
                params={{ quizId: pack.slug }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <span>{lang === "bn" ? "লাইভ রুম হোস্ট করুন" : "Host Live Room"}</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowOmrModal(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
              >
                <Printer className="h-4 w-4 text-primary" />
                <span>{lang === "bn" ? "OMR শিট প্রিন্ট করুন" : "Print OMR Sheet"}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 pt-6 border-t border-border/80 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-xl sm:text-2xl font-black text-foreground">
                {pack.questions.length}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === "bn" ? "মোট প্রশ্ন" : "Total Questions"}
              </div>
            </div>
            <div>
              <div className="font-mono text-xl sm:text-2xl font-black text-foreground">
                {pack.questions.length * 20}s
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === "bn" ? "আনুমানিক সময়" : "Estimated Time"}
              </div>
            </div>
            <div>
              <div className="font-mono text-xl sm:text-2xl font-black text-foreground">
                -0.25
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === "bn" ? "নেগেটিভ মার্কিং" : "Negative Penalty"}
              </div>
            </div>
          </div>
        </div>

        {/* Question Bank Detailed Review */}
        <div className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              {lang === "bn" ? "প্রশ্নমালা ও বিশ্লেষণ পর্যালোচনা" : "Curriculum Items & Explanations"}
            </h2>
            <button
              onClick={() => {
                const allRevealed: Record<string, boolean> = {};
                pack.questions.forEach((q) => {
                  allRevealed[q.id] = true;
                });
                setRevealedAnswers(allRevealed);
              }}
              className="text-xs font-bold text-primary hover:underline"
            >
              {lang === "bn" ? "সকল উত্তর দেখুন" : "Reveal All Answers"}
            </button>
          </div>

          <div className="space-y-4">
            {pack.questions.map((q, idx) => {
              const isRevealed = !!revealedAnswers[q.id];
              return (
                <div
                  key={q.id}
                  className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-mono text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <h3 className="font-display text-sm sm:text-base font-bold text-foreground leading-snug">
                        {lang === "bn" ? q.textBn : q.textEn}
                      </h3>
                    </div>

                    <button
                      onClick={() => toggleReveal(q.id)}
                      className="rounded-xl border border-border/80 p-2 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                      title={isRevealed ? "Hide Answer" : "Show Answer"}
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Options or Written Answer Key */}
                  {q.type === "written" || q.type === "fill_blank" ? (
                    <div className="rounded-2xl border border-dashed border-primary/40 bg-background/80 p-3.5 text-xs">
                      <span className="font-mono font-bold text-primary">
                        {lang === "bn" ? "✍️ সংক্ষিপ্ত লিখিত উত্তর প্রশ্ন" : "✍️ Short Written Response Item"}
                      </span>
                      {isRevealed && (
                        <div className="mt-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Accepted Key: {(q.acceptedAnswers || []).join(" / ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctOptionIds.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 rounded-2xl border p-3 text-xs font-semibold transition-colors ${
                              isRevealed && isCorrect
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "border-border/80 bg-background/80 text-foreground"
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                isRevealed && isCorrect
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {lang === "bn" ? optionLetters[optIdx] : optionLettersEn[optIdx]}
                            </span>
                            <span className="flex-1">{lang === "bn" ? opt.textBn : opt.textEn}</span>
                            {isRevealed && isCorrect && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rationale Explanation Drawer */}
                  {isRevealed && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1 animate-in fade-in">
                      <div className="font-bold text-primary flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{lang === "bn" ? "অফিসিয়াল সমাধান ও বিশ্লেষণ" : "Official Editorial Rationale"}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {lang === "bn" ? q.explanationBn : q.explanationEn || q.explanationBn}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* OMR Sheet Modal */}
      {showOmrModal && (
        <OmrSheetView
          quiz={pack}
          onClose={() => setShowOmrModal(false)}
        />
      )}

      <Footer />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { db } from "@/lib/db";
import { Quiz } from "@/lib/types";
import { ArrowRight, BookOpen, Download, FileText, Play, Search, ShieldCheck, Sparkles, Tag } from "lucide-react";

export const Route = createFileRoute("/vault/")({
  head: () => ({
    meta: [
      { title: "National Curriculum & Assessment Knowledge Vault · Onnesha Arena" },
      {
        name: "description",
        content:
          "Official assessment repositories for BCS Cadre, Medical & Varsity Admission, Defense Training, and Board Examinations.",
      },
    ],
  }),
  component: KnowledgeVaultCatalogPage,
});

function KnowledgeVaultCatalogPage() {
  const { lang, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("all");
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>(READY_MADE_PACKS);

  useEffect(() => {
    setAllQuizzes(db.getQuizzes());
  }, []);

  const curricula = [
    { id: "all", nameEn: "All Repositories", nameBn: "সকল ভল্ট" },
    { id: "General Knowledge", nameEn: "BCS & Civil Service", nameBn: "বিসিএস ও ক্যাডার একাডেমি" },
    { id: "Physics", nameEn: "Varsity & Medical Entrance", nameBn: "মেডিকেল ও বিশ্ববিদ্যালয় ভর্তি" },
    { id: "Safety & Compliance", nameEn: "Public Service & Compliance", nameBn: "পাবলিক সার্ভিস ও কমপ্লায়েন্স" },
    { id: "Mathematics", nameEn: "Mathematics & Analytical", nameBn: "উচ্চতর গণিত ও অ্যানালিটিক্স" },
    { id: "English Language", nameEn: "English & Linguistics", nameBn: "ইংরেজি ও লিঙ্গুইস্টিকস" },
    { id: "Science", nameEn: "General Science & ICT", nameBn: "সাধারণ বিজ্ঞান ও আইসিটি" },
  ];

  const filteredPacks = allQuizzes.filter((pack) => {
    const matchesCategory =
      selectedCurriculum === "all" || pack.categoryEn === selectedCurriculum || (pack.tags && pack.tags.includes(selectedCurriculum));
    const matchesSearch =
      pack.titleBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.descriptionBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-10">
        {/* Top Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Onnesha Knowledge Vault</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            {lang === "bn" ? "জাতীয় কারিকুলাম ও মূল্যায়ন ভল্ট" : "National Assessment Knowledge Vault"}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {lang === "bn"
              ? "বিসিএস প্রিলিমিনারি, বিশ্ববিদ্যালয় ভর্তি, প্রতিরক্ষা ক্যাডার ও প্রাতিষ্ঠানিক পরীক্ষার জন্য যাচাইকৃত মডেল টেস্ট সংগ্রহশালা।"
              : "Peer-reviewed bilingual question repositories designed for civil service exams, defense training, and university entrance."}
          </p>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "bn" ? "বিষয় বা টপিক খুঁজুন (যেমন: মুক্তিযুদ্ধ, পদার্থবিজ্ঞান)..." : "Search topics, categories, or keywords..."}
              className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {curricula.map((curr) => (
              <button
                key={curr.id}
                onClick={() => setSelectedCurriculum(curr.id)}
                className={`rounded-2xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCurriculum === curr.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {lang === "bn" ? curr.nameBn : curr.nameEn}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Catalog */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPacks.map((pack) => (
            <div
              key={pack.id}
              className="bento-card p-6 shadow-sm flex flex-col justify-between hover:shadow-glow transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{pack.icon}</span>
                    {pack.quizNumber && (
                      <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-primary">
                        Quiz #{pack.quizNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                      {pack.questions.length} Items
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Verified
                    </span>
                  </div>
                </div>

                {pack.courseTitle && (
                  <div className="mt-3 text-[11px] font-bold text-primary truncate">
                    {pack.courseTitle}
                  </div>
                )}

                <h3 className="mt-1 font-display text-lg font-bold text-foreground leading-snug">
                  {lang === "bn" ? pack.titleBn : pack.titleEn}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {lang === "bn" ? pack.descriptionBn : pack.descriptionEn}
                </p>

                {pack.tags && pack.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pack.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border/80 flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/vault/$slug"
                  params={{ slug: pack.slug }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span>{lang === "bn" ? "প্রশ্ন ও ব্যাখ্যা" : "Review Bank"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <div className="flex items-center gap-2">
                  <Link
                    to="/play"
                    search={{ practice: pack.slug || pack.id }}
                    className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    {lang === "bn" ? "পরীক্ষা দিন" : "Practice Now"}
                  </Link>

                  <Link
                    to="/host/$quizId"
                    params={{ quizId: pack.slug || pack.id }}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent transition"
                  >
                    {lang === "bn" ? "হোস্ট" : "Host"}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

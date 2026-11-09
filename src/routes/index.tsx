import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PinInput } from "@/components/common/PinInput";
import { LiveLeaderboardMock } from "@/components/common/LiveLeaderboardMock";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { audioEngine } from "@/lib/audio-engine";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Flame,
  Globe2,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Layers,
  Lock,
  MessageSquare,
  PenTool,
  Play,
  QrCode,
  Radio,
  Rocket,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wand2,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onnesha Arena — Institutional AI Examination & Model Test Engine" },
      {
        name: "description",
        content:
          "High-security live model tests, negative marking evaluation, psychometric item analysis, and verifiable blockchain-style digital certificates.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedVaultCategory, setSelectedVaultCategory] = useState<string>("all");

  // Interactive Live Sample Question State
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sampleAnswered, setSampleAnswered] = useState(false);
  const [sampleScore, setSampleScore] = useState(0);

  const sampleQuestion = {
    textBn: "গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধানের কোন অনুচ্ছেদে চিন্তা, বিবেক ও বাক-স্বাধীনতার নিশ্চয়তা প্রদান করা হয়েছে?",
    textEn: "Which Article of the Constitution of Bangladesh guarantees Freedom of Thought, Conscience, and Speech?",
    options: [
      { bn: "অনুচ্ছেদ ২৭ (আইনের সমতা)", en: "Article 27 (Equality before Law)", isCorrect: false },
      { bn: "অনুচ্ছেদ ৩৯ (বাক ও ভাব প্রকাশ)", en: "Article 39 (Freedom of Thought & Speech)", isCorrect: true },
      { bn: "অনুচ্ছেদ ৩২ (জীবন ও ব্যক্তিস্বাধীনতা)", en: "Article 32 (Protection of Right to Life)", isCorrect: false },
      { bn: "অনুচ্ছেদ ৩৭ (সমাবেশের স্বাধীনতা)", en: "Article 37 (Freedom of Assembly)", isCorrect: false },
    ],
    explanationBn: "সংবিধানের ৩য় ভাগের ৩৯(২) অনুচ্ছেদ অনুসারে চিন্তা ও বিবেকের স্বাধীনতা এবং বাক-স্বাধীনতার নিশ্চয়তা প্রদান করা হয়েছে।",
    explanationEn: "Article 39 of Part III of the Constitution explicitly guarantees the freedom of thought, conscience, and speech.",
  };

  const handleSampleOptionClick = (index: number) => {
    if (sampleAnswered) return;
    setSelectedOption(index);
    setSampleAnswered(true);

    const isCorrect = sampleQuestion.options[index].isCorrect;
    if (isCorrect) {
      setSampleScore(980);
      try { audioEngine.playCorrect(); } catch {}
    } else {
      setSampleScore(0);
      try { audioEngine.playIncorrect(); } catch {}
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      navigate({ to: "/play", search: { pin } });
    }
  };

  const categories = [
    { id: "all", labelBn: "সকল কারিকুলাম", labelEn: "All Modules" },
    { id: "bcs", labelBn: "৪৬তম বিসিএস ক্যাডার", labelEn: "46th BCS Cadre" },
    { id: "defense", labelBn: "আনসার ও ডিফেন্স একাডেমি", labelEn: "Defense & Academy" },
    { id: "varsity", labelBn: "বিশ্ববিদ্যালয় ভর্তি", labelEn: "Varsity Admission" },
    { id: "ict", labelBn: "ICT ও সাইবার সিকিউরিটি", labelEn: "ICT & Security" },
  ];

  const filteredPacks = selectedVaultCategory === "all"
    ? READY_MADE_PACKS.slice(0, 6)
    : READY_MADE_PACKS.filter((p) => {
        if (selectedVaultCategory === "bcs") return p.categoryEn.includes("BCS") || p.titleEn.includes("BCS");
        if (selectedVaultCategory === "defense") return p.tags.some(t => t.includes("Defense") || t.includes("Ansar") || t.includes("Security"));
        if (selectedVaultCategory === "varsity") return p.categoryEn.includes("Science") || p.categoryEn.includes("General");
        if (selectedVaultCategory === "ict") return p.categoryEn.includes("ICT") || p.tags.includes("ICT");
        return true;
      }).slice(0, 6);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 overflow-hidden">
        {/* HERO SECTION */}
        <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-16 lg:pt-14 lg:pb-24">
          {/* Subtle Ambient Glows */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-primary/15 via-emerald-500/10 to-teal-500/10 blur-[100px] opacity-70 rounded-full" />

          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-12 lg:gap-8 relative z-10">
            {/* Left Column: Heading, Value Props & Fast Entry */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Institutional Live Network Status Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-foreground shadow-sm animate-in fade-in">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-primary font-mono text-[11px] font-extrabold uppercase tracking-wider">500+ SEAT REGIONAL ENGINE</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs font-semibold text-muted-foreground">Anti-Impersonation Seat Lock</span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.12] tracking-tight text-foreground">
                {t("hero_title_prefix")}{" "}
                <span className="bg-gradient-to-r from-primary via-emerald-600 to-teal-600 dark:from-primary dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  {t("hero_title_highlight")}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mx-auto lg:mx-0 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {t("hero_subtitle")}
              </p>

              {/* Primary Actions Cluster */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Rocket className="h-4 w-4" />
                  <span>{t("start_free")}</span>
                </Link>

                <Link
                  to="/vault"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent hover:border-primary/40 transition-all"
                >
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>{lang === "bn" ? "কারিকুলাম ভল্ট" : "Question Vault"}</span>
                </Link>

                <Link
                  to="/timer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-xs font-bold text-foreground hover:bg-accent transition-colors shadow-sm"
                >
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{t("exam_timer")}</span>
                </Link>
              </div>

              {/* Candidate Arena Pass Fast Entry Card */}
              <div className="mx-auto lg:mx-0 mt-8 max-w-md bento-card p-6 shadow-glow text-center border-primary/30">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-display font-extrabold uppercase tracking-wider text-foreground">{t("enter_pin_prompt")}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-bold text-primary">INSTANT SYNC</span>
                </div>

                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <PinInput
                    value={pin}
                    onChange={(p) => setPin(p)}
                    onComplete={(p) => navigate({ to: "/play", search: { pin: p } })}
                  />

                  <button
                    type="submit"
                    disabled={pin.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-emerald-500"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>{t("play_button")}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Mission Control Telemetry HUD + Interactive Live Sample Item */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Leaderboard HUD Mockup */}
              <LiveLeaderboardMock />

              {/* Interactive Sample Question Widget */}
              <div className="bento-card p-5 sm:p-6 shadow-sm border border-primary/20 space-y-4 bg-card/90 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="font-display text-xs font-extrabold text-foreground">
                      {lang === "bn" ? "লাইভ মডেল টেস্ট অভিজ্ঞতা" : "Interactive Sample Assessment Item"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {sampleScore > 0 ? `+${sampleScore} PTS` : "-0.25 NEG"}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                    {lang === "bn" ? sampleQuestion.textBn : sampleQuestion.textEn}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sampleQuestion.options.map((opt, idx) => {
                      const isChosen = selectedOption === idx;
                      let btnClass = "border border-border bg-background hover:bg-accent hover:border-primary/50 text-foreground";
                      if (sampleAnswered) {
                        if (opt.isCorrect) {
                          btnClass = "border-2 border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold";
                        } else if (isChosen) {
                          btnClass = "border-2 border-destructive bg-destructive/15 text-destructive font-bold";
                        } else {
                          btnClass = "border border-border/50 bg-background/50 text-muted-foreground opacity-50";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSampleOptionClick(idx)}
                          className={`rounded-xl p-2.5 text-left text-xs font-semibold transition-all ${btnClass}`}
                        >
                          <span className="font-mono text-[10px] font-bold text-primary mr-1.5">
                            {["A", "B", "C", "D"][idx]}.
                          </span>
                          <span>{lang === "bn" ? opt.bn : opt.en}</span>
                        </button>
                      );
                    })}
                  </div>

                  {sampleAnswered && (
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-[11px] text-foreground space-y-1 animate-in fade-in">
                      <div className="font-bold flex items-center gap-1 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{lang === "bn" ? "ব্যাখ্যা ও সমাধান:" : "Verified Explanation:"}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {lang === "bn" ? sampleQuestion.explanationBn : sampleQuestion.explanationEn}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* METRICS & PERFORMANCE STRIP */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bento-card p-5 text-center shadow-sm space-y-1">
              <div className="font-mono text-2xl sm:text-3xl font-black text-primary">50,000+</div>
              <div className="text-xs font-bold text-foreground">{lang === "bn" ? "প্রশ্নব্যাংক আইটেম" : "Curated Questions"}</div>
              <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "বিসিএস ও একাডেমি সিলেবাস" : "BCS, Bank & Academy"}</div>
            </div>

            <div className="bento-card p-5 text-center shadow-sm space-y-1">
              <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
              <div className="text-xs font-bold text-foreground">{lang === "bn" ? "নেগেটিভ মার্কিং নির্ভুলতা" : "Negative Marking"}</div>
              <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "-০.২৫ ও -০.৫০ স্বয়ংক্রিয় কর্তন" : "-0.25 exact deduction"}</div>
            </div>

            <div className="bento-card p-5 text-center shadow-sm space-y-1">
              <div className="font-mono text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">&lt;15ms</div>
              <div className="text-xs font-bold text-foreground">{lang === "bn" ? "মাল্টিপ্লেয়ার সিংক্রোনাইজেশন" : "Sync Latency"}</div>
              <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "রিয়েলটাইম প্রজেক্টর ও মোবাইল" : "Realtime HUD telemetry"}</div>
            </div>

            <div className="bento-card p-5 text-center shadow-sm space-y-1">
              <div className="font-mono text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">256-Bit</div>
              <div className="text-xs font-bold text-foreground">{lang === "bn" ? "যাচাইযোগ্য ডিজিটাল সনদ" : "Cryptographic QR Seals"}</div>
              <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "পাবলিক ভেরিফিকেশন গেটওয়ে" : "Tamper-proof credentials"}</div>
            </div>
          </div>
        </section>

        {/* CORE INSTITUTIONAL ADVANTAGES (BENTO GRID) */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 border-t border-border/60">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {lang === "bn" ? "অত্যাধুনিক প্রযুক্তিগত সুবিধা" : "Next-Gen Assessment Architecture"}
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-foreground">
              {lang === "bn" ? "কেন একাডেমি ও প্রশিক্ষণ কেন্দ্র অন্বেষা বেছে নেয়?" : "Why Leading Institutions Choose Onnesha Arena"}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              {lang === "bn"
                ? "ঐতিহ্যবাহী কাগজের পরীক্ষার পরিবর্তে সেকেন্ডের মধ্যে কম্পিউটারভিত্তিক ও মোবাইল অ্যাসেসমেন্ট।"
                : "A high-stakes examination operating system engineered for institutional integrity."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Advantage 1 */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-primary/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "সাইকোমেট্রিক আইটেম অ্যানালাইসিস" : "Psychometric Item Analysis"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "প্রতিটি প্রশ্নের P-Value ও কাঠিন্য সূচক স্বয়ংক্রিয়ভাবে হিসাব করে পরীক্ষার্থীদের দুর্বল অধ্যায় ও সিলেবাস গ্যাপ চিহ্নিত করে।"
                  : "Calculates real-time item facility indices (P-values) and highlights systemic curriculum gaps across regional candidate batches."}
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-primary">
                <span>{lang === "bn" ? "ইনস্টিটিউট গ্রেড অ্যানালিটিক্স" : "Institutional grade analysis"}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Advantage 2 */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-emerald-500/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-sm">
                <Eye className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "অ্যান্টি-চিট প্রোফেসর মনিটর" : "Anti-Cheat Proctor Pulse"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "পরীক্ষার্থীরা ব্রাউজার ট্যাব পরিবর্তন করলে বা স্ক্রিন ছেড়ে গেলে তাৎক্ষণিক কন্ট্রোলারে টাইমস্ট্যাম্পড অ্যালার্ট প্রদান করে।"
                  : "Tracks browser visibility events and flags examinee window switches directly to the controller HUD in real-time."}
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>{lang === "bn" ? "লাইভ ইনসিডেন্ট লগিং" : "Real-time incident logging"}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Advantage 3 */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-blue-500/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 shadow-sm">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "গেজেট নোটিশ ও ভেরিফায়েবল সনদ" : "Official Gazette & Verifiable Credentials"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "নোটিশ বোর্ডের জন্য প্রস্তুতকৃত প্রিন্টযোগ্য রোল মেধা তালিকা ও কিউআর কোডযুক্ত ডিজিটাল সার্টিফিকেট স্বয়ংক্রিয় জেনারেশন।"
                  : "One-click printable institutional merit gazette notice boards with cryptographic QR verification links."}
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                <span>{lang === "bn" ? "পাবলিক কিউআর ভেরিফিকেশন" : "Public QR verification"}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Advantage 4: AI Question Studio */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-teal-500/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-sm">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "Gemini AI কারিকুলাম পেপার সেটার" : "AI Question Paper Setter"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "যেকোনো টপিক বা সিলেবাসের উপর ভিত্তি করে কয়েক সেকেন্ডে দ্বিভাষিক (বাংলা ও ইংরেজি) ২০-প্রশ্নের মানসম্মত মডেল টেস্ট তৈরি।"
                  : "Harnesses Google Gemini 2.5 Flash to synthesize bilingual MCQ papers with accurate negative mark penalties in seconds."}
              </p>
            </div>

            {/* Advantage 5: Physical OMR Sheet Printable */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-amber-500/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-sm">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "ফিজিক্যাল OMR বাব্‌ল শিট জেনারেটর" : "Printable Physical OMR Sheets"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "অফলাইন ক্লাসরুম পরীক্ষার জন্য ২০, ৫০ ও ১০০ প্রশ্নের প্রমিত A4 সাইজের OMR শিট ১-ক্লিকে প্রিন্ট ও সংরক্ষণ।"
                  : "Instantly generate and print standardized A4 OMR bubble sheets with Cadet Roll grids for physical mock halls."}
              </p>
            </div>

            {/* Advantage 6: Guardian SMS Gateway */}
            <div className="bento-card p-6 shadow-sm space-y-4 hover:border-pink-500/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500 shadow-sm">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? "স্বয়ংক্রিয় অভিভাবক SMS গেটওয়ে" : "Automated Guardian SMS Scorecards"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "পরীক্ষা শেষ হওয়ার সাথে সাথেই গ্রিনওয়েব SMS API এর মাধ্যমে অভিভাবকের মোবাইলে রোল, স্কোর ও মেধা অবস্থান প্রেরণ।"
                  : "Dispatches automated performance report SMS to registered parent phone numbers via Bangladesh SMS Gateways."}
              </p>
            </div>
          </div>
        </section>

        {/* KNOWLEDGE VAULT EXPLORER */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 border-t border-border/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {lang === "bn" ? "কারিকুলাম ভল্ট" : "Curriculum Series"}
              </span>
              <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-foreground">
                {t("ready_packs_title")}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {t("ready_packs_subtitle")}
              </p>
            </div>

            <Link
              to="/vault"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-accent hover:border-primary/40 transition-all shadow-sm shrink-0"
            >
              <span>{lang === "bn" ? "সকল ১৫টি ভল্ট এক্সপ্লোর করুন →" : "Explore all 15 vaults →"}</span>
            </Link>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedVaultCategory(cat.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  selectedVaultCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {lang === "bn" ? cat.labelBn : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Filtered Vault Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPacks.map((pack) => (
              <Link
                key={pack.id}
                to="/vault/$slug"
                params={{ slug: pack.slug }}
                className="bento-card group flex flex-col justify-between p-6 shadow-sm hover:scale-[1.01] hover:border-primary/50 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl">{pack.icon}</div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary font-mono">
                      {pack.questions.length} ITEMS
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {lang === "bn" ? pack.titleBn : pack.titleEn}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {lang === "bn" ? pack.descriptionBn : pack.descriptionEn}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-primary">
                  <span className="text-muted-foreground text-[11px] font-mono">
                    {pack.categoryBn || pack.categoryEn}
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    <span>{lang === "bn" ? "সমাধান ও পরীক্ষা →" : "View Keys →"}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* INSTITUTIONAL SEGMENTS */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 border-t border-border/60">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {lang === "bn" ? "প্রাতিষ্ঠানিক সমাধান" : "Tailored Programs"}
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {lang === "bn" ? "কাদের জন্য অন্বেষা অ্যারেনা?" : "Who is Onnesha Arena Built For?"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link
              to="/for/$segment"
              params={{ segment: "education" }}
              className="bento-card group p-6 shadow-sm hover:border-primary/50 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">
                {t("for_education")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("for_education_desc")}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
                <span>{lang === "bn" ? "বিস্তারিত দেখুন" : "Explore solution"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>

            <Link
              to="/for/$segment"
              params={{ segment: "training" }}
              className="bento-card group p-6 shadow-sm hover:border-amber-500/50 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">
                {t("for_training")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("for_training_desc")}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-500 group-hover:underline">
                <span>{lang === "bn" ? "বিস্তারিত দেখুন" : "Explore solution"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>

            <Link
              to="/for/$segment"
              params={{ segment: "corporate" }}
              className="bento-card group p-6 shadow-sm hover:border-blue-500/50 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 shadow-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">
                {t("for_corporate")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("for_corporate_desc")}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-500 group-hover:underline">
                <span>{lang === "bn" ? "বিস্তারিত দেখুন" : "Explore solution"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>

            <Link
              to="/for/$segment"
              params={{ segment: "events" }}
              className="bento-card group p-6 shadow-sm hover:border-pink-500/50 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500 shadow-sm">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-foreground">
                {t("for_events")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("for_events_desc")}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-pink-500 group-hover:underline">
                <span>{lang === "bn" ? "বিস্তারিত দেখুন" : "Explore solution"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          </div>
        </section>

        {/* TRUST BADGES BAR */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
              <Award className="h-4 w-4 text-amber-500" />
              <span>{t("trust_cert")}</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>{t("trust_isolation")}</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
              <FileCheck className="h-4 w-4 text-blue-500" />
              <span>{t("trust_bilingual")}</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
              <Lock className="h-4 w-4 text-pink-500" />
              <span>{t("trust_app")}</span>
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-14 border-t border-border/60">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {t("faq_heading")}
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { q: t("faq_1_q"), a: t("faq_1_a") },
              { q: t("faq_2_q"), a: t("faq_2_a") },
              { q: t("faq_3_q"), a: t("faq_3_a") },
              { q: t("faq_4_q"), a: t("faq_4_a") },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card transition-all overflow-hidden shadow-sm hover:border-primary/30"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left font-display text-sm sm:text-base font-bold text-foreground hover:bg-accent/50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/60 px-4 sm:px-5 pb-5 pt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed animate-in fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* BOTTOM HIGH-IMPACT CTA */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
          <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-tr from-primary/20 via-background to-emerald-500/15 p-8 sm:p-12 text-center shadow-glow relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -bottom-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
            <h2 className="font-display text-2xl sm:text-4xl font-black text-foreground relative z-10">
              {lang === "bn"
                ? "আজই আপনার একাডেমি বা টিমের জন্য অ্যারেনা চালু করুন"
                : "Deploy your institutional exam arena today"}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto relative z-10 leading-relaxed">
              {lang === "bn"
                ? "কোনো ক্রেডিট কার্ডের প্রয়োজন নেই। ফ্রিতে ইন্সট্রাক্টর স্টুডিও চালু করুন এবং জাতীয় কারিকুলামে তাৎক্ষণিক লাইভ পরীক্ষা নিন।"
                : "Instant cloud deployment. Zero hardware installation. Free tier available with full BCS syllabus."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 relative z-10">
              <Link
                to="/dashboard"
                className="rounded-2xl bg-primary px-8 py-3.5 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all hover:scale-105"
              >
                {t("start_free")} →
              </Link>
              <Link
                to="/pricing"
                className="rounded-2xl border border-border bg-card px-6 py-3.5 text-xs sm:text-sm font-bold text-foreground shadow-sm hover:bg-accent transition-all"
              >
                {t("pricing")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}


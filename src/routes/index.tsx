import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useBranding } from "@/hooks/use-branding";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PinInput } from "@/components/common/PinInput";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { audioEngine } from "@/lib/audio-engine";
import onnesha from "@/assets/onnesha.jpg.asset.json";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileCheck,
  FileSpreadsheet,
  GraduationCap,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Play,
  RotateCcw,
  Shield,
  ShieldCheck,
  Users,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onnesha Arena — Regional Examination & Live Model Test System" },
      {
        name: "description",
        content:
          "Run 500-seat regional model exams with mobile-number candidate auto-fill, single-device seat locks, exact -0.25 negative marking, and printable merit gazettes.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { lang, t } = useLanguage();
  const branding = useBranding();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedVaultCategory, setSelectedVaultCategory] = useState<string>("all");

  // Interactive Live Sample Question State inside the Hero App Frame
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sampleAnswered, setSampleAnswered] = useState(false);
  const [sampleScore, setSampleScore] = useState<number>(0);

  // Interactive Candidate Lookup Preview inside the Architecture Section
  const [demoQuery, setDemoQuery] = useState("01711000101");

  const sampleQuestion = {
    code: "BCS-46 · CONST-39",
    textBn:
      "গণপ্রজাতন্ত্রী বাংলাদেশের সংবিধানের কোন অনুচ্ছেদে চিন্তা, বিবেক ও বাক-স্বাধীনতার নিশ্চয়তা প্রদান করা হয়েছে?",
    textEn:
      "Which Article of the Constitution of Bangladesh guarantees Freedom of Thought, Conscience, and Speech?",
    options: [
      { bn: "অনুচ্ছেদ ২৭ (আইনের সমতা)", en: "Article 27 (Equality before Law)", isCorrect: false },
      { bn: "অনুচ্ছেদ ৩৯ (বাক ও ভাব প্রকাশ)", en: "Article 39 (Freedom of Thought & Speech)", isCorrect: true },
      { bn: "অনুচ্ছেদ ৩২ (জীবন ও ব্যক্তিস্বাধীনতা)", en: "Article 32 (Protection of Right to Life)", isCorrect: false },
      { bn: "অনুচ্ছেদ ৩৭ (সমাবেশের স্বাধীনতা)", en: "Article 37 (Freedom of Assembly)", isCorrect: false },
    ],
    explanationBn:
      "সংবিধানের ৩য় ভাগের ৩৯(২) অনুচ্ছেদ অনুসারে চিন্তা ও বিবেকের স্বাধীনতা এবং বাক-স্বাধীনতার নিশ্চয়তা প্রদান করা হয়েছে।",
    explanationEn:
      "Article 39 of Part III of the Constitution guarantees freedom of thought, conscience, and speech.",
  };

  const liveRegionalFeed = [
    { rank: 1, name: "Nusrat Jahan", roll: "2026-101", region: "Dhaka Range", score: "19.75", locked: true },
    { rank: 2, name: "Tanvir Ahmed", roll: "2026-102", region: "Chattogram Range", score: "19.00", locked: true },
    { rank: 3, name: "Sadia Islam", roll: "2026-103", region: "Rajshahi Range", score: "18.50", locked: true },
    { rank: 4, name: "Mehedi Hasan", roll: "2026-104", region: "Sylhet Range", score: "18.25", locked: true },
  ];

  const demoRosterPreview = [
    { phone: "01711000101", roll: "2026-101", name: "Nusrat Jahan", region: "Dhaka Range", center: "Dhaka HQ Center" },
    { phone: "01711000102", roll: "2026-102", name: "Tanvir Ahmed", region: "Chattogram Range", center: "Chattogram Divisional Hall" },
    { phone: "01711000103", roll: "2026-103", name: "Sadia Islam", region: "Rajshahi Range", center: "Rajshahi Regional Center" },
  ];

  const matchedDemoCandidate =
    demoRosterPreview.find(
      (c) =>
        c.phone.includes(demoQuery.trim()) ||
        c.roll.toLowerCase() === demoQuery.trim().toLowerCase()
    ) || demoRosterPreview[0];

  const handleSampleOptionClick = (index: number) => {
    if (sampleAnswered) return;
    setSelectedOption(index);
    setSampleAnswered(true);

    const isCorrect = sampleQuestion.options[index].isCorrect;
    if (isCorrect) {
      setSampleScore(1.0);
      try {
        audioEngine.playCorrect();
      } catch {}
    } else {
      setSampleScore(-0.25);
      try {
        audioEngine.playIncorrect();
      } catch {}
    }
  };

  const resetSampleQuestion = () => {
    setSelectedOption(null);
    setSampleAnswered(false);
    setSampleScore(0);
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
    { id: "academy", labelBn: "সরকারি ও একাডেমি নিয়োগ", labelEn: "Public Service & Academy" },
    { id: "varsity", labelBn: "বিশ্ববিদ্যালয় ভর্তি", labelEn: "Varsity Admission" },
    { id: "ict", labelBn: "ICT ও সাইবার সিকিউরিটি", labelEn: "ICT & Cyber Security" },
  ];

  const filteredPacks =
    selectedVaultCategory === "all"
      ? READY_MADE_PACKS.slice(0, 6)
      : READY_MADE_PACKS.filter((p) => {
          if (selectedVaultCategory === "bcs")
            return p.categoryEn.includes("BCS") || p.titleEn.includes("BCS");
          if (selectedVaultCategory === "academy")
            return p.tags.some(
              (tag) =>
                tag.includes("Defense") ||
                tag.includes("Security") ||
                tag.includes("General")
            );
          if (selectedVaultCategory === "varsity")
            return p.categoryEn.includes("Science") || p.categoryEn.includes("General");
          if (selectedVaultCategory === "ict")
            return p.categoryEn.includes("ICT") || p.tags.includes("ICT");
          return true;
        }).slice(0, 6);

  return (
    <div
      data-type="software"
      data-site-kind="software"
      className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors selection:bg-primary/20 selection:text-primary"
    >
      <Navbar />

      <main className="flex-1">
        {/* ================================================================ */}
        {/* SCREEN 1: HERO & LIVE EXAMINATION CONSOLE FRAME                  */}
        {/* ================================================================ */}
        <section
          data-enter="hero"
          className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-border/70"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-10 lg:gap-12">
            {/* Left Column: Direct Copy, Hard Facts & PIN Entry */}
            <div className="lg:col-span-6 space-y-6">
              {/* Co-Branding / Status Bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
                    500+ CONCURRENT SEATS
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">8 Regional Ranges</span>
                </div>

                {branding.showPartnerLogo && branding.partnerLogoUrl && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-foreground shadow-xs">
                    <img
                      src={onnesha.url}
                      alt="Onnesha"
                      className="h-4 w-auto rounded-xs object-contain"
                    />
                    <span className="text-muted-foreground font-mono text-[10px]">×</span>
                    <img
                      src={branding.partnerLogoUrl}
                      alt={branding.partnerName || "Joint Partner"}
                      className="h-4 max-w-[80px] object-contain"
                    />
                    {branding.partnerName && (
                      <span className="text-[11px] font-bold text-foreground">
                        {branding.partnerName}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Headline */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.35rem] font-black leading-[1.08] tracking-tight text-foreground">
                {t("hero_title_prefix")}{" "}
                <span className="text-primary">{t("hero_title_highlight")}</span>
              </h1>

              {/* Plain, factual lead paragraph */}
              <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {t("hero_subtitle")}
              </p>

              {/* Hard Specification Strip */}
              <div className="grid grid-cols-3 gap-3 max-w-lg pt-1">
                <div className="rounded-2xl border border-border bg-card/80 px-3.5 py-2.5">
                  <div className="font-mono text-lg sm:text-xl font-black tabular-nums text-foreground">
                    1.4 KB
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {lang === "bn" ? "ডেল্টা পেলোড / সিট" : "Delta payload / seat"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-3.5 py-2.5">
                  <div className="font-mono text-lg sm:text-xl font-black tabular-nums text-primary">
                    -0.25
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {lang === "bn" ? "স্বয়ংক্রিয় নেগেটিভ মার্ক" : "Exact rubric penalty"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-3.5 py-2.5">
                  <div className="font-mono text-lg sm:text-xl font-black tabular-nums text-foreground">
                    1 Seat
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    {lang === "bn" ? "ডিভাইস টোকেন লক" : "Cryptographic lock"}
                  </div>
                </div>
              </div>

              {/* Candidate Exam Hall Entry Card */}
              <div className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-tactical">
                <div className="flex items-center justify-between text-xs font-bold mb-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-display uppercase tracking-wider">
                      {t("enter_pin_prompt")}
                    </span>
                  </div>
                  <Link
                    to="/play"
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    {lang === "bn" ? "রোল/মোবাইল লুকআপ →" : "Roll / Mobile Lookup →"}
                  </Link>
                </div>

                <form onSubmit={handlePinSubmit} className="space-y-3.5">
                  <PinInput
                    value={pin}
                    onChange={(p) => setPin(p)}
                    onComplete={(p) => navigate({ to: "/play", search: { pin: p } })}
                  />

                  <button
                    type="submit"
                    disabled={pin.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>{t("play_button")}</span>
                  </button>
                </form>

                <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {lang === "bn" ? "লাইভ পিন নেই?" : "No live room PIN?"}
                  </span>
                  <Link
                    to="/play"
                    search={{ practice: "bcs-gk" }}
                    className="font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>
                      {lang === "bn"
                        ? "সেলফ-প্র্যাকটিস মক টেস্ট শুরু করুন →"
                        : "Start Self-Practice Mock Exam →"}
                    </span>
                  </Link>
                </div>
              </div>

              {/* Secondary Action Links */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-xs sm:text-sm font-bold text-background transition-all hover:-translate-y-0.5"
                >
                  <span>{t("start_free")}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/vault"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-xs sm:text-sm font-bold text-foreground hover:border-primary/50 transition-all"
                >
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>{lang === "bn" ? "কারিকুলাম ভল্ট দেখুন" : "Browse Question Vault"}</span>
                </Link>

                <Link
                  to="/timer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{t("exam_timer")}</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Unified Live Examination Console Frame (app-frame) */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-border bg-card shadow-tactical overflow-hidden">
                {/* Console Window Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-foreground">
                      LIVE HALL · PIN 482 910
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>DHAKA + 7 RANGES</span>
                    <span>·</span>
                    <span className="text-primary font-bold">512 SEATS LOCKED</span>
                  </div>
                </div>

                {/* Part A: Interactive Live Question Paper Item */}
                <div className="p-5 sm:p-6 border-b border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {sampleQuestion.code}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                          sampleAnswered
                            ? sampleScore > 0
                              ? "bg-primary/15 text-primary"
                              : "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {sampleAnswered
                          ? sampleScore > 0
                            ? "+1.00 MARK"
                            : "-0.25 PENALTY"
                          : "RUBRIC: +1.00 / -0.25"}
                      </span>
                      {sampleAnswered && (
                        <button
                          type="button"
                          onClick={resetSampleQuestion}
                          className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm sm:text-base font-bold text-foreground leading-snug">
                    {lang === "bn" ? sampleQuestion.textBn : sampleQuestion.textEn}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sampleQuestion.options.map((opt, idx) => {
                      const isChosen = selectedOption === idx;
                      let btnStyle =
                        "border border-border bg-background hover:border-primary/50 text-foreground";
                      if (sampleAnswered) {
                        if (opt.isCorrect) {
                          btnStyle =
                            "border-2 border-primary bg-primary/10 text-foreground font-bold";
                        } else if (isChosen) {
                          btnStyle =
                            "border-2 border-destructive bg-destructive/10 text-destructive font-bold";
                        } else {
                          btnStyle =
                            "border border-border/50 bg-background/50 text-muted-foreground opacity-55";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSampleOptionClick(idx)}
                          className={`rounded-xl p-3 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 ${btnStyle}`}
                        >
                          <span className="font-mono text-[11px] font-bold text-primary mr-2">
                            {["A", "B", "C", "D"][idx]}.
                          </span>
                          <span>{lang === "bn" ? opt.bn : opt.en}</span>
                        </button>
                      );
                    })}
                  </div>

                  {sampleAnswered && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          {lang === "bn" ? "যাচাইকৃত ব্যাখ্যা:" : "Verified Key Explanation:"}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {lang === "bn"
                          ? sampleQuestion.explanationBn
                          : sampleQuestion.explanationEn}
                      </p>
                    </div>
                  )}
                </div>

                {/* Part B: Live Regional Merit & Seat-Lock Telemetry Table */}
                <div className="p-5 sm:p-6 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                        {lang === "bn"
                          ? "অঞ্চলভিত্তিক রিয়েল-টাইম মেধা তালিকা"
                          : "Live Regional Merit & Seat Status"}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      0 IMPERSONATION CONFLICTS
                    </span>
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                    {liveRegionalFeed.map((row) => (
                      <div
                        key={row.roll}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-bold text-primary w-5">
                            #{row.rank}
                          </span>
                          <div className="truncate">
                            <span className="font-bold text-foreground">{row.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                              {row.roll}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {row.region}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-primary">
                            <Lock className="h-3 w-3" />
                            <span>SEAT LOCKED</span>
                          </span>
                          <span className="font-mono font-black tabular-nums text-foreground w-12 text-right">
                            {row.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SCREEN 2: REGIONAL IDENTITY & SEAT-LOCK ARCHITECTURE DIAGRAM     */}
        {/* ================================================================ */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 py-16 lg:py-24 border-b border-border/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                {lang === "bn"
                  ? "ক্যান্ডিডেট ভেরিফিকেশন প্রটোকল"
                  : "Candidate Verification Protocol"}
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-foreground">
                {lang === "bn"
                  ? "মোবাইল বা রোল নম্বর লিখলেই স্বয়ংক্রিয় অঞ্চল ও নাম শনাক্তকরণ"
                  : "Type a mobile or roll number. The roster locks the seat."}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "পরীক্ষার্থী জয়েন করার সময় নিজের মোবাইল নম্বর বা রোল লিখলে সিস্টেম স্বয়ংক্রিয়ভাবে তার অঞ্চল (Region) ও নাম পূরণ করে দেয়। এক ডিভাইসে পরীক্ষা চলাকালীন অন্য কেউ একই নামে প্রবেশ করতে পারে না।"
                  : "Examinees join in two ways: type their registered mobile/roll number for instant profile auto-fill, or select their Region and Name from the directory and verify ownership."}
              </p>

              {/* Interactive Roster Lookup Sandbox */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {lang === "bn"
                        ? "লাইভ রোল / মোবাইল সার্চ প্রিভিউ"
                        : "Try Live Roster Auto-Fill Preview"}
                    </span>
                  </span>
                  <div className="flex gap-1.5 font-mono text-[10px]">
                    {["01711000101", "2026-102", "2026-103"].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setDemoQuery(sample)}
                        className={`rounded px-2 py-0.5 border transition ${
                          demoQuery === sample
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={demoQuery}
                  onChange={(e) => setDemoQuery(e.target.value)}
                  placeholder="Enter Mobile (01711000101) or Roll (2026-101)"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
                />

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-foreground">{matchedDemoCandidate.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      Roll: {matchedDemoCandidate.roll} · {matchedDemoCandidate.region}
                    </div>
                  </div>
                  <span className="rounded-md bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-bold text-primary">
                    AUTO-FILLED
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Hub-and-Lanes Verification Diagram */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    ARCHITECTURE · SINGLE-SEAT VERIFICATION PIPELINE
                  </span>
                  <span className="font-mono text-xs font-bold text-primary">
                    RENDER PERSISTENT STORE
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stage 1 */}
                  <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                    <div className="font-mono text-xs font-bold text-primary">01 · INPUT</div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      {lang === "bn" ? "নম্বর বা অঞ্চল নির্বাচন" : "Number or Region Lookup"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "bn"
                        ? "মোবাইল/রোল নম্বর টাইপ করলে অথবা অঞ্চল ও নাম সিলেক্ট করলে সার্ভার রস্টার যাচাই করে।"
                        : "Candidate enters Mobile/Roll for instant lookup, or selects Region → Name and verifies phone."}
                    </p>
                  </div>

                  {/* Stage 2 */}
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2">
                    <div className="font-mono text-xs font-bold text-primary">02 · SEAT LOCK</div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      {lang === "bn" ? "সিঙ্গেল-সিট টোকেন লক" : "Single-Device Seat Token"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "bn"
                        ? "একবার আসন গ্রহণ করলে অন্য কোনো ব্রাউজার বা ডিভাইস থেকে সেই রোলে কেউ প্রবেশ করতে পারে না।"
                        : "Binds the roster entry to a cryptographic seatToken. Blocks second-device impersonation."}
                    </p>
                  </div>

                  {/* Stage 3 */}
                  <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                    <div className="font-mono text-xs font-bold text-primary">03 · GAZETTE</div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      {lang === "bn" ? "অঞ্চলভিত্তিক মেধা গেজেট" : "Regional Merit Gazette"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "bn"
                        ? "পরীক্ষা শেষে প্রতিটি অঞ্চলের পৃথক ও সম্মিলিত মেধা তালিকা এবং QR সনদ তৈরি হয়।"
                        : "Generates region-filtered merit rankings, item difficulty indices, and QR certificates."}
                    </p>
                  </div>
                </div>

                {/* System Guarantees Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="font-mono text-xs font-bold text-foreground">Tab-Switch Log</div>
                    <div className="text-[11px] text-muted-foreground">Live host pardon control</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="font-mono text-xs font-bold text-foreground">Key Stripping</div>
                    <div className="text-[11px] text-muted-foreground">Zero answer key in DOM</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="font-mono text-xs font-bold text-foreground">Host Seat Unlock</div>
                    <div className="text-[11px] text-muted-foreground">1-click device handoff</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="font-mono text-xs font-bold text-foreground">CSV Bulk Roster</div>
                    <div className="text-[11px] text-muted-foreground">Import with Region code</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SCREEN 3: INSTITUTIONAL CAPABILITIES (UNIFIED MONOCHROME/EMERALD) */}
        {/* ================================================================ */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 py-16 lg:py-24 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                {lang === "bn" ? "পরীক্ষা পরিচালনা মডিউল" : "Examination Operating Modules"}
              </span>
              <h2 className="mt-2 font-display text-2xl sm:text-4xl font-black tracking-tight text-foreground">
                {lang === "bn"
                  ? "প্রশ্ন প্রণয়ন থেকে প্রিন্টযোগ্য মেধা তালিকা — এক সিস্টেমে"
                  : "Every tool required to run a formal model examination."}
              </h2>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline shrink-0"
            >
              <span>{lang === "bn" ? "স্টুডিও ড্যাশবোর্ড খুলুন" : "Open Instructor Studio"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn" ? "সাইকোমেট্রিক আইটেম অ্যানালাইসিস" : "Psychometric Item Analysis"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "প্রতিটি প্রশ্নের কাঠিন্য সূচক ও ভুল উত্তরের প্রবণতা বিশ্লেষণ করে অঞ্চলভিত্তিক দুর্বল অধ্যায় চিহ্নিত করে।"
                  : "Computes per-question facility ratios and identifies the most common distractor chosen across regional batches."}
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn" ? "লাইভ অ্যান্টি-চিট প্রক্টর পালস" : "Live Proctor Telemetry & Pardon"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "পরীক্ষার্থী ব্রাউজার ট্যাব পরিবর্তন করলে কন্ট্রোলার স্ক্রিনে সতর্কবার্তা যায় এবং হোস্ট তাৎক্ষণিক আনলক করতে পারেন।"
                  : "Streams tab-switch and focus-loss alerts to the Exam Controller HUD with one-click Pardon & Resume controls."}
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn"
                  ? "গেজেট নোটিশ ও ভেরিফায়েবল QR সনদ"
                  : "Printable Gazette & QR Certificates"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "নোটিশ বোর্ডের জন্য প্রিন্টযোগ্য অঞ্চলভিত্তিক মেধা তালিকা ও পাবলিকলি যাচাইযোগ্য ডিজিটাল সার্টিফিকেট।"
                  : "Prints notice-board merit gazettes filtered by Region and issues deterministic QR-verifiable certificates."}
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Wand2 className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn" ? "Gemini 2.5 দ্বিভাষিক প্রশ্ন নির্মাতা" : "Gemini 2.5 Bilingual Paper Setter"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "যেকোনো সিলেবাস বা অধ্যায় থেকে কয়েক সেকেন্ডে বাংলা ও ইংরেজি MCQ প্রশ্নপত্র এবং ব্যাখ্যা তৈরি।"
                  : "Generates bilingual Bengali and English MCQ papers with verified answer keys and explanations from any syllabus topic."}
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn" ? "প্রিন্টযোগ্য A4 OMR শিট ও স্ক্যানার" : "Printable A4 OMR Bubble Sheets"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "অফলাইন পরীক্ষার জন্য প্রমিত A4 OMR বাব্‌ল শিট প্রিন্ট এবং ক্যামেরা আপলোডের মাধ্যমে স্বয়ংক্রিয় মূল্যায়ন।"
                  : "Exports standardized A4 OMR bubble sheets for physical exam halls with optical sheet grading."}
              </p>
            </div>

            <div className="bento-card p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                {lang === "bn" ? "অভিভাবক ও পরীক্ষার্থী SMS ফলাফল" : "Automated SMS Scorecards"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "পরীক্ষা শেষ হওয়ার সাথে সাথেই নিবন্ধিত মোবাইল নম্বরে রোল, প্রাপ্ত নম্বর ও মেধা অবস্থান প্রেরণ।"
                  : "Dispatches batch SMS scorecards with roll number, net marks, and merit standing to registered mobile numbers."}
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SCREEN 4: CURRICULUM & QUESTION VAULT                            */}
        {/* ================================================================ */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 py-16 lg:py-24 border-b border-border/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                {lang === "bn" ? "প্রশ্নব্যাংক ভল্ট" : "Verified Question Repositories"}
              </span>
              <h2 className="mt-2 font-display text-2xl sm:text-4xl font-black tracking-tight text-foreground">
                {t("ready_packs_title")}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {t("ready_packs_subtitle")}
              </p>
            </div>

            <Link
              to="/vault"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-primary/50 transition-all shrink-0"
            >
              <span>
                {lang === "bn" ? "সকল ১৫টি প্রশ্নব্যাংক দেখুন →" : "Browse all 15 question vaults →"}
              </span>
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
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "bn" ? cat.labelBn : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Vault Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPacks.map((pack) => (
              <Link
                key={pack.id}
                to="/vault/$slug"
                params={{ slug: pack.slug }}
                className="bento-card group flex flex-col justify-between p-6"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{pack.icon}</span>
                    <span className="rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-bold text-foreground font-mono">
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
                  <span className="group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>{lang === "bn" ? "প্রশ্নপত্র খুলুন →" : "Open Paper →"}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ================================================================ */}
        {/* SCREEN 5: INSTITUTIONAL PROGRAMS & FAQ                           */}
        {/* ================================================================ */}
        <section className="mx-auto max-w-7xl px-5 sm:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left: Institutional Segments */}
            <div className="lg:col-span-5 space-y-5">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                {lang === "bn" ? "প্রাতিষ্ঠানিক ব্যবহার" : "Institutional Deployment"}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {lang === "bn"
                  ? "কোচিং, বিশ্ববিদ্যালয় ও বিভাগীয় প্রশিক্ষণ কেন্দ্রের জন্য"
                  : "Built for academies, universities, and regional training centers."}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 pt-2">
                {[
                  {
                    slug: "education",
                    icon: GraduationCap,
                    title: t("for_education"),
                    desc: t("for_education_desc"),
                  },
                  {
                    slug: "training",
                    icon: ShieldCheck,
                    title: t("for_training"),
                    desc: t("for_training_desc"),
                  },
                  {
                    slug: "corporate",
                    icon: Building2,
                    title: t("for_corporate"),
                    desc: t("for_corporate_desc"),
                  },
                  {
                    slug: "events",
                    icon: Users,
                    title: t("for_events"),
                    desc: t("for_events_desc"),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.slug}
                      to="/for/$segment"
                      params={{ segment: item.slug }}
                      className="bento-card flex items-start gap-3.5 p-4"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm font-bold text-foreground flex items-center justify-between">
                          <span>{item.title}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right: FAQ & Direct Launch */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                  {lang === "bn" ? "সচরাচর জিজ্ঞাসিত প্রশ্ন" : "Specifications & FAQ"}
                </span>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
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
                      className="rounded-2xl border border-border bg-card overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left font-display text-sm sm:text-base font-bold text-foreground hover:bg-muted/40 transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                            isOpen ? "rotate-180 text-primary" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border/60 px-4 sm:px-5 pb-5 pt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Direct Closing Card */}
              <div className="rounded-2xl border border-primary/40 bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h3 className="font-display text-lg sm:text-xl font-black text-foreground">
                    {lang === "bn"
                      ? "আপনার পরবর্তী আঞ্চলিক পরীক্ষা পরিচালনা করুন"
                      : "Ready to host your next regional examination?"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {lang === "bn"
                      ? "ইন্সট্রাক্টর স্টুডিও থেকে অঞ্চল, পরীক্ষার্থী তালিকা ও প্রশ্নপত্র সেট করুন।"
                      : "Configure regions, import candidate rosters, and launch a live PIN hall in under two minutes."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to="/dashboard"
                    className="rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
                  >
                    {t("start_free")} →
                  </Link>
                  <Link
                    to="/play"
                    className="rounded-xl border border-border bg-background px-4 py-3 text-xs font-bold text-foreground hover:border-primary/40 transition-all"
                  >
                    {t("join_pin")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/for/$segment")({
  head: ({ params }) => ({
    meta: [
      { title: `Onnesha Quiz for ${params.segment} · Tailored Assessment Solutions` },
      { name: "description", content: `Specialized live quiz and assessment workflows for ${params.segment}.` },
    ],
  }),
  component: SegmentSolutionPage,
});

interface SegmentContent {
  icon: React.ReactNode;
  titleEn: string;
  titleBn: string;
  taglineEn: string;
  taglineBn: string;
  bulletsEn: string[];
  bulletsBn: string[];
  ctaEn: string;
  ctaBn: string;
}

const SEGMENTS: Record<string, SegmentContent> = {
  education: {
    icon: <GraduationCap className="h-10 w-10 text-primary" />,
    titleEn: "Live Quizzes & Model Tests for Classes & Coaching",
    titleBn: "ক্লাসরুম ও কোচিং সেন্টারের জন্য লাইভ কুইজ ও মডেল টেস্ট",
    taglineEn: "Negative marking · Roll-number join · Merit list + print · Guardian result SMS · Certificates.",
    taglineBn: "নেগেটিভ মার্কিং · রোল নম্বর জয়েন · মেধা তালিকা ও নোটিশ প্রিন্ট · অভিভাবকের ফোনে SMS · সনদপত্র।",
    bulletsEn: [
      "Liven up daily classroom lectures with instant mobile participation",
      "Run BCS, Medical & Varsity model tests with exact negative marking penalties",
      "Instant roll-wise merit lists formatted for official institution notice boards",
      "Automated SMS result dispatch directly to parents & guardians",
      "Weak-topic diagnostics highlighting questions with low accuracy",
    ],
    bulletsBn: [
      "মোবাইল ফোনের মাধ্যমে তাৎক্ষণিক অংশগ্রহণে ক্লাসের পড়ালেখায় আনুন নতুন মাত্রা",
      "বিসিএস ও ভর্তি পরীক্ষার জন্য নেগেটিভ মার্কিংসহ নির্ভুল মডেল টেস্ট গ্রহণ",
      "প্রতিষ্ঠানের নোটিশ বোর্ডের জন্য প্রস্তুতকৃত প্রিন্টযোগ্য রোল-ভিত্তিক মেধা তালিকা",
      "অভিভাবকের ফোনে স্বয়ংক্রিয়ভাবে রেজাল্টের SMS পাঠানোর সুবিধা",
      "শিক্ষার্থীদের দুর্বল অধ্যায় ও বিষয়সমূহ স্বয়ংক্রিয়ভাবে চিহ্নিতকরণ",
    ],
    ctaEn: "Start Free with Your Class",
    ctaBn: "ক্লাসের জন্য ফ্রি শুরু করুন",
  },
  corporate: {
    icon: <Building2 className="h-10 w-10 text-blue-500" />,
    titleEn: "Employee Onboarding, Compliance & Knowledge Checks",
    titleBn: "কর্পোরেট অনবোর্ডিং, কমপ্লায়েন্স ও জ্ঞান যাচাই",
    taglineEn: "Track compliance completion · Automated scores · Team engagement · Dedicated data isolation.",
    taglineBn: "কমপ্লায়েন্স সম্পন্নকরণ ট্র্যাকিং · স্বয়ংক্রিয় স্কোর · টিম এনগেজমেন্ট · ডেটা সুরক্ষা।",
    bulletsEn: [
      "Transform boring compliance policies into fun interactive knowledge quizzes",
      "Ready-made packs for workplace safety, PPE, fire drill, and cyber password safety",
      "Per-organization data isolation and corporate SSO readiness",
      "Export employee completion analytics in CSV/Excel for HR audits",
      "Issue verifiable completion certificates with QR verification",
    ],
    bulletsBn: [
      "একঘেয়ে ট্রেনিং ও নীতিমালার বদলে আনুন আনন্দময় ইন্টারেক্টিভ কুইজ পদ্ধতি",
      "অগ্নি-নিরাপত্তা, সাইবার সুরক্ষা ও ফ্যাক্টরি কমপ্লায়েন্সের প্রস্তুতকৃত প্রশ্ন-প্যাক",
      "প্রতিটি প্রতিষ্ঠানের জন্য আলাদা সুরক্ষিত ডেটা আইসোলেশন ব্যবস্থা",
      "এইচআর অডিটের জন্য এক্সেল ও সিএসভিতে কর্মীদের রেজাল্ট রিপোর্ট এক্সপোর্ট",
      "QR কোডযুক্ত ভেরিফায়েবল ডিজিটাল ট্রেনিং সমাপ্তি সনদপত্র প্রদান",
    ],
    ctaEn: "Empower Your Team Free",
    ctaBn: "টিমের জন্য ফ্রি শুরু করুন",
  },
  training: {
    icon: <Sparkles className="h-10 w-10 text-amber-500" />,
    titleEn: "Assessments & Verifiable Certification for Course Trainers",
    titleBn: "প্রশিক্ষক ও কোর্স ইন্সট্রাক্টরদের জন্য মূল্যায়ন ও ডিজিটাল সনদ",
    taglineEn: "Pre & post tests · Instant skill benchmarks · Verifiable digital badges with QR codes.",
    taglineBn: "প্রি ও পোস্ট টেস্ট · তাৎক্ষণিক স্কিল যাচাই · QR কোডযুক্ত ডিজিটাল সার্টিফিকেট।",
    bulletsEn: [
      "Pre-training diagnostic tests to gauge audience knowledge levels before lectures",
      "Post-training certification exams with custom passing score thresholds",
      "Branded certificates with organization seal, student name, and verification URL",
      "Zero app installation required — works seamlessly on any phone or laptop",
      "AI quiz generator creates tests from training slides in 30 seconds",
    ],
    bulletsBn: [
      "ট্রেনিং শুরুর পূর্বে অডিয়েন্সের জ্ঞান যাচাই করতে দ্রুত প্রি-টেস্ট কুইজ",
      "ট্রেনিং শেষে পাসিং মার্কস নির্ধারণ করে পোস্ট-ট্রেনিং সার্টিফিকেট পরীক্ষা",
      "প্রতিষ্ঠানের লোগো, সিল ও কিউআর কোডসহ ব্র্যান্ডেড প্রশংসাপত্র প্রদান",
      "কোনো অ্যাপ ইনস্টল করা ছাড়াই যেকোনো মোবাইল ব্রাউজারে ঝামেলাহীন ব্যবহার",
      "ট্রেনিং মডিউল বা স্লাইড টেক্সট থেকে AI এর সাহায্যে মাত্র ৩০ সেকেন্ডে কুইজ নির্মাণ",
    ],
    ctaEn: "Create Training Quiz",
    ctaBn: "ট্রেনিং কুইজ তৈরি করুন",
  },
  events: {
    icon: <Users className="h-10 w-10 text-pink-500" />,
    titleEn: "Live Quiz Nights, Campus Trivia & Event Engagement",
    titleBn: "লাইভ কুইজ নাইট, ক্যাম্পাস ট্রিভিয়া ও ইভেন্ট এনগেজমেন্ট",
    taglineEn: "Big-screen projector view · Suspense leaderboards · Sound effects · Team battles.",
    taglineBn: "প্রজেক্টর বিগ স্ক্রিন ভিউ · লাইভ উত্তেজনাপূর্ণ লিডারবোর্ড · সাউন্ড এফেক্টস · টিম প্রতিযোগিতা।",
    bulletsEn: [
      "Giant PIN and QR code projector display for rapid audience onboarding",
      "Thrilling rank shifts with streak multipliers and suspense drumroll sounds",
      "3D podium celebration ceremony with confetti for top 3 champions",
      "Ready-made pop culture, Bangladesh history & team icebreaker trivia",
      "Real-time audience opinion polls with instant live bar charts",
    ],
    bulletsBn: [
      "প্রজেক্টরে বিশাল পিন কোড ও কিউআর কোড প্রদর্শন করে দ্রুত দর্শকদের যুক্ত করা",
      "ড্রামরোল সাউন্ড ও স্ট্রিক বোনাসের সাথে প্রতিটি প্রশ্নে র‍্যাঙ্ক পরিবর্তনের রোমাঞ্চ",
      "১ম, ২য় ও ৩য় স্থান অধিকারীদের জন্য কনফেটি ও ফ্যানফেয়ার সংবর্ধনা পডিয়াম",
      "বাংলাদেশের ইতিহাস, পপ কালচার ও টিম আইসব্রেকারের চমৎকার রেডি প্রশ্ন-প্যাক",
      "লাইভ বার চার্ট সহকারে দর্শকদের মতামত ও পোলিং গ্রহণের সুবিধা",
    ],
    ctaEn: "Host an Event Quiz",
    ctaBn: "ইভেন্ট কুইজ হোস্ট করুন",
  },
};

function SegmentSolutionPage() {
  const { segment } = Route.useParams();
  const { lang, t } = useLanguage();

  const data = SEGMENTS[segment];
  if (!data) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-12">
        {/* Top Hero */}
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center shadow-glow space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 shadow-sm">
            {data.icon}
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight max-w-2xl mx-auto">
            {lang === "bn" ? data.titleBn : data.titleEn}
          </h1>

          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            {lang === "bn" ? data.taglineBn : data.taglineEn}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/dashboard"
              className="rounded-2xl bg-primary px-8 py-3.5 text-sm font-extrabold text-primary-foreground shadow-md hover:bg-primary/90 transition-all hover:scale-105"
            >
              {lang === "bn" ? data.ctaBn : data.ctaEn} →
            </Link>
            <Link
              to="/contact-sales"
              className="rounded-2xl border border-border bg-background px-6 py-3.5 text-xs font-bold text-foreground hover:bg-accent transition"
            >
              {t("contact_sales")}
            </Link>
          </div>
        </div>

        {/* Key Features / Bullets */}
        <div className="mt-10 grid grid-cols-1 gap-3.5">
          {(lang === "bn" ? data.bulletsBn : data.bulletsEn).map((bullet, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:border-primary/40"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
              <span className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                {bullet}
              </span>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            <Award className="h-4 w-4 text-amber-500" />
            <span>{t("trust_cert")}</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>{t("trust_isolation")}</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span>{t("trust_bilingual")}</span>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-3xl border border-border bg-gradient-to-tr from-primary/10 to-transparent p-8 text-center shadow-sm">
          <h3 className="font-display text-xl font-bold text-foreground">
            {lang === "bn" ? "ফ্রিতে এখনই একটি লাইভ টেস্ট শুরু করুন" : "Ready to get started?"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {lang === "bn"
              ? "কোনো সফটওয়্যার ইন্সটল করার প্রয়োজন নেই। সরাসরি ব্রাউজারে চলবে।"
              : "No app installation required. Works directly on any browser."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow"
            >
              {t("start_free")}
            </Link>
            <Link
              to="/pricing"
              className="rounded-xl border border-border bg-card px-6 py-2.5 text-xs font-bold text-foreground"
            >
              {t("pricing")}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

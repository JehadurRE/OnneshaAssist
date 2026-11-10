import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BkashModal } from "@/components/dashboard/BkashModal";
import { PricingTier } from "@/lib/types";
import {
  Activity,
  ArrowRight,
  Award,
  Building,
  Check,
  ChevronDown,
  Cpu,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  HelpCircle,
  MessageSquare,
  Radio,
  Rocket,
  Scale,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Institutional Plans & Examination Pricing · Onnesha Arena" },
      {
        name: "description",
        content:
          "Institutional assessment tiers for BCS academies, coaching centres, defense training and universities. Pay via bKash or Bank PO.",
      },
    ],
  }),
  component: PricingPage,
});

interface InstitutionalPlan {
  id: string;
  nameEn: string;
  nameBn: string;
  badgeEn?: string;
  badgeBn?: string;
  descriptionEn: string;
  descriptionBn: string;
  monthlyPrice: number;
  annualPrice: number;
  capacity: number;
  popular?: boolean;
  ctaEn: string;
  ctaBn: string;
  featuresEn: string[];
  featuresBn: string[];
}

const INSTITUTIONAL_PLANS: InstitutionalPlan[] = [
  {
    id: "tier-starter",
    nameEn: "Academic Starter",
    nameBn: "একাডেমিক স্টার্টার",
    descriptionEn: "Ideal for individual teachers, small batches, and classroom diagnostic quizzes.",
    descriptionBn: "ব্যক্তিগত শিক্ষক ও ছোট ক্লাসরুমের তাৎক্ষণিক কুইজ মূল্যায়নের জন্য উপযোগী।",
    monthlyPrice: 0,
    annualPrice: 0,
    capacity: 50,
    ctaEn: "Start Free Assessment",
    ctaBn: "বিনামূল্যে শুরু করুন",
    featuresEn: [
      "Up to 50 simultaneous examinees per session",
      "Unlimited assessment sessions per month",
      "Access to all 15 Curriculum Knowledge Vaults",
      "AI Quiz Studio (5 free generation credits)",
      "Live dynamic merit leaderboard",
      "Standard instant grading & review",
    ],
    featuresBn: [
      "প্রতি সেশনে সর্বোচ্চ ৫০ জন পরীক্ষার্থী",
      "মাসে আনলিমিটেড পরীক্ষা ও মূল্যায়ন সেশন",
      "সকল ১৫টি কারিকুলাম নলেজ ভল্টে অ্যাক্সেস",
      "AI কুইজ স্টুডিও (৫টি ফ্রি ক্রেডিট)",
      "লাইভ ডায়নামিক লিডারবোর্ড",
      "তাৎক্ষণিক উত্তর পর্যালোচনা ও মার্কিং",
    ],
  },
  {
    id: "tier-academy",
    nameEn: "Pro Academy & Coaching",
    nameBn: "প্রো একাডেমি ও কোচিং",
    badgeEn: "MOST POPULAR",
    badgeBn: "সর্বাধিক জনপ্রিয়",
    descriptionEn: "For coaching centres, BCS preparation academies & high-volume model tests.",
    descriptionBn: "কোচিং সেন্টার, বিসিএস একাডেমি ও নিয়মিত মডেল টেস্ট আয়োজনের জন্য সেরা পছন্দ।",
    monthlyPrice: 1490,
    annualPrice: 14900,
    capacity: 300,
    popular: true,
    ctaEn: "Upgrade to Pro Academy",
    ctaBn: "প্রো একাডেমিতে আপগ্রেড করুন",
    featuresEn: [
      "Up to 300 simultaneous examinees per session",
      "Formal OMR mode with custom negative marking (-0.25)",
      "Roll number / Student ID authentication tracking",
      "Printable official merit gazette notice boards",
      "Guardian SMS result dispatch integration",
      "Psychometric item difficulty (P-value) indexing",
      "50 AI generation credits per month",
      "Custom examination countdown timer presets",
    ],
    featuresBn: [
      "প্রতি সেশনে সর্বোচ্চ ৩০০ জন পরীক্ষার্থী",
      "কাস্টম নেগেটিভ মার্কিংসহ (-০.২৫) ফরমাল OMR মোড",
      "রোল নম্বর ও ক্যাডেট আইডি যাচাইকরণ",
      "নোটিশ বোর্ডের জন্য প্রিন্টযোগ্য অফিসিয়াল মেধা গেজেট",
      "অভিভাবকের ফোনে স্বয়ংক্রিয় SMS রেজাল্ট ডিসপ্যাচ",
      "সাইকোমেট্রিক প্রশ্নের কাঠিন্য (P-Value) সূচক",
      "প্রতি মাসে ৫০টি AI প্রশ্ন জেনারেশন ক্রেডিট",
      "কাস্টম এক্সাম টাইমার ও ফুলস্ক্রিন প্রেজেন্টেশন",
    ],
  },
  {
    id: "tier-campus",
    nameEn: "Institutional Campus & Defense",
    nameBn: "ক্যাম্পাস ও ডিফেন্স একাডেমি",
    badgeEn: "ENTERPRISE GRADE",
    badgeBn: "প্রাতিষ্ঠানিক সংস্করণ",
    descriptionEn: "For universities, regional training academies, and national exam boards.",
    descriptionBn: "বিশ্ববিদ্যালয়, আঞ্চলিক প্রশিক্ষণ একাডেমি এবং বৃহৎ পরীক্ষা বোর্ডের জন্য।",
    monthlyPrice: 3990,
    annualPrice: 39900,
    capacity: 1500,
    ctaEn: "Get Campus License",
    ctaBn: "ক্যাম্পাস লাইসেন্স নিন",
    featuresEn: [
      "Up to 1,500 simultaneous examinees per session",
      "Anti-Cheat Proctor Pulse (live tab-focus tracker)",
      "Verifiable digital certificates with cryptographic QR seals",
      "Institution branded custom logo, watermarks & header crests",
      "Multi-batch comparative performance matrix",
      "Automated Weak-Topic diagnostic syllabus heatmaps",
      "250 AI generation credits per month",
      "Export full analytics in CSV, Excel & JSON",
      "Dedicated priority support & SLA guarantee",
    ],
    featuresBn: [
      "প্রতি সেশনে সর্বোচ্চ ১,৫০০ জন পরীক্ষার্থী",
      "অ্যান্টি-চিট প্রোফেসর পালস (লাইভ ফোকাস ট্র্যাকার)",
      "QR কোড ও ক্রিপ্টোগ্রাফিক সিলযুক্ত ভেরিফায়েবল সনদ",
      "প্রতিষ্ঠানের নিজস্ব লোগো ও ব্র্যান্ডেড হেডার ক্রিস্ট",
      "একাধিক ব্যাচের তুলনামূলক ফলাফল ম্যাট্রিক্স",
      "দুর্বল অধ্যায় ও সিলেবাস গ্যাপের হিটম্যাপ রিপোর্ট",
      "প্রতি মাসে ২৫০টি AI প্রশ্ন জেনারেশন ক্রেডিট",
      "এক্সেল, সিএসভি ও জেএসনে পূর্ণাঙ্গ ডেটা এক্সপোর্ট",
      "ডেডিকেটেড প্রায়োরিটি সাপোর্ট ও SLA নিশ্চয়তা",
    ],
  },
];

function PricingPage() {
  const { lang, t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanForBkash, setSelectedPlanForBkash] = useState<InstitutionalPlan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Interactive Estimator State
  const [selectedBatchSize, setSelectedBatchSize] = useState<number>(300);
  const [includeSms, setIncludeSms] = useState<boolean>(true);
  const [includeCertificates, setIncludeCertificates] = useState<boolean>(true);

  // Recommended plan based on estimator
  const recommendedPlan =
    selectedBatchSize <= 50
      ? INSTITUTIONAL_PLANS[0]
      : selectedBatchSize <= 300
      ? INSTITUTIONAL_PLANS[1]
      : INSTITUTIONAL_PLANS[2];

  const handleOpenBkash = (plan: InstitutionalPlan) => {
    if (plan.monthlyPrice === 0) {
      window.location.href = '/dashboard';
      return;
    }
    setSelectedPlanForBkash(plan);
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-12">
        {/* Top Hero Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{lang === 'bn' ? 'স্বচ্ছ ও সাশ্রয়ী প্রাতিষ্ঠানিক সাবস্ক্রিপশন' : 'Predictable Institutional Licensing'}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            {lang === 'bn' ? 'আপনার একাডেমি বা ক্যাম্পাসের জন্য সঠিক প্ল্যান' : 'Scale Examinations with Zero Friction'}
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {lang === 'bn'
              ? 'ব্যক্তিগত শিক্ষক থেকে শুরু করে বিশ্ববিদ্যালয়, প্রশিক্ষণ একাডেমি এবং শীর্ষ কোচিং সেন্টারের জন্য তৈরি ডিজিটাল মূল্যায়ন ব্যবস্থা।'
              : 'From classroom pop-quizzes to high-stakes defense academy model exams with negative marking, proctor telemetry, and instant gazette notices.'}
          </p>

          {/* Billing Cycle Selector */}
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('monthly')}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{t('yearly')}</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  2 Months Free
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3-COLUMN INSTITUTIONAL TIER CARDS */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {INSTITUTIONAL_PLANS.map((plan) => {
            const isPopular = plan.popular;
            const price = billingCycle === 'yearly' ? plan.annualPrice : plan.monthlyPrice;
            const displayMonthlyEquivalent =
              billingCycle === 'yearly' && plan.annualPrice > 0
                ? Math.round(plan.annualPrice / 12)
                : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`bento-card relative flex flex-col justify-between p-6 sm:p-8 shadow-sm transition-all duration-300 ${
                  isPopular
                    ? 'border-primary shadow-glow ring-2 ring-primary/40 lg:-translate-y-2'
                    : 'hover:border-primary/50'
                }`}
              >
                {/* Popular Badge */}
                {plan.badgeEn && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-md">
                      {lang === 'bn' ? plan.badgeBn : plan.badgeEn}
                    </span>
                  </div>
                )}

                <div>
                  {/* Plan Name & Desc */}
                  <div className="border-b border-border/80 pb-6">
                    <h3 className="font-display text-xl font-extrabold text-foreground">
                      {lang === 'bn' ? plan.nameBn : plan.nameEn}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {lang === 'bn' ? plan.descriptionBn : plan.descriptionEn}
                    </p>

                    {/* Price */}
                    <div className="mt-6 flex items-baseline gap-1.5 font-mono">
                      <span className="text-4xl sm:text-5xl font-black text-foreground">
                        {price === 0 ? (
                          'Free'
                        ) : (
                          <>৳{displayMonthlyEquivalent.toLocaleString()}</>
                        )}
                      </span>
                      {price > 0 && (
                        <span className="text-xs text-muted-foreground">
                          / month {billingCycle === 'yearly' && '(billed annually)'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-[11px] font-mono font-semibold text-primary">
                      ✓ Up to {plan.capacity.toLocaleString()} simultaneous examinees
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="py-6">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Included Capabilities:
                    </div>
                    <ul className="space-y-2.5 text-xs text-foreground">
                      {(lang === 'bn' ? plan.featuresBn : plan.featuresEn).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-4 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => handleOpenBkash(plan)}
                    className={`w-full rounded-2xl py-3.5 text-xs font-extrabold transition-all shadow-sm ${
                      isPopular
                        ? 'bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 hover:scale-[1.02]'
                        : 'border border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    {lang === 'bn' ? plan.ctaBn : plan.ctaEn} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* INSTITUTIONAL CAPACITY & FEATURE ESTIMATOR */}
        <section className="mt-16 rounded-3xl border-2 border-primary/30 bg-card p-6 sm:p-10 shadow-glow">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/80 pb-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono text-[11px] font-bold text-primary mb-1">
                <Cpu className="h-3.5 w-3.5" />
                <span>Onnesha Arena Scaler</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                {lang === 'bn' ? 'ক্যাম্পাস ক্যাপাসিটি ও অ্যাড-অন এস্টিমেটর' : 'Interactive Campus Capacity & Add-On Estimator'}
              </h2>
            </div>

            <div className="text-xs font-mono text-muted-foreground">
              Instant AI Plan Configuration
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Inputs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Batch Size Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Select Simultaneous Examinee Capacity:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[50, 300, 1500, 5000].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedBatchSize(size)}
                      className={`rounded-2xl border-2 p-3 text-center transition-all ${
                        selectedBatchSize === size
                          ? 'border-primary bg-primary/10 text-primary shadow-sm font-black'
                          : 'border-border bg-background text-foreground hover:bg-accent font-semibold'
                      }`}
                    >
                      <div className="font-mono text-lg">{size >= 1000 ? `${size / 1000}k` : size}</div>
                      <div className="text-[10px] text-muted-foreground">Students</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add-ons Checklist */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Institutional Add-On Modules:
                </label>

                <label className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 cursor-pointer hover:border-primary/40 transition">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-foreground">Automated Guardian SMS Result Gateway</div>
                      <div className="text-[10px] text-muted-foreground">Instant scorecard dispatch to parent phone numbers</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeSms}
                    onChange={(e) => setIncludeSms(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 cursor-pointer hover:border-primary/40 transition">
                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold text-foreground">Cryptographic QR Verifiable Certificates</div>
                      <div className="text-[10px] text-muted-foreground">Tamper-proof digital credentials for each examinee</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeCertificates}
                    onChange={(e) => setIncludeCertificates(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                </label>
              </div>
            </div>

            {/* Right Recommended Box */}
            <div className="lg:col-span-5 rounded-3xl border-2 border-primary/40 bg-card p-6 shadow-tactical space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">
                Recommended Configuration
              </div>

              <div className="border-b border-border/60 pb-4">
                <h3 className="font-display text-2xl font-black text-foreground">
                  {lang === 'bn' ? recommendedPlan.nameBn : recommendedPlan.nameEn}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Matched for {selectedBatchSize.toLocaleString()} examinees with automated diagnostics.
                </p>
              </div>

              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-4xl font-black text-foreground">
                  {recommendedPlan.monthlyPrice === 0 ? 'Free' : `৳${recommendedPlan.monthlyPrice.toLocaleString()}`}
                </span>
                {recommendedPlan.monthlyPrice > 0 && (
                  <span className="text-xs text-muted-foreground">/ month</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleOpenBkash(recommendedPlan)}
                className="w-full rounded-2xl bg-primary py-3.5 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                Proceed with bKash Checkout →
              </button>

              <div className="text-center text-[10px] text-muted-foreground">
                🔒 Verified 256-Bit Encrypted Institutional Gateway
              </div>
            </div>
          </div>
        </section>

        {/* DETAILED INSTITUTIONAL FEATURE MATRIX */}
        <section className="mt-16">
          <h2 className="text-center font-display text-xl sm:text-2xl font-bold text-foreground mb-8">
            {lang === 'bn' ? 'ফিচার ও প্রাতিষ্ঠানিক সক্ষমতার পূর্ণাঙ্গ তুলনা' : 'Deep Functional Comparison Matrix'}
          </h2>

          <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[42rem] border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left font-display">
                  <th className="p-4 font-bold">Capabilities</th>
                  <th className="p-4 font-bold text-center">Academic Starter</th>
                  <th className="p-4 font-bold text-center text-primary">Pro Academy (300)</th>
                  <th className="p-4 font-bold text-center">Campus / Defense (1500)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="p-4 font-semibold text-foreground">Simultaneous Candidate Capacity</td>
                  <td className="p-4 text-center font-mono font-bold">50</td>
                  <td className="p-4 text-center font-mono font-bold text-primary">300</td>
                  <td className="p-4 text-center font-mono font-bold">1,500+</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Formal OMR Negative Marking (-0.25)</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Printable Notice Board Merit Gazette</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Psychometric Item Difficulty ($P$-Value)</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Anti-Cheat Proctor Pulse (Focus Tracker)</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Cryptographic QR Verifiable Certificates</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-muted-foreground">—</td>
                  <td className="p-4 text-center text-emerald-500 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">AI Question Generation Credits / Mo</td>
                  <td className="p-4 text-center font-mono">5 credits</td>
                  <td className="p-4 text-center font-mono font-bold text-primary">50 credits</td>
                  <td className="p-4 text-center font-mono font-bold">250 credits</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ENTERPRISE / GOVERNMENT INQUIRY BANNER */}
        <div className="mt-16 bento-card p-8 sm:p-10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="font-display text-xl font-bold text-foreground">
              {lang === 'bn' ? 'বাংলাদেশ আনসার ও ভিডিপি বা বিশ্ববিদ্যালয় ক্যাম্পাস চুক্তি?' : 'Custom Institutional Proposal or Government Tender?'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              {lang === 'bn'
                ? 'বার্ষিক ইনভয়েস, ব্যাংক পিও এবং কাস্টম অন-প্রিমাইস ক্লাউড ডেপ্লয়মেন্টের জন্য আমাদের সলিউশন দলের সাথে কথা বলুন।'
                : 'Dedicated cloud isolation, custom Moodle/Canvas LTI integration, official bank PO invoicing, and customized service agreements.'}
            </p>
          </div>

          <Link
            to="/contact-sales"
            className="rounded-2xl bg-primary px-7 py-3.5 text-xs font-bold text-primary-foreground shadow-glow hover:bg-primary/90 transition shrink-0"
          >
            {t('contact_sales')} →
          </Link>
        </div>

        {/* FAQ ACCORDION */}
        <section className="mt-16 max-w-2xl mx-auto space-y-3">
          <h3 className="font-display text-xl font-bold text-center text-foreground mb-6">
            {lang === 'bn' ? 'পেমেন্ট ও লাইসেন্স সংক্রান্ত সাধারণ জিজ্ঞাসা' : 'Licensing & Payment FAQ'}
          </h3>

          {[
            {
              q: lang === 'bn' ? 'সিমুলটেনিয়াস এক্সামিনি (Simultaneous Capacity) বলতে কী বোঝায়?' : 'What is simultaneous examinee capacity?',
              a: lang === 'bn' ? 'একই সময়ে একটি লাইভ পরীক্ষা বা মূল্যায়ন সেশনে সর্বোচ্চ কতজন পরীক্ষার্থী একসাথে অংশ নিতে পারবে। আপনি প্রতি মাসে যত খুশি সেশন ও পরীক্ষা নিতে পারেন।' : 'It refers to the maximum number of candidates who can be actively testing in a single examination session at the same instant. You can host unlimited sessions per month.',
            },
            {
              q: lang === 'bn' ? 'পেমেন্ট কীভাবে করা যায়?' : 'What payment methods are supported in Bangladesh?',
              a: lang === 'bn' ? 'বিকাশ (bKash) ও যেকোনো স্থানীয় ভিসা/মাস্টারকার্ড দিয়ে তাৎক্ষণিক সক্রিয়করণ করা যায়। প্রাতিষ্ঠানিক চুক্তির জন্য ব্যাংক ট্রান্সফার গ্রহণযোগ্য।' : 'Instant activation via bKash, local credit/debit cards, and official institutional bank wire for annual agreements.',
            },
            {
              q: lang === 'bn' ? 'বাৎসরিক পেমেন্টে কী সুবিধা রয়েছে?' : 'What are the annual plan savings?',
              a: lang === 'bn' ? 'বাৎসরিক লাইসেন্স নিলে ২ মাস সম্পূর্ণ ফ্রি (১৭% ডিসকাউন্ট) পাবেন।' : 'Annual licenses include 2 months completely free (equivalent to a 17% savings).',
            },
          ].map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between text-left font-display text-sm font-bold text-foreground"
              >
                <span>{item.q}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === idx ? 'rotate-180 text-primary' : ''}`} />
              </button>
              {openFaq === idx && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-2 animate-in fade-in">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </section>
      </main>

      {/* bKash Payment Modal */}
      {selectedPlanForBkash && (
        <BkashModal
          tier={{
            id: selectedPlanForBkash.id,
            nameEn: selectedPlanForBkash.nameEn,
            nameBn: selectedPlanForBkash.nameBn,
            monthlyPrice: selectedPlanForBkash.monthlyPrice,
            yearlyPrice: selectedPlanForBkash.annualPrice,
            capacity: selectedPlanForBkash.capacity,
            featuresEn: selectedPlanForBkash.featuresEn,
            featuresBn: selectedPlanForBkash.featuresBn,
            perPersonEn: `৳${(selectedPlanForBkash.monthlyPrice / selectedPlanForBkash.capacity).toFixed(1)} / student`,
            perPersonBn: `৳${(selectedPlanForBkash.monthlyPrice / selectedPlanForBkash.capacity).toFixed(1)} / শিক্ষার্থী`,
            ctaEn: selectedPlanForBkash.ctaEn,
            ctaBn: selectedPlanForBkash.ctaBn,
          }}
          billingCycle={billingCycle}
          isOpen={!!selectedPlanForBkash}
          onClose={() => setSelectedPlanForBkash(null)}
          onSuccess={(trxId) => {
            alert(`Payment verified! Transaction ID: ${trxId}. Institutional license activated.`);
            setSelectedPlanForBkash(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
}

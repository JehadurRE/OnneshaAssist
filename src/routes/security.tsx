import { createFileRoute, Link } from "@tanstack/react-router";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Award, CheckCircle2, Lock, QrCode, Server, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Verifiable Certificates · Onnesha Quiz" },
      { name: "description", content: "Per-organization data isolation and tamper-proof digital certificates." },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-sm mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            {lang === "bn" ? "নিরাপত্তা ও যাচাইযোগ্য ডিজিটাল সনদ" : "Enterprise Security & Verifiable Certificates"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {lang === "bn"
              ? "ক্লাউড কানেক্ট এআই ও অন্বেষা এলএমএস দ্বারা সুরক্ষিত ডেটা আইসোলেশন ও ট্যাম্পার-প্রুফ সনদ ব্যবস্থা।"
              : "End-to-end data isolation and cryptographic authenticity verification powered by Onnesha LMS & Cloud Connect AI."}
          </p>
        </div>

        {/* Security Cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              {lang === "bn" ? "QR কোড ও ক্রিপ্টোগ্রাফিক সনদ যাচাই" : "Cryptographic QR Verification"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "bn"
                ? "প্রতিটি সার্টিফিকেটে একটি ইউনিক হ্যাশ এবং QR কোড অন্তর্ভুক্ত থাকে, যা পাবলিক /verify পেজে তাৎক্ষণিক সত্যতা প্রমাণ করে।"
                : "Every issued certificate includes an immutable credential ID and scannable QR code linking to our public verification portal."}
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Server className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              {lang === "bn" ? "প্রতি প্রতিষ্ঠানের ডেটা আইসোলেশন" : "Per-Organization Data Isolation"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "bn"
                ? "প্রতিটি স্কুল, কোচিং বা কর্পোরেট অ্যাকাউন্টের শিক্ষার্থী তালিকা, ফলাফল ও প্রশ্ন ব্যাংক সম্পূর্ণ আলাদাভাবে সংরক্ষিত হয়।"
                : "Strict tenant boundary enforcement ensuring that student rosters, exam questions, and scorecards remain strictly isolated."}
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              {lang === "bn" ? "২৫৬-বিট এনক্রিপ্টেড ডাটাবেজ" : "256-bit AES Encryption"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "bn"
                ? "সকল তথ্য ট্রানজিটে এবং বিশ্রামে TLS 1.3 ও AES-256 বিট এনক্রিপশনের মাধ্যমে সুরক্ষিত থাকে।"
                : "All data in transit and at rest is secured with TLS 1.3 and military-grade AES-256 encryption standards."}
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              {lang === "bn" ? "বিকাশ সিকিউর পেমেন্ট" : "bKash & Payment Protection"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "bn"
                ? "পেমেন্ট লেনদেন সরাসরি বিকাশ সুরক্ষিত API গেটওয়ে দিয়ে প্রক্রিয়া হয়। কোনো কার্ড বা পিন ডাটা সংরক্ষণ করা হয় না।"
                : "Subscriptions are verified via official bKash checkout endpoints without ever storing sensitive credentials."}
            </p>
          </div>
        </div>

        {/* Verification Demo Link */}
        <div className="mt-10 rounded-3xl border border-border bg-muted/40 p-6 text-center space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {lang === "bn" ? "সনদ যাচাইকরণ দেখতে চান?" : "Want to test certificate verification?"}
          </p>
          <Link
            to="/verify/$certId"
            params={{ certId: "ONN-4821-9982" }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{lang === "bn" ? "নমুনা সনদ যাচাইকরণ দেখুন" : "View Sample Certificate Verification"}</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

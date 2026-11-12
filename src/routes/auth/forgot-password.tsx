import { createFileRoute, Link } from "@tanstack/react-router";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import onnesha from "@/assets/onnesha.jpg.asset.json";
import { ArrowLeft, KeyRound, Mail, Phone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Password Recovery Policy · Onnesha Arena" },
      {
        name: "description",
        content: "Recover access to your institutional Onnesha Arena workspace securely.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bento-card p-6 sm:p-8 shadow-glow space-y-5">
          <div className="text-center">
            <img src={onnesha.url} alt="Onnesha" className="h-11 mx-auto rounded-lg object-contain mb-3" />
            <h1 className="font-display text-2xl font-black text-foreground tracking-tight">
              {lang === "bn" ? "পাসওয়ার্ড পুনরুদ্ধার নীতি" : "Verified Account Recovery"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "পরীক্ষার নিরাপত্তা রক্ষায় যাচাইকৃত মাধ্যম ছাড়া পাসওয়ার্ড পরিবর্তন বন্ধ রাখা হয়েছে।"
                : "Institutional exam security requires verified credential recovery."}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs text-foreground">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {lang === "bn" ? "১. সুপার অ্যাডমিন রিসেট (সুপারিশকৃত)" : "1. Institutional Super Admin Reset"}
                </p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {lang === "bn"
                    ? "আপনার প্রতিষ্ঠানের সুপার অ্যাডমিন /admin প্যানেল থেকে নতুন পাসওয়ার্ড সেট করে দিতে পারবেন।"
                    : "Ask your institution Super Admin to update your faculty password directly from the Super Admin Console (/admin)."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-border/60">
              <Phone className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {lang === "bn" ? "২. মোবাইল OTP লগইন" : "2. Sign in with Verified Mobile OTP"}
                </p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {lang === "bn"
                    ? "নিবন্ধিত মোবাইল নম্বর থাকলে লগইন পাতায় গিয়ে 'Phone & OTP' অপশন ব্যবহার করুন।"
                    : "If your phone number is registered and server SMS is active, use the Phone & OTP tab on the sign-in page."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-border/60">
              <Mail className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {lang === "bn" ? "৩. সাপোর্ট যোগাযোগ" : "3. Controller Support Desk"}
                </p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {lang === "bn"
                    ? "অ্যাডমিন অ্যাকাউন্ট রিকভারির জন্য সাপোর্ট টিম বা কন্ট্যাক্ট সেলস পেজে যোগাযোগ করুন।"
                    : "Need Super Admin recovery? Reach out via the Contact Sales / Institutional Desk."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Link
              to="/auth/login"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{lang === "bn" ? "লগইন পাতায় ফিরুন" : "Back to Sign In"}</span>
            </Link>
            <Link
              to="/contact-sales"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3 text-xs font-bold text-foreground hover:bg-accent transition"
            >
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              <span>{lang === "bn" ? "সাপোর্ট ডেস্ক" : "Contact Desk"}</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

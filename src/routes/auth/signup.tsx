import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OnneshaLogo } from "@/components/common/OnneshaLogo";
import {
  AlertCircle,
  Building2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Create Candidate Account · Onnesha Arena" },
      {
        name: "description",
        content: "Register a candidate account to join live assessments and view verified scores.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { lang } = useLanguage();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const result = await signup({
      name,
      email,
      password,
      role: "candidate",
      ...(institutionName.trim() ? { institutionName: institutionName.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    });
    setIsLoading(false);

    if (result.success) {
      navigate({ to: "/play" });
    } else {
      setErrorMessage(result.error || "Failed to create account. Please verify input data.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-lg bento-card p-6 sm:p-10 shadow-glow">
          {/* Brand Header */}
          <div className="text-center">
            <OnneshaLogo variant="default" size="lg" className="mx-auto mb-3 justify-center" />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
              <ShieldCheck className="h-3 w-3" />
              <span>{lang === "bn" ? "পরীক্ষার্থী পোর্টাল" : "Candidate Registration"}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {lang === "bn" ? "নতুন পরীক্ষার্থী অ্যাকাউন্ট তৈরি করুন" : "Create Candidate Account"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "লাইভ পরীক্ষা ও ফলাফল ট্র্যাকিংয়ের জন্য ব্যক্তিগত পরীক্ষার্থী অ্যাকাউন্ট খুলুন"
                : "Register to join scheduled model exams and track verified credentials"}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Institution / Academy Name (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Institution / Batch (Optional)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Dhaka Range / Sanjibon Batch"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Mobile Number (Optional for OTP Login) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Mobile Number (Optional, for Phone OTP)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01711000000"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 font-mono text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Set Account Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              <span>{isLoading ? "Creating Account..." : "Create Candidate Account"}</span>
            </button>
          </form>

          {/* Footer Signin Link */}
          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-border/80 pt-4">
            Already have an account?{" "}
            <Link to="/auth/login" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

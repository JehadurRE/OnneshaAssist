import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import ansar from "@/assets/ansar.svg.asset.json";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Instructor & Candidate Login · Onnesha Arena" },
      {
        name: "description",
        content: "Sign in to Onnesha Assessment Arena using Email or Bangladeshi Phone OTP.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { lang } = useLanguage();
  const { login, requestPhoneOtp, loginWithPhoneOtp } = useAuth();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<"password" | "phone">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate({ to: "/dashboard" });
    } else {
      setErrorMessage(result.error || "Failed to sign in. Please verify your credentials.");
    }
  };

  const handleSendOtp = async () => {
    setErrorMessage(null);
    if (phone.replace(/\D/g, "").length < 11) {
      setErrorMessage("Please enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }

    setIsLoading(true);
    const result = await requestPhoneOtp(phone);
    setIsLoading(false);

    if (result.success) {
      setOtpSent(true);
    } else {
      setErrorMessage(result.error || "Failed to dispatch verification code.");
    }
  };

  const handlePhoneOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const result = await loginWithPhoneOtp(phone, otp);
    setIsLoading(false);

    if (result.success) {
      navigate({ to: "/dashboard" });
    } else {
      setErrorMessage(result.error || "Invalid OTP code.");
    }
  };

  const loadInstructorCredentials = () => {
    setEmail("instructor@onnesha.app");
    setPassword("instructor123");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bento-card p-6 sm:p-8 shadow-glow">
          {/* Brand Emblem & Header */}
          <div className="text-center">
            <img src={ansar.url} alt="Emblem" className="h-12 w-12 mx-auto object-contain mb-3" />
            <h1 className="font-display text-2xl font-black text-foreground tracking-tight">
              {lang === "bn" ? "অন্বেষা অ্যারেনায় প্রবেশ" : "Sign In to Onnesha Arena"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn" ? "ইন্সট্রাক্টর স্টুডিও ও মেধা তালিকা ম্যানেজমেন্ট" : "Instructor Studio & Assessment Management"}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("password");
                setErrorMessage(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === "password"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "bn" ? "ইমেইল ও পাসওয়ার্ড" : "Email & Password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("phone");
                setErrorMessage(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "bn" ? "ফোন ও OTP (বাংলাদেশ)" : "Phone & OTP (BD)"}
            </button>
          </div>

          {/* Form Content */}
          {authMode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
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
                    placeholder="instructor@onnesha.app"
                    className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">Demo Instructor:</span> <code className="text-primary font-mono font-bold">instructor@onnesha.app</code> / <code className="text-primary font-mono font-bold">instructor123</code>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                <UserCheck className="h-4 w-4" />
                <span>{isLoading ? "Verifying..." : "Sign In to Instructor Studio"}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handlePhoneOtpLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Mobile Number (01XXXXXXXXX)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01711000000"
                      className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 font-mono text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isLoading}
                    className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-primary hover:bg-accent transition shrink-0"
                  >
                    {otpSent ? "Resend" : "Send OTP"}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="animate-in fade-in space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Enter 6-Digit OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit code from SMS"
                      className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 font-mono text-xs sm:text-sm font-semibold tracking-widest text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Security OTP has been dispatched to {phone}. Please check your phone.</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!otp || isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-40"
              >
                <UserCheck className="h-4 w-4" />
                <span>{isLoading ? "Verifying..." : "Verify OTP & Sign In"}</span>
              </button>
            </form>
          )}

          {/* Quick Demo Fill Helper */}
          <div className="mt-4 pt-4 border-t border-border/60 text-center">
            <button
              type="button"
              onClick={loadInstructorCredentials}
              className="text-[11px] text-muted-foreground hover:text-primary font-semibold transition"
            >
              Fill Instructor Test Account (instructor@onnesha.app)
            </button>
          </div>

          {/* Footer Signup Link */}
          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-border/80 pt-4">
            Don&apos;t have an instructor account?{" "}
            <Link to="/auth/signup" className="font-bold text-primary hover:underline">
              Register Academy Free
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

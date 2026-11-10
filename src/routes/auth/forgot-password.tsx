import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import onnesha from "@/assets/onnesha.jpg.asset.json";
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Lock, Mail, Send } from "lucide-react";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password · Onnesha Arena" },
      {
        name: "description",
        content: "Reset your institutional instructor account password.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { lang } = useLanguage();
  const { resetPasswordWithEmail } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetEmail = email.trim().toLowerCase();
    const registry = JSON.parse(localStorage.getItem("onnesha_user_registry") || "[]");
    const localAccount = registry.find((u: any) => u.email?.toLowerCase() === targetEmail);
    const dbAccount = db.getUsers().find((u) => u.email?.toLowerCase() === targetEmail);

    if (!localAccount && !dbAccount) {
      setErrorMessage("No account registered with this email address.");
      return;
    }

    setStep(2);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    const result = await resetPasswordWithEmail(email, newPassword);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate({ to: "/auth/login" });
      }, 1500);
    } else {
      setErrorMessage(result.error || "Failed to reset password.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bento-card p-6 sm:p-8 shadow-glow">
          <div className="text-center">
            <img src={onnesha.url} alt="Onnesha" className="h-11 mx-auto rounded-lg object-contain mb-3" />
            <h1 className="font-display text-2xl font-black text-foreground tracking-tight">
              {lang === "bn" ? "পাসওয়ার্ড পুনরুদ্ধার" : "Reset Password"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "আপনার নিবন্ধিত ইমেইল ও নতুন পাসওয়ার্ড দিয়ে অ্যাকাউন্ট আপডেট করুন"
                : "Verify your registered email and establish a new secure password"}
            </p>
          </div>

          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleVerifyEmail} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Registered Email Address
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

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                <Send className="h-4 w-4" />
                <span>Verify Account Identity</span>
              </button>

              <div className="mt-4 text-center">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  New Password (min. 6 chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                <span>{isLoading ? "Updating Password..." : "Set New Secure Password"}</span>
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Change Email</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}


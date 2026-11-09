import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, UserRole } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import ansar from "@/assets/ansar.svg.asset.json";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  GraduationCap,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Register Instructor / Academy Account · Onnesha Arena" },
      {
        name: "description",
        content: "Register an institutional assessment account for your coaching centre, school, or training unit.",
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
  const [password, setPassword] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [role, setRole] = useState<UserRole>("instructor");
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
      role,
      institutionName: institutionName || undefined,
    });
    setIsLoading(false);

    if (result.success) {
      navigate({ to: "/dashboard" });
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
            <img src={ansar.url} alt="Emblem" className="h-12 w-12 mx-auto object-contain mb-3" />
            <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {lang === "bn" ? "নতুন একাডেমি রেজিস্টার করুন" : "Register Onnesha Studio"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "ফ্রি অ্যাকাউন্ট তৈরি করে আনলিমিটেড লাইভ মডেল টেস্ট শুরু করুন"
                : "Create an institutional instructor workspace in seconds"}
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
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Workspace Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("instructor")}
                  className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition-all ${
                    role === "instructor"
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  <div>
                    <div className="text-xs font-bold">Instructor / Academy</div>
                    <div className="text-[10px] text-muted-foreground">Host &amp; grade model tests</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("candidate")}
                  className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition-all ${
                    role === "candidate"
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <div>
                    <div className="text-xs font-bold">Cadet / Candidate</div>
                    <div className="text-[10px] text-muted-foreground">Track test scores</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Full Name / Designation
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Rafiqul Islam / Instructor Tanvir"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Institution / Academy Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Institution / Coaching Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Apex BCS Cadre Care / Dhaka Cadet College"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="instructor@academy.edu.bd"
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
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
              <span>{isLoading ? "Creating Workspace..." : "Complete Registration & Open Studio"}</span>
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

import React, { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  serverGetOfficialCentresForClaim,
  serverLookupStudentForEmailClaim,
  serverSubmitStudentEmailAndClaimCertificate,
} from "@/lib/server-session";
import { detectCommonEmailTypo, isPlaceholderStudentEmail } from "@/lib/email-otp";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/claim-certificate")({
  component: ClaimCertificatePage,
});

interface CentreMeta {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
}

interface VerifiedStudentState {
  rollNumber: string;
  name: string;
  regionName: string;
  hasRealEmail: boolean;
  maskedEmail?: string | undefined;
  eligibleForCertificate: boolean;
  certificateIssued: boolean;
  certificateNumber?: string | undefined;
  certificateEmailed: boolean;
  maskedEmailedTo?: string | undefined;
  missingRequirements: string[];
}

interface ClaimSuccessState {
  emailSaved: string;
  eligible: boolean;
  certificateNumber?: string | undefined;
  verifyUrl?: string | undefined;
  emailed: boolean;
  alreadyEmailed?: boolean | undefined;
  emailProvider?: string | undefined;
  emailError?: string | undefined;
  message: string;
}

function ClaimCertificatePage() {
  const [courseMeta, setCourseMeta] = useState<{
    id: string;
    code: string;
    titleEn: string;
    titleBn: string;
  } | null>(null);
  const [centres, setCentres] = useState<CentreMeta[]>([]);
  const [branding, setBranding] = useState<{
    leftLogoUrl?: string | undefined;
    rightLogoUrl?: string | undefined;
    rightSecondaryLogoUrl?: string | undefined;
  } | null>(null);

  const [selectedCentreCode, setSelectedCentreCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudentState | null>(null);

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestedEmail, setSuggestedEmail] = useState<string | null>(null);
  const [doneState, setDoneState] = useState<ClaimSuccessState | null>(null);

  useEffect(() => {
    serverGetOfficialCentresForClaim()
      .then((res) => {
        if (res.success) {
          setCourseMeta(res.course);
          setCentres(res.centres);
          setBranding(res.branding);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectCentre = (code: string) => {
    setSelectedCentreCode(code);
    if (code && !rollNumber.trim()) {
      setRollNumber(`${code}-`);
    } else if (code && /^[A-Z]{2,4}-$/.test(rollNumber.trim().toUpperCase())) {
      setRollNumber(`${code}-`);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setSubmitError(null);
    setSuggestedEmail(null);
    setVerifying(true);
    try {
      const res = await serverLookupStudentForEmailClaim({
        data: {
          rollNumber: rollNumber.trim(),
          phone: phone.trim(),
          courseId: courseMeta?.id,
        },
      });
      if (!res.success) {
        setVerifyError(res.error || "Could not verify student identity.");
        return;
      }
      setVerifiedStudent(res.student);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStudent) return;
    setSubmitError(null);
    setSuggestedEmail(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanConfirm = confirmEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setSubmitError("Please enter your personal Gmail / email address.");
      return;
    }
    if (isPlaceholderStudentEmail(cleanEmail)) {
      setSubmitError(
        "Please enter your real personal email (e.g. Gmail), not an @sanjibon.onnesha address.",
      );
      return;
    }
    const localTypo = detectCommonEmailTypo(cleanEmail);
    if (localTypo) {
      setSuggestedEmail(localTypo);
      setSubmitError(`Spelling mistake detected in "${cleanEmail}". Did you mean "${localTypo}"?`);
      return;
    }
    if (cleanEmail !== cleanConfirm) {
      setSubmitError("Both email fields must match exactly. Please check and re-enter.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await serverSubmitStudentEmailAndClaimCertificate({
        data: {
          rollNumber: verifiedStudent.rollNumber,
          phone: phone.trim(),
          email: cleanEmail,
          courseId: courseMeta?.id,
        },
      });
      if (!res.success) {
        if ("suggestedEmail" in res && res.suggestedEmail) {
          setSuggestedEmail(res.suggestedEmail);
        }
        setSubmitError(res.error || "Could not update email.");
        return;
      }
      setDoneState({
        emailSaved: res.emailSaved,
        eligible: res.eligible,
        certificateNumber: "certificateNumber" in res ? res.certificateNumber : undefined,
        verifyUrl: "verifyUrl" in res ? res.verifyUrl : undefined,
        emailed: res.emailed,
        alreadyEmailed: "alreadyEmailed" in res ? res.alreadyEmailed : undefined,
        emailProvider: "emailProvider" in res ? res.emailProvider : undefined,
        emailError: "emailError" in res ? res.emailError : undefined,
        message: res.message,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setVerifiedStudent(null);
    setDoneState(null);
    setEmail("");
    setConfirmEmail("");
    setVerifyError(null);
    setSubmitError(null);
    setSuggestedEmail(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
          {/* Top Branded Header */}
          <div className="border-b border-border/70 bg-emerald-500/[0.06] px-6 py-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-800 dark:text-emerald-200">
                <Award className="h-3.5 w-3.5" />
                <span>{courseMeta?.code || "AI-DM-04"} · Certificate Email Form</span>
              </div>
              <div className="flex items-center gap-2">
                {branding?.rightLogoUrl && (
                  <img
                    src={branding.rightLogoUrl}
                    alt="Bangladesh Ansar & VDP"
                    className="h-8 w-auto object-contain"
                  />
                )}
                {branding?.rightSecondaryLogoUrl && (
                  <img
                    src={branding.rightSecondaryLogoUrl}
                    alt="Cloud Connect AI Limited"
                    className="h-7 w-auto object-contain"
                  />
                )}
              </div>
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Update Gmail &amp; Claim Certificate
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                আপনার আসল <strong>Gmail</strong> ঠিকানা সাবমিট করুন — রোস্টারে আপডেট হবে এবং আপনি
                পাস/যোগ্য হলে সাথে সাথে আপনার ইমেইলে অফিশিয়াল কোর্স সমাপনী সনদপত্র চলে যাবে।
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Step Indicator */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
              <div
                className={`rounded-xl border px-3 py-2 text-center ${
                  !verifiedStudent && !doneState
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                1. Verify Roll
              </div>
              <div
                className={`rounded-xl border px-3 py-2 text-center ${
                  verifiedStudent && !doneState
                    ? "border-primary bg-primary/10 text-primary"
                    : doneState
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                2. Submit Gmail
              </div>
              <div
                className={`rounded-xl border px-3 py-2 text-center ${
                  doneState
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                3. Certificate
              </div>
            </div>

            {/* STEP 1: Verify Roll + Mobile */}
            {!verifiedStudent && !doneState && (
              <form onSubmit={handleVerify} className="space-y-4">
                {centres.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-foreground">
                      Training Centre / প্রশিক্ষণ কেন্দ্র (Optional)
                    </span>
                    <select
                      value={selectedCentreCode}
                      onChange={(e) => handleSelectCentre(e.target.value)}
                      className="staff-input text-sm"
                    >
                      <option value="">Select your training centre…</option>
                      {centres.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.nameEn} ({c.code}) — {c.nameBn}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Roll Number / রোল নম্বর *
                  </span>
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. CUM-01, JHL-03, SYL-01"
                    className="staff-input font-mono text-sm uppercase"
                    autoComplete="off"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Registered Mobile Number / রেজিস্টার্ড মোবাইল নম্বর *
                  </span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="staff-input !pl-9 font-mono text-sm"
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Must match the mobile number recorded in your training centre attendance sheet.
                  </p>
                </label>

                {verifyError && (
                  <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>{verifying ? "Verifying…" : "Verify Identity / যাচাই করুন"}</span>
                </button>
              </form>
            )}

            {/* STEP 2: Verified Student → Enter Real Gmail */}
            {verifiedStudent && !doneState && (
              <form onSubmit={handleSubmitEmail} className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-200">
                      <UserCheck className="h-4 w-4" />
                      <span>Identity Verified</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3 w-3" /> Change roll
                    </button>
                  </div>
                  <div className="text-base font-black text-foreground">{verifiedStudent.name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">
                      {verifiedStudent.rollNumber}
                    </span>
                    {verifiedStudent.regionName && <span>· {verifiedStudent.regionName}</span>}
                  </div>
                  <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-bold">
                    {verifiedStudent.eligibleForCertificate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-emerald-800 dark:text-emerald-200">
                        <Award className="h-3 w-3" /> Eligible — Certificate will be emailed
                        immediately
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-amber-800 dark:text-amber-200">
                        Roster email update (certificate eligibility pending)
                      </span>
                    )}
                    {verifiedStudent.hasRealEmail && verifiedStudent.maskedEmail ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                        Current email: {verifiedStudent.maskedEmail}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-rose-700 dark:text-rose-300">
                        No Gmail on roster yet
                      </span>
                    )}
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Your Personal Gmail / আপনার আসল Gmail ঠিকানা *
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setSubmitError(null);
                        setSuggestedEmail(null);
                      }}
                      placeholder="yourname@gmail.com"
                      className="staff-input !pl-9 font-mono text-sm"
                      autoComplete="email"
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Confirm Gmail / আবার Gmail লিখুন *
                  </span>
                  <input
                    type="email"
                    required
                    value={confirmEmail}
                    onChange={(e) => {
                      setConfirmEmail(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="Re-type your exact Gmail address"
                    className="staff-input font-mono text-sm"
                    autoComplete="email"
                  />
                </label>

                {submitError && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                    {suggestedEmail && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(suggestedEmail);
                          setConfirmEmail(suggestedEmail);
                          setSubmitError(null);
                          setSuggestedEmail(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Use {suggestedEmail}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span>
                    {submitting
                      ? "Saving & Sending…"
                      : verifiedStudent.eligibleForCertificate
                        ? "Save Gmail & Send My Certificate"
                        : "Save My Gmail on Roster"}
                  </span>
                </button>
              </form>
            )}

            {/* STEP 3: Success */}
            {doneState && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-2.5">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="font-display text-lg font-black text-foreground">
                    {doneState.eligible && doneState.emailed
                      ? "Certificate Sent to Your Gmail!"
                      : "Gmail Updated Successfully!"}
                  </h2>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                    {doneState.message}
                  </p>
                  <div className="pt-1 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    {doneState.emailSaved}
                  </div>
                  {doneState.emailed && (
                    <p className="text-[11px] text-muted-foreground">
                      Please check your Inbox (and Spam/Promotions folder) within 1–2 minutes.
                    </p>
                  )}
                </div>

                {doneState.certificateNumber && (
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Link
                      to="/verify/$certId"
                      params={{ certId: doneState.certificateNumber }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-black text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                    >
                      <Award className="h-4 w-4" />
                      <span>View &amp; Download Certificate</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground underline"
                  >
                    Submit for another student
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

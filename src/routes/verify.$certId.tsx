import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { db } from "@/lib/db";
import { serverVerifyCertificate } from "@/lib/server-session";
import { CertificateData } from "@/lib/types";
import { ArrowLeft, CheckCircle2, Search, ShieldAlert } from "lucide-react";

const OFFICIAL_DEMO_CERT: CertificateData = {
  id: "cert-onn-4821-9982",
  certificateNumber: "ONN-4821-9982",
  studentName: "Cadet Tanvir Hossain",
  studentRoll: "2026-101",
  regionName: "Dhaka Range",
  quizTitle: "৪৬তম বিসিএস প্রিলিমিনারি ও মুক্তিযুদ্ধ মডেল টেস্ট",
  score: 4850,
  marksObtained: 4850,
  totalPoints: 5000,
  totalMarks: 5000,
  rank: 1,
  totalParticipants: 500,
  accuracyPercent: 97,
  scorePct: 97,
  issueDate: "2026-03-15",
  organizationName: "Onnesha Assessment & Examination Arena",
  institutionName: "Onnesha Assessment Arena",
  instructorName: "Chief Assessment Officer",
  verificationUrl: "/verify/ONN-4821-9982",
  verified: true,
};

export const Route = createFileRoute("/verify/$certId")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify Certificate #${params.certId} · Onnesha Arena` },
      { name: "description", content: "Official public cryptographic certificate verification portal." },
    ],
  }),
  component: VerifyCertificatePage,
});

function VerifyCertificatePage() {
  const { certId } = Route.useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [searchCode, setSearchCode] = useState(certId);
  const [foundCert, setFoundCert] = useState<CertificateData | undefined>(() => {
    if (certId.toUpperCase() === "ONN-4821-9982") return OFFICIAL_DEMO_CERT;
    return db.getCertificateById(certId);
  });
  const [isCheckingServer, setIsCheckingServer] = useState(!foundCert);

  useEffect(() => {
    setSearchCode(certId);
    if (certId.toUpperCase() === "ONN-4821-9982") {
      setFoundCert(OFFICIAL_DEMO_CERT);
      setIsCheckingServer(false);
      return;
    }

    let active = true;
    const local = db.getCertificateById(certId);
    if (local) {
      setFoundCert(local);
      setIsCheckingServer(false);
      return;
    }

    setIsCheckingServer(true);
    serverVerifyCertificate({ data: { certId } })
      .then((res) => {
        if (!active) return;
        if (res.success && res.certificate) {
          setFoundCert(res.certificate);
        } else {
          setFoundCert(undefined);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsCheckingServer(false);
      });

    return () => {
      active = false;
    };
  }, [certId]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      navigate({
        to: "/verify/$certId",
        params: { certId: searchCode.trim().toUpperCase() },
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 space-y-6">
        {/* Top Lookup Bar */}
        <form
          onSubmit={handleLookup}
          className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-sm print:hidden"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Enter Certificate ID (e.g. ONN-4821-9982)"
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2 font-mono text-xs font-bold uppercase text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
          >
            {lang === "bn" ? "যাচাই করুন" : "Verify Credential"}
          </button>
        </form>

        {isCheckingServer ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="font-mono text-sm font-bold text-muted-foreground">
              Verifying credential #{certId} against central registry...
            </p>
          </div>
        ) : foundCert ? (
          <>
            {/* Verification Status Header */}
            <div className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-500/10 p-6 text-center shadow-tactical flex flex-col items-center animate-in fade-in print:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md mb-2">
                <CheckCircle2 className="h-6 w-6 stroke-[3]" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                {lang === "bn" ? "সনদটি সফলভাবে যাচাইকৃত ও সত্য" : "Authentic Certificate Verified"}
              </h1>
              <p className="mt-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Official Credential No: <strong className="text-foreground">{foundCert.certificateNumber}</strong>
                {foundCert.regionName ? ` · Region: ${foundCert.regionName}` : ""} · Issuer:{" "}
                {foundCert.institutionName || "Onnesha Assessment Arena"}
              </p>
            </div>

            {/* Render Certificate View */}
            <CertificateView certificate={foundCert} />
          </>
        ) : (
          <div className="rounded-3xl border-2 border-destructive/40 bg-destructive/10 p-8 sm:p-12 text-center shadow-tactical flex flex-col items-center max-w-xl mx-auto animate-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20 text-destructive mb-4">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Certificate Not Found
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              No verified certificate was found in the Onnesha repository for credential identifier:{" "}
              <code className="font-mono font-bold text-destructive">{certId}</code>.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/verify/$certId"
                params={{ certId: "ONN-4821-9982" }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
              >
                Load Sample Certificate (ONN-4821-9982)
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Home Arena</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

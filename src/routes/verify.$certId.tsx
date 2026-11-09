import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { db } from "@/lib/db";
import { serverVerifyCertificate } from "@/lib/server-session";
import { CertificateData } from "@/lib/types";
import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";

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
  const [searchCode, setSearchCode] = useState("");
  const [foundCert, setFoundCert] = useState<CertificateData | undefined>(() =>
    db.getCertificateById(certId)
  );
  const [isCheckingServer, setIsCheckingServer] = useState(!foundCert);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 space-y-6">
        {isCheckingServer ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="font-mono text-sm font-bold text-muted-foreground">
              Verifying credential #{certId} against central registry...
            </p>
          </div>
        ) : foundCert ? (
          <>
            {/* Verification Status Header */}
            <div className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-500/10 p-6 text-center shadow-tactical flex flex-col items-center animate-in fade-in">
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchCode.trim()) {
                  navigate({
                    to: "/verify/$certId",
                    params: { certId: searchCode.trim().toUpperCase() },
                  });
                }
              }}
              className="mt-6 flex w-full max-w-sm gap-2"
            >
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="e.g. ONN-4821-0101"
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Verify
              </button>
            </form>

            <div className="mt-6">
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

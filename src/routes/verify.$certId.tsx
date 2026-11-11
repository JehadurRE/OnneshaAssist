import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CertificateView } from '@/components/common/CertificateView';
import { db } from '@/lib/db';
import { serverAdminMutateStore, serverVerifyCertificate } from '@/lib/server-session';
import { CertificateData } from '@/lib/types';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Search, ShieldCheck } from 'lucide-react';

export const Route = createFileRoute('/verify/$certId')({
  component: VerifyCertPage,
});

function VerifyCertPage() {
  const { certId } = Route.useParams();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(certId);
  const [cert, setCert] = useState<CertificateData | undefined>(() => db.getCertificateById(certId));
  const [isLoadingServer, setIsLoadingServer] = useState(!db.getCertificateById(certId));

  useEffect(() => {
    setSearchId(certId);
    const localCert = db.getCertificateById(certId);
    if (localCert) {
      setCert(localCert);
      setIsLoadingServer(false);
      // Ensure server store also has this certificate for cross-device QR scans
      serverAdminMutateStore({
        data: { action: 'issue_certificate', certificate: localCert },
      }).catch(() => {});
      return;
    }

    let cancelled = false;
    setIsLoadingServer(true);
    serverVerifyCertificate({ data: { certNo: certId } })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.certificate) {
          setCert(res.certificate);
        } else {
          setCert(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setCert(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingServer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [certId]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchId.trim().toUpperCase();
    if (!cleaned) return;
    navigate({ to: '/verify/$certId', params: { certId: cleaned } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto flex-1 w-full max-w-5xl px-3 sm:px-6 py-6 sm:py-10 pb-28 md:pb-14">
        {/* Top Bar & Lookup Form */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
          <Link
            to="/play"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition self-start"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Exam Center</span>
          </Link>

          <form onSubmit={handleLookup} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter ID (e.g. ONN-4634-026104)"
                className="w-full rounded-xl border border-border bg-card py-2.5 sm:py-2 pl-9 pr-3 text-xs font-mono uppercase text-foreground focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shrink-0 cursor-pointer"
            >
              Verify
            </button>
          </form>
        </div>

        {/* Verification Status Banner */}
        {isLoadingServer ? (
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
            <Loader2 className="mx-auto h-9 w-9 sm:h-10 sm:w-10 animate-spin text-emerald-400 mb-3" />
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              সনদপত্র যাচাই করা হচ্ছে (Verifying Official Ledger)...
            </h2>
            <p className="mt-1 text-xs text-muted-foreground font-mono break-all">{certId}</p>
          </div>
        ) : cert ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Authentic &amp; Verified Credential
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    This certificate is cryptographically logged in the Onnesha Assessment Registry
                    for{' '}
                    <strong className="text-foreground">{cert.studentName}</strong> (Roll:{' '}
                    <span className="font-mono text-foreground">{cert.studentRoll || 'N/A'}</span>).
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right font-mono text-xs border-t sm:border-t-0 border-emerald-500/20 pt-2.5 sm:pt-0">
                <div className="text-[10px] text-muted-foreground uppercase">Registry Serial</div>
                <div className="font-bold text-emerald-700 dark:text-emerald-400 break-all">
                  {cert.certificateNumber}
                </div>
              </div>
            </div>

            <CertificateView certificate={cert} />
          </div>
        ) : (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 sm:p-10 text-center max-w-xl mx-auto my-6 sm:my-8">
            <div className="mx-auto mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">
              Certificate Record Not Found
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              No verified credential matching serial{' '}
              <span className="font-mono font-bold text-red-400 break-all">{certId}</span> was found
              in the registry. Please check the serial number or try our sample verified credential:
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Link
                to="/verify/$certId"
                params={{ certId: 'ONN-4634-026104' }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>View ONN-4634-026104</span>
              </Link>
              <Link
                to="/verify/$certId"
                params={{ certId: 'ONN-4821-9982' }}
                className="inline-flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-xs font-bold text-foreground hover:border-emerald-500/30 transition"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>View ONN-4821-9982</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

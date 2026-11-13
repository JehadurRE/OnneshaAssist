import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { db } from "@/lib/db";
import { serverVerifyCertificate } from "@/lib/server-session";
import type { CertificateVerificationReport } from "@/lib/server-security";
import { CertificateData } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/verify/$certId")({
  component: VerifyCertPage,
});

function VerifyCertPage() {
  const { certId } = Route.useParams();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(certId);
  const [cert, setCert] = useState<CertificateData | undefined>(undefined);
  const [verification, setVerification] = useState<CertificateVerificationReport | null>(null);
  const [showCryptoDetails, setShowCryptoDetails] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isLoadingServer, setIsLoadingServer] = useState(true);

  useEffect(() => {
    setSearchId(certId);
    let cancelled = false;
    setIsLoadingServer(true);

    // Server-first authoritative verification (local cache used only as offline fallback)
    serverVerifyCertificate({ data: { certNo: certId } })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.certificate) {
          setCert(res.certificate);
          setVerification(res.verification || null);
        } else {
          setCert(undefined);
          setVerification(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const offlineFallback = db.getCertificateById(certId);
        setCert(offlineFallback);
        setVerification(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingServer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [certId]);

  const handleCopyPublicKey = () => {
    if (!verification?.publicKeyPem || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    navigator.clipboard.writeText(verification.publicKeyPem);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchId.trim().toUpperCase();
    if (!cleaned) return;
    navigate({ to: "/verify/$certId", params: { certId: cleaned } });
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
            {verification?.status === "tampered" ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                    <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-red-700 dark:text-red-400">
                        Cryptographic Integrity Warning
                      </span>
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">
                        TAMPERED
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      The SHA-256 payload digest or Ed25519 signature for{" "}
                      <strong className="text-foreground">{cert.studentName}</strong> failed
                      cryptographic verification. Treat this credential as invalid.
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right font-mono text-xs border-t sm:border-t-0 border-red-500/20 pt-2.5 sm:pt-0">
                  <div className="text-[10px] text-muted-foreground uppercase">Registry Serial</div>
                  <div className="font-bold text-red-700 dark:text-red-400 break-all">
                    {cert.certificateNumber}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`rounded-2xl border p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 print:hidden ${
                  verification?.status === "legacy_unsigned"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-emerald-500/30 bg-emerald-500/10"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
                      verification?.status === "legacy_unsigned"
                        ? "bg-amber-600 shadow-amber-600/20"
                        : "bg-emerald-600 shadow-emerald-600/20"
                    }`}
                  >
                    {verification?.status === "legacy_unsigned" ? (
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span
                        className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                          verification?.status === "legacy_unsigned"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {verification?.status === "verified_signed"
                          ? "Ed25519 Signed & Hash-Chain Verified"
                          : verification?.status === "legacy_unsigned"
                            ? "Legacy Registry Record (Pre-Signature)"
                            : "Registry Credential Matched"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          verification?.status === "legacy_unsigned"
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                            : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                        }`}
                      >
                        {verification?.status === "verified_signed"
                          ? `BLOCK #${cert.ledgerIndex || 1}`
                          : "ACTIVE"}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {verification?.status === "verified_signed"
                        ? `Asymmetric Ed25519 signature & SHA-256 hash chain verified on the Onnesha server ledger for `
                        : `Found in the Onnesha Assessment Registry for `}
                      <strong className="text-foreground">{cert.studentName}</strong> (Roll:{" "}
                      <span className="font-mono text-foreground">{cert.studentRoll || "N/A"}</span>
                      ).
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 font-mono text-xs border-t sm:border-t-0 border-border/40 pt-2.5 sm:pt-0">
                  <div className="text-[10px] text-muted-foreground uppercase">Registry Serial</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 break-all">
                    {cert.certificateNumber}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCryptoDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-accent transition w-fit cursor-pointer"
                  >
                    <KeyRound className="h-3 w-3 text-primary" />
                    <span>
                      {showCryptoDetails ? "Hide Proof Ledger" : "Inspect Cryptographic Proof"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {showCryptoDetails && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 text-xs font-mono print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2 font-sans font-bold text-foreground">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span>Ed25519 Signature &amp; SHA-256 Hash-Chain Audit Proof</span>
                  </div>
                  {verification?.publicKeyPem && (
                    <button
                      type="button"
                      onClick={handleCopyPublicKey}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-sans font-bold hover:bg-accent cursor-pointer"
                    >
                      {copiedKey ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Public Key Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Copy Ed25519 Public Key (PEM)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px]">
                      SHA-256 Payload Digest
                    </div>
                    <div className="break-all text-foreground font-semibold">
                      {cert.payloadHash || verification?.expectedPayloadHash || "Unavailable"}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Payload Match:{" "}
                      {verification ? (verification.payloadMatch ? "YES" : "FAILED") : "Offline"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1">
                    <div className="text-muted-foreground uppercase text-[10px]">
                      Hash-Chain Block (#{cert.ledgerIndex ?? "Unsigned"})
                    </div>
                    <div className="break-all text-foreground font-semibold">
                      {cert.chainHash || "Not chained (legacy issue)"}
                    </div>
                    <div className="text-[10px] text-muted-foreground break-all">
                      Prev: {cert.prevBlockHash ? `${cert.prevBlockHash.slice(0, 24)}…` : "None"}
                    </div>
                  </div>
                </div>

                {cert.cryptoSignature && (
                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase">
                      <span>
                        Ed25519 Signature (Key ID: {cert.signerKeyId || verification?.keyId})
                      </span>
                      <span>Signed: {cert.signedAt || cert.issueDate}</span>
                    </div>
                    <div className="break-all text-foreground">{cert.cryptoSignature}</div>
                  </div>
                )}

                <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Architecture Note:</strong> Credentials are sealed on the server using{" "}
                  <strong>Ed25519 asymmetric digital signatures</strong> linked via an append-only{" "}
                  <strong>SHA-256 hash chain</strong> (tamper-evident cryptographic ledger). It does
                  not require cryptocurrency gas fees or publish student PII onto a public coin
                  blockchain.
                </p>
              </div>
            )}

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
              No verified credential matching serial{" "}
              <span className="font-mono font-bold text-red-400 break-all">{certId}</span> was found
              in the registry. Please check the serial number issued on your scorecard and try
              again.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

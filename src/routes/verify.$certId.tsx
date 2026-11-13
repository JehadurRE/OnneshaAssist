import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { db } from "@/lib/db";
import {
  serverAnchorCertificateNow,
  serverExportVerifiableCredential,
  serverVerifyCertificate,
} from "@/lib/server-session";
import type { CertificateVerificationReport } from "@/lib/server-security";
import { CertificateData } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
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
  const [didWeb, setDidWeb] = useState<string | null>(null);
  const [publicKeyMultibase, setPublicKeyMultibase] = useState<string | null>(null);
  const [showCryptoDetails, setShowCryptoDetails] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isLoadingServer, setIsLoadingServer] = useState(true);
  const [isSyncingAnchor, setIsSyncingAnchor] = useState(false);
  const [anchorNotice, setAnchorNotice] = useState<string | null>(null);

  useEffect(() => {
    setSearchId(certId);
    setAnchorNotice(null);
    let cancelled = false;
    setIsLoadingServer(true);

    const origin = typeof window !== "undefined" ? window.location.origin : undefined;

    // Server-first authoritative verification (local cache used only as offline fallback)
    serverVerifyCertificate({ data: { certNo: certId, origin } })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.certificate) {
          setCert(res.certificate);
          setVerification(res.verification || null);
          setDidWeb(res.didWeb || null);
          setPublicKeyMultibase(res.publicKeyMultibase || null);
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

  const handleSyncPublicAnchor = async () => {
    if (!cert || isSyncingAnchor) return;
    setIsSyncingAnchor(true);
    setAnchorNotice(null);
    try {
      const res = await serverAnchorCertificateNow({ data: { certNo: cert.certificateNumber } });
      if (res.certificate) {
        setCert(res.certificate);
      }
      if (res.verification) {
        setVerification(res.verification);
      }
      if (res.rekorAnchored && res.otsAnchored) {
        setAnchorNotice("Anchored to both Sigstore Rekor and OpenTimestamps (Bitcoin)!");
      } else if (res.rekorAnchored || res.otsAnchored) {
        setAnchorNotice(
          res.rekorAnchored
            ? "Anchored to Sigstore Rekor transparency log."
            : "Anchored ledger tip to OpenTimestamps (Bitcoin).",
        );
      } else {
        setAnchorNotice(
          res.rekorError || res.otsError || "Public transparency networks temporarily unreachable.",
        );
      }
    } catch {
      setAnchorNotice("Unable to reach transparency anchor endpoint right now.");
    } finally {
      setIsSyncingAnchor(false);
    }
  };

  const handleDownloadW3CCredential = async () => {
    if (!cert || typeof window === "undefined") return;
    try {
      const res = await serverExportVerifiableCredential({
        data: { certNo: cert.certificateNumber, origin: window.location.origin },
      });
      if (!res.success || !res.credential) return;
      const blob = new Blob([JSON.stringify(res.credential, null, 2)], {
        type: "application/vc+json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cert.certificateNumber}.vc.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore download error
    }
  };

  const handleDownloadOtsProof = () => {
    if (!cert?.otsProofBase64 || typeof window === "undefined") return;
    const raw = atob(cert.otsProofBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cert.certificateNumber}.ots`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                      {cert.rekorStatus === "anchored" &&
                        typeof cert.rekorLogIndex === "number" && (
                          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                            REKOR #{cert.rekorLogIndex}
                          </span>
                        )}
                      {cert.otsProofBase64 && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          {cert.otsStatus === "bitcoin_confirmed"
                            ? "BTC CONFIRMED"
                            : "BTC OTS ANCHORED"}
                        </span>
                      )}
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
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 text-xs font-mono print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2 font-sans font-bold text-foreground">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span>
                      W3C DID + Ed25519 Signature + Sigstore Rekor + Bitcoin OTS Audit Proof
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {verification?.status === "verified_signed" && (
                      <button
                        type="button"
                        onClick={handleSyncPublicAnchor}
                        disabled={isSyncingAnchor}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-sans font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        {isSyncingAnchor ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span>Sync Public Anchor</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadW3CCredential}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-sans font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      <FileJson className="h-3.5 w-3.5" />
                      <span>W3C VC (.vc.json)</span>
                    </button>
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
                            <span>Copy PEM Key</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {anchorNotice && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 font-sans text-[11px] font-medium text-sky-700 dark:text-sky-300">
                    {anchorNotice}
                  </div>
                )}

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

                {/* Sigstore Rekor Instant Transparency Log + OpenTimestamps Bitcoin Anchor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase">
                      <span className="text-muted-foreground font-bold">
                        Sigstore Rekor Transparency Log
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          cert.rekorStatus === "anchored"
                            ? "bg-sky-500/20 text-sky-700 dark:text-sky-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {cert.rekorStatus === "anchored"
                          ? `LOG #${cert.rekorLogIndex}`
                          : cert.rekorStatus === "pending_retry"
                            ? "PENDING RETRY"
                            : "NOT ANCHORED"}
                      </span>
                    </div>
                    <div className="break-all text-foreground">
                      {cert.rekorEntryUuid || "Click 'Sync Public Anchor' to log zero-PII digest."}
                    </div>
                    {cert.rekorReceiptDigest && (
                      <div className="text-[10px] text-muted-foreground break-all">
                        Zero-PII Receipt SHA-256: {cert.rekorReceiptDigest}
                      </div>
                    )}
                    {cert.rekorExplorerUrl && (
                      <a
                        href={cert.rekorExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-sans font-bold text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Verify on Sigstore Search</span>
                      </a>
                    )}
                  </div>

                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase">
                      <span className="text-muted-foreground font-bold">
                        OpenTimestamps (Bitcoin Checkpoint)
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          cert.otsStatus === "bitcoin_confirmed"
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : cert.otsProofBase64
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {cert.otsStatus === "bitcoin_confirmed"
                          ? `BTC BLOCK ${cert.otsBitcoinBlockHeight || "CONFIRMED"}`
                          : cert.otsProofBase64
                            ? "CALENDAR PENDING BTC"
                            : "NO CHECKPOINT"}
                      </span>
                    </div>
                    <div className="break-all text-foreground">
                      {cert.otsChainHash
                        ? `Covers through Ledger #${cert.otsLedgerIndex} (${cert.otsChainHash.slice(0, 24)}…)`
                        : "Background ledger-tip Bitcoin stamp pending."}
                    </div>
                    {cert.otsCalendarUrl && (
                      <div className="text-[10px] text-muted-foreground break-all">
                        Calendar: {cert.otsCalendarUrl}
                      </div>
                    )}
                    {cert.otsProofBase64 && (
                      <button
                        type="button"
                        onClick={handleDownloadOtsProof}
                        className="inline-flex items-center gap-1 font-sans font-bold text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download Binary .ots Proof</span>
                      </button>
                    )}
                  </div>
                </div>

                {cert.cryptoSignature && (
                  <div className="rounded-xl bg-background/70 border border-border/70 p-3 space-y-1 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground uppercase">
                      <span>
                        Ed25519 Signature (Key ID: {cert.signerKeyId || verification?.keyId})
                      </span>
                      <span>Signed: {cert.signedAt || cert.issueDate}</span>
                    </div>
                    <div className="break-all text-foreground">{cert.cryptoSignature}</div>
                    {didWeb && (
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground border-t border-border/50 mt-2">
                        <span className="truncate">
                          Issuer DID: <strong className="text-foreground">{didWeb}</strong>
                          {publicKeyMultibase ? ` (${publicKeyMultibase.slice(0, 18)}…)` : ""}
                        </span>
                        <a
                          href="/.well-known/did.json"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-sans font-bold text-primary hover:underline shrink-0"
                        >
                          <Globe className="h-3 w-3" />
                          <span>/.well-known/did.json</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Industrial 3-Layer Verification:</strong> (1) Instant{" "}
                  <strong>W3C Verifiable Credential / did:web Ed25519</strong> signature over{" "}
                  <strong>SHA-256 hash-chain</strong> block, (2) zero-PII{" "}
                  <strong>Sigstore Rekor</strong> transparency log anchor (`hashedrekord` ECDSA
                  P-256), and (3) asynchronous <strong>OpenTimestamps Bitcoin</strong> ledger
                  checkpointing. No student PII is ever published on external logs or blockchains.
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

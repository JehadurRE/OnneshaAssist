import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { CertificateData } from "@/lib/types";
import { useBranding } from "@/hooks/use-branding";
import { downloadCertificatePdf, populateCertificateCanvas } from "@/lib/pdf-generator";

interface CertificateViewProps {
  certificate: CertificateData;
  onDownload?: () => void;
}

export const CertificateView: React.FC<CertificateViewProps> = ({ certificate, onDownload }) => {
  const branding = useBranding();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificate.certificateNumber}`
      : certificate.verificationUrl ||
        `https://arena.onnesha.courses/verify/${certificate.certificateNumber}`;

  useEffect(() => {
    if (canvasRef.current) {
      populateCertificateCanvas(canvasRef.current, certificate, branding);
    }
  }, [certificate, branding]);

  useEffect(() => {
    if (isZoomOpen && zoomCanvasRef.current) {
      populateCertificateCanvas(zoomCanvasRef.current, certificate, branding);
    }
  }, [isZoomOpen, certificate, branding]);

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await downloadCertificatePdf(certificate, branding);
      if (onDownload) {
        onDownload();
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyVerifyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(verifyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Proportional A4 Landscape Certificate Sheet — Scales identically to the printed PDF on Mobile & Desktop */}
      <div className="group relative w-full overflow-hidden rounded-xl sm:rounded-2xl border-2 border-amber-500/40 bg-[#fffdf7] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={2400}
          height={1700}
          onClick={() => setIsZoomOpen(true)}
          className="block w-full h-auto aspect-[2400/1700] cursor-zoom-in select-none"
        />

        {/* Subtle Zoom Hint Pill on Mobile/Desktop */}
        <button
          type="button"
          onClick={() => setIsZoomOpen(true)}
          className="print:hidden absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-3 py-1 text-[10px] sm:text-xs font-bold text-white backdrop-blur-md shadow-md hover:bg-slate-950 transition cursor-pointer"
        >
          <Maximize2 className="h-3 w-3 text-emerald-400" />
          <span>বড় করে দেখুন (Tap to Zoom)</span>
        </button>
      </div>

      {/* Action Controls — Real PDF Binary Download + Shareable Link */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 print:hidden">
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3.5 sm:py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 transition disabled:opacity-60 cursor-pointer"
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>সনদপত্র PDF তৈরি হচ্ছে (Generating PDF)...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>ডাউনলোড সনদপত্র (Download Official PDF)</span>
            </>
          )}
        </button>

        <button
          onClick={handleCopyVerifyLink}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-xs font-bold text-foreground hover:border-emerald-500/40 transition cursor-pointer"
        >
          {copiedLink ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-500">ভেরিফিকেশন লিংক কপি হয়েছে! (Copied)</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span>ভেরিফিকেশন লিংক কপি করুন (Copy Verify Link)</span>
            </>
          )}
        </button>

        <a
          href={`/verify/${certificate.certificateNumber}`}
          target="_blank"
          rel="noreferrer"
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-5 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-emerald-500/40 transition"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Public Verification URL</span>
        </a>
      </div>

      {/* High-Resolution Pan/Zoom Modal for Inspecting Fine Print on Mobile */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-md p-3 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900/90 px-4 py-2.5 text-white">
            <span className="text-xs font-bold font-mono text-emerald-400 truncate">
              {certificate.certificateNumber} — Print-Preview Mode (Pinch/Scroll to Inspect)
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 transition cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-start sm:justify-center rounded-xl border border-white/10 bg-slate-950/60 p-2 sm:p-6">
            <canvas
              ref={zoomCanvasRef}
              width={2400}
              height={1700}
              className="block w-[860px] sm:w-full max-w-5xl h-auto aspect-[2400/1700] rounded-lg shadow-2xl shrink-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};

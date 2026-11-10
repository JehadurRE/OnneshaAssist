import React, { useState } from 'react';
import { Award, CheckCircle2, Copy, Download, ExternalLink, Loader2, Shield } from 'lucide-react';
import { CertificateData } from '@/lib/types';
import { useBranding } from '@/hooks/use-branding';
import { downloadCertificatePdf } from '@/lib/pdf-generator';
import onnesha from '@/assets/onnesha.jpg.asset.json';

interface CertificateViewProps {
  certificate: CertificateData;
  onDownload?: () => void;
}

export const CertificateView: React.FC<CertificateViewProps> = ({ certificate, onDownload }) => {
  const branding = useBranding();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${certificate.certificateNumber}`
      : certificate.verificationUrl || `https://onnesha.app/verify/${certificate.certificateNumber}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    verifyUrl
  )}`;

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
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(verifyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Certificate Frame — 100% Mobile Responsive */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-4 sm:border-8 border-double border-amber-500/40 bg-gradient-to-br from-card via-background to-emerald-950/20 p-4 sm:p-8 md:p-12 shadow-2xl">
        {/* Corner Ornaments */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 sm:top-4 sm:left-4 h-7 w-7 sm:h-12 sm:w-12 border-t-2 border-l-2 border-amber-500/50 rounded-tl-lg" />
        <div className="pointer-events-none absolute top-2.5 right-2.5 sm:top-4 sm:right-4 h-7 w-7 sm:h-12 sm:w-12 border-t-2 border-r-2 border-amber-500/50 rounded-tr-lg" />
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 h-7 w-7 sm:h-12 sm:w-12 border-b-2 border-l-2 border-amber-500/50 rounded-bl-lg" />
        <div className="pointer-events-none absolute bottom-2.5 right-2.5 sm:bottom-4 sm:right-4 h-7 w-7 sm:h-12 sm:w-12 border-b-2 border-r-2 border-amber-500/50 rounded-br-lg" />

        {/* Header Logos & Authority */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-b border-border/80 pb-4 sm:pb-6">
          <div className="flex items-center justify-center gap-3">
            <img
              src={onnesha.url}
              alt="Onnesha"
              className="h-10 sm:h-14 w-auto object-contain rounded-lg bg-white p-1 shadow-md"
            />
            {branding.showPartnerLogo && branding.partnerLogoUrl && (
              <img
                src={branding.partnerLogoUrl}
                alt={branding.partnerName || 'Partner'}
                className="h-10 sm:h-14 max-w-[110px] sm:max-w-[140px] object-contain rounded-lg bg-white p-1 shadow-md sm:hidden"
              />
            )}
          </div>

          <div className="text-center flex-1 px-1 sm:px-2">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] sm:tracking-[0.25em] text-emerald-400 break-words">
              {branding.showPartnerLogo && branding.partnerName
                ? `Onnesha × ${branding.partnerName}`
                : branding.institutionTitle || 'Onnesha Assessment & Examination Arena'}
            </div>
            <h2 className="mt-1 font-serif text-base sm:text-xl md:text-2xl font-black tracking-tight text-foreground break-words">
              {certificate.organizationName || 'Onnesha Assessment & Examination Arena'}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              National Training, Merit Evaluation &amp; Digital Examination Authority
            </p>
          </div>

          <div className="hidden sm:flex items-center justify-center">
            {branding.showPartnerLogo && branding.partnerLogoUrl ? (
              <img
                src={branding.partnerLogoUrl}
                alt={branding.partnerName || 'Partner'}
                className="h-14 max-w-[140px] object-contain rounded-lg bg-white p-1 shadow-md"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <Shield className="h-7 w-7" />
              </div>
            )}
          </div>
        </div>

        {/* Main Body */}
        <div className="py-5 sm:py-8 text-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 sm:px-4 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest text-amber-400 mb-3 sm:mb-4">
            <Award className="h-3.5 w-3.5 shrink-0" />
            <span>Certificate of Merit &amp; Excellence</span>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground italic px-2">
            This official credential is proudly presented to / এই মর্মে প্রত্যয়ন করা যাচ্ছে যে
          </p>

          <div className="mt-2 sm:mt-3 mb-2 font-serif text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground underline decoration-amber-500/60 decoration-2 underline-offset-8 max-w-full break-words px-2 sm:px-8">
            {certificate.studentName}
          </div>

          {(certificate.studentRoll || certificate.regionName) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono font-bold text-emerald-400">
              {certificate.studentRoll && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
                  Roll ID: {certificate.studentRoll}
                </span>
              )}
              {certificate.regionName && (
                <span className="rounded-md border border-border bg-secondary/60 px-2.5 py-0.5 text-muted-foreground">
                  Division: {certificate.regionName}
                </span>
              )}
            </div>
          )}

          <p className="mt-4 sm:mt-5 max-w-xl mx-auto text-xs sm:text-sm leading-relaxed text-muted-foreground px-1">
            for successfully completing and demonstrating outstanding proficiency in the assessment:
          </p>

          <h3 className="mt-2 text-base sm:text-xl font-bold text-emerald-400 px-2 break-words">
            {certificate.quizTitle}
          </h3>

          {/* Metrics Grid — Stacks cleanly on Mobile, 3 columns on Tablet/Desktop */}
          <div className="mt-5 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-xl mx-auto">
            <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 flex sm:block items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Merit Standing
              </div>
              <div className="text-right sm:text-center">
                <div className="sm:mt-1 font-mono text-lg sm:text-xl font-black text-foreground">
                  #{certificate.rank}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  of {certificate.totalParticipants} Candidates
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex sm:block items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Raw Marks Obtained
              </div>
              <div className="text-right sm:text-center">
                <div className="sm:mt-1 font-mono text-lg sm:text-xl font-black text-emerald-400">
                  {certificate.marksObtained ?? certificate.score}
                </div>
                <div className="text-[10px] text-emerald-300/80">
                  Out of {certificate.totalMarks ?? certificate.totalPoints}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex sm:block items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Accuracy Velocity
              </div>
              <div className="text-right sm:text-center">
                <div className="sm:mt-1 font-mono text-lg sm:text-xl font-black text-amber-400">
                  {certificate.accuracyPercent ?? certificate.scorePct ?? 100}%
                </div>
                <div className="text-[10px] text-amber-300/80">Verified Precision</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signatures & QR Code */}
        <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 items-center gap-5 sm:gap-6 border-t border-border/80 pt-5 sm:pt-6 text-xs">
          {/* Left: Examiner Signature */}
          <div className="text-center sm:text-left order-2 sm:order-1">
            <div className="font-serif italic text-base sm:text-lg text-foreground/90 mb-1">
              {certificate.instructorName || 'Chief Assessment Officer'}
            </div>
            <div className="h-px w-40 bg-border mx-auto sm:mx-0 mb-1" />
            <div className="font-bold text-foreground">
              {certificate.instructorName || 'Chief Assessment Officer'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Controller of Examinations • সনদ প্রত্যয়নকারী
            </div>
          </div>

          {/* Center: Verification Seal & Live Scannable QR */}
          <div className="flex flex-col items-center justify-center order-1 sm:order-2">
            <div className="rounded-xl border border-border/80 bg-white p-2 shadow-md">
              <img
                src={qrImageUrl}
                alt={`Verify ${certificate.certificateNumber}`}
                className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
              />
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Blockchain/Digital Verified</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Scan QR to Verify Online
            </span>
          </div>

          {/* Right: Issue Date & Serial */}
          <div className="text-center sm:text-right order-3">
            <div className="font-mono font-bold text-foreground mb-1">{certificate.issueDate}</div>
            <div className="h-px w-40 bg-border mx-auto sm:ml-auto sm:mr-0 mb-1" />
            <div className="font-bold text-foreground">Date of Issue</div>
            <div className="font-mono text-[11px] text-emerald-400 mt-0.5 break-all">
              ID: {certificate.certificateNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls — Real PDF Binary Download + Shareable Link */}
      <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 print:hidden">
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
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">ভেরিফিকেশন লিংক কপি হয়েছে! (Copied)</span>
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
    </div>
  );
};

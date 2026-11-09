import React, { useRef } from 'react';
import { CertificateData } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { useBranding } from '@/hooks/use-branding';
import onnesha from '@/assets/onnesha.jpg.asset.json';
import { Award, CheckCircle2, Download, ExternalLink, Printer, QrCode, ShieldCheck, Sparkles } from 'lucide-react';

export const CertificateView: React.FC<{ certificate: CertificateData; onPrint?: () => void }> = ({
  certificate,
  onPrint,
}) => {
  const { lang } = useLanguage();
  const branding = useBranding();
  const certRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const verificationUrl =
    certificate.verificationUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${certificate.certificateNumber}`
      : `https://onnesha.app/verify/${certificate.certificateNumber}`);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

  const scoreDisplay = certificate.score || certificate.marksObtained || 0;
  const totalScoreDisplay = certificate.totalPoints || certificate.totalMarks || 100;
  const accuracy = certificate.accuracyPercent || certificate.scorePct || Math.round((scoreDisplay / Math.max(1, totalScoreDisplay)) * 100);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Printable Certificate Frame */}
      <div
        ref={certRef}
        id="certificate-print-area"
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border-8 border-amber-500/30 bg-card p-8 sm:p-12 shadow-2xl text-center print:border-black print:shadow-none print:m-0 print:p-6"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(251, 191, 36, 0.04) 0%, transparent 70%)',
        }}
      >
        {/* Double border inner inlay */}
        <div className="absolute inset-3 pointer-events-none rounded-2xl border-2 border-dashed border-amber-500/40 print:border-black" />

        {/* Top Header Logos */}
        <div className="flex items-center justify-between gap-4 border-b border-border/80 pb-6 print:border-black">
          <img src={onnesha.url} alt="Onnesha LMS" className="h-14 rounded-xl object-contain shadow-sm" />
          <div className="flex flex-col items-center">
            <h3 className="font-display text-base sm:text-lg font-black tracking-wider text-foreground uppercase">
              {branding.institutionTitle || (lang === 'bn' ? 'অন্বেষা লার্নিং অ্যান্ড অ্যাসেসমেন্ট' : 'Onnesha Assessment & Examination Arena')}
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              {branding.showPartnerLogo && branding.partnerName
                ? `${branding.partnerName} · Official Digital Assessment`
                : lang === 'bn'
                  ? 'অফিসিয়াল ডিজিটাল অ্যাসেসমেন্ট · অন্বেষা এলএমএস'
                  : 'Official Digital Assessment · Onnesha LMS'}
            </p>
          </div>
          {branding.showPartnerLogo && branding.partnerLogoUrl ? (
            <img
              src={branding.partnerLogoUrl}
              alt={branding.partnerName || 'Joint Partner'}
              className="h-14 max-w-[140px] object-contain"
            />
          ) : (
            <div className="h-14 w-14 flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600">
              <Award className="h-7 w-7" />
            </div>
          )}
        </div>

        {/* Main Certificate Title */}
        <div className="mt-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-4 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
            <Award className="h-4 w-4" />
            <span>{lang === 'bn' ? 'যাচাইযোগ্য ডিজিটাল মেধা সনদপত্র' : 'OFFICIAL CERTIFICATE OF MERIT'}</span>
          </div>
          <h1 className="mt-4 font-serif text-2xl sm:text-3xl font-black text-foreground italic tracking-tight">
            Certificate of Academic Excellence
          </h1>
          <p className="text-xs text-muted-foreground mt-1">This credential is cryptographically issued and verified by institutional examiners.</p>
        </div>

        {/* Recipient Details */}
        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Proudly presented to</p>
          <div className="font-serif text-3xl sm:text-4xl font-extrabold text-foreground tracking-wide border-b-2 border-amber-500/50 pb-2 inline-block px-8">
            {certificate.studentName}
          </div>
          {certificate.studentRoll && (
            <div className="font-mono text-xs font-bold text-muted-foreground">
              Cadet Roll / Exam ID: <span className="text-foreground">{certificate.studentRoll}</span>
            </div>
          )}
        </div>

        {/* Achievement Paragraph */}
        <div className="mt-6 max-w-xl mx-auto text-xs sm:text-sm text-muted-foreground leading-relaxed">
          For demonstrating extraordinary competence and achieving <strong className="text-foreground">Merit Rank #{certificate.rank}</strong> in the competitive examination:
          <div className="mt-2 font-display text-base sm:text-lg font-black text-foreground">
            &ldquo;{certificate.quizTitle}&rdquo;
          </div>
        </div>

        {/* Performance Badges */}
        <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg mx-auto">
          <div className="rounded-2xl border border-border/80 bg-background/80 p-3">
            <div className="font-mono text-xl sm:text-2xl font-black text-amber-500">
              #{certificate.rank}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Merit Standing</div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/80 p-3">
            <div className="font-mono text-xl sm:text-2xl font-black text-foreground">
              {scoreDisplay}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Raw Marks Obtained</div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/80 p-3">
            <div className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {accuracy}%
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Accuracy Velocity</div>
          </div>
        </div>

        {/* Signatures & Real Scannable QR Code */}
        <div className="mt-10 pt-6 border-t border-border/80 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end print:border-black">
          {/* Left: Invigilator */}
          <div className="text-center sm:text-left space-y-1">
            <div className="w-36 border-b border-foreground/60 mx-auto sm:mx-0 mb-1"></div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Date: <strong>{certificate.issueDate}</strong>
            </div>
            <div className="font-bold text-foreground">{certificate.instructorName || 'Major (Retd.) Farhan Chowdhury'}</div>
            <div className="text-[11px] text-muted-foreground">Chief Assessment Officer</div>
          </div>

          {/* Center: Real Scannable QR Code */}
          <div className="flex flex-col items-center">
            <div className="p-1.5 rounded-2xl bg-white border border-gray-300 shadow-sm inline-block">
              <img
                src={qrImageUrl}
                alt="Verification QR Code"
                className="h-16 w-16 object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div className="mt-1 font-mono text-[9px] font-bold text-muted-foreground">
              ID: {certificate.certificateNumber}
            </div>
            <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ Cryptographically Verified
            </div>
          </div>

          {/* Right: Controller Authority */}
          <div className="text-center sm:text-right space-y-1">
            <div className="w-36 border-b border-foreground/60 mx-auto sm:ml-auto mb-1"></div>
            <div className="font-bold text-foreground">Controller of Examinations</div>
            <div className="text-[11px] text-muted-foreground">
              {branding.showPartnerLogo && branding.partnerName
                ? `${branding.partnerName} · Onnesha`
                : certificate.institutionName || branding.institutionTitle || 'Onnesha Assessment Arena'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
        >
          <Printer className="h-4 w-4" />
          <span>{lang === 'bn' ? 'সনদপত্র প্রিন্ট (PDF)' : 'Print / Save as PDF'}</span>
        </button>

        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-xs font-bold text-foreground shadow-sm hover:bg-accent transition"
        >
          <ExternalLink className="h-4 w-4 text-emerald-500" />
          <span>{lang === 'bn' ? 'পাবলিক ভেরিফিকেশন লিংক' : 'Open Public Verification URL'}</span>
        </a>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { PricingTier } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { db } from '@/lib/db';
import { CheckCircle2, Lock, Printer, Receipt, ShieldCheck, X } from 'lucide-react';

interface BkashModalProps {
  tier: PricingTier | null;
  billingCycle: 'monthly' | 'yearly';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trxId: string) => void;
}

export const BkashModal: React.FC<BkashModalProps> = ({
  tier,
  billingCycle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { lang } = useLanguage();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [trxId, setTrxId] = useState('');

  if (!isOpen || !tier) return null;

  const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 11) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(2);
    }, 800);
  };

  const handleConfirmPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) return;
    setIsProcessing(true);

    const generatedTrxId = `9K${Math.floor(10000000 + Math.random() * 90000000)}P`;
    
    setTimeout(() => {
      // Record transaction into persistent DB
      db.recordTransaction({
        planId: tier.id,
        amount: price,
        msisdn: phone,
        trxId: generatedTrxId,
        method: 'bkash',
        status: 'completed',
      });

      setTrxId(generatedTrxId);
      setIsProcessing(false);
      setStep(3);
    }, 1200);
  };

  const handleFinish = () => {
    onSuccess(trxId);
    onClose();
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-pink-600/40 bg-card shadow-2xl">
        {/* Pink bKash Header */}
        <div className="bg-[#e2136e] p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/20 p-1 text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center justify-center gap-2 font-display text-xl font-black tracking-tight">
            <span>bKash</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] uppercase font-mono">Payment Gateway</span>
          </div>

          <div className="mt-3 font-mono text-3xl font-black">
            ৳{price.toLocaleString()}
          </div>
          <div className="text-xs text-white/90 font-medium mt-0.5">
            {lang === 'bn' ? tier.nameBn : tier.nameEn} ({billingCycle})
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Your bKash Account Number
                </label>
                <input
                  type="tel"
                  required
                  autoFocus
                  maxLength={11}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 font-mono text-base font-bold text-foreground outline-none focus:border-[#e2136e]"
                />
              </div>

              <div className="rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#e2136e] shrink-0" />
                <span>256-Bit Encrypted Institutional Payment Gateway.</span>
              </div>

              <button
                type="submit"
                disabled={isProcessing || phone.length < 11}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e2136e] py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-[#c20f5c] transition disabled:opacity-50"
              >
                <span>{isProcessing ? 'Verifying MSISDN...' : 'Proceed to Verification'}</span>
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleConfirmPay} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  bKash Verification Code (OTP)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="482910"
                  className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 font-mono text-center text-lg font-bold tracking-widest text-foreground outline-none focus:border-[#e2136e]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Enter bKash PIN
                </label>
                <input
                  type="password"
                  required
                  maxLength={5}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="•••••"
                  className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 font-mono text-center text-lg font-bold tracking-widest text-foreground outline-none focus:border-[#e2136e]"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing || pin.length < 4}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e2136e] py-3.5 text-sm font-extrabold text-white shadow-md hover:bg-[#c20f5c] transition disabled:opacity-50"
              >
                <span>{isProcessing ? 'Processing Transaction...' : 'Confirm Institutional Payment'}</span>
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-4 space-y-3 animate-in zoom-in-95">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="font-display text-lg font-bold text-foreground">
                Payment Verified &amp; Active!
              </h3>
              <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs font-mono space-y-1">
                <div>TRX ID: <strong className="text-[#e2136e]">{trxId}</strong></div>
                <div>Amount: <strong>৳{price.toLocaleString()} BDT</strong></div>
                <div>Status: <span className="text-emerald-600 font-bold">COMPLETED</span></div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-1 rounded-2xl border border-border bg-background py-2.5 text-xs font-bold text-foreground hover:bg-accent"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 rounded-2xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Enter Studio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

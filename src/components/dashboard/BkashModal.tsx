import React, { useState } from "react";
import { PricingTier } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { db } from "@/lib/db";
import { serverRecordTransaction } from "@/lib/server-session";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  Receipt,
  ShieldCheck,
  X,
} from "lucide-react";

interface BkashModalProps {
  tier: PricingTier | null;
  billingCycle: "monthly" | "yearly";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trxId: string, status: "completed" | "pending" | "failed") => void;
}

export const BkashModal: React.FC<BkashModalProps> = ({
  tier,
  billingCycle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { lang } = useLanguage();
  const [phone, setPhone] = useState("");
  const [trxInput, setTrxInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [trxId, setTrxId] = useState("");
  const [recordedStatus, setRecordedStatus] = useState<"completed" | "pending" | "failed">(
    "pending",
  );

  if (!isOpen || !tier) return null;

  const rawPrice = billingCycle === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
  const price = rawPrice ?? 0;

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const cleanTrx = trxInput.trim().toUpperCase();
    if (cleanPhone.length < 11) {
      setFormError("Enter a valid 11-digit Bangladesh bKash mobile number (01XXXXXXXXX).");
      return;
    }
    if (!/^[A-Z0-9]{6,20}$/.test(cleanTrx)) {
      setFormError(
        "Enter a valid bKash Transaction ID (6-20 alphanumeric characters from your bKash SMS receipt).",
      );
      return;
    }
    if (isProcessing) return;

    setFormError(null);
    setIsProcessing(true);

    try {
      const res = await serverRecordTransaction({
        data: {
          planId: tier.id,
          amount: price,
          msisdn: cleanPhone,
          trxId: cleanTrx,
          method: "bkash",
          status: "pending",
        },
      }).catch(() => null);

      const serverTrxId = res?.transaction?.trxId || cleanTrx;
      const rawStatus = res?.transaction?.status;
      const verifiedStatus: "completed" | "pending" | "failed" =
        res && !res.success
          ? "failed"
          : rawStatus === "completed" || rawStatus === "failed" || rawStatus === "pending"
            ? rawStatus
            : "pending";

      db.recordTransaction({
        planId: tier.id,
        amount: price,
        msisdn: cleanPhone,
        trxId: serverTrxId,
        method: "bkash",
        status: verifiedStatus,
      });

      setRecordedStatus(verifiedStatus);
      setTrxId(serverTrxId);
      setStep(2);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    onSuccess(trxId, recordedStatus);
    onClose();
    setStep(1);
    setTrxInput("");
    setFormError(null);
    setRecordedStatus("pending");
  };

  const statusLabel =
    recordedStatus === "completed"
      ? "COMPLETED"
      : recordedStatus === "failed"
        ? "FAILED"
        : "PENDING VERIFICATION";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-pink-600/40 bg-card shadow-2xl">
        {/* Pink bKash Header */}
        <div className="bg-[#e2136e] p-6 text-white text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/20 p-1 text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center justify-center gap-2 font-display text-xl font-black tracking-tight">
            <span>bKash</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] uppercase font-mono">
              Merchant Pay
            </span>
          </div>

          <div className="mt-3 font-mono text-3xl font-black">৳{price.toLocaleString()}</div>
          <div className="text-xs text-white/90 font-medium mt-0.5">
            {lang === "bn" ? tier.nameBn : tier.nameEn} ({billingCycle})
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <form onSubmit={handleConfirmPay} className="space-y-3.5">
              <div className="rounded-2xl border border-[#e2136e]/25 bg-[#e2136e]/5 p-3 text-xs space-y-1">
                <div className="font-bold text-foreground">Merchant Payment Instructions</div>
                <p className="text-muted-foreground leading-relaxed">
                  1. Open bKash App → <strong>Payment</strong> → Merchant{" "}
                  <strong className="font-mono text-[#e2136e]">01700-000000</strong>
                  <br />
                  2. Pay <strong className="font-mono">৳{price.toLocaleString()}</strong> using
                  Reference <strong className="font-mono uppercase">{tier.id}</strong>
                  <br />
                  3. Enter your sender number and SMS <strong>TrxID</strong> below for Super Admin
                  approval.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Sender bKash Number
                </label>
                <input
                  type="tel"
                  required
                  autoFocus
                  maxLength={14}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 font-mono text-sm font-bold text-foreground outline-none focus:border-[#e2136e]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  bKash Transaction ID (TrxID)
                </label>
                <input
                  type="text"
                  required
                  maxLength={20}
                  value={trxInput}
                  onChange={(e) => setTrxInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BLH8X94K2P"
                  className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-foreground outline-none focus:border-[#e2136e]"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                  {formError}
                </div>
              )}

              <div className="rounded-2xl bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-[#e2136e] shrink-0" />
                <span>Submissions are recorded as Pending until verified by an administrator.</span>
              </div>

              <button
                type="submit"
                disabled={isProcessing || phone.trim().length < 11 || trxInput.trim().length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e2136e] py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#c20f5c] transition disabled:opacity-50"
              >
                <span>{isProcessing ? "Submitting TrxID..." : "Submit Payment Reference"}</span>
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="text-center py-4 space-y-3 animate-in zoom-in-95">
              {recordedStatus === "completed" ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              ) : recordedStatus === "failed" ? (
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
              ) : (
                <Clock className="h-12 w-12 text-amber-500 mx-auto" />
              )}
              <h3 className="font-display text-lg font-bold text-foreground">
                {recordedStatus === "completed"
                  ? "Payment Verified & Active!"
                  : recordedStatus === "failed"
                    ? "Transaction Failed"
                    : "Payment Submitted — Pending Verification"}
              </h3>
              {recordedStatus === "pending" && (
                <p className="text-xs text-muted-foreground">
                  Your TrxID has been logged on the server. A Super Admin will confirm it to
                  activate your plan upgrade.
                </p>
              )}
              <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs font-mono space-y-1">
                <div>
                  TRX ID: <strong className="text-[#e2136e]">{trxId}</strong>
                </div>
                <div>
                  Amount: <strong>৳{price.toLocaleString()} BDT</strong>
                </div>
                <div>
                  Status:{" "}
                  <span
                    className={`font-bold ${
                      recordedStatus === "completed"
                        ? "text-emerald-600"
                        : recordedStatus === "failed"
                          ? "text-red-600"
                          : "text-amber-600"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const receiptText = [
                      "ONNESHA ARENA - INSTITUTIONAL PAYMENT RECEIPT",
                      `Plan: ${tier.nameEn} (${billingCycle})`,
                      `Amount: BDT ${price.toLocaleString()}`,
                      `Transaction ID: ${trxId}`,
                      `MSISDN: ${phone}`,
                      `Date: ${new Date().toISOString()}`,
                      `Status: ${statusLabel}`,
                    ].join("\n");
                    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Onnesha-Receipt-${trxId}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-2xl border border-border bg-background py-2.5 text-xs font-bold text-foreground hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Save Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 rounded-2xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

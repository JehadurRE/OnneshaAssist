import React, { useEffect, useState } from "react";
import {
  EMAIL_TEMPLATE_CATALOG,
  type EmailTemplateId,
} from "@/lib/email-templates";
import {
  serverGetEmailTemplatePreview,
  serverSendTestEmail,
} from "@/lib/server-session";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Monitor,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";

export function EmailTemplatesStudio(props: {
  onNotice?: ((msg: string) => void) | undefined;
  defaultTestEmail?: string | undefined;
}) {
  const [selectedId, setSelectedId] = useState<EmailTemplateId>("student_credentials");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [providers, setProviders] = useState<{ resend: boolean; brevo: boolean }>({
    resend: false,
    brevo: false,
  });
  const [testTo, setTestTo] = useState(props.defaultTestEmail || "");
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    serverGetEmailTemplatePreview({ data: { templateId: selectedId } })
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setSubject(res.subject);
          setHtml(res.html);
          setFromEmail(res.fromEmail);
          setProviders(res.emailProviders);
        } else {
          setFeedback({ tone: "err", text: res.error || "Could not load email preview." });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFeedback({
            tone: "err",
            text: err instanceof Error ? err.message : "Preview failed.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo.trim() || sendingTest) return;
    setSendingTest(true);
    setFeedback(null);
    try {
      const res = await serverSendTestEmail({
        data: { to: testTo.trim(), templateId: selectedId },
      });
      if (res.success) {
        const msg = `Test email sent to ${res.to} via ${res.provider}.`;
        setFeedback({ tone: "ok", text: msg });
        props.onNotice?.(msg);
      } else {
        setFeedback({ tone: "err", text: res.error || "Failed to send test email." });
      }
    } catch (err) {
      setFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Failed to send test email.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const activeMeta =
    EMAIL_TEMPLATE_CATALOG.find((t) => t.id === selectedId) || EMAIL_TEMPLATE_CATALOG[0]!;

  return (
    <div className="staff-panel space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="staff-panel-title flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <span>Transactional Email Templates Studio</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Branded, Gmail/Outlook/mobile-tested HTML templates used automatically for student
            credentials, certificates, password resets, and OTP verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
              providers.resend
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                providers.resend ? "bg-emerald-500" : "bg-muted-foreground"
              }`}
            />
            Resend {providers.resend ? "Ready" : "Off"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
              providers.brevo
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                providers.brevo ? "bg-emerald-500" : "bg-muted-foreground"
              }`}
            />
            Brevo Fallback {providers.brevo ? "Ready" : "Off"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Template Picker + Send Test */}
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-1.5">
            {EMAIL_TEMPLATE_CATALOG.map((tpl) => {
              const active = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedId(tpl.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition ${
                    active
                      ? "border-primary bg-primary/8 shadow-xs"
                      : "border-border bg-background/60 hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-foreground">{tpl.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    {tpl.description}
                  </p>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleSendTest}
            className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3"
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Send Live Test Email</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Send a sample of <strong>{activeMeta.label}</strong> to inspect real inbox rendering
              and confirm Resend/Brevo delivery.
            </p>
            <input
              type="email"
              required
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="your-inbox@gmail.com"
              className="staff-input text-xs font-medium"
            />
            <button
              type="submit"
              disabled={sendingTest || !testTo.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {sendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{sendingTest ? "Sending test..." : "Send Test Email"}</span>
            </button>
            {feedback && (
              <div
                className={`rounded-xl border px-3 py-2 text-[11px] font-semibold flex items-start gap-1.5 ${
                  feedback.tone === "ok"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-destructive/35 bg-destructive/10 text-destructive"
                }`}
              >
                {feedback.tone === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                <span>{feedback.text}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right: Live Inbox Frame */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-border bg-muted/35 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-[11px] text-muted-foreground truncate">
                <span className="font-bold">From:</span>{" "}
                <span className="font-mono">{fromEmail || "Onnesha Arena"}</span>
              </div>
              <div className="text-xs font-extrabold text-foreground truncate">
                <span className="font-semibold text-muted-foreground">Subject:</span>{" "}
                {subject || "Loading preview…"}
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-border bg-background p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewport("desktop")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  viewport === "desktop"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setViewport("mobile")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  viewport === "mobile"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          <div className="flex-1 flex justify-center p-4 overflow-auto min-h-[540px] bg-[#e8efec] dark:bg-slate-900/60">
            {loading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground self-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Rendering template preview…</span>
              </div>
            ) : (
              <iframe
                title={`Preview: ${activeMeta.label}`}
                srcDoc={html}
                sandbox="allow-same-origin"
                className="bg-white rounded-xl shadow-md border border-slate-200 transition-all duration-300"
                style={{
                  width: viewport === "mobile" ? "375px" : "100%",
                  maxWidth: "660px",
                  minHeight: "560px",
                  height: "620px",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

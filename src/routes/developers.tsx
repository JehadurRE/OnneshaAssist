import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { db } from "@/lib/db";
import { Check, CheckCircle2, Code2, Copy, Key, Play, RefreshCw, Send, Terminal, Webhook } from "lucide-react";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developer API & LMS Integrations · Onnesha Arena" },
      { name: "description", content: "REST APIs, Webhooks, and LTI 1.3 integration documentation." },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  const { lang } = useLanguage();
  const [apiKey, setApiKey] = useState("onn_live_9k28al90p482910");
  const [copied, setCopied] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<"get_quizzes" | "get_certificate" | "get_roster">("get_quizzes");
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateKey = () => {
    const newKey = `onn_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    setApiKey(newKey);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunApiTest = () => {
    setIsLoading(true);
    setTimeout(() => {
      if (selectedEndpoint === "get_quizzes") {
        const data = db.getQuizzes().slice(0, 3).map((q) => ({
          id: q.id,
          slug: q.slug,
          title: q.titleEn,
          category: q.categoryEn,
          questionCount: q.questions.length,
        }));
        setApiResponse(JSON.stringify({ status: "success", count: data.length, data }, null, 2));
      } else if (selectedEndpoint === "get_certificate") {
        const certs = db.getCertificates();
        setApiResponse(JSON.stringify({ status: "success", count: certs.length, certificates: certs.slice(0, 5) }, null, 2));
      } else {
        const roster = db.getRoster().slice(0, 3);
        setApiResponse(JSON.stringify({ status: "success", count: roster.length, roster }, null, 2));
      }
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 py-12 space-y-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm mb-3">
            <Code2 className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            {lang === "bn" ? "ডেভেলপার API ও ইন্টিগ্রেশন" : "Developer API & Sandbox"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {lang === "bn"
              ? "আপনার স্কুল বা প্রতিষ্ঠানের নিজস্ব LMS, Moodle বা কাস্টম পোর্টালে অন্বেষা কুইজ ও মেধা তালিকা যুক্ত করুন।"
              : "Integrate live quizzes, assessments, and verifiable certificates into your custom portal or Moodle LMS."}
          </p>
        </div>

        {/* API Key Manager Card */}
        <div className="bento-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">Active Production API Key</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Use this token in your Authorization Bearer header.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="font-mono text-xs font-bold bg-muted/60 px-3 py-2 rounded-xl border border-border">
                {apiKey}
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className="rounded-xl border border-border p-2 text-foreground hover:bg-accent"
                title="Copy API Key"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleGenerateKey}
                className="rounded-xl border border-border p-2 text-foreground hover:bg-accent"
                title="Rotate API Key"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* API Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <Key className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-display text-sm font-bold text-foreground">REST JSON API</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Create quizzes, fetch candidate scorecards, and query rankings via SQLite-backed JSON endpoints.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <Webhook className="h-5 w-5 text-emerald-500 mb-2" />
            <h3 className="font-display text-sm font-bold text-foreground">Instant Webhooks</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Receive live webhook events when a candidate finishes an exam or when an invigilator confirms an OMR batch.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <Terminal className="h-5 w-5 text-amber-500 mb-2" />
            <h3 className="font-display text-sm font-bold text-foreground">LTI 1.3 Advantage</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Native single-sign-on integration for Canvas, Blackboard, and Moodle LMS platforms.
            </p>
          </div>
        </div>

        {/* Interactive API Sandbox Playground */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <span>Interactive REST API Sandbox</span>
              </h3>
              <p className="text-xs text-muted-foreground">Test live database queries against the local SQLite engine.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value as any)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value="get_quizzes">GET /v1/quizzes</option>
                <option value="get_certificate">GET /v1/certificates/ONN-4821-9982</option>
                <option value="get_roster">GET /v1/roster</option>
              </select>

              <button
                type="button"
                onClick={handleRunApiTest}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>{isLoading ? "Executing..." : "Execute Query"}</span>
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-2xl bg-muted/60 p-4 font-mono text-xs text-foreground leading-relaxed max-h-72 overflow-y-auto">
            {apiResponse ||
`// Click "Execute Query" above to test response from live SQLite repository.
{
  "endpoint": "${selectedEndpoint}",
  "authenticated": true,
  "status": "ready"
}`}
          </pre>
        </div>
      </main>

      <Footer />
    </div>
  );
}

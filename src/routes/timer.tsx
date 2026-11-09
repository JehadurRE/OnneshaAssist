import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import ccai from "@/assets/ccai.png.asset.json";
import learningBd from "@/assets/learning-bd.png.asset.json";
import onnesha from "@/assets/onnesha.jpg.asset.json";
import { useBranding } from "@/hooks/use-branding";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/timer")({
  head: () => ({
    meta: [
      { title: "Exam Countdown Timer — Onnesha Assessment Arena" },
      {
        name: "description",
        content:
          "Projector-ready examination countdown timer by Onnesha LMS, Learning Bangladesh, and Cloud Connect AI.",
      },
    ],
  }),
  component: TimerPage,
});

const PRESETS = [5, 10, 15, 30, 45, 60, 90, 120];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function TimerPage() {
  const { lang } = useLanguage();
  const branding = useBranding();
  const [total, setTotal] = useState(30 * 60);
  const [left, setLeft] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [minsInput, setMinsInput] = useState("30");
  const [secsInput, setSecsInput] = useState("0");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setRunning(false);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const apply = useCallback((seconds: number) => {
    const s = Math.max(0, Math.min(seconds, 24 * 3600));
    setTotal(s);
    setLeft(s);
    setRunning(false);
    setMinsInput(String(Math.floor(s / 60)));
    setSecsInput(String(s % 60));
  }, []);

  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pct = total > 0 ? (left / total) * 100 : 0;
  const finished = left === 0;
  const warn = !finished && left <= Math.max(60, total * 0.1);

  return (
    <div
      ref={shellRef}
      className={`min-h-screen bg-background text-foreground bg-grid flex flex-col ${
        isFullscreen ? "max-h-screen overflow-hidden" : ""
      }`}
    >
      {!isFullscreen && <Navbar />}

      <main
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 sm:px-6 ${
          isFullscreen ? "justify-center gap-3 py-3" : "gap-8 py-10"
        }`}
      >
        {/* Timer Header on normal view */}
        {!isFullscreen && (
          <div className="w-full flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
            <div className="flex items-center gap-3">
              <img src={onnesha.url} alt="Onnesha LMS" className="h-9 rounded-md object-contain" />
              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <>
                  <span className="text-muted-foreground font-mono text-xs font-bold">×</span>
                  <img
                    src={branding.partnerLogoUrl}
                    alt={branding.partnerName || "Joint Partner"}
                    className="h-9 max-w-[120px] rounded-md object-contain"
                  />
                </>
              )}
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">
                  {branding.showPartnerLogo && branding.partnerName
                    ? `${branding.partnerName} · Exam Hall Timer`
                    : branding.institutionTitle || "Onnesha Assessment — Exam Hall Timer"}
                </h1>
                <p className="text-xs text-muted-foreground">Official Examination Clock · Onnesha LMS &amp; CCAI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <img src={learningBd.url} alt="Learning Bangladesh" className="h-6 object-contain" />
              <img src={ccai.url} alt="Cloud Connect AI Limited" className="h-6 object-contain" />
            </div>
          </div>
        )}

        {/* Big Countdown Display Section */}
        <section className={`w-full ${isFullscreen ? "flex flex-1 flex-col justify-center" : ""}`}>
          <div
            className={`relative overflow-hidden rounded-3xl border text-center shadow-glow transition-colors ${
              isFullscreen ? "p-5" : "p-8 sm:p-12"
            } ${
              finished
                ? "border-destructive/60 bg-destructive/10"
                : warn
                  ? "border-warning/60 bg-warning/10"
                  : "border-border bg-card"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground ${
                isFullscreen ? "text-[10px]" : ""
              }`}
            >
              {finished
                ? (lang === 'bn' ? 'সময় সমাপ্ত — লেখা বন্ধ করুন' : 'Time is over — stop writing')
                : running
                  ? (lang === 'bn' ? 'পরীক্ষা চলছে' : 'Exam in progress')
                  : (lang === 'bn' ? 'প্রস্তুত' : 'Ready')}
            </p>

            <div
              className={`font-mono font-bold leading-none tabular-nums tracking-tight text-foreground ${
                isFullscreen
                  ? "mt-3 text-[clamp(3rem,14vh,9rem)]"
                  : "mt-6 text-[clamp(3.5rem,15vw,10rem)]"
              }`}
            >
              {h > 0 ? `${pad(h)}:` : ""}
              {pad(m)}:{pad(s)}
            </div>

            {/* Progress Bar */}
            <div
              className={`mx-auto h-2.5 w-full max-w-3xl overflow-hidden rounded-full bg-muted ${
                isFullscreen ? "mt-4" : "mt-8"
              }`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                  finished ? "bg-destructive" : warn ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Controls */}
            <div
              className={`flex flex-wrap items-center justify-center gap-3 ${
                isFullscreen ? "mt-4" : "mt-8"
              }`}
            >
              <button
                onClick={() => left > 0 && setRunning((r) => !r)}
                className="rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-40"
                disabled={left === 0}
              >
                {running ? (lang === 'bn' ? 'থামুন' : 'Pause') : (lang === 'bn' ? 'শুরু করুন' : 'Start')}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setLeft(total);
                }}
                className="rounded-2xl border border-border bg-card px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground shadow-sm transition hover:bg-accent"
              >
                {lang === 'bn' ? 'রিসেট' : 'Reset'}
              </button>
              <button
                onClick={() => {
                  const el = shellRef.current;
                  if (!document.fullscreenElement) el?.requestFullscreen?.();
                  else document.exitFullscreen();
                }}
                className="rounded-2xl border border-border bg-card px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground shadow-sm transition hover:bg-accent"
              >
                {isFullscreen ? (lang === 'bn' ? 'ফুলস্ক্রিন বন্ধ' : 'Exit Fullscreen') : (lang === 'bn' ? 'ফুলস্ক্রিন' : 'Fullscreen')}
              </button>
            </div>
          </div>
        </section>

        {/* Set Duration Controls */}
        <section
          className={`w-full rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm ${
            isFullscreen ? "hidden" : ""
          }`}
        >
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {lang === 'bn' ? 'পরীক্ষার সময়সীমা নির্বাচন করুন' : 'Set Exam Duration'}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => apply(p * 60)}
                className={`rounded-full border px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                  total === p * 60
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {p} min
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold">
              <span className="mb-1 block text-muted-foreground">{lang === 'bn' ? 'মিনিট' : 'Minutes'}</span>
              <input
                type="number"
                min={0}
                value={minsInput}
                onChange={(e) => setMinsInput(e.target.value)}
                className="w-28 rounded-xl border border-input bg-background px-3 py-2 font-mono text-base font-bold tabular-nums text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="text-xs font-semibold">
              <span className="mb-1 block text-muted-foreground">{lang === 'bn' ? 'সেকেন্ড' : 'Seconds'}</span>
              <input
                type="number"
                min={0}
                max={59}
                value={secsInput}
                onChange={(e) => setSecsInput(e.target.value)}
                className="w-28 rounded-xl border border-input bg-background px-3 py-2 font-mono text-base font-bold tabular-nums text-foreground outline-none focus:border-primary"
              />
            </label>
            <button
              onClick={() =>
                apply((parseInt(minsInput || "0", 10) || 0) * 60 + (parseInt(secsInput || "0", 10) || 0))
              }
              className="rounded-xl bg-secondary px-6 py-2.5 text-xs font-bold text-secondary-foreground shadow-sm transition hover:opacity-90"
            >
              {lang === 'bn' ? 'প্রয়োগ করুন' : 'Apply Duration'}
            </button>
          </div>
        </section>
      </main>

      {!isFullscreen && <Footer />}
    </div>
  );
}

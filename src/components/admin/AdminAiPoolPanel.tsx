import React, { useEffect, useState } from "react";
import {
  AI_CAPABILITY_LIST,
  AI_CAPABILITY_META,
  AI_PROVIDER_CATALOG,
  AI_PROVIDER_LIST,
} from "@/lib/ai-pool";
import {
  serverDeleteAiPoolNode,
  serverGetAiPoolConfig,
  serverResetAiPoolTelemetry,
  serverSaveAiPoolPolicy,
  serverTestAiPoolNode,
  serverUpsertAiPoolNode,
} from "@/lib/server-session";
import type {
  AiPoolRoutingStrategy,
  AiProviderId,
  AiTaskCapability,
  SanitizedAiPoolConfig,
  SanitizedAiPoolNode,
} from "@/lib/types";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Gauge,
  KeyRound,
  Layers,
  Loader2,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";

const STRATEGY_META: Array<{
  id: AiPoolRoutingStrategy;
  title: string;
  desc: string;
}> = [
  {
    id: "priority_failover",
    title: "Priority Failover",
    desc: "Always routes to Priority #1 first; transparently fails over on 429/5xx/timeout.",
  },
  {
    id: "round_robin",
    title: "Round Robin",
    desc: "Distributes requests evenly across all healthy enabled keys/providers.",
  },
  {
    id: "weighted_random",
    title: "Weighted Pool",
    desc: "Routes proportionally by node weight (great for mixing free & paid tiers).",
  },
  {
    id: "fastest_latency",
    title: "Fastest Latency",
    desc: "Automatically prefers the healthy node with the lowest measured response time.",
  },
];

interface NodeFormState {
  id?: string;
  label: string;
  provider: AiProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModelsCsv: string;
  enabled: boolean;
  priority: number;
  weight: number;
  capabilities: AiTaskCapability[];
  notes: string;
}

function defaultNodeForm(provider: AiProviderId = "openrouter", nextPriority = 1): NodeFormState {
  const preset = AI_PROVIDER_CATALOG[provider];
  return {
    label: `${preset.name} Primary`,
    provider,
    apiKey: "",
    baseUrl: preset.defaultBaseUrl,
    model: preset.defaultModel,
    fallbackModelsCsv:
      provider === "openrouter"
        ? "openai/gpt-4.1-mini, deepseek/deepseek-chat-v3-0324"
        : provider === "gemini"
          ? "gemini-2.0-flash"
          : "",
    enabled: true,
    priority: nextPriority,
    weight: 10,
    capabilities: [],
    notes: "",
  };
}

function StatusBadge({ status }: { status: SanitizedAiPoolNode["status"] }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Healthy
      </span>
    );
  }
  if (status === "cooldown") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <PauseCircle className="h-3 w-3" />
        Cooldown
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-destructive">
        <XCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      Untested
    </span>
  );
}

export function AdminAiPoolPanel(props: {
  readOnly?: boolean;
  onConfigUpdated?: () => void;
}) {
  const [config, setConfig] = useState<SanitizedAiPoolConfig | null>(null);
  const [role, setRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Policy draft
  const [strategy, setStrategy] = useState<AiPoolRoutingStrategy>("priority_failover");
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [maxFailoverAttempts, setMaxFailoverAttempts] = useState(5);
  const [defaultTimeoutMs, setDefaultTimeoutMs] = useState(45000);
  const [taskRoutes, setTaskRoutes] = useState<Partial<Record<AiTaskCapability, string>>>({});
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Node modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NodeFormState>(() => defaultNodeForm("openrouter", 1));
  const [savingNode, setSavingNode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Live pings
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [resettingStats, setResettingStats] = useState(false);

  const canEdit = !props.readOnly && role === "admin";

  const flash = (tone: "ok" | "err", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => {
      setNotice((cur) => (cur?.text === text ? null : cur));
    }, 5500);
  };

  const applyConfig = (cfg: SanitizedAiPoolConfig) => {
    setConfig(cfg);
    setStrategy(cfg.strategy);
    setCooldownSeconds(cfg.cooldownSeconds);
    setMaxFailoverAttempts(cfg.maxFailoverAttempts);
    setDefaultTimeoutMs(cfg.defaultTimeoutMs);
    setTaskRoutes(cfg.taskPreferredNodeIds || {});
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await serverGetAiPoolConfig();
      if (res.success && res.config) {
        setRole(res.role);
        applyConfig(res.config);
      } else if (!res.success) {
        flash("err", res.error || "Could not load AI Pool configuration.");
      }
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Failed to load AI Pool.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const openAddModal = (provider: AiProviderId = "openrouter") => {
    const nextPriority = (config?.nodes.filter((n) => !n.readOnly).length || 0) + 1;
    setForm(defaultNodeForm(provider, nextPriority));
    setModalOpen(true);
  };

  const openEditModal = (node: SanitizedAiPoolNode) => {
    setForm({
      id: node.id,
      label: node.label,
      provider: node.provider,
      apiKey: "",
      baseUrl: node.baseUrl || AI_PROVIDER_CATALOG[node.provider].defaultBaseUrl,
      model: node.model,
      fallbackModelsCsv: (node.fallbackModels || []).join(", "),
      enabled: node.enabled,
      priority: node.priority,
      weight: node.weight,
      capabilities: node.capabilities || [],
      notes: node.notes || "",
    });
    setModalOpen(true);
  };

  const handleProviderSelectInModal = (provider: AiProviderId) => {
    const preset = AI_PROVIDER_CATALOG[provider];
    setForm((prev) => ({
      ...prev,
      provider,
      label: prev.id ? prev.label : `${preset.name} Node`,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
      fallbackModelsCsv:
        provider === "openrouter"
          ? "openai/gpt-4.1-mini, deepseek/deepseek-chat-v3-0324"
          : provider === "gemini"
            ? "gemini-2.0-flash"
            : "",
    }));
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingNode(true);
    try {
      const fallbackModels = form.fallbackModelsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await serverUpsertAiPoolNode({
        data: {
          id: form.id,
          label: form.label.trim(),
          provider: form.provider,
          apiKey: form.apiKey.trim() || undefined,
          baseUrl: form.baseUrl.trim() || undefined,
          model: form.model.trim(),
          fallbackModels,
          enabled: form.enabled,
          priority: form.priority,
          weight: form.weight,
          capabilities: form.capabilities.length > 0 ? form.capabilities : undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      if (!res.success || !res.config) {
        flash("err", res.error || "Failed to save AI Pool node.");
        return;
      }
      applyConfig(res.config);
      setModalOpen(false);
      props.onConfigUpdated?.();
      flash("ok", form.id ? `Updated "${form.label}".` : `Added "${form.label}" to AI Pool.`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Failed to save node.");
    } finally {
      setSavingNode(false);
    }
  };

  const handleToggleNode = async (node: SanitizedAiPoolNode) => {
    if (!canEdit || node.readOnly) return;
    const res = await serverUpsertAiPoolNode({
      data: {
        id: node.id,
        label: node.label,
        provider: node.provider,
        baseUrl: node.baseUrl,
        model: node.model,
        fallbackModels: node.fallbackModels,
        enabled: !node.enabled,
        priority: node.priority,
        weight: node.weight,
        capabilities: node.capabilities,
        notes: node.notes,
      },
    });
    if (res.success && res.config) {
      applyConfig(res.config);
      props.onConfigUpdated?.();
    }
  };

  const handleAdjustPriority = async (node: SanitizedAiPoolNode, delta: number) => {
    if (!canEdit || node.readOnly) return;
    const nextPriority = Math.max(1, node.priority + delta);
    const res = await serverUpsertAiPoolNode({
      data: {
        id: node.id,
        label: node.label,
        provider: node.provider,
        baseUrl: node.baseUrl,
        model: node.model,
        fallbackModels: node.fallbackModels,
        enabled: node.enabled,
        priority: nextPriority,
        weight: node.weight,
        capabilities: node.capabilities,
        notes: node.notes,
      },
    });
    if (res.success && res.config) {
      applyConfig(res.config);
    }
  };

  const handleDeleteNode = async (id: string) => {
    if (!canEdit) return;
    const res = await serverDeleteAiPoolNode({ data: { id } });
    if (res.success && res.config) {
      applyConfig(res.config);
      setConfirmDeleteId(null);
      props.onConfigUpdated?.();
      flash("ok", "Removed node from AI Pool.");
    } else {
      flash("err", res.error || "Could not delete node.");
    }
  };

  const handleTestNode = async (nodeId: string) => {
    setTestingNodeId(nodeId);
    try {
      const res = await serverTestAiPoolNode({ data: { nodeId } });
      if (res.success && res.config) {
        applyConfig(res.config);
        const first = res.results?.[0];
        if (first?.ok) {
          flash("ok", `✓ ${first.label} (${first.model}) responded in ${first.latencyMs}ms.`);
        } else {
          flash("err", `✗ ${first?.label || "Node"} failed: ${first?.error || "Unknown error"}`);
        }
      } else {
        flash("err", res.error || "Ping failed.");
      }
    } finally {
      setTestingNodeId(null);
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const res = await serverTestAiPoolNode({ data: { testAll: true } });
      if (res.success && res.config) {
        applyConfig(res.config);
        const passed = (res.results || []).filter((r) => r.ok).length;
        const total = (res.results || []).length;
        flash(
          passed === total ? "ok" : "err",
          `Health check completed: ${passed}/${total} pool nodes healthy.`,
        );
      } else {
        flash("err", res.error || "No active pool nodes to test.");
      }
    } finally {
      setTestingAll(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!canEdit) return;
    setSavingPolicy(true);
    try {
      const res = await serverSaveAiPoolPolicy({
        data: {
          strategy,
          cooldownSeconds,
          maxFailoverAttempts,
          defaultTimeoutMs,
          taskPreferredNodeIds: taskRoutes,
        },
      });
      if (res.success && res.config) {
        applyConfig(res.config);
        props.onConfigUpdated?.();
        flash("ok", "Saved AI Pool routing strategy, circuit breaker, and capability routes.");
      } else {
        flash("err", res.error || "Could not save routing policy.");
      }
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleResetStats = async () => {
    if (!canEdit) return;
    setResettingStats(true);
    try {
      const res = await serverResetAiPoolTelemetry();
      if (res.success && res.config) {
        applyConfig(res.config);
        flash("ok", "Cleared AI Pool cooldowns, counters, and execution log.");
      }
    } finally {
      setResettingStats(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="staff-panel flex items-center gap-3 py-10 justify-center text-xs font-semibold text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading Multi-Provider AI Pool &amp; Telemetry…</span>
      </div>
    );
  }

  const summary = config?.summary;
  const isOnline = (summary?.enabledNodes || 0) > 0;
  const activePreset = AI_PROVIDER_CATALOG[form.provider];

  return (
    <div className="space-y-6 staff-surface animate-in fade-in">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-violet-500/10 p-5 sm:p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  isOnline
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
                />
                {isOnline
                  ? `AI Gateway Online · ${summary?.enabledNodes} Active Node${summary?.enabledNodes === 1 ? "" : "s"}`
                  : "AI Gateway Offline · Add a Provider"}
              </span>
              <span className="rounded-full border border-border bg-card/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                10 Providers · Auto-Failover · Circuit Breaker
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <span>AI Pool &amp; Multi-Provider Orchestration Hub</span>
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Pool API keys across OpenRouter (300+ models), Google Gemini, OpenAI, Anthropic
              Claude, Groq, DeepSeek, Mistral, xAI Grok, Together AI, or self-hosted Ollama/vLLM
              with automatic 429/5xx failover and live latency telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="staff-btn-ghost text-xs"
              title="Refresh telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              disabled={testingAll || !isOnline}
              onClick={() => void handleTestAll()}
              className="staff-btn-ghost text-xs disabled:opacity-40"
            >
              {testingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span>{testingAll ? "Pinging…" : "Ping All Nodes"}</span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => openAddModal("openrouter")}
                className="staff-btn-primary text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Add AI Pool Node</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LIVE NOTICE BANNER */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold animate-in fade-in ${
            notice.tone === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.tone === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI TELEMETRY STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="staff-metric">
          <div className="flex items-center justify-between">
            <span className="staff-metric-label">Active Pool Nodes</span>
            <Server className="h-4 w-4 staff-metric-icon" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-foreground">
              {summary?.enabledNodes ?? 0}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              / {summary?.totalNodes ?? 0} configured
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {summary?.healthyNodes ?? 0} ready · {summary?.cooldownNodes ?? 0} cooling down
          </div>
        </div>

        <div className="staff-metric">
          <div className="flex items-center justify-between">
            <span className="staff-metric-label">Success Rate</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {summary?.successRatePct ?? 100}%
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              ({summary?.totalRequests ?? 0} calls)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {summary?.totalFailures ?? 0} failed / failovers handled
          </div>
        </div>

        <div className="staff-metric">
          <div className="flex items-center justify-between">
            <span className="staff-metric-label">Avg Pool Latency</span>
            <Gauge className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-foreground">
              {summary?.avgLatencyMs ? `${summary.avgLatencyMs}ms` : "—"}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Exponential moving average across nodes
          </div>
        </div>

        <div className="staff-metric">
          <div className="flex items-center justify-between">
            <span className="staff-metric-label">Connected Providers</span>
            <Layers className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(summary?.providersActive || []).length > 0 ? (
              summary!.providersActive.map((pid) => (
                <span
                  key={pid}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${AI_PROVIDER_CATALOG[pid].accentClass}`}
                >
                  {AI_PROVIDER_CATALOG[pid].shortName}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">None connected</span>
            )}
          </div>
        </div>
      </div>

      {/* POOL NODES DECK */}
      <section className="staff-panel space-y-4">
        <div className="staff-panel-header">
          <div>
            <h3 className="staff-panel-title flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>AI Provider Pool Nodes ({config?.nodes.length || 0})</span>
            </h3>
            <p className="staff-panel-desc">
              Add multiple keys and providers (e.g., 2 OpenRouter keys + Gemini + Groq). Keys are
              stored server-side only and masked in the UI.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-1.5">
              {(["openrouter", "gemini", "openai", "anthropic", "groq", "deepseek", "custom"] as AiProviderId[]).map(
                (pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => openAddModal(pid)}
                    className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold transition hover:brightness-95 ${AI_PROVIDER_CATALOG[pid].accentClass}`}
                  >
                    + {AI_PROVIDER_CATALOG[pid].shortName}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {!config?.nodes.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-base font-extrabold text-foreground">
                No AI Providers Connected Yet
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Start with OpenRouter (1 key unlocks Claude, GPT-4.1, Gemini 2.5, DeepSeek, Llama
                4 &amp; free models), or add direct keys for Gemini, OpenAI, Anthropic, Groq, or
                local Ollama.
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddModal("openrouter")}
                  className="staff-btn-primary text-xs"
                >
                  <Plus className="h-4 w-4" />
                  Connect OpenRouter
                </button>
                <button
                  type="button"
                  onClick={() => openAddModal("gemini")}
                  className="staff-btn-ghost text-xs"
                >
                  Connect Google Gemini
                </button>
                <button
                  type="button"
                  onClick={() => openAddModal("groq")}
                  className="staff-btn-ghost text-xs"
                >
                  Connect Groq (Ultra Fast)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            {config.nodes.map((node) => {
              const preset = AI_PROVIDER_CATALOG[node.provider];
              const isTesting = testingNodeId === node.id;
              return (
                <div
                  key={node.id}
                  className={`rounded-2xl border p-4 transition-all space-y-3 ${
                    node.enabled
                      ? "border-border bg-card shadow-xs hover:border-primary/40"
                      : "border-border/60 bg-muted/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${preset.accentClass}`}
                        >
                          {preset.shortName}
                        </span>
                        <StatusBadge status={node.status} />
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                          P#{node.priority} · W:{node.weight}
                        </span>
                        {node.source !== "pool" && (
                          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300">
                            {node.source === "env" ? "ENV VAR" : "LEGACY KEY"}
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-sm font-extrabold text-foreground truncate">
                        {node.label}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={() => void handleTestNode(node.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary/50 hover:text-primary transition disabled:opacity-50"
                        title="Live ping test"
                      >
                        {isTesting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 text-emerald-500" />
                        )}
                        <span>Ping</span>
                      </button>

                      {canEdit && !node.readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleToggleNode(node)}
                            className={`rounded-xl border p-1.5 transition ${
                              node.enabled
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border bg-background text-muted-foreground"
                            }`}
                            title={node.enabled ? "Disable node" : "Enable node"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(node)}
                            className="rounded-xl border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
                            title="Edit node"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Model + Endpoint + Masked Key */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/25 p-2.5 text-[11px]">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Primary Model
                      </span>
                      <code className="font-mono font-bold text-foreground break-all">
                        {node.model}
                      </code>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        API Key (Server-Encrypted)
                      </span>
                      <code className="font-mono font-semibold text-muted-foreground">
                        {node.apiKeyMasked}
                      </code>
                    </div>
                  </div>

                  {node.fallbackModels && node.fallbackModels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="font-bold uppercase text-muted-foreground mr-1">
                        Fallbacks:
                      </span>
                      {node.fallbackModels.map((fm) => (
                        <span
                          key={fm}
                          className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-muted-foreground"
                        >
                          {fm}
                        </span>
                      ))}
                    </div>
                  )}

                  {node.lastError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] font-medium text-destructive line-clamp-2">
                      {node.lastError}
                    </div>
                  )}

                  {/* Footer Telemetry + Priority / Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" />
                        {node.lastLatencyMs ? `${node.lastLatencyMs}ms` : "—"}
                      </span>
                      <span>
                        {node.totalRequests} req · {node.totalFailures} err
                      </span>
                      {(node.totalInputTokens > 0 || node.totalOutputTokens > 0) && (
                        <span>
                          {((node.totalInputTokens + node.totalOutputTokens) / 1000).toFixed(1)}k tok
                        </span>
                      )}
                    </div>

                    {canEdit && !node.readOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleAdjustPriority(node, -1)}
                          className="rounded-lg border border-border p-1 hover:bg-accent"
                          title="Move higher priority"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAdjustPriority(node, 1)}
                          className="rounded-lg border border-border p-1 hover:bg-accent"
                          title="Move lower priority"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        {confirmDeleteId === node.id ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteNode(node.id)}
                            className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-extrabold text-destructive-foreground"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(node.id)}
                            className="rounded-lg border border-destructive/30 p-1 text-destructive hover:bg-destructive/10"
                            title="Delete node"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ROUTING STRATEGY + PLATFORM CAPABILITY MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Routing Engine & Circuit Breaker */}
        <section className="lg:col-span-6 staff-panel space-y-4">
          <div className="staff-panel-header">
            <div>
              <h3 className="staff-panel-title flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <span>Routing Strategy &amp; Circuit Breaker</span>
              </h3>
              <p className="staff-panel-desc">
                Control how requests distribute across pool nodes and recover from rate limits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STRATEGY_META.map((item) => {
              const selected = strategy === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setStrategy(item.id)}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    selected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-background hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-extrabold text-foreground">
                      {item.title}
                    </span>
                    {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="staff-label mb-1 block">Cooldown (sec)</label>
              <input
                type="number"
                min={10}
                max={600}
                disabled={!canEdit}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value) || 60)}
                className="staff-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="staff-label mb-1 block">Max Failovers</label>
              <input
                type="number"
                min={1}
                max={12}
                disabled={!canEdit}
                value={maxFailoverAttempts}
                onChange={(e) => setMaxFailoverAttempts(Number(e.target.value) || 5)}
                className="staff-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="staff-label mb-1 block">Timeout (ms)</label>
              <input
                type="number"
                min={5000}
                max={120000}
                step={1000}
                disabled={!canEdit}
                value={defaultTimeoutMs}
                onChange={(e) => setDefaultTimeoutMs(Number(e.target.value) || 45000)}
                className="staff-input font-mono text-xs"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                disabled={resettingStats}
                onClick={() => void handleResetStats()}
                className="staff-btn-ghost text-xs text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Cooldowns &amp; Logs</span>
              </button>
              <button
                type="button"
                disabled={savingPolicy}
                onClick={() => void handleSavePolicy()}
                className="staff-btn-primary text-xs"
              >
                {savingPolicy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Routing Policy</span>
              </button>
            </div>
          )}
        </section>

        {/* Right: 5 Integrated Platform AI Capabilities */}
        <section className="lg:col-span-6 staff-panel space-y-4">
          <div className="staff-panel-header">
            <div>
              <h3 className="staff-panel-title flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Platform AI Integrations &amp; Task Routing</span>
              </h3>
              <p className="staff-panel-desc">
                Every AI capability across Onnesha Arena uses this pool. Optionally pin a dedicated
                model/node per workflow.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {AI_CAPABILITY_LIST.map((capId) => {
              const meta = AI_CAPABILITY_META[capId];
              return (
                <div
                  key={capId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-background/70 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs font-extrabold text-foreground">
                        {meta.titleEn}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          isOnline
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isOnline ? "Ready" : "Needs Key"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {meta.descEn}
                    </p>
                  </div>

                  <select
                    disabled={!canEdit}
                    value={taskRoutes[capId] || ""}
                    onChange={(e) =>
                      setTaskRoutes((prev) => ({
                        ...prev,
                        [capId]: e.target.value || undefined,
                      }))
                    }
                    className="sm:w-48 shrink-0 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Auto ({strategy.replace("_", " ")})</option>
                    {(config?.nodes || [])
                      .filter((n) => n.enabled)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.model.slice(0, 22)})
                        </option>
                      ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* LIVE EXECUTION TELEMETRY LEDGER */}
      <section className="staff-panel space-y-4">
        <div className="staff-panel-header">
          <div>
            <h3 className="staff-panel-title flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span>Live AI Execution &amp; Failover Ledger ({config?.logs.length || 0})</span>
            </h3>
            <p className="staff-panel-desc">
              Real-time audit trail of Quiz Generation, Student AI Tutor, Practical Grading, LMS
              Authoring, and Psychometric Diagnostics.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left font-display">
                <th className="p-3 font-bold">Time</th>
                <th className="p-3 font-bold">Capability</th>
                <th className="p-3 font-bold">Provider / Model</th>
                <th className="p-3 font-bold">Actor</th>
                <th className="p-3 font-bold text-center">Latency</th>
                <th className="p-3 font-bold text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {!config?.logs.length ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No AI requests logged yet. Generate a quiz, ask the Student Tutor, or run an AI
                    copilot to see live telemetry here.
                  </td>
                </tr>
              ) : (
                config.logs.slice(0, 25).map((log) => (
                  <tr key={log.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-bold text-foreground">
                      {AI_CAPABILITY_META[log.task]?.titleEn || log.task}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold mr-1.5 ${AI_PROVIDER_CATALOG[log.provider]?.accentClass || ""}`}
                      >
                        {AI_PROVIDER_CATALOG[log.provider]?.shortName || log.provider}
                      </span>
                      <code className="font-mono text-[11px] text-muted-foreground">
                        {log.model}
                      </code>
                    </td>
                    <td className="p-3 text-muted-foreground">{log.actorName || "System"}</td>
                    <td className="p-3 text-center font-mono font-bold">
                      {log.latencyMs}ms
                      {log.failoverAttempts > 0 && (
                        <span className="ml-1 text-[10px] text-amber-600">
                          (+{log.failoverAttempts} retry)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-extrabold text-destructive"
                          title={log.error}
                        >
                          <XCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ADD / EDIT NODE MODAL */}
      {modalOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-primary">
                {form.id ? "Edit AI Pool Node" : "Add Provider to AI Pool"}
              </span>
              <h3 className="font-display text-lg font-black text-foreground">
                Configure Multi-Provider Gateway Node
              </h3>
            </div>

            {/* 10-Provider Quick Selector Grid */}
            <div className="space-y-2">
              <label className="staff-label block">Select AI Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {AI_PROVIDER_LIST.map((p) => {
                  const selected = form.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderSelectInModal(p.id)}
                      className={`rounded-xl border px-2.5 py-2 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border bg-background hover:bg-accent/50"
                      }`}
                    >
                      <div className="font-display text-xs font-extrabold text-foreground truncate">
                        {p.shortName}
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate">
                        {p.protocol === "openai_compatible"
                          ? "OpenAI API"
                          : p.protocol === "gemini_native"
                            ? "Gemini REST"
                            : "Claude API"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                <span>{activePreset.tagline}</span>
                <a
                  href={activePreset.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0"
                >
                  <span>Get Key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <form onSubmit={handleSaveNode} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="staff-label mb-1 block">Node Label *</label>
                  <input
                    type="text"
                    required
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="e.g. OpenRouter Key #1 (Primary)"
                    className="staff-input text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="staff-label mb-1 block">
                    API Key {form.id ? "(leave blank to keep existing)" : activePreset.supportsKeyless ? "(optional)" : "*"}
                  </label>
                  <input
                    type="password"
                    required={!form.id && !activePreset.supportsKeyless}
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder={activePreset.keyPlaceholder}
                    className="staff-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="staff-label block">Model ID *</label>
                <input
                  type="text"
                  required
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder={activePreset.defaultModel}
                  className="staff-input font-mono text-xs font-bold"
                />
                <div className="flex flex-wrap gap-1.5">
                  {activePreset.recommendedModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm({ ...form, model: m.id })}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                        form.model === m.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m.label}
                      {m.badge && <span className="ml-1 opacity-70">· {m.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="staff-label mb-1 block">Base URL</label>
                  <input
                    type="url"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder={activePreset.defaultBaseUrl}
                    className="staff-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="staff-label mb-1 block">
                    Fallback Models (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={form.fallbackModelsCsv}
                    onChange={(e) => setForm({ ...form, fallbackModelsCsv: e.target.value })}
                    placeholder="model-b, model-c"
                    className="staff-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="staff-label mb-1 block">Priority (1 = top)</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
                    className="staff-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="staff-label mb-1 block">Weight (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 10 })}
                    className="staff-input font-mono text-xs"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                      className="h-4 w-4 accent-primary rounded"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="staff-label block">
                  Capability Scope (leave all unchecked to allow every AI feature)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AI_CAPABILITY_LIST.map((cap) => {
                    const active = form.capabilities.includes(cap);
                    return (
                      <button
                        key={cap}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            capabilities: active
                              ? prev.capabilities.filter((c) => c !== cap)
                              : [...prev.capabilities, cap],
                          }))
                        }
                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {AI_CAPABILITY_META[cap].titleEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="staff-btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNode}
                  className="staff-btn-primary text-xs"
                >
                  {savingNode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{form.id ? "Update Pool Node" : "Save to AI Pool"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

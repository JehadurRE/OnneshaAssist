import type {
  AiNodeHealthStatus,
  AiPoolConfig,
  AiPoolExecutionLog,
  AiPoolNode,
  AiPoolRoutingStrategy,
  AiProviderId,
  AiTaskCapability,
  SanitizedAiPoolConfig,
  SanitizedAiPoolNode,
} from "./types";

export interface AiProviderPreset {
  id: AiProviderId;
  name: string;
  shortName: string;
  tagline: string;
  protocol: "openai_compatible" | "gemini_native" | "anthropic_native";
  defaultBaseUrl: string;
  defaultModel: string;
  recommendedModels: Array<{ id: string; label: string; badge?: string }>;
  envKeyNames: string[];
  keyPlaceholder: string;
  docsUrl: string;
  supportsKeyless?: boolean;
  accentClass: string;
}

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderPreset> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    tagline: "Unified gateway to 300+ models (Claude, GPT, Gemini, DeepSeek, Llama, Free tier)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash",
    recommendedModels: [
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Fast · Balanced" },
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", badge: "Best Quality" },
      { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", badge: "Low Cost" },
      { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3", badge: "High Value" },
      { id: "meta-llama/llama-4-scout", label: "Llama 4 Scout", badge: "Fast Open" },
      { id: "qwen/qwen3-32b", label: "Qwen 3 32B", badge: "Multilingual" },
      { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (Free)", badge: "Free" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (Free)", badge: "Free" },
    ],
    envKeyNames: ["OPENROUTER_API_KEY"],
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
    accentClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    tagline: "Direct Google AI Studio REST API with native JSON mode & strong Bengali support",
    protocol: "gemini_native",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    recommendedModels: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Recommended" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "Deep Reasoning" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", badge: "Fallback" },
    ],
    envKeyNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/apikey",
    accentClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    tagline: "GPT-4.1 & GPT-4o family for reliable structured JSON exams and grading rubrics",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    recommendedModels: [
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", badge: "Fast · JSON" },
      { id: "gpt-4.1", label: "GPT-4.1", badge: "Flagship" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", badge: "Budget" },
      { id: "gpt-4o", label: "GPT-4o", badge: "Versatile" },
    ],
    envKeyNames: ["OPENAI_API_KEY"],
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    accentClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    shortName: "Claude",
    tagline: "High-nuance academic reasoning, bilingual feedback, and rigorous rubric grading",
    protocol: "anthropic_native",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    recommendedModels: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", badge: "Flagship" },
      { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet", badge: "Analytical" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", badge: "Ultra Fast" },
    ],
    envKeyNames: ["ANTHROPIC_API_KEY"],
    keyPlaceholder: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    accentClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  },
  groq: {
    id: "groq",
    name: "Groq Cloud",
    shortName: "Groq",
    tagline: "Sub-second LPU inference — ideal for real-time Student AI Tutor & quick drafts",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    recommendedModels: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Ultra Fast" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B", badge: "Next-Gen" },
      { id: "qwen-qwq-32b", label: "Qwen QwQ 32B", badge: "Reasoning" },
    ],
    envKeyNames: ["GROQ_API_KEY"],
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    accentClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    tagline: "Cost-efficient high-IQ reasoning & technical assessment synthesis",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    recommendedModels: [
      { id: "deepseek-chat", label: "DeepSeek V3 (Chat)", badge: "Best Value" },
      { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)", badge: "Deep Logic" },
    ],
    envKeyNames: ["DEEPSEEK_API_KEY"],
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    accentClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    shortName: "Mistral",
    tagline: "European frontier models with crisp multilingual output and JSON fidelity",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    recommendedModels: [
      { id: "mistral-small-latest", label: "Mistral Small", badge: "Fast" },
      { id: "mistral-large-latest", label: "Mistral Large", badge: "Flagship" },
    ],
    envKeyNames: ["MISTRAL_API_KEY"],
    keyPlaceholder: "mistral-...",
    docsUrl: "https://console.mistral.ai/api-keys/",
    accentClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
  xai: {
    id: "xai",
    name: "xAI (Grok)",
    shortName: "xAI Grok",
    tagline: "Grok-3 reasoning and fast factual synthesis via OpenAI-compatible API",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini",
    recommendedModels: [
      { id: "grok-3-mini", label: "Grok 3 Mini", badge: "Fast" },
      { id: "grok-3", label: "Grok 3", badge: "Flagship" },
    ],
    envKeyNames: ["XAI_API_KEY"],
    keyPlaceholder: "xai-...",
    docsUrl: "https://console.x.ai/",
    accentClass: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
  together: {
    id: "together",
    name: "Together AI",
    shortName: "Together",
    tagline: "High-throughput open-weights cloud (Llama 3.3, Qwen 2.5, DeepSeek)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    recommendedModels: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", badge: "Fast" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B Turbo", badge: "Multilingual" },
    ],
    envKeyNames: ["TOGETHER_API_KEY"],
    keyPlaceholder: "tgp_v1_...",
    docsUrl: "https://api.together.xyz/settings/api-keys",
    accentClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
  custom: {
    id: "custom",
    name: "Custom / Self-Hosted",
    shortName: "Custom",
    tagline: "Ollama, vLLM, LiteLLM, Azure OpenAI, Cloudflare AI Gateway, or any OpenAI-compatible proxy",
    protocol: "openai_compatible",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1:8b",
    recommendedModels: [
      { id: "llama3.1:8b", label: "Ollama Llama 3.1 8B", badge: "Local" },
      { id: "qwen2.5:14b", label: "Ollama Qwen 2.5 14B", badge: "Local" },
      { id: "gemma3:12b", label: "Ollama Gemma 3 12B", badge: "Local" },
    ],
    envKeyNames: ["CUSTOM_AI_API_KEY"],
    keyPlaceholder: "Optional bearer token (leave blank for local Ollama)",
    docsUrl: "https://ollama.com/library",
    supportsKeyless: true,
    accentClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
};

export const AI_PROVIDER_LIST: AiProviderPreset[] = Object.values(AI_PROVIDER_CATALOG);

export const AI_CAPABILITY_META: Record<
  AiTaskCapability,
  {
    id: AiTaskCapability;
    titleEn: string;
    titleBn: string;
    descEn: string;
    descBn: string;
  }
> = {
  quiz_generation: {
    id: "quiz_generation",
    titleEn: "AI Quiz & Paper Generator",
    titleBn: "AI কুইজ ও প্রশ্নপত্র নির্মাতা",
    descEn: "Synthesizes bilingual MCQ, Multi-MCQ, True/False & Written exams with explanations.",
    descBn: "ব্যাখ্যাসহ দ্বিভাষিক MCQ, সত্য/মিথ্যা ও লিখিত প্রশ্নপত্র তৈরি করে।",
  },
  course_tutor: {
    id: "course_tutor",
    titleEn: "Student AI Course Tutor",
    titleBn: "শিক্ষার্থী AI কোর্স টিউটর",
    descEn: "Multi-turn RAG tutor grounded in published course materials inside Student Portal.",
    descBn: "প্রকাশিত কোর্স ম্যাটেরিয়ালের ওপর ভিত্তি করে শিক্ষার্থীদের প্রশ্নের উত্তর দেয়।",
  },
  practical_grading: {
    id: "practical_grading",
    titleEn: "Practical Grading Copilot",
    titleBn: "প্র্যাকটিক্যাল গ্রেডিং কো-পাইলট",
    descEn: "Suggests rubric marks & concise bilingual EN/BN remarks on Final Exam Desk.",
    descBn: "রুব্রিক অনুযায়ী নম্বর ও দ্বিভাষিক মন্তব্য প্রস্তাব করে ফাইনাল এক্সাম ডেস্কে।",
  },
  lms_authoring: {
    id: "lms_authoring",
    titleEn: "LMS Material & Notice Author",
    titleBn: "LMS নোট ও নোটিশ রচয়িতা",
    descEn: "Drafts structured bilingual study guides, revision checklists, and announcements.",
    descBn: "গোছানো দ্বিভাষিক স্টাডি গাইড, রিভিশন নোট ও নোটিশ খসড়া করে।",
  },
  exam_analytics: {
    id: "exam_analytics",
    titleEn: "Psychometric Cohort Insights",
    titleBn: "সাইকোমেট্রিক ও ফলাফল বিশ্লেষণ",
    descEn: "Analyzes completed exam sessions to surface weak items and remediation plans.",
    descBn: "পরীক্ষার ফলাফল বিশ্লেষণ করে দুর্বল অধ্যায় ও করণীয় রিপোর্ট তৈরি করে।",
  },
};

export const AI_CAPABILITY_LIST: AiTaskCapability[] = [
  "quiz_generation",
  "course_tutor",
  "practical_grading",
  "lms_authoring",
  "exam_analytics",
];

export function maskApiKey(key: string | undefined): string {
  const clean = (key || "").trim();
  if (!clean) return "Not set";
  if (clean.length <= 8) return "••••••••";
  const prefix = clean.slice(0, Math.min(7, Math.floor(clean.length / 3)));
  const suffix = clean.slice(-4);
  return `${prefix}••••${suffix}`;
}

export function createDefaultAiPoolConfig(): AiPoolConfig {
  return {
    strategy: "priority_failover",
    cooldownSeconds: 60,
    maxFailoverAttempts: 5,
    defaultTimeoutMs: 45_000,
    taskPreferredNodeIds: {},
    nodes: [],
    logs: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeAiPoolConfig(raw?: Partial<AiPoolConfig> | null): AiPoolConfig {
  const base = createDefaultAiPoolConfig();
  if (!raw || typeof raw !== "object") return base;
  const strategy: AiPoolRoutingStrategy =
    raw.strategy === "round_robin" ||
    raw.strategy === "weighted_random" ||
    raw.strategy === "fastest_latency" ||
    raw.strategy === "priority_failover"
      ? raw.strategy
      : base.strategy;

  const nodes: AiPoolNode[] = Array.isArray(raw.nodes)
    ? raw.nodes
        .filter((n): n is AiPoolNode => Boolean(n && typeof n === "object" && n.id && n.provider))
        .map((n, idx) => {
          const provider: AiProviderId =
            n.provider in AI_PROVIDER_CATALOG ? n.provider : "openrouter";
          const preset = AI_PROVIDER_CATALOG[provider];
          return {
            id: String(n.id),
            label: (n.label || `${preset.shortName} #${idx + 1}`).trim(),
            provider,
            apiKey: typeof n.apiKey === "string" ? n.apiKey.trim() : "",
            baseUrl: n.baseUrl?.trim() || preset.defaultBaseUrl,
            model: (n.model || preset.defaultModel).trim(),
            fallbackModels: Array.isArray(n.fallbackModels)
              ? n.fallbackModels.map((m) => String(m).trim()).filter(Boolean)
              : undefined,
            enabled: n.enabled !== false,
            priority: Number.isFinite(n.priority) ? Math.max(1, Math.round(n.priority)) : idx + 1,
            weight: Number.isFinite(n.weight)
              ? Math.min(100, Math.max(1, Math.round(n.weight)))
              : 10,
            capabilities:
              Array.isArray(n.capabilities) && n.capabilities.length > 0
                ? n.capabilities.filter((c): c is AiTaskCapability => c in AI_CAPABILITY_META)
                : undefined,
            temperature: typeof n.temperature === "number" ? n.temperature : undefined,
            maxTokens: typeof n.maxTokens === "number" ? n.maxTokens : undefined,
            timeoutMs: typeof n.timeoutMs === "number" ? n.timeoutMs : undefined,
            notes: n.notes?.trim() || undefined,
            status: n.status || "untested",
            cooldownUntil: typeof n.cooldownUntil === "number" ? n.cooldownUntil : undefined,
            lastLatencyMs: typeof n.lastLatencyMs === "number" ? n.lastLatencyMs : undefined,
            avgLatencyMs: typeof n.avgLatencyMs === "number" ? n.avgLatencyMs : undefined,
            totalRequests: Number.isFinite(n.totalRequests) ? n.totalRequests : 0,
            totalFailures: Number.isFinite(n.totalFailures) ? n.totalFailures : 0,
            totalInputTokens: Number.isFinite(n.totalInputTokens) ? n.totalInputTokens : 0,
            totalOutputTokens: Number.isFinite(n.totalOutputTokens) ? n.totalOutputTokens : 0,
            lastSuccessAt: n.lastSuccessAt,
            lastErrorAt: n.lastErrorAt,
            lastError: n.lastError,
            createdAt: n.createdAt || base.updatedAt!,
            updatedAt: n.updatedAt || base.updatedAt!,
          };
        })
    : [];

  const logs: AiPoolExecutionLog[] = Array.isArray(raw.logs) ? raw.logs.slice(0, 80) : [];

  return {
    strategy,
    cooldownSeconds: Number.isFinite(raw.cooldownSeconds)
      ? Math.min(600, Math.max(10, Math.round(raw.cooldownSeconds!)))
      : base.cooldownSeconds,
    maxFailoverAttempts: Number.isFinite(raw.maxFailoverAttempts)
      ? Math.min(12, Math.max(1, Math.round(raw.maxFailoverAttempts!)))
      : base.maxFailoverAttempts,
    defaultTimeoutMs: Number.isFinite(raw.defaultTimeoutMs)
      ? Math.min(120_000, Math.max(5_000, Math.round(raw.defaultTimeoutMs!)))
      : base.defaultTimeoutMs,
    taskPreferredNodeIds:
      raw.taskPreferredNodeIds && typeof raw.taskPreferredNodeIds === "object"
        ? { ...raw.taskPreferredNodeIds }
        : {},
    nodes,
    logs,
    updatedAt: raw.updatedAt || base.updatedAt,
  };
}

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const val = process.env[name]?.trim();
  return val && val.length > 0 ? val : undefined;
}

export function discoverEnvAiPoolNodes(): Array<AiPoolNode & { source: "env" }> {
  const discovered: Array<AiPoolNode & { source: "env" }> = [];
  const nowIso = new Date().toISOString();
  let envPriority = 100;

  const envProviders: Array<{
    provider: AiProviderId;
    envVars: string[];
    modelEnv?: string;
    baseUrlEnv?: string;
  }> = [
    {
      provider: "openrouter",
      envVars: ["OPENROUTER_API_KEY"],
      modelEnv: "OPENROUTER_MODEL",
    },
    {
      provider: "gemini",
      envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      modelEnv: "GEMINI_MODEL",
    },
    {
      provider: "openai",
      envVars: ["OPENAI_API_KEY"],
      modelEnv: "OPENAI_MODEL",
    },
    {
      provider: "anthropic",
      envVars: ["ANTHROPIC_API_KEY"],
      modelEnv: "ANTHROPIC_MODEL",
    },
    {
      provider: "groq",
      envVars: ["GROQ_API_KEY"],
      modelEnv: "GROQ_MODEL",
    },
    {
      provider: "deepseek",
      envVars: ["DEEPSEEK_API_KEY"],
      modelEnv: "DEEPSEEK_MODEL",
    },
    {
      provider: "mistral",
      envVars: ["MISTRAL_API_KEY"],
      modelEnv: "MISTRAL_MODEL",
    },
    {
      provider: "xai",
      envVars: ["XAI_API_KEY"],
      modelEnv: "XAI_MODEL",
    },
    {
      provider: "together",
      envVars: ["TOGETHER_API_KEY"],
      modelEnv: "TOGETHER_MODEL",
    },
  ];

  for (const spec of envProviders) {
    let foundKey: string | undefined;
    let foundVar = "";
    for (const v of spec.envVars) {
      const k = readEnv(v);
      if (k && k.length >= 8) {
        foundKey = k;
        foundVar = v;
        break;
      }
    }
    if (!foundKey) continue;
    const preset = AI_PROVIDER_CATALOG[spec.provider];
    const model = (spec.modelEnv ? readEnv(spec.modelEnv) : undefined) || preset.defaultModel;
    discovered.push({
      id: `env-${spec.provider}`,
      label: `${preset.name} (ENV: ${foundVar})`,
      provider: spec.provider,
      apiKey: foundKey,
      baseUrl: preset.defaultBaseUrl,
      model,
      fallbackModels:
        spec.provider === "gemini" ? ["gemini-2.0-flash"] : undefined,
      enabled: true,
      priority: envPriority++,
      weight: 10,
      status: "healthy",
      totalRequests: 0,
      totalFailures: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "env",
    });
  }

  const customBase = readEnv("CUSTOM_AI_BASE_URL");
  if (customBase) {
    const preset = AI_PROVIDER_CATALOG.custom;
    discovered.push({
      id: "env-custom",
      label: "Custom AI Endpoint (ENV)",
      provider: "custom",
      apiKey: readEnv("CUSTOM_AI_API_KEY") || "",
      baseUrl: customBase,
      model: readEnv("CUSTOM_AI_MODEL") || preset.defaultModel,
      enabled: true,
      priority: envPriority++,
      weight: 10,
      status: "healthy",
      totalRequests: 0,
      totalFailures: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: "env",
    });
  }

  return discovered;
}

export type EffectiveAiPoolNode = AiPoolNode & {
  source: "pool" | "env" | "legacy_gemini";
};

export function buildEffectivePoolNodes(
  pool: AiPoolConfig,
  legacyServerGeminiKey?: string,
): EffectiveAiPoolNode[] {
  const effective: EffectiveAiPoolNode[] = pool.nodes.map((n) => ({
    ...n,
    source: "pool" as const,
  }));

  const seenKeyFingerprints = new Set(
    effective.map((n) => `${n.provider}:${n.apiKey}:${n.model}`),
  );

  // Legacy single serverGeminiApiKey compatibility
  const cleanLegacy = (legacyServerGeminiKey || "").trim();
  if (cleanLegacy.length >= 10) {
    const alreadyInPool = effective.some(
      (n) => n.provider === "gemini" && n.apiKey === cleanLegacy,
    );
    if (!alreadyInPool) {
      const nowIso = new Date().toISOString();
      effective.push({
        id: "legacy-server-gemini",
        label: "Google Gemini (Server Key)",
        provider: "gemini",
        apiKey: cleanLegacy,
        baseUrl: AI_PROVIDER_CATALOG.gemini.defaultBaseUrl,
        model: "gemini-2.5-flash",
        fallbackModels: ["gemini-2.0-flash"],
        enabled: true,
        priority: 90,
        weight: 10,
        status: "healthy",
        totalRequests: 0,
        totalFailures: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        source: "legacy_gemini",
      });
      seenKeyFingerprints.add(`gemini:${cleanLegacy}:gemini-2.5-flash`);
    }
  }

  // Env-discovered nodes (added if not already duplicated in explicit pool)
  for (const envNode of discoverEnvAiPoolNodes()) {
    const fp = `${envNode.provider}:${envNode.apiKey}:${envNode.model}`;
    if (!seenKeyFingerprints.has(fp)) {
      effective.push(envNode);
      seenKeyFingerprints.add(fp);
    }
  }

  return effective;
}

export function sanitizeAiPoolConfig(
  pool: AiPoolConfig,
  legacyServerGeminiKey?: string,
): SanitizedAiPoolConfig {
  const now = Date.now();
  const effective = buildEffectivePoolNodes(pool, legacyServerGeminiKey);
  const sanitizedNodes: SanitizedAiPoolNode[] = effective.map((node) => {
    const { apiKey, source, ...rest } = node;
    const isCooling = typeof node.cooldownUntil === "number" && node.cooldownUntil > now;
    const effectiveStatus: AiNodeHealthStatus = isCooling ? "cooldown" : node.status;
    return {
      ...rest,
      status: effectiveStatus,
      hasApiKey: apiKey.trim().length > 0 || Boolean(AI_PROVIDER_CATALOG[node.provider]?.supportsKeyless),
      apiKeyMasked: apiKey.trim()
        ? maskApiKey(apiKey)
        : AI_PROVIDER_CATALOG[node.provider]?.supportsKeyless
          ? "No key (local)"
          : "Missing key",
      source,
      readOnly: source !== "pool",
    };
  });

  const enabledNodes = sanitizedNodes.filter((n) => n.enabled && n.hasApiKey);
  const cooldownNodes = enabledNodes.filter((n) => n.status === "cooldown");
  const healthyNodes = enabledNodes.filter(
    (n) => n.status === "healthy" || n.status === "untested" || n.status === "degraded",
  );
  const totalRequests = sanitizedNodes.reduce((s, n) => s + (n.totalRequests || 0), 0);
  const totalFailures = sanitizedNodes.reduce((s, n) => s + (n.totalFailures || 0), 0);
  const successRatePct =
    totalRequests > 0
      ? Math.round(((totalRequests - totalFailures) / totalRequests) * 100)
      : 100;
  const latNodes = sanitizedNodes.filter(
    (n) => typeof n.avgLatencyMs === "number" && n.avgLatencyMs > 0,
  );
  const avgLatencyMs =
    latNodes.length > 0
      ? Math.round(latNodes.reduce((s, n) => s + (n.avgLatencyMs || 0), 0) / latNodes.length)
      : 0;
  const providersActive = Array.from(new Set(enabledNodes.map((n) => n.provider)));

  return {
    strategy: pool.strategy,
    cooldownSeconds: pool.cooldownSeconds,
    maxFailoverAttempts: pool.maxFailoverAttempts,
    defaultTimeoutMs: pool.defaultTimeoutMs,
    taskPreferredNodeIds: { ...(pool.taskPreferredNodeIds || {}) },
    nodes: sanitizedNodes,
    logs: (pool.logs || []).slice(0, 60),
    summary: {
      totalNodes: sanitizedNodes.length,
      enabledNodes: enabledNodes.length,
      healthyNodes: healthyNodes.length,
      cooldownNodes: cooldownNodes.length,
      totalRequests,
      totalFailures,
      successRatePct,
      avgLatencyMs,
      providersActive,
    },
    updatedAt: pool.updatedAt,
  };
}

export function hasAnyConfiguredAiProvider(
  pool?: AiPoolConfig | null,
  legacyServerGeminiKey?: string,
): boolean {
  const normalized = normalizeAiPoolConfig(pool);
  const effective = buildEffectivePoolNodes(normalized, legacyServerGeminiKey);
  return effective.some(
    (n) => n.enabled && (n.apiKey.trim().length > 0 || AI_PROVIDER_CATALOG[n.provider]?.supportsKeyless),
  );
}

// In-memory round-robin cursor across pool executions
let roundRobinCounter = 0;

export function selectOrderedPoolCandidates(params: {
  nodes: EffectiveAiPoolNode[];
  strategy: AiPoolRoutingStrategy;
  task: AiTaskCapability;
  preferredNodeId?: string | undefined;
  taskPreferredNodeIds?: Partial<Record<AiTaskCapability, string>> | undefined;
  now?: number | undefined;
}): EffectiveAiPoolNode[] {
  const now = params.now ?? Date.now();
  const eligible = params.nodes.filter((n) => {
    if (!n.enabled) return false;
    const preset = AI_PROVIDER_CATALOG[n.provider];
    if (!n.apiKey.trim() && !preset?.supportsKeyless) return false;
    if (n.capabilities && n.capabilities.length > 0 && !n.capabilities.includes(params.task)) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) return [];

  const ready = eligible.filter((n) => !n.cooldownUntil || n.cooldownUntil <= now);
  const cooling = eligible
    .filter((n) => typeof n.cooldownUntil === "number" && n.cooldownUntil > now)
    .sort((a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0));

  const sortPool = (list: EffectiveAiPoolNode[]): EffectiveAiPoolNode[] => {
    const copy = [...list];
    if (copy.length <= 1) return copy;

    switch (params.strategy) {
      case "round_robin": {
        copy.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
        const offset = roundRobinCounter % copy.length;
        roundRobinCounter = (roundRobinCounter + 1) % 100_000;
        return [...copy.slice(offset), ...copy.slice(0, offset)];
      }
      case "weighted_random": {
        const remaining = [...copy];
        const ordered: EffectiveAiPoolNode[] = [];
        while (remaining.length > 0) {
          const totalWeight = remaining.reduce((s, n) => s + Math.max(1, n.weight || 10), 0);
          let roll = Math.random() * totalWeight;
          let pickedIdx = 0;
          for (let i = 0; i < remaining.length; i++) {
            roll -= Math.max(1, remaining[i]!.weight || 10);
            if (roll <= 0) {
              pickedIdx = i;
              break;
            }
          }
          ordered.push(remaining.splice(pickedIdx, 1)[0]!);
        }
        return ordered;
      }
      case "fastest_latency": {
        return copy.sort((a, b) => {
          const latA = a.avgLatencyMs && a.avgLatencyMs > 0 ? a.avgLatencyMs : 1500;
          const latB = b.avgLatencyMs && b.avgLatencyMs > 0 ? b.avgLatencyMs : 1500;
          return latA - latB || a.priority - b.priority;
        });
      }
      case "priority_failover":
      default:
        return copy.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    }
  };

  let ordered = [...sortPool(ready), ...cooling];

  // Put explicit preferred node or task-pinned node first if eligible
  const pinnedId = params.preferredNodeId || params.taskPreferredNodeIds?.[params.task];
  if (pinnedId) {
    const idx = ordered.findIndex((n) => n.id === pinnedId);
    if (idx > 0) {
      const [pinned] = ordered.splice(idx, 1);
      if (pinned) ordered = [pinned, ...ordered];
    }
  }

  return ordered;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiPoolCallRequest {
  task: AiTaskCapability;
  systemPrompt?: string | undefined;
  messages: AiChatMessage[];
  jsonMode?: boolean | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  preferredNodeId?: string | undefined;
  clientOverrideKey?: string | undefined;
  clientOverrideProvider?: AiProviderId | undefined;
  clientOverrideModel?: string | undefined;
  actorName?: string | undefined;
}

export interface AiPoolCallResult {
  text: string;
  nodeId: string;
  nodeLabel: string;
  provider: AiProviderId;
  model: string;
  latencyMs: number;
  failoverAttempts: number;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

interface AdapterResponse {
  text: string;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

class AiProviderHttpError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiProviderHttpError(`Request timed out after ${timeoutMs}ms`, 408, true);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiNativeAdapter(params: {
  node: AiPoolNode;
  model: string;
  systemPrompt?: string | undefined;
  messages: AiChatMessage[];
  jsonMode?: boolean | undefined;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<AdapterResponse> {
  const base = (params.node.baseUrl || AI_PROVIDER_CATALOG.gemini.defaultBaseUrl).replace(/\/+$/, "");
  const url = `${base}/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.node.apiKey.trim())}`;

  const contents = params.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
      ...(params.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (params.systemPrompt?.trim()) {
    body["systemInstruction"] = { parts: [{ text: params.systemPrompt.trim() }] };
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    params.timeoutMs,
  );

  if (!res.ok) {
    let msg = `Gemini API HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) msg = `Gemini (${res.status}): ${errBody.error.message}`;
    } catch {
      // ignore
    }
    const retryable = res.status === 429 || res.status === 404 || res.status >= 500;
    throw new AiProviderHttpError(msg, res.status, retryable);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) {
    throw new AiProviderHttpError(`Gemini "${params.model}" returned an empty response.`, 502, true);
  }
  return {
    text,
    inputTokens: payload.usageMetadata?.promptTokenCount,
    outputTokens: payload.usageMetadata?.candidatesTokenCount,
  };
}

async function callAnthropicNativeAdapter(params: {
  node: AiPoolNode;
  model: string;
  systemPrompt?: string | undefined;
  messages: AiChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<AdapterResponse> {
  const base = (params.node.baseUrl || AI_PROVIDER_CATALOG.anthropic.defaultBaseUrl).replace(/\/+$/, "");
  const url = base.endsWith("/messages") ? base : `${base}/messages`;

  const msgs = params.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    messages: msgs,
  };
  if (params.systemPrompt?.trim()) {
    body["system"] = params.systemPrompt.trim();
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.node.apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    },
    params.timeoutMs,
  );

  if (!res.ok) {
    let msg = `Anthropic API HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) msg = `Anthropic (${res.status}): ${errBody.error.message}`;
    } catch {
      // ignore
    }
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    throw new AiProviderHttpError(msg, res.status, retryable);
  }

  const payload = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (payload.content || [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("");
  if (!text.trim()) {
    throw new AiProviderHttpError(
      `Anthropic "${params.model}" returned an empty response.`,
      502,
      true,
    );
  }
  return {
    text,
    inputTokens: payload.usage?.input_tokens,
    outputTokens: payload.usage?.output_tokens,
  };
}

async function callOpenAiCompatibleAdapter(params: {
  node: AiPoolNode;
  model: string;
  systemPrompt?: string | undefined;
  messages: AiChatMessage[];
  jsonMode?: boolean | undefined;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<AdapterResponse> {
  const preset = AI_PROVIDER_CATALOG[params.node.provider] || AI_PROVIDER_CATALOG.custom;
  const base = (params.node.baseUrl || preset.defaultBaseUrl).replace(/\/+$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.node.apiKey.trim()) {
    headers["Authorization"] = `Bearer ${params.node.apiKey.trim()}`;
  }
  if (params.node.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://onnesha-exam-platform.onrender.com";
    headers["X-Title"] = "Onnesha Arena AI Assessment Engine";
  }

  const fullMessages: Array<{ role: string; content: string }> = [];
  if (params.systemPrompt?.trim()) {
    fullMessages.push({ role: "system", content: params.systemPrompt.trim() });
  }
  for (const m of params.messages) {
    fullMessages.push({ role: m.role, content: m.content });
  }

  const sendAttempt = async (withJsonFormat: boolean): Promise<Response> => {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: fullMessages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    };
    if (withJsonFormat) {
      body["response_format"] = { type: "json_object" };
    }
    return fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      params.timeoutMs,
    );
  };

  let res = await sendAttempt(Boolean(params.jsonMode));

  // Some OpenRouter/open-weight models reject response_format=json_object with 400; retry without it
  if (res.status === 400 && params.jsonMode) {
    res = await sendAttempt(false);
  }

  if (!res.ok) {
    let msg = `${preset.shortName} API HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const detail =
        typeof errBody?.error === "string"
          ? errBody.error
          : errBody?.error?.message || errBody?.message;
      if (detail) msg = `${preset.shortName} (${res.status}): ${detail}`;
    } catch {
      // ignore
    }
    const retryable = res.status === 429 || res.status === 404 || res.status >= 500;
    throw new AiProviderHttpError(msg, res.status, retryable);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map((c) => c.text || "").join("")
        : "";
  if (!text.trim()) {
    throw new AiProviderHttpError(
      `${preset.shortName} "${params.model}" returned an empty response.`,
      502,
      true,
    );
  }
  return {
    text,
    inputTokens: payload.usage?.prompt_tokens,
    outputTokens: payload.usage?.completion_tokens,
  };
}

async function dispatchSingleModelCall(params: {
  node: AiPoolNode;
  model: string;
  systemPrompt?: string | undefined;
  messages: AiChatMessage[];
  jsonMode?: boolean | undefined;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<AdapterResponse> {
  const preset = AI_PROVIDER_CATALOG[params.node.provider] || AI_PROVIDER_CATALOG.custom;
  if (preset.protocol === "gemini_native") {
    return callGeminiNativeAdapter(params);
  }
  if (preset.protocol === "anthropic_native") {
    return callAnthropicNativeAdapter(params);
  }
  return callOpenAiCompatibleAdapter(params);
}

export function extractJsonFromAiText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : trimmed;
  // If already valid JSON, return as-is
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Try extracting outermost JSON object
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = candidate.slice(firstBrace, lastBrace + 1);
      try {
        JSON.parse(slice);
        return slice;
      } catch {
        // fall through
      }
    }
    return candidate;
  }
}

export async function executeAiPoolRequest(
  pool: AiPoolConfig,
  request: AiPoolCallRequest,
  options?: {
    legacyServerGeminiKey?: string | undefined;
    onMutate?: (() => void) | undefined;
  },
): Promise<AiPoolCallResult> {
  let effectiveNodes = buildEffectivePoolNodes(pool, options?.legacyServerGeminiKey);

  // If caller supplied a direct client override key (e.g. instructor local key), prepend a transient node
  const cleanClientKey = request.clientOverrideKey?.trim();
  if (cleanClientKey && cleanClientKey.length >= 8) {
    const prov: AiProviderId =
      request.clientOverrideProvider ||
      (cleanClientKey.startsWith("sk-or-")
        ? "openrouter"
        : cleanClientKey.startsWith("sk-ant-")
          ? "anthropic"
          : cleanClientKey.startsWith("gsk_")
            ? "groq"
            : cleanClientKey.startsWith("AIza")
              ? "gemini"
              : cleanClientKey.startsWith("sk-")
                ? "openai"
                : "gemini");
    const preset = AI_PROVIDER_CATALOG[prov];
    const nowIso = new Date().toISOString();
    effectiveNodes = [
      {
        id: `transient-client-${prov}`,
        label: `Client Override (${preset.shortName})`,
        provider: prov,
        apiKey: cleanClientKey,
        baseUrl: preset.defaultBaseUrl,
        model: request.clientOverrideModel?.trim() || preset.defaultModel,
        fallbackModels: prov === "gemini" ? ["gemini-2.0-flash"] : undefined,
        enabled: true,
        priority: 0,
        weight: 100,
        status: "healthy",
        totalRequests: 0,
        totalFailures: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        source: "pool",
      },
      ...effectiveNodes,
    ];
  }

  const candidates = selectOrderedPoolCandidates({
    nodes: effectiveNodes,
    strategy: pool.strategy,
    task: request.task,
    preferredNodeId: request.preferredNodeId,
    taskPreferredNodeIds: pool.taskPreferredNodeIds,
  });

  if (candidates.length === 0) {
    throw new Error(
      "No AI provider or Gemini API key is configured in the AI Pool. Add OpenRouter, Gemini, OpenAI, Claude, Groq, or another provider in Admin → AI Pool.",
    );
  }

  const maxNodesToTry = Math.min(candidates.length, Math.max(1, pool.maxFailoverAttempts || 5));
  let failoverAttempts = 0;
  let lastError = "All AI pool nodes failed to respond.";

  const recordLog = (entry: Omit<AiPoolExecutionLog, "id" | "timestamp">) => {
    const log: AiPoolExecutionLog = {
      id: `ailog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    pool.logs = [log, ...(pool.logs || [])].slice(0, 80);
  };

  for (let i = 0; i < maxNodesToTry; i++) {
    const candidate = candidates[i]!;
    const persistedNode = pool.nodes.find((n) => n.id === candidate.id);
    const modelsToTry = Array.from(
      new Set([candidate.model, ...(candidate.fallbackModels || [])].filter(Boolean)),
    );

    const temperature = request.temperature ?? candidate.temperature ?? 0.35;
    const maxTokens = request.maxTokens ?? candidate.maxTokens ?? 4096;
    const timeoutMs = candidate.timeoutMs ?? pool.defaultTimeoutMs ?? 45_000;

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const model = modelsToTry[mIdx]!;
      const t0 = Date.now();
      try {
        const res = await dispatchSingleModelCall({
          node: candidate,
          model,
          systemPrompt: request.systemPrompt,
          messages: request.messages,
          jsonMode: request.jsonMode,
          temperature,
          maxTokens,
          timeoutMs,
        });
        const latencyMs = Math.max(1, Date.now() - t0);

        if (persistedNode) {
          persistedNode.totalRequests = (persistedNode.totalRequests || 0) + 1;
          persistedNode.lastLatencyMs = latencyMs;
          persistedNode.avgLatencyMs = persistedNode.avgLatencyMs
            ? Math.round(persistedNode.avgLatencyMs * 0.7 + latencyMs * 0.3)
            : latencyMs;
          persistedNode.totalInputTokens =
            (persistedNode.totalInputTokens || 0) + (res.inputTokens || 0);
          persistedNode.totalOutputTokens =
            (persistedNode.totalOutputTokens || 0) + (res.outputTokens || 0);
          persistedNode.status = "healthy";
          persistedNode.cooldownUntil = undefined;
          persistedNode.lastSuccessAt = new Date().toISOString();
          persistedNode.lastError = undefined;
          persistedNode.updatedAt = new Date().toISOString();
        }

        recordLog({
          task: request.task,
          nodeId: candidate.id,
          nodeLabel: candidate.label,
          provider: candidate.provider,
          model,
          success: true,
          latencyMs,
          failoverAttempts,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          actorName: request.actorName,
        });
        options?.onMutate?.();

        return {
          text: res.text,
          nodeId: candidate.id,
          nodeLabel: candidate.label,
          provider: candidate.provider,
          model,
          latencyMs,
          failoverAttempts,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
        };
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - t0);
        const message = err instanceof Error ? err.message : "Unknown AI provider error";
        const status = err instanceof AiProviderHttpError ? err.status : 500;
        lastError = `[${candidate.label} · ${model}] ${message}`;

        if (persistedNode) {
          persistedNode.totalRequests = (persistedNode.totalRequests || 0) + 1;
          persistedNode.totalFailures = (persistedNode.totalFailures || 0) + 1;
          persistedNode.lastLatencyMs = latencyMs;
          persistedNode.lastErrorAt = new Date().toISOString();
          persistedNode.lastError = message;
          if (status === 429 || status === 503 || status === 502 || status === 504 || status === 529) {
            persistedNode.status = "cooldown";
            persistedNode.cooldownUntil = Date.now() + (pool.cooldownSeconds || 60) * 1000;
          } else {
            persistedNode.status = "error";
          }
          persistedNode.updatedAt = new Date().toISOString();
        }

        recordLog({
          task: request.task,
          nodeId: candidate.id,
          nodeLabel: candidate.label,
          provider: candidate.provider,
          model,
          success: false,
          latencyMs,
          failoverAttempts,
          error: message,
          actorName: request.actorName,
        });
        options?.onMutate?.();

        failoverAttempts++;
        // If auth failed (401/403) on this key, don't waste retries on fallback models of the same key
        if (status === 401 || status === 403) {
          break;
        }
      }
    }
  }

  throw new Error(lastError);
}

export async function pingAiPoolNode(node: AiPoolNode): Promise<{
  ok: boolean;
  latencyMs: number;
  model: string;
  reply?: string | undefined;
  error?: string | undefined;
}> {
  const t0 = Date.now();
  try {
    const res = await dispatchSingleModelCall({
      node,
      model: node.model,
      systemPrompt: "You are a health check endpoint.",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      jsonMode: false,
      temperature: 0,
      maxTokens: 16,
      timeoutMs: Math.min(node.timeoutMs || 15_000, 15_000),
    });
    return {
      ok: true,
      latencyMs: Math.max(1, Date.now() - t0),
      model: node.model,
      reply: res.text.trim().slice(0, 60),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.max(1, Date.now() - t0),
      model: node.model,
      error: err instanceof Error ? err.message : "Health check failed",
    };
  }
}

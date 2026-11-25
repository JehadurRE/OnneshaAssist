import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_PROVIDER_CATALOG,
  createDefaultAiPoolConfig,
  executeAiPoolRequest,
  extractJsonFromAiText,
  maskApiKey,
  sanitizeAiPoolConfig,
  selectOrderedPoolCandidates,
} from "../ai-pool";
import { suggestPracticalGradeViaAiPool } from "../ai-copilots";
import type { AiPoolNode, PracticalExam, PracticalSubmission } from "../types";

function makeNode(overrides: Partial<AiPoolNode> & { id: string; provider: AiPoolNode["provider"] }): AiPoolNode {
  const preset = AI_PROVIDER_CATALOG[overrides.provider];
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    label: overrides.label || `${preset.name} Node`,
    provider: overrides.provider,
    apiKey: overrides.apiKey ?? "sk-test-secret-1234567890",
    baseUrl: overrides.baseUrl || preset.defaultBaseUrl,
    model: overrides.model || preset.defaultModel,
    fallbackModels: overrides.fallbackModels,
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 1,
    weight: overrides.weight ?? 10,
    capabilities: overrides.capabilities,
    status: overrides.status ?? "healthy",
    cooldownUntil: overrides.cooldownUntil,
    lastLatencyMs: overrides.lastLatencyMs,
    avgLatencyMs: overrides.avgLatencyMs,
    totalRequests: overrides.totalRequests ?? 0,
    totalFailures: overrides.totalFailures ?? 0,
    totalInputTokens: overrides.totalInputTokens ?? 0,
    totalOutputTokens: overrides.totalOutputTokens ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

describe("Multi-Provider AI Pool Engine", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("masks API keys and never leaks raw secrets in sanitized config", () => {
    expect(maskApiKey("sk-or-v1-abcdefghijklmnopqrstuvwxyz9876")).toBe("sk-or-v••••9876");
    expect(maskApiKey("")).toBe("Not set");

    const pool = createDefaultAiPoolConfig();
    pool.nodes.push(
      makeNode({
        id: "n-or",
        provider: "openrouter",
        apiKey: "sk-or-v1-super-secret-value-4321",
        model: "anthropic/claude-sonnet-4",
      }),
    );

    const sanitized = sanitizeAiPoolConfig(pool);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("super-secret-value");
    expect(sanitized.nodes[0]?.apiKeyMasked).toBe("sk-or-v••••4321");
    expect(sanitized.summary.enabledNodes).toBe(1);
    expect(sanitized.summary.providersActive).toContain("openrouter");
  });

  it("routes by priority, fastest latency, capability scope, and skips cooling nodes first", () => {
    const n1 = makeNode({
      id: "n-or-1",
      provider: "openrouter",
      priority: 1,
      avgLatencyMs: 900,
      cooldownUntil: Date.now() + 30_000,
    });
    const n2 = makeNode({
      id: "n-groq-2",
      provider: "groq",
      priority: 2,
      avgLatencyMs: 180,
      capabilities: ["course_tutor"],
    });
    const n3 = makeNode({
      id: "n-gemini-3",
      provider: "gemini",
      priority: 3,
      avgLatencyMs: 420,
    });

    // For quiz_generation, n2 is excluded by capability scope, n3 is ready, n1 is cooling down -> [n3, n1]
    const quizOrder = selectOrderedPoolCandidates({
      nodes: [
        { ...n1, source: "pool" },
        { ...n2, source: "pool" },
        { ...n3, source: "pool" },
      ],
      strategy: "priority_failover",
      task: "quiz_generation",
    });
    expect(quizOrder.map((n) => n.id)).toEqual(["n-gemini-3", "n-or-1"]);

    // For course_tutor with fastest_latency, n2 (180ms) beats n3 (420ms)
    const tutorOrder = selectOrderedPoolCandidates({
      nodes: [
        { ...n1, source: "pool" },
        { ...n2, source: "pool" },
        { ...n3, source: "pool" },
      ],
      strategy: "fastest_latency",
      task: "course_tutor",
    });
    expect(tutorOrder.map((n) => n.id)).toEqual(["n-groq-2", "n-gemini-3", "n-or-1"]);
  });

  it("fails over cleanly from rate-limited OpenRouter (429) to Gemini and logs telemetry", async () => {
    const pool = createDefaultAiPoolConfig();
    pool.nodes.push(
      makeNode({
        id: "node-or",
        label: "OpenRouter Primary",
        provider: "openrouter",
        apiKey: "sk-or-v1-primary-key-9999",
        model: "google/gemini-2.5-flash",
        priority: 1,
      }),
      makeNode({
        id: "node-gem",
        label: "Gemini Backup",
        provider: "gemini",
        apiKey: "AIzaSyBackupKey1234567890",
        model: "gemini-2.5-flash",
        priority: 2,
      }),
    );

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("openrouter.ai")) {
        return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Hello from Gemini backup!" }] } }],
          usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 12 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await executeAiPoolRequest(pool, {
      task: "course_tutor",
      messages: [{ role: "user", content: "Explain RAG." }],
      actorName: "Student NOA-01",
    });

    expect(result.provider).toBe("gemini");
    expect(result.text).toBe("Hello from Gemini backup!");
    expect(result.failoverAttempts).toBe(1);
    expect(pool.nodes[0]?.status).toBe("cooldown");
    expect(pool.nodes[0]?.cooldownUntil).toBeGreaterThan(Date.now());
    expect(pool.nodes[1]?.status).toBe("healthy");
    expect(pool.nodes[1]?.totalRequests).toBe(1);
    expect(pool.logs.length).toBe(2);
    expect(pool.logs[0]?.success).toBe(true);
    expect(pool.logs[1]?.success).toBe(false);
  });

  it("extracts JSON from fenced/prose output and clamps Practical Grading Copilot scores", async () => {
    const rawProse = `Here is the evaluation:\n\`\`\`json\n{"ok":true,"score":9}\n\`\`\`\nDone.`;
    expect(JSON.parse(extractJsonFromAiText(rawProse))).toEqual({ ok: true, score: 9 });

    const pool = createDefaultAiPoolConfig();
    pool.nodes.push(
      makeNode({
        id: "node-claude",
        provider: "anthropic",
        apiKey: "sk-ant-api03-1234567890abcdef",
        model: "claude-sonnet-4-20250514",
      }),
    );

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                grades: [
                  { taskId: "t1", marks: 99, comment: "EN: Excellent | BN: চমৎকার" },
                  { taskId: "t2", marks: -5, comment: "EN: Missing | BN: জমা নেই" },
                ],
                overallFeedback: "Good effort overall.",
                rationaleSummary: "Task 1 strong, Task 2 missing.",
              }),
            },
          ],
          usage: { input_tokens: 120, output_tokens: 60 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const exam: PracticalExam = {
      id: "ex-1",
      courseId: "c-1",
      titleEn: "Capstone",
      titleBn: "ক্যাপস্টোন",
      status: "open",
      tasks: [
        {
          id: "t1",
          titleEn: "Task 1",
          titleBn: "টাস্ক ১",
          promptEn: "Write a campaign plan",
          promptBn: "ক্যাম্পেইন প্ল্যান লিখুন",
          maxMarks: 20,
          requireText: true,
        },
        {
          id: "t2",
          titleEn: "Task 2",
          titleBn: "টাস্ক ২",
          promptEn: "Share portfolio link",
          promptBn: "পোর্টফোলিও লিংক দিন",
          maxMarks: 20,
          requireLink: true,
        },
      ],
      createdAt: "",
      updatedAt: "",
    };
    const sub: PracticalSubmission = {
      id: "sub-1",
      practicalExamId: "ex-1",
      courseId: "c-1",
      rollNumber: "NOA-01",
      studentName: "Candidate One",
      status: "submitted",
      answers: [{ taskId: "t1", textAnswer: "Detailed campaign plan" }],
      createdAt: "",
      updatedAt: "",
    };

    const suggestion = await suggestPracticalGradeViaAiPool(pool, { exam, submission: sub });
    expect(suggestion.provider).toBe("anthropic");
    expect(suggestion.grades[0]?.marks).toBe(20); // clamped from 99 -> 20
    expect(suggestion.grades[1]?.marks).toBe(0); // clamped from -5 -> 0
    expect(suggestion.overallFeedback).toBe("Good effort overall.");
  });
});

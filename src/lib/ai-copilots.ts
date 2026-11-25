import { executeAiPoolRequest, extractJsonFromAiText } from "./ai-pool";
import type {
  AiPoolConfig,
  AiProviderId,
  ExamResultRecord,
  ExamSessionRecord,
  PracticalExam,
  PracticalSubmission,
} from "./types";

// ============================================================================
// 1. PRACTICAL EXAM AI GRADING COPILOT
// ============================================================================

export interface AiSuggestedTaskGrade {
  taskId: string;
  marks: number;
  comment: string;
}

export interface AiPracticalGradeSuggestion {
  grades: AiSuggestedTaskGrade[];
  overallFeedback: string;
  rationaleSummary: string;
  provider: AiProviderId;
  model: string;
  nodeLabel: string;
  latencyMs: number;
}

export async function suggestPracticalGradeViaAiPool(
  pool: AiPoolConfig,
  params: {
    exam: PracticalExam;
    submission: PracticalSubmission;
    preferredNodeId?: string | undefined;
    actorName?: string | undefined;
  },
  options?: {
    legacyServerGeminiKey?: string | undefined;
    onMutate?: () => void;
  },
): Promise<AiPracticalGradeSuggestion> {
  const { exam, submission } = params;

  const taskBlocks = exam.tasks.map((task, idx) => {
    const ans = submission.answers.find((a) => a.taskId === task.id);
    return {
      index: idx + 1,
      taskId: task.id,
      titleEn: task.titleEn,
      titleBn: task.titleBn,
      promptEn: task.promptEn || "",
      maxMarks: task.maxMarks,
      submittedText: ans?.textAnswer?.trim() || "(no text submitted)",
      submittedLink: ans?.linkUrl?.trim() || "(no link)",
      submittedFile: ans?.fileName
        ? `${ans.fileName} (${ans.fileMime || "file"}, ${ans.fileSizeBytes || 0} bytes)`
        : "(no file)",
    };
  });

  const prompt = `You are a strict, fair, encouraging senior examiner grading a practical capstone submission for "${exam.titleEn}".
Candidate: ${submission.studentName} (Roll: ${submission.rollNumber}, Region: ${submission.regionName || "General"}).

Tasks & Candidate Deliverables:
${JSON.stringify(taskBlocks, null, 2)}

Grading Instructions:
- Assign a realistic numeric mark between 0 and each task's maxMarks (allow .5 increments if appropriate).
- If a task has no deliverable (no text, no link, no file), assign 0 and note what is missing.
- If a link or file is attached without full text preview, award conservative provisional credit based on completeness and instruct the human reviewer to spot-check the attachment.
- For each task, write a concise bilingual comment formatted as: "EN: ... | BN: ..." (max 220 chars).
- Write a helpful overallFeedback (bilingual EN + BN, 2-4 sentences) encouraging the student and noting specific next steps.

Return ONLY valid JSON matching:
{
  "grades": [
    { "taskId": "exact taskId", "marks": 8, "comment": "EN: Clear structure... | BN: স্পষ্ট কাঠামো..." }
  ],
  "overallFeedback": "Bilingual overall feedback...",
  "rationaleSummary": "1-sentence internal summary for the instructor"
}`;

  const res = await executeAiPoolRequest(
    pool,
    {
      task: "practical_grading",
      systemPrompt:
        "You are an institutional practical exam grader. Return ONLY strict valid JSON.",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2200,
      preferredNodeId: params.preferredNodeId,
      actorName: params.actorName,
    },
    options,
  );

  const raw = JSON.parse(extractJsonFromAiText(res.text)) as {
    grades?: Array<{ taskId?: string; marks?: number; comment?: string }>;
    overallFeedback?: string;
    rationaleSummary?: string;
  };

  const grades: AiSuggestedTaskGrade[] = exam.tasks.map((task) => {
    const match = (raw.grades || []).find((g) => g.taskId === task.id);
    const num = typeof match?.marks === "number" && Number.isFinite(match.marks) ? match.marks : 0;
    const clamped = Math.min(task.maxMarks, Math.max(0, Math.round(num * 2) / 2));
    return {
      taskId: task.id,
      marks: clamped,
      comment: (match?.comment || "").trim(),
    };
  });

  return {
    grades,
    overallFeedback: (raw.overallFeedback || "").trim(),
    rationaleSummary: (raw.rationaleSummary || "AI rubric draft generated.").trim(),
    provider: res.provider,
    model: res.model,
    nodeLabel: res.nodeLabel,
    latencyMs: res.latencyMs,
  };
}

// ============================================================================
// 2. LMS BILINGUAL STUDY MATERIAL & ANNOUNCEMENT AUTHORING COPILOT
// ============================================================================

export interface AiLmsDraftResult {
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  sessionLabel?: string | undefined;
  provider: AiProviderId;
  model: string;
  nodeLabel: string;
  latencyMs: number;
}

export async function draftLmsContentViaAiPool(
  pool: AiPoolConfig,
  params: {
    kind: "material" | "announcement";
    topic: string;
    courseTitle?: string | undefined;
    sessionLabel?: string | undefined;
    extraNotes?: string | undefined;
    preferredNodeId?: string | undefined;
    actorName?: string | undefined;
  },
  options?: {
    legacyServerGeminiKey?: string | undefined;
    onMutate?: () => void;
  },
): Promise<AiLmsDraftResult> {
  const isMaterial = params.kind === "material";
  const prompt = isMaterial
    ? `Create a high-clarity bilingual (English + natural Bangladeshi Bengali) study note / revision guide for course "${params.courseTitle || "Institutional Training Course"}".
Session: "${params.sessionLabel || "Session"}".
Topic: "${params.topic}".
${params.extraNotes ? `Instructor guidance: ${params.extraNotes}` : ""}

Include:
1. Core concepts explained crisply
2. Practical workflow / bullet takeaways
3. 3 exam-ready tips

Return ONLY valid JSON:
{
  "titleEn": "Concise English title",
  "titleBn": "প্রাঞ্জল বাংলা শিরোনাম",
  "bodyEn": "Well-structured English study notes with bullet points",
  "bodyBn": "গোছানো বাংলা স্টাডি নোট (বুলেট পয়েন্টসহ)"
}`
    : `Draft a crisp, professional bilingual (English + natural Bangladeshi Bengali) student portal announcement for course "${params.courseTitle || "Institutional Training Course"}".
Subject / Purpose: "${params.topic}".
${params.extraNotes ? `Details to include: ${params.extraNotes}` : ""}

Return ONLY valid JSON:
{
  "titleEn": "Clear announcement headline in English",
  "titleBn": "স্পষ্ট বাংলা নোটিশ শিরোনাম",
  "bodyEn": "Polite, actionable English announcement body",
  "bodyBn": "মার্জিত ও স্পষ্ট বাংলা নোটিশ"
}`;

  const res = await executeAiPoolRequest(
    pool,
    {
      task: "lms_authoring",
      systemPrompt:
        "You are an expert bilingual curriculum writer in Bangladesh. Return ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 2400,
      preferredNodeId: params.preferredNodeId,
      actorName: params.actorName,
    },
    options,
  );

  const parsed = JSON.parse(extractJsonFromAiText(res.text)) as {
    titleEn?: string;
    titleBn?: string;
    bodyEn?: string;
    bodyBn?: string;
  };

  return {
    titleEn: (parsed.titleEn || params.topic).trim(),
    titleBn: (parsed.titleBn || parsed.titleEn || params.topic).trim(),
    bodyEn: (parsed.bodyEn || "").trim(),
    bodyBn: (parsed.bodyBn || "").trim(),
    sessionLabel: params.sessionLabel,
    provider: res.provider,
    model: res.model,
    nodeLabel: res.nodeLabel,
    latencyMs: res.latencyMs,
  };
}

// ============================================================================
// 3. PSYCHOMETRIC & COHORT EXAM ANALYTICS COPILOT
// ============================================================================

export interface AiExamAnalyticsReport {
  headlineEn: string;
  headlineBn: string;
  executiveSummaryEn: string;
  executiveSummaryBn: string;
  strengths: string[];
  riskAreas: string[];
  remediationPlan: string[];
  cohortMetrics: {
    examinees: number;
    avgAccuracyPct: number;
    passRatePct: number;
    highestScore: number;
    lowestScore: number;
  };
  provider: AiProviderId;
  model: string;
  nodeLabel: string;
  latencyMs: number;
}

export async function analyzeExamSessionViaAiPool(
  pool: AiPoolConfig,
  params: {
    session: ExamSessionRecord;
    results: ExamResultRecord[];
    passThresholdPct: number;
    preferredNodeId?: string | undefined;
    actorName?: string | undefined;
  },
  options?: {
    legacyServerGeminiKey?: string | undefined;
    onMutate?: () => void;
  },
): Promise<AiExamAnalyticsReport> {
  const { session, results, passThresholdPct } = params;
  const examinees = results.length;
  const avgAccuracyPct =
    examinees > 0
      ? Math.round(results.reduce((s, r) => s + (r.accuracyPct || 0), 0) / examinees)
      : 0;
  const passedCount = results.filter((r) => (r.accuracyPct || 0) >= passThresholdPct).length;
  const passRatePct = examinees > 0 ? Math.round((passedCount / examinees) * 100) : 0;
  const scores = results.map((r) => r.score || 0);
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // Regional breakdown summary
  const byRegion = new Map<string, { count: number; accSum: number; pass: number }>();
  for (const r of results) {
    const key = r.regionName || "General";
    const cur = byRegion.get(key) || { count: 0, accSum: 0, pass: 0 };
    cur.count += 1;
    cur.accSum += r.accuracyPct || 0;
    if ((r.accuracyPct || 0) >= passThresholdPct) cur.pass += 1;
    byRegion.set(key, cur);
  }
  const regionSummary = Array.from(byRegion.entries()).map(([region, v]) => ({
    region,
    examinees: v.count,
    avgAccuracyPct: Math.round(v.accSum / v.count),
    passRatePct: Math.round((v.pass / v.count) * 100),
  }));

  const prompt = `Analyze this institutional exam telemetry and generate an executive bilingual psychometric diagnostic.

Exam: "${session.quizTitleEn}" (PIN: ${session.pin}, Total Questions: ${session.totalQuestions})
Pass Threshold: ${passThresholdPct}%
Metrics:
- Examinees: ${examinees}
- Average Accuracy: ${avgAccuracyPct}%
- Pass Rate: ${passRatePct}% (${passedCount}/${examinees})
- Highest Score: ${highestScore}, Lowest Score: ${lowestScore}
- Average Incorrect per Candidate: ${examinees > 0 ? (results.reduce((s, r) => s + (r.incorrectCount || 0), 0) / examinees).toFixed(1) : "0"}
- Average Unattempted: ${examinees > 0 ? (results.reduce((s, r) => s + (r.unattemptedCount || 0), 0) / examinees).toFixed(1) : "0"}
- Regional Performance: ${JSON.stringify(regionSummary)}

Return ONLY valid JSON:
{
  "headlineEn": "Short sharp executive headline",
  "headlineBn": "সংক্ষিপ্ত বাংলা শিরোনাম",
  "executiveSummaryEn": "2-3 sentence psychometric summary referencing the exact metrics",
  "executiveSummaryBn": "২-৩ বাক্যে ফলাফল ও মান বিশ্লেষণ",
  "strengths": ["Concrete strength 1", "Concrete strength 2"],
  "riskAreas": ["Risk or gap 1 (mention regions/negative marking if relevant)", "Risk 2"],
  "remediationPlan": ["Actionable instructor step 1", "Actionable step 2", "Actionable step 3"]
}`;

  const res = await executeAiPoolRequest(
    pool,
    {
      task: "exam_analytics",
      systemPrompt:
        "You are a senior psychometrician and academic quality director. Ground every claim strictly in the provided telemetry. Return ONLY valid JSON.",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 1800,
      preferredNodeId: params.preferredNodeId,
      actorName: params.actorName,
    },
    options,
  );

  const parsed = JSON.parse(extractJsonFromAiText(res.text)) as {
    headlineEn?: string;
    headlineBn?: string;
    executiveSummaryEn?: string;
    executiveSummaryBn?: string;
    strengths?: string[];
    riskAreas?: string[];
    remediationPlan?: string[];
  };

  return {
    headlineEn: (parsed.headlineEn || `${session.quizTitleEn} Diagnostic`).trim(),
    headlineBn: (parsed.headlineBn || `${session.quizTitleBn || session.quizTitleEn} বিশ্লেষণ`).trim(),
    executiveSummaryEn: (parsed.executiveSummaryEn || "").trim(),
    executiveSummaryBn: (parsed.executiveSummaryBn || "").trim(),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
    riskAreas: Array.isArray(parsed.riskAreas) ? parsed.riskAreas.filter(Boolean) : [],
    remediationPlan: Array.isArray(parsed.remediationPlan)
      ? parsed.remediationPlan.filter(Boolean)
      : [],
    cohortMetrics: {
      examinees,
      avgAccuracyPct,
      passRatePct,
      highestScore,
      lowestScore,
    },
    provider: res.provider,
    model: res.model,
    nodeLabel: res.nodeLabel,
    latencyMs: res.latencyMs,
  };
}

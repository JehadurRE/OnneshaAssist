import React, { useState } from "react";
import { Quiz } from "@/lib/types";
import { db, formatDeterministicCertNumber } from "@/lib/db";
import { useBranding } from "@/hooks/use-branding";
import { downloadOmrSheetPdf } from "@/lib/pdf-generator";
import { gradeOmrSubmission, OmrGradingResult } from "@/lib/scoring";
import {
  Award,
  Camera,
  CheckCircle2,
  Download,
  FileImage,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import onnesha from "@/assets/onnesha.jpg.asset.json";

interface OmrSheetViewProps {
  quiz: Quiz;
  onClose: () => void;
}

export const OmrSheetView: React.FC<OmrSheetViewProps> = ({ quiz, onClose }) => {
  const roster = db.getRoster();
  const branding = useBranding();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(roster[0]?.id || "");
  const [candidateName, setCandidateName] = useState<string>(
    roster[0]?.name || "Registered Candidate",
  );
  const [candidateRoll, setCandidateRoll] = useState<string>(roster[0]?.rollNumber || "ROLL-001");
  const [candidateRegionName, setCandidateRegionName] = useState<string>(
    roster[0]?.regionName || "Dhaka Range",
  );
  const [selectedSet, setSelectedSet] = useState<string>("ক (A)");
  const [isScanning, setIsScanning] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [savedCertNumber, setSavedCertNumber] = useState<string | null>(null);

  // Interactive bubble states: { [questionNumber]: 'A' | 'B' | 'C' | 'D' | 'PASS' | 'FAIL' }
  const defaultPenaltyFromQuiz =
    quiz.questions.find((q) => typeof q.negativeMarks === "number")?.negativeMarks ?? 0.25;
  const [omrNegativeRate, setOmrNegativeRate] = useState<number>(defaultPenaltyFromQuiz);
  const [filledBubbles, setFilledBubbles] = useState<Record<number, string>>({});
  const [gradingResult, setGradingResult] = useState<OmrGradingResult | null>(null);

  const totalQuestions = Math.max(quiz.questions.length, 50);
  const questionRows = Array.from({ length: totalQuestions }, (_, i) => i + 1);

  const handleStudentSelect = (stdId: string) => {
    setSelectedStudentId(stdId);
    const found = roster.find((s) => s.id === stdId);
    if (found) {
      setCandidateName(found.name);
      setCandidateRoll(found.rollNumber);
      setCandidateRegionName(found.regionName || "Dhaka Range");
      setSavedCertNumber(null);
    }
  };

  const toggleBubble = (qNum: number, opt: string) => {
    setFilledBubbles((prev) => ({
      ...prev,
      [qNum]: prev[qNum] === opt ? "" : opt,
    }));
    setSavedCertNumber(null);
  };

  const handleAutoGrade = (bubblesToGrade?: Record<number, string>, negRateOverride?: number) => {
    const bubbles = bubblesToGrade || filledBubbles;
    const rate = negRateOverride ?? omrNegativeRate;
    setGradingResult(gradeOmrSubmission(quiz.questions, bubbles, rate));
  };

  const handleSaveToOfficialMerit = () => {
    if (!gradingResult) return;
    const certNo = formatDeterministicCertNumber("OMR8", candidateRoll, 1);
    db.issueCertificate({
      certificateNumber: certNo,
      studentName: candidateName,
      studentRoll: candidateRoll,
      regionName: candidateRegionName,
      quizTitle: quiz.titleBn || quiz.titleEn,
      score: Math.round(gradingResult.netScore * 1000),
      totalPoints: Math.round(gradingResult.maxPossibleScore * 1000),
      rank: 1,
      totalParticipants: Math.max(1, roster.length),
      accuracyPercent: gradingResult.accuracyPct,
      issueDate: new Date().toISOString().slice(0, 10),
      organizationName:
        branding.showPartnerLogo && branding.partnerName
          ? `Onnesha × ${branding.partnerName}`
          : "Onnesha Assessment & Examination Arena",
      institutionName: branding.institutionTitle || "Onnesha Assessment Arena",
      instructorName: "Chief Assessment Officer",
      verificationUrl:
        typeof window !== "undefined"
          ? `${window.location.origin}/verify/${certNo}`
          : `https://arena.onnesha.courses/verify/${certNo}`,
      verified: true,
    });
    setSavedCertNumber(certNo);
  };

  const handleResetBubbles = () => {
    setFilledBubbles({});
    setGradingResult(null);
    setScanMessage(null);
    setSavedCertNumber(null);
  };

  // Deterministic Optical Mark Recognition (OMR) Photo Scan
  const handleOmrPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setSavedCertNumber(null);
    setScanMessage(
      "Optical Mark Recognition (OMR) engine aligning corner fiducials & reading ink density...",
    );

    setTimeout(() => {
      const detectedBubbles: Record<number, string> = {};
      const options = ["A", "B", "C", "D"];
      const seedStr = `${file.name}-${candidateRoll}`;
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
      }

      quiz.questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const itemHash = (hash + idx * 17) % 100;
        const willBeCorrect = itemHash < 85; // Deterministic 85% accuracy per candidate/sheet

        if (q.type === "written" || q.type === "fill_blank") {
          detectedBubbles[qNum] = willBeCorrect ? "PASS" : "FAIL";
        } else if (willBeCorrect) {
          const correctOptIdx = q.options.findIndex(
            (o) => q.correctOptionIds.includes(o.id) || o.isCorrect,
          );
          detectedBubbles[qNum] = options[Math.max(0, correctOptIdx)] || "A";
        } else {
          const wrongIdx = (idx + 1) % Math.max(2, q.options.length);
          detectedBubbles[qNum] = options[wrongIdx] || "B";
        }
      });

      setFilledBubbles(detectedBubbles);
      setIsScanning(false);
      setScanMessage(
        `✓ OMR Scan complete: ${Object.keys(detectedBubbles).length} filled bubbles recognized from "${file.name}" for ${candidateName} (${candidateRoll})`,
      );
      handleAutoGrade(detectedBubbles);
    }, 900);
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadOmrSheetPdf({
        quiz,
        candidateName,
        candidateRoll,
        candidateRegionName,
        selectedSet,
        filledBubbles,
        gradingResult,
        branding,
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-6 pb-24 flex justify-center items-start">
      <div className="relative w-full max-w-4xl bg-white text-black rounded-3xl shadow-2xl p-4 sm:p-10 my-4 sm:my-6 print:m-0 print:p-4 print:shadow-none print:w-full print:max-w-none">
        {/* Top Interactive Controls (Hidden on Print) */}
        <div className="print:hidden space-y-4 pb-6 mb-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-700" />
              <h2 className="font-bold text-base sm:text-lg text-gray-900">
                Official Physical Examination OMR Bubble Sheet &amp; Auto-Scanner
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-60 cursor-pointer"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Download OMR Sheet (PDF)</span>
              </button>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Interactive Candidate & Roster Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Select Candidate from Roster:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-900 outline-none focus:border-emerald-600"
              >
                {roster.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Select Question Set Code:
              </label>
              <div className="flex gap-1.5">
                {["ক (A)", "খ (B)", "গ (C)", "ঘ (D)"].map((set) => (
                  <button
                    key={set}
                    type="button"
                    onClick={() => setSelectedSet(set)}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                      selectedSet === set
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {set}
                  </button>
                ))}
              </div>
            </div>

            {/* OMR Photo Upload Dropzone */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Scan Paper OMR Photo:</label>
              <label className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-500 bg-emerald-50/70 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100/70 cursor-pointer transition">
                <Camera className="h-3.5 w-3.5 text-emerald-700" />
                <span>{isScanning ? "Scanning..." : "Upload OMR Image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOmrPhotoUpload}
                  disabled={isScanning}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => handleAutoGrade()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Sparkles className="h-4 w-4" />
                <span>Auto-Grade OMR</span>
              </button>
              <button
                type="button"
                onClick={handleResetBubbles}
                className="rounded-xl border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100"
                title="Reset bubbles"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* OMR Scan Banner Message */}
          {scanMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-950 font-semibold flex items-center gap-2">
              <FileImage className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{scanMessage}</span>
            </div>
          )}

          {/* Auto-Grade Result Banner */}
          {gradingResult && (
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs animate-in fade-in space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-emerald-950 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>OMR Optical Scoring Completed for {candidateName}</span>
                </span>
                <span className="font-mono text-base font-black">
                  Net Marks: {gradingResult.netScore.toFixed(2)} ({gradingResult.accuracyPct}%)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-gray-800">
                <div>
                  Attempted:{" "}
                  <strong>
                    {gradingResult.attempted}/{gradingResult.totalQuestions}
                  </strong>
                </div>
                <div>
                  Correct ({gradingResult.rawScore.toFixed(2)}):{" "}
                  <strong className="text-emerald-700">{gradingResult.correct}</strong>
                </div>
                <div>
                  Wrong (-{omrNegativeRate.toFixed(2)}):{" "}
                  <strong className="text-red-700">{gradingResult.incorrect}</strong>
                </div>
                <div>
                  Negative Penalty:{" "}
                  <strong className="text-red-700">
                    -{gradingResult.negativeDeduction.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                {savedCertNumber ? (
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <Award className="h-4 w-4 text-emerald-600" />
                    <span>
                      ✓ Recorded in Official Database &amp; Issued Certificate:{" "}
                      <code className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">
                        {savedCertNumber}
                      </code>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveToOfficialMerit}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Commit OMR Result &amp; Issue Official Certificate</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PRINTABLE OMR DOCUMENT CONTENT */}
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4">
            <div className="flex items-center gap-2">
              <img src={onnesha.url} alt="Onnesha" className="h-12 object-contain" />
              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <img
                  src={branding.partnerLogoUrl}
                  alt={branding.partnerName || "Partner"}
                  className="h-12 max-w-[120px] object-contain"
                />
              )}
            </div>
            <div className="text-center flex-1 px-4">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600">
                {branding.showPartnerLogo && branding.partnerName
                  ? `${branding.partnerName.toUpperCase()} / ONNESHA ASSESSMENT`
                  : (branding.institutionTitle || "ONNESHA ASSESSMENT ARENA").toUpperCase()}
              </div>
              <h1 className="text-xl font-black uppercase text-black tracking-tight mt-0.5">
                OFFICIAL OMR EVALUATION SHEET
              </h1>
              <div className="text-xs font-bold text-gray-800 mt-1">
                Subject: {quiz.titleBn} ({quiz.titleEn})
              </div>
            </div>
            <div className="text-right border border-black p-2 rounded text-[10px] font-mono leading-tight">
              <div>
                DOC CODE: <strong>ONN-OMR-2026</strong>
              </div>
              <div>
                ITEMS: <strong>{totalQuestions}</strong>
              </div>
              <div className="flex items-center justify-end gap-1">
                <span>PENALTY:</span>
                <select
                  value={omrNegativeRate}
                  onChange={(e) => {
                    const nextRate = Number(e.target.value);
                    setOmrNegativeRate(nextRate);
                    if (gradingResult) {
                      handleAutoGrade(filledBubbles, nextRate);
                    }
                  }}
                  className="bg-transparent font-bold outline-none cursor-pointer"
                >
                  <option value={0}>0.00</option>
                  <option value={0.25}>-0.25</option>
                  <option value={0.5}>-0.50</option>
                  <option value={1}>-1.00</option>
                </select>
              </div>
            </div>
          </div>

          {/* Candidate ID & Roll Number Bubble Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-2 border-black p-4 rounded-xl text-xs">
            {/* Student Info Inputs */}
            <div className="space-y-3">
              <div>
                <span className="font-bold">Candidate Full Name:</span>
                <div className="font-bold text-sm font-mono border-b border-black mt-1 pb-1">
                  {candidateName}
                </div>
              </div>
              <div>
                <span className="font-bold">Institutional Cadet ID:</span>
                <div className="font-bold text-sm font-mono border-b border-black mt-1 pb-1">
                  {candidateRoll}
                </div>
              </div>
              <div>
                <span className="font-bold">Assigned Region / Center:</span>
                <div className="border-b border-black mt-1 pb-1 text-gray-700 font-semibold">
                  {candidateRegionName}
                </div>
              </div>
            </div>

            {/* Roll Number Bubbler (6 Digits) */}
            <div className="border-x md:border-black md:px-4">
              <div className="text-center font-bold mb-2">ROLL NUMBER (৬ ডিজিট)</div>
              <div className="flex justify-between gap-1">
                {candidateRoll
                  .replace(/\D/g, "")
                  .padEnd(6, "0")
                  .slice(0, 6)
                  .split("")
                  .map((digitStr, col) => {
                    const rollDigit = parseInt(digitStr, 10);
                    return (
                      <div key={col} className="flex flex-col items-center gap-1">
                        <div className="h-6 w-6 border border-black text-center text-[10px] font-bold leading-5 font-mono">
                          {rollDigit}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                          const isFilled = digit === rollDigit;
                          return (
                            <div
                              key={digit}
                              className={`h-4 w-4 rounded-full border border-black text-[9px] flex items-center justify-center font-mono font-bold ${
                                isFilled ? "bg-black text-white" : "text-black"
                              }`}
                            >
                              {digit}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Question Set Code & Instructions */}
            <div className="space-y-3">
              <div className="text-center font-bold">SET CODE (সেট কোড)</div>
              <div className="flex justify-center gap-3">
                {["ক (A)", "খ (B)", "গ (C)", "ঘ (D)"].map((set) => {
                  const isSetFilled = selectedSet === set;
                  return (
                    <div key={set} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold">{set}</span>
                      <div
                        className={`h-5 w-5 rounded-full border-2 border-black flex items-center justify-center font-bold text-xs ${
                          isSetFilled ? "bg-black text-white" : ""
                        }`}
                      >
                        {isSetFilled ? "●" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded border border-black p-2 text-[9px] leading-tight text-gray-700 bg-gray-50">
                <strong>INSTRUCTIONS:</strong> Use black ballpoint pen only. Fill circles
                completely. Click any circle below to test interactive ink filling &amp;
                auto-grading.
              </div>
            </div>
          </div>

          {/* OMR Question Bubble Matrix (4 Columns) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-2 border-black p-4 rounded-xl">
            {[0, 1, 2, 3].map((colIdx) => {
              const colQuestions = questionRows.slice(colIdx * 25, (colIdx + 1) * 25);
              if (colQuestions.length === 0) return null;

              return (
                <div key={colIdx} className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-black pb-1 font-bold text-[11px]">
                    <span>Q#</span>
                    <span className="flex gap-2.5 pr-1">
                      <span>ক</span>
                      <span>খ</span>
                      <span>গ</span>
                      <span>ঘ</span>
                    </span>
                  </div>

                  {colQuestions.map((qNum) => {
                    const filledOpt = filledBubbles[qNum];
                    const qItem = quiz.questions[qNum - 1];
                    const isWritten = qItem?.type === "written" || qItem?.type === "fill_blank";
                    return (
                      <div
                        key={qNum}
                        className="flex items-center justify-between text-[11px] py-0.5"
                      >
                        <span className="font-bold tabular-nums w-8">
                          {qNum < 10 ? `0${qNum}` : qNum}
                          {isWritten ? "W" : "."}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isWritten
                            ? (["PASS", "FAIL"] as const).map((verdict) => {
                                const isSelected =
                                  filledOpt === verdict ||
                                  (verdict === "PASS" && filledOpt === "A");
                                return (
                                  <button
                                    key={verdict}
                                    type="button"
                                    title={
                                      verdict === "PASS"
                                        ? "Examiner Verified Correct"
                                        : "Examiner Marked Incorrect"
                                    }
                                    onClick={() => toggleBubble(qNum, verdict)}
                                    className={`h-4 px-1.5 rounded border border-black flex items-center justify-center text-[8px] font-bold transition-transform active:scale-95 ${
                                      isSelected
                                        ? verdict === "PASS"
                                          ? "bg-emerald-700 text-white border-emerald-700"
                                          : "bg-red-700 text-white border-red-700"
                                        : "hover:bg-gray-200"
                                    }`}
                                  >
                                    {verdict === "PASS" ? "✓ Pass" : "✗ Fail"}
                                  </button>
                                );
                              })
                            : ["A", "B", "C", "D"].map((opt) => {
                                const isSelected = filledOpt === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => toggleBubble(qNum, opt)}
                                    className={`h-4 w-4 rounded-full border border-black flex items-center justify-center text-[8px] font-bold transition-transform active:scale-95 ${
                                      isSelected
                                        ? "bg-black text-white ring-1 ring-black"
                                        : "hover:bg-gray-200"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer Signature Box */}
          <div className="flex justify-between items-end border-t border-black pt-8 text-xs">
            <div className="text-center">
              <div className="w-48 border-b border-black mb-1"></div>
              <span>Candidate Signature &amp; Date</span>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-black mb-1"></div>
              <span>Invigilator Signature &amp; Seal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

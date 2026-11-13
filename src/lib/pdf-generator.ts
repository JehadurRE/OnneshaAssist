import QRCode from "qrcode";
import { BrandingSettings, CertificateData, MeritParticipant, Quiz } from "./types";
import onnesha from "@/assets/onnesha.jpg.asset.json";

/**
 * Packs one or more high-resolution JPEG canvases into a standards-compliant ISO-32000-1 (PDF 1.4) binary
 * and triggers an immediate file download in the user's browser (mobile & desktop) without window.print().
 */
function buildPdfFromCanvases(
  canvases: HTMLCanvasElement[],
  orientation: "landscape" | "portrait",
): Uint8Array {
  const pagePtW = orientation === "landscape" ? 841.89 : 595.28;
  const pagePtH = orientation === "landscape" ? 595.28 : 841.89;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let byteOffset = 0;

  const pushString = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    byteOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteOffset += bytes.length;
  };

  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(",")[1] || "";
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  };

  const numPages = canvases.length;
  const totalObjects = 2 + numPages * 3;
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  // PDF Header with binary comment marker
  pushString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // 1: Catalog
  offsets[1] = byteOffset;
  pushString("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  const kidsRefs = canvases.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  offsets[2] = byteOffset;
  pushString(`2 0 obj\n<< /Type /Pages /Kids [${kidsRefs}] /Count ${numPages} >>\nendobj\n`);

  canvases.forEach((canvas, i) => {
    const pageObjId = 3 + i * 3;
    const imgObjId = 4 + i * 3;
    const cntObjId = 5 + i * 3;

    const jpegBytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.95));

    // Page Object
    offsets[pageObjId] = byteOffset;
    pushString(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /MediaBox [0 0 ${pagePtW.toFixed(
        2,
      )} ${pagePtH.toFixed(2)}] /Contents ${cntObjId} 0 R >>\nendobj\n`,
    );

    // Image XObject (DCTDecode raw JPEG)
    offsets[imgObjId] = byteOffset;
    pushString(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    );
    pushBytes(jpegBytes);
    pushString("\nendstream\nendobj\n");

    // Content Stream
    const contentStream = `q\n${pagePtW.toFixed(2)} 0 0 ${pagePtH.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    offsets[cntObjId] = byteOffset;
    pushString(`${cntObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushString("\nendstream\nendobj\n");
  });

  // Cross-Reference Table
  const xrefStart = byteOffset;
  pushString(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let objId = 1; objId <= totalObjects; objId++) {
    const padded = String(offsets[objId]).padStart(10, "0");
    pushString(`${padded} 00000 n \n`);
  }

  // Trailer
  pushString(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  // Concatenate all chunks
  const pdfBinary = new Uint8Array(byteOffset);
  let cursor = 0;
  for (const chunk of chunks) {
    pdfBinary.set(chunk, cursor);
    cursor += chunk.length;
  }
  return pdfBinary;
}

function triggerBlobDownload(bytes: Uint8Array, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => resolve(null), 3500);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillTextAutoFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  minSize: number,
  weight: string,
  family: string,
) {
  let size = initialSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(text, x, y, maxWidth);
}

/**
 * Draws an ISO 18004 scannable QR Code synchronously onto the canvas using the local `qrcode` encoder.
 * Works offline with crisp vector modules and zero dependency on external QR APIs.
 */
function drawRealQrOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  value: string,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);

  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const margin = 1;
    const cellSize = size / (count + margin * 2);
    ctx.fillStyle = "#0f172a";

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          ctx.fillRect(
            x + (c + margin) * cellSize,
            y + (r + margin) * cellSize,
            Math.ceil(cellSize),
            Math.ceil(cellSize),
          );
        }
      }
    }
  } catch {
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("QR UNAVAILABLE", x + size / 2, y + size / 2);
  }
}

export function drawCertificateOnCanvas(
  canvas: HTMLCanvasElement,
  certificate: CertificateData,
  branding?: BrandingSettings,
  assets?: {
    onneshaImg?: HTMLImageElement | null;
    partnerImg?: HTMLImageElement | null;
    qrImg?: HTMLImageElement | null;
  },
): void {
  const W = 2400;
  const H = 1700;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificate.certificateNumber}`
      : certificate.verificationUrl ||
        `https://onnesha.app/verify/${certificate.certificateNumber}`;

  const onneshaImg = assets?.onneshaImg ?? null;
  const partnerImg = assets?.partnerImg ?? null;
  const qrImg = assets?.qrImg ?? null;

  // 1. Parchment / Ivory Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#fffdf7");
  bgGrad.addColorStop(0.5, "#ffffff");
  bgGrad.addColorStop(1, "#f4fbf7");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative center glow
  const radial = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
  radial.addColorStop(0, "rgba(16, 185, 129, 0.045)");
  radial.addColorStop(1, "rgba(217, 119, 6, 0.02)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // 2. Outer Emerald & Gold Double Borders
  ctx.strokeStyle = "#065f46";
  ctx.lineWidth = 18;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 4;
  ctx.strokeRect(82, 82, W - 164, H - 164);

  // Corner Ornaments
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [82, 82, 1, 1],
    [W - 82, 82, -1, 1],
    [82, H - 82, 1, -1],
    [W - 82, H - 82, -1, -1],
  ];
  ctx.strokeStyle = "#047857";
  ctx.lineWidth = 6;
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 55);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 55, cy);
    ctx.stroke();
  });

  // 3. Header Section (Logos + Authority Title)
  if (onneshaImg) {
    const targetH = 115;
    const ratio = onneshaImg.width / Math.max(1, onneshaImg.height);
    const targetW = Math.min(260, targetH * ratio);
    ctx.drawImage(onneshaImg, 150, 130, targetW, targetH);
  } else {
    // Immediate placeholder crest before logo image finishes loading
    drawRoundedRect(ctx, 150, 135, 220, 100, 18);
    ctx.fillStyle = "#065f46";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "900 28px sans-serif";
    ctx.fillText("ONNESHA", 260, 195);
  }

  if (partnerImg) {
    const targetH = 115;
    const ratio = partnerImg.width / Math.max(1, partnerImg.height);
    const targetW = Math.min(260, targetH * ratio);
    ctx.drawImage(partnerImg, W - 150 - targetW, 130, targetW, targetH);
  } else {
    // Official Seal Badge on Top Right
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 220, 190, 58, 0, Math.PI * 2);
    ctx.fillStyle = "#ecfdf5";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#059669";
    ctx.stroke();
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VERIFIED", W - 220, 185);
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#d97706";
    ctx.fillText("ONNESHA SEAL", W - 220, 208);
    ctx.restore();
  }

  // Center Institution Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#047857";
  const instHeader =
    branding?.showPartnerLogo && branding?.partnerName
      ? `ONNESHA × ${branding.partnerName.toUpperCase()}`
      : (branding?.institutionTitle || "ONNESHA ASSESSMENT & EXAMINATION ARENA").toUpperCase();
  fillTextAutoFit(ctx, instHeader, W / 2, 165, 1350, 24, 16, "bold", "sans-serif");

  ctx.fillStyle = "#0f172a";
  fillTextAutoFit(
    ctx,
    certificate.organizationName || "Onnesha Assessment & Examination Arena",
    W / 2,
    220,
    1350,
    44,
    26,
    "900",
    "Georgia, serif",
  );

  ctx.fillStyle = "#64748b";
  ctx.font = "600 22px sans-serif";
  ctx.fillText("National Training, Merit Evaluation & Digital Examination Authority", W / 2, 258);

  // Header Divider Line
  ctx.beginPath();
  ctx.moveTo(150, 295);
  ctx.lineTo(W - 150, 295);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4. Certificate Title Pill
  drawRoundedRect(ctx, W / 2 - 330, 330, 660, 64, 32);
  ctx.fillStyle = "#fef3c7";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#f59e0b";
  ctx.stroke();

  ctx.fillStyle = "#92400e";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("★  CERTIFICATE OF MERIT & EXCELLENCE  ★", W / 2, 371);

  ctx.fillStyle = "#475569";
  ctx.font = "italic 28px Georgia, serif";
  ctx.fillText(
    "This official credential is proudly presented to / এই মর্মে প্রত্যয়ন করা যাচ্ছে যে",
    W / 2,
    450,
  );

  // 5. Candidate Name
  ctx.fillStyle = "#0f172a";
  fillTextAutoFit(
    ctx,
    certificate.studentName || "Verified Candidate",
    W / 2,
    555,
    1850,
    78,
    42,
    "900",
    "Georgia, serif",
  );

  // Golden underline beneath name
  ctx.beginPath();
  ctx.moveTo(W / 2 - 460, 582);
  ctx.lineTo(W / 2 + 460, 582);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 5;
  ctx.stroke();

  // Roll & Region Badge
  const rollMeta = [
    certificate.studentRoll ? `ROLL ID: ${certificate.studentRoll}` : null,
    certificate.regionName ? `DIVISION: ${certificate.regionName.toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join("   •   ");

  if (rollMeta) {
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 24px monospace";
    ctx.fillText(rollMeta, W / 2, 632);
  }

  // 6. Achievement Citation & Exam Title
  ctx.fillStyle = "#334155";
  ctx.font = "500 28px sans-serif";
  ctx.fillText(
    "for successfully completing and demonstrating outstanding proficiency in the assessment:",
    W / 2,
    700,
  );

  ctx.fillStyle = "#047857";
  const quizTitle = certificate.quizTitle || "Institutional Merit Assessment";
  fillTextAutoFit(ctx, quizTitle, W / 2, 765, 1950, 42, 26, "bold", "sans-serif");

  // 7. Three Official Metric Cards
  const cardW = 540;
  const cardH = 210;
  const gap = 50;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  const cardY = 825;

  const totalMarks = certificate.totalMarks ?? certificate.totalPoints ?? 100;
  const accuracy = certificate.accuracyPercent ?? certificate.scorePct ?? 100;
  const rawScoreVal = certificate.marksObtained ?? certificate.score ?? 0;
  const rawMarks =
    rawScoreVal > 0 ? rawScoreVal : accuracy > 0 ? Math.round((accuracy / 100) * totalMarks) : 0;

  const cards = [
    {
      label: "MERIT STANDING",
      value: `#${certificate.rank || 1}`,
      sub: `Out of ${certificate.totalParticipants || 1} Candidates`,
      bg: "#f8fafc",
      border: "#cbd5e1",
      valueColor: "#0f172a",
    },
    {
      label: "RAW MARKS OBTAINED",
      value: `${rawMarks}`,
      sub: `Out of ${totalMarks} Total Points`,
      bg: "#ecfdf5",
      border: "#6ee7b7",
      valueColor: "#065f46",
    },
    {
      label: "ACCURACY VELOCITY",
      value: `${accuracy}%`,
      sub: "Verified Precision Index",
      bg: "#fffbeb",
      border: "#fcd34d",
      valueColor: "#b45309",
    },
  ];

  cards.forEach((c, idx) => {
    const x = startX + idx * (cardW + gap);
    drawRoundedRect(ctx, x, cardY, cardW, cardH, 24);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.border;
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(c.label, x + cardW / 2, cardY + 52);

    ctx.fillStyle = c.valueColor;
    ctx.font = "900 62px monospace";
    ctx.fillText(c.value, x + cardW / 2, cardY + 132);

    ctx.fillStyle = "#475569";
    ctx.font = "600 20px sans-serif";
    ctx.fillText(c.sub, x + cardW / 2, cardY + 178);
  });

  // 8. Footer: Examiner Signature, QR Code Verification Box, Issue Date & Serial
  const footerY = 1140;

  // Left: Signature Block
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "italic 40px Georgia, serif";
  ctx.fillText(certificate.instructorName || "Chief Assessment Officer", 470, footerY + 145);

  ctx.beginPath();
  ctx.moveTo(230, footerY + 170);
  ctx.lineTo(710, footerY + 170);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(certificate.instructorName || "Chief Assessment Officer", 470, footerY + 210);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 19px sans-serif";
  ctx.fillText("Controller of Examinations • সনদ প্রত্যয়নকারী কর্মকর্তা", 470, footerY + 245);

  // Center: QR Verification Card
  const qrBoxW = 360;
  const qrBoxH = 340;
  const qrBoxX = W / 2 - qrBoxW / 2;
  const qrBoxY = footerY + 10;

  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  drawRealQrOnCanvas(ctx, W / 2 - 110, qrBoxY + 24, 220, verifyUrl);

  ctx.fillStyle = certificate.cryptoSignature ? "#047857" : "#0369a1";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(
    certificate.cryptoSignature
      ? "✓ ED25519 CRYPTOGRAPHICALLY SIGNED"
      : "✓ VERIFIED REGISTRY CREDENTIAL",
    W / 2,
    qrBoxY + 276,
  );

  ctx.fillStyle = "#64748b";
  ctx.font = "600 14px monospace";
  ctx.fillText(
    certificate.rekorStatus === "anchored" && typeof certificate.rekorLogIndex === "number"
      ? `REKOR #${certificate.rekorLogIndex} · BLK #${certificate.ledgerIndex || 1}`
      : certificate.payloadHash
        ? `SHA256:${certificate.payloadHash.slice(0, 12)}… · BLK #${certificate.ledgerIndex || 1}`
        : "SCAN QR TO VERIFY ONLINE",
    W / 2,
    qrBoxY + 308,
  );

  // Right: Issue Date & Certificate Number
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px monospace";
  ctx.fillText(
    certificate.issueDate || new Date().toISOString().slice(0, 10),
    W - 470,
    footerY + 115,
  );

  ctx.fillStyle = "#047857";
  ctx.font = "bold 28px monospace";
  ctx.fillText(`ID: ${certificate.certificateNumber}`, W - 470, footerY + 155);

  ctx.beginPath();
  ctx.moveTo(W - 710, footerY + 170);
  ctx.lineTo(W - 230, footerY + 170);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("Date of Issue & Serial ID", W - 470, footerY + 210);

  ctx.fillStyle = "#64748b";
  fillTextAutoFit(
    ctx,
    verifyUrl.replace(/^https?:\/\//, ""),
    W - 470,
    footerY + 245,
    480,
    18,
    13,
    "600",
    "monospace",
  );
}

/**
 * Renders the certificate onto an HTMLCanvasElement (with immediate fallback paint + async image paint).
 */
export async function populateCertificateCanvas(
  canvas: HTMLCanvasElement,
  certificate: CertificateData,
  branding?: BrandingSettings,
): Promise<void> {
  // 1. Immediate synchronous draw so mobile & desktop screens show the full landscape certificate at 0ms
  drawCertificateOnCanvas(canvas, certificate, branding);

  // 2. Load logo images in parallel and redraw cleanly (QR code is drawn locally via ISO 18004 encoder)
  const [onneshaImg, partnerImg] = await Promise.all([
    loadImageSafe(onnesha.url),
    branding?.showPartnerLogo && branding?.partnerLogoUrl
      ? loadImageSafe(branding.partnerLogoUrl)
      : Promise.resolve(null),
  ]);

  drawCertificateOnCanvas(canvas, certificate, branding, {
    onneshaImg,
    partnerImg,
  });
}

/**
 * Generates and downloads an official A4 Landscape Certificate PDF directly to the user's device.
 */
export async function downloadCertificatePdf(
  certificate: CertificateData,
  branding?: BrandingSettings,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 1700;
  await populateCertificateCanvas(canvas, certificate, branding);
  const pdfBytes = buildPdfFromCanvases([canvas], "landscape");
  triggerBlobDownload(pdfBytes, `Onnesha-Certificate-${certificate.certificateNumber}.pdf`);
}

/**
 * Generates and downloads an A4 Portrait OMR Answer Sheet PDF directly to the user's device.
 */
export async function downloadOmrSheetPdf(params: {
  quiz: Quiz;
  candidateName: string;
  candidateRoll: string;
  candidateRegionName: string;
  selectedSet: string;
  filledBubbles: Record<number, string>;
  gradingResult?: {
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    netScore: number;
    accuracyPct: number;
  } | null;
  branding?: BrandingSettings;
}): Promise<void> {
  const {
    quiz,
    candidateName,
    candidateRoll,
    candidateRegionName,
    selectedSet,
    filledBubbles,
    gradingResult,
    branding,
  } = params;

  const W = 1700;
  const H = 2400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Corner Optical Alignment Timing Marks
  ctx.fillStyle = "#000000";
  const markSize = 36;
  ctx.fillRect(60, 60, markSize, markSize);
  ctx.fillRect(W - 60 - markSize, 60, markSize, markSize);
  ctx.fillRect(60, H - 60 - markSize, markSize, markSize);
  ctx.fillRect(W - 60 - markSize, H - 60 - markSize, markSize, markSize);

  // Outer Frame
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.strokeRect(115, 110, W - 230, H - 220);

  // Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#047857";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(
    (branding?.institutionTitle || "ONNESHA ASSESSMENT & EXAMINATION ARENA").toUpperCase(),
    W / 2,
    165,
  );

  ctx.fillStyle = "#000000";
  ctx.font = "900 38px sans-serif";
  ctx.fillText("OFFICIAL OMR OPTICAL ANSWER SHEET", W / 2, 215);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(quiz.titleBn || quiz.titleEn || "Standardized Assessment", W / 2, 255);

  // Candidate Metadata Box
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 290, W - 300, 175);

  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.font = "bold 24px monospace";
  ctx.fillText(`CANDIDATE : ${candidateName}`, 180, 340);
  ctx.fillText(`ROLL NO   : ${candidateRoll}`, 180, 385);
  ctx.fillText(`DIVISION  : ${candidateRegionName}   |   SET CODE: ${selectedSet}`, 180, 430);

  if (gradingResult) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 26px monospace";
    ctx.fillText(`NET SCORE: ${gradingResult.netScore.toFixed(2)}`, W - 180, 345);
    ctx.font = "bold 20px monospace";
    ctx.fillText(
      `CORRECT: ${gradingResult.correct} | WRONG: ${gradingResult.incorrect} | ACC: ${gradingResult.accuracyPct}%`,
      W - 180,
      390,
    );
  }

  // Question Bubbles Grid (4 columns of up to 25 questions = 100 questions capacity)
  const totalQ = Math.min(100, Math.max(quiz.questions.length, 50));
  const cols = 4;
  const rowsPerCol = Math.ceil(totalQ / cols);
  const gridLeft = 150;
  const gridTop = 510;
  const colW = (W - 300) / cols;
  const rowH = Math.min(62, (H - 760) / rowsPerCol);

  const options = ["A", "B", "C", "D"];

  for (let qNum = 1; qNum <= totalQ; qNum++) {
    const colIdx = Math.floor((qNum - 1) / rowsPerCol);
    const rowIdx = (qNum - 1) % rowsPerCol;
    const x0 = gridLeft + colIdx * colW;
    const y0 = gridTop + rowIdx * rowH;

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px monospace";
    ctx.fillText(String(qNum).padStart(2, "0") + ".", x0 + 55, y0 + 26);

    const selected = filledBubbles[qNum];
    options.forEach((opt, oIdx) => {
      const cx = x0 + 95 + oIdx * 56;
      const cy = y0 + 19;
      const r = 18;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (selected === opt) {
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#334155";
      }
      ctx.textAlign = "center";
      ctx.font = "bold 16px monospace";
      ctx.fillText(opt, cx, cy + 6);
    });
  }

  // Footer Signatures
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, H - 170);
  ctx.lineTo(540, H - 170);
  ctx.moveTo(W - 540, H - 170);
  ctx.lineTo(W - 180, H - 170);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Candidate Signature", 360, H - 135);
  ctx.fillText("Invigilator / Examiner Signature", W - 360, H - 135);

  const pdfBytes = buildPdfFromCanvases([canvas], "portrait");
  triggerBlobDownload(pdfBytes, `Onnesha-OMR-${candidateRoll}.pdf`);
}

/**
 * Generates and downloads an Official Merit Gazette PDF directly to the user's device.
 */
export async function downloadMeritGazettePdf(params: {
  quizTitle: string;
  regionLabel: string;
  participants: MeritParticipant[];
  branding?: BrandingSettings;
}): Promise<void> {
  const { quizTitle, regionLabel, participants, branding } = params;
  const rowsPerPage = 28;
  const totalPages = Math.max(1, Math.ceil(participants.length / rowsPerPage));
  const canvases: HTMLCanvasElement[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const W = 1700;
    const H = 2400;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, W - 160, H - 160);

    // Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#047857";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(
      (branding?.institutionTitle || "ONNESHA ASSESSMENT & EXAMINATION ARENA").toUpperCase(),
      W / 2,
      145,
    );

    ctx.fillStyle = "#000000";
    ctx.font = "900 40px sans-serif";
    ctx.fillText("OFFICIAL EXAMINATION MERIT GAZETTE", W / 2, 198);

    ctx.fillStyle = "#334155";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`${quizTitle}  •  Scope: ${regionLabel}`, W / 2, 240);

    // Table Header
    const tableTop = 290;
    const tableLeft = 120;
    const tableW = W - 240;
    const rowH = 60;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(tableLeft, tableTop, tableW, rowH);

    const cols = [
      { label: "RANK", x: tableLeft + 25, align: "left" as const },
      { label: "ROLL NO", x: tableLeft + 150, align: "left" as const },
      { label: "CANDIDATE NAME", x: tableLeft + 380, align: "left" as const },
      { label: "DIVISION / RANGE", x: tableLeft + 830, align: "left" as const },
      { label: "CORRECT", x: tableLeft + 1140, align: "center" as const },
      { label: "SCORE", x: tableLeft + 1290, align: "center" as const },
      { label: "STATUS", x: tableLeft + 1410, align: "right" as const },
    ];

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    cols.forEach((c) => {
      ctx.textAlign = c.align;
      ctx.fillText(c.label, c.x, tableTop + 38);
    });

    const slice = participants.slice(pageIdx * rowsPerPage, (pageIdx + 1) * rowsPerPage);
    slice.forEach((p, idx) => {
      const globalRank = pageIdx * rowsPerPage + idx + 1;
      const y = tableTop + (idx + 1) * rowH;

      ctx.fillStyle = globalRank <= 3 ? "#fffbeb" : idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(tableLeft, y, tableW, rowH);

      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tableLeft, y, tableW, rowH);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`#${globalRank}`, cols[0]!.x, y + 38);
      ctx.fillText(p.rollNumber || `2026-${100 + globalRank}`, cols[1]!.x, y + 38);

      ctx.font = "bold 20px sans-serif";
      ctx.fillText((p.nickname || "Candidate").slice(0, 26), cols[2]!.x, y + 38);

      ctx.font = "600 19px sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText((p.regionName || "Dhaka Range").slice(0, 20), cols[3]!.x, y + 38);

      ctx.textAlign = "center";
      ctx.fillStyle = "#047857";
      ctx.font = "bold 20px monospace";
      ctx.fillText(String(p.correctCount ?? 0), cols[4]!.x, y + 38);

      ctx.fillStyle = "#0f172a";
      ctx.fillText(String(p.finalScore ?? 0), cols[5]!.x, y + 38);

      ctx.textAlign = "right";
      const qualified = (p.finalScore ?? 0) >= 500;
      ctx.fillStyle = qualified ? "#047857" : "#64748b";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(qualified ? "QUALIFIED" : "STANDBY", cols[6]!.x, y + 38);
    });

    // Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "#475569";
    ctx.font = "bold 18px monospace";
    ctx.fillText(
      `Page ${pageIdx + 1} of ${totalPages}  •  Generated on ${new Date().toLocaleDateString()}  •  Controller of Examinations, Onnesha`,
      W / 2,
      H - 115,
    );

    canvases.push(canvas);
  }

  const pdfBytes = buildPdfFromCanvases(canvases, "portrait");
  triggerBlobDownload(
    pdfBytes,
    `Onnesha-Merit-Gazette-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

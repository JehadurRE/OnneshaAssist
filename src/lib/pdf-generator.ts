import QRCode from "qrcode";
import {
  BrandingSettings,
  CertificateData,
  CertificatePartnerLogo,
  CertificateSignatory,
  MeritParticipant,
  Quiz,
} from "./types";
import {
  brandingWithCertificateProfile,
  CertificateThemePalette,
  DEFAULT_CERTIFICATE_SIGNATORIES,
  resolveCertificateTheme,
} from "./branding";
import { computeParticipantAccuracyPct, isPassingScore, resolvePassThresholdPct } from "./scoring";
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

const imageCache = new Map<string, HTMLImageElement>();

async function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
  const cleanSrc = (src || "").trim();
  if (!cleanSrc) return null;
  const cached = imageCache.get(cleanSrc);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  return new Promise((resolve) => {
    const img = new Image();
    if (!cleanSrc.startsWith("data:") && !cleanSrc.startsWith("/")) {
      img.crossOrigin = "anonymous";
    }
    const timeout = setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      clearTimeout(timeout);
      imageCache.set(cleanSrc, img);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = cleanSrc;
  });
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  align: "left" | "center" | "right" = "center",
): { x: number; y: number; w: number; h: number } {
  const iw = Math.max(1, img.naturalWidth || img.width);
  const ih = Math.max(1, img.naturalHeight || img.height);
  const scale = Math.min(boxW / iw, boxH / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const drawY = boxY + (boxH - drawH) / 2;
  const drawX =
    align === "left" ? boxX : align === "right" ? boxX + boxW - drawW : boxX + (boxW - drawW) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  return { x: drawX, y: drawY, w: drawW, h: drawH };
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

const BANGLADESH_OUTLINE_NORM: ReadonlyArray<readonly [number, number]> = [
  [0.085, 0.017], // Tetulia NW tip
  [0.19, 0.045],
  [0.29, 0.032],
  [0.37, 0.055], // Lalmonirhat
  [0.44, 0.145], // Kurigram
  [0.43, 0.215], // Jamuna entry
  [0.54, 0.215], // Sherpur Garo Hills border
  [0.68, 0.242], // Sunamganj
  [0.84, 0.238], // Jaflong
  [0.925, 0.258], // Sylhet NE tip
  [0.892, 0.312],
  [0.915, 0.368], // Moulvibazar
  [0.842, 0.405], // Habiganj indentation
  [0.77, 0.398],
  [0.72, 0.455], // Brahmanbaria / Akhaura
  [0.685, 0.533], // Cumilla bend
  [0.722, 0.595],
  [0.748, 0.632], // Feni narrow neck
  [0.805, 0.562], // Ramgarh / Khagrachhari
  [0.885, 0.485], // Sajek / Rangamati north
  [0.955, 0.515], // Rangamati east
  [0.935, 0.64],
  [0.985, 0.785], // Bandarban SE bulge
  [0.938, 0.905],
  [0.915, 0.978], // Teknaf SE tip
  [0.865, 0.92], // Cox's Bazar
  [0.818, 0.822],
  [0.802, 0.722], // Chattogram port curve
  [0.75, 0.668], // Sitakunda coast
  [0.685, 0.675], // Noakhali / Meghna estuary
  [0.632, 0.768], // Bhola
  [0.565, 0.802], // Patuakhali
  [0.465, 0.79], // Barguna
  [0.365, 0.808], // Sundarbans delta
  [0.245, 0.825], // Satkhira SW
  [0.228, 0.705],
  [0.195, 0.612], // Jashore west
  [0.142, 0.515], // Chuadanga / Meherpur
  [0.118, 0.445], // Kushtia Padma entry
  [0.068, 0.395], // Rajshahi
  [0.016, 0.335], // Chapainawabganj W tip
  [0.095, 0.255], // Naogaon
  [0.115, 0.175], // Dinajpur
  [0.055, 0.105], // Thakurgaon
];

const BANGLADESH_DIVISIONS: ReadonlyArray<{
  name: string;
  pos: readonly [number, number];
  isHub?: boolean;
}> = [
  { name: "DHAKA AI CORE", pos: [0.51, 0.47], isHub: true },
  { name: "CHATTOGRAM", pos: [0.8, 0.72] },
  { name: "SYLHET", pos: [0.82, 0.29] },
  { name: "RAJSHAHI", pos: [0.13, 0.38] },
  { name: "KHULNA", pos: [0.33, 0.64] },
  { name: "BARISHAL", pos: [0.5, 0.66] },
  { name: "RANGPUR", pos: [0.27, 0.15] },
  { name: "MYMENSINGH", pos: [0.51, 0.32] },
];

const DIVISION_RING_EDGES: ReadonlyArray<readonly [number, number]> = [
  [6, 3], // Rangpur - Rajshahi
  [3, 4], // Rajshahi - Khulna
  [4, 5], // Khulna - Barishal
  [5, 1], // Barishal - Chattogram
  [1, 2], // Chattogram - Sylhet
  [2, 7], // Sylhet - Mymensingh
  [7, 6], // Mymensingh - Rangpur
];

function traceSmoothPolygon(
  ctx: CanvasRenderingContext2D,
  pts: ReadonlyArray<readonly [number, number]>,
) {
  if (pts.length < 3) return;
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  ctx.beginPath();
  ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]!;
    const next = pts[(i + 1) % pts.length]!;
    ctx.quadraticCurveTo(curr[0], curr[1], (curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2);
  }
  ctx.closePath();
}

/**
 * Renders the modern Bangladesh vector silhouette fused with an AI neural node constellation
 * and architectural circuit buses in the background without competing with foreground typography.
 */
function drawBangladeshAiBackdrop(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme: CertificateThemePalette,
  opacity: number,
) {
  const mapH = 1040;
  const mapW = 760;
  const mapX = W / 2 - mapW / 2;
  const mapY = 330;

  const toCanvas = ([nx, ny]: readonly [number, number]): readonly [number, number] => [
    mapX + nx * mapW,
    mapY + ny * mapH,
  ];
  const poly = BANGLADESH_OUTLINE_NORM.map(toCanvas);
  const dhakaPos = toCanvas(BANGLADESH_DIVISIONS[0]!.pos);

  ctx.save();

  // Subtle exterior AI neural circuit traces extending horizontally left & right from map
  ctx.globalAlpha = Math.min(0.4, opacity * 0.85);
  ctx.strokeStyle = theme.mapColor;
  ctx.lineWidth = 1.6;
  const busYs = [460, 620, 820, 1020, 1180];
  busYs.forEach((by, idx) => {
    const offset = idx % 2 === 0 ? 18 : -18;
    // Left bus trace
    ctx.beginPath();
    ctx.moveTo(115, by);
    ctx.lineTo(360 + idx * 35, by);
    ctx.lineTo(405 + idx * 35, by + offset);
    ctx.lineTo(740, by + offset);
    ctx.stroke();

    // Right bus trace
    ctx.beginPath();
    ctx.moveTo(W - 115, by);
    ctx.lineTo(W - 360 - idx * 35, by);
    ctx.lineTo(W - 405 - idx * 35, by - offset);
    ctx.lineTo(W - 740, by - offset);
    ctx.stroke();

    // Terminal circuit micro-nodes
    ctx.fillStyle = theme.nodeColor;
    [360 + idx * 35, W - 360 - idx * 35].forEach((nx) => {
      ctx.beginPath();
      ctx.arc(nx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Soft filled Bangladesh silhouette
  traceSmoothPolygon(ctx, poly);
  const fillGrad = ctx.createRadialGradient(
    dhakaPos[0],
    dhakaPos[1],
    30,
    dhakaPos[0],
    dhakaPos[1],
    560,
  );
  fillGrad.addColorStop(0, theme.mapColor);
  fillGrad.addColorStop(1, "transparent");
  ctx.globalAlpha = opacity * 0.55;
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Clip inside Bangladesh contour for subtle AI geometric lattice + radar rings
  ctx.save();
  traceSmoothPolygon(ctx, poly);
  ctx.clip();

  ctx.globalAlpha = opacity * 0.45;
  ctx.strokeStyle = theme.mapColor;
  ctx.lineWidth = 1.25;
  const gridStep = 48;
  for (let gx = mapX; gx <= mapX + mapW; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, mapY);
    ctx.lineTo(gx, mapY + mapH);
    ctx.stroke();
  }
  for (let gy = mapY; gy <= mapY + mapH; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(mapX, gy);
    ctx.lineTo(mapX + mapW, gy);
    ctx.stroke();
  }

  // Concentric AI signal rings radiating from Dhaka Core
  [120, 230, 350, 480].forEach((radius, idx) => {
    ctx.beginPath();
    if (idx % 2 === 1) ctx.setLineDash([8, 10]);
    else ctx.setLineDash([]);
    ctx.arc(dhakaPos[0], dhakaPos[1], radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();

  // Double contour outline around Bangladesh
  ctx.globalAlpha = opacity * 0.35;
  ctx.strokeStyle = theme.mapColor;
  ctx.lineWidth = 11;
  traceSmoothPolygon(ctx, poly);
  ctx.stroke();

  ctx.globalAlpha = Math.min(0.65, opacity * 1.45);
  ctx.strokeStyle = theme.mapColor;
  ctx.lineWidth = 3;
  traceSmoothPolygon(ctx, poly);
  ctx.stroke();

  // Outer perimeter ring edges between regional hubs
  ctx.globalAlpha = opacity * 0.9;
  ctx.strokeStyle = theme.nodeColor;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 8]);
  DIVISION_RING_EDGES.forEach(([aIdx, bIdx]) => {
    const a = toCanvas(BANGLADESH_DIVISIONS[aIdx]!.pos);
    const b = toCanvas(BANGLADESH_DIVISIONS[bIdx]!.pos);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Hub-and-spoke curved AI neural pathways from Dhaka to all divisions
  BANGLADESH_DIVISIONS.forEach((div, idx) => {
    const pt = toCanvas(div.pos);
    if (!div.isHub) {
      ctx.globalAlpha = Math.min(0.55, opacity * 1.25);
      ctx.strokeStyle = theme.mapColor;
      ctx.lineWidth = 2.2;
      const midX = (dhakaPos[0] + pt[0]) / 2 + (idx % 2 === 0 ? 28 : -28);
      const midY = (dhakaPos[1] + pt[1]) / 2 - 22;
      ctx.beginPath();
      ctx.moveTo(dhakaPos[0], dhakaPos[1]);
      ctx.quadraticCurveTo(midX, midY, pt[0], pt[1]);
      ctx.stroke();
    }

    // Division node
    const nodeR = div.isHub ? 12 : 7;
    ctx.globalAlpha = Math.min(0.75, opacity * 1.8);
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], nodeR + 8, 0, Math.PI * 2);
    ctx.strokeStyle = div.isHub ? theme.nodeColor : theme.mapColor;
    ctx.lineWidth = div.isHub ? 2.5 : 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pt[0], pt[1], nodeR, 0, Math.PI * 2);
    ctx.fillStyle = div.isHub ? theme.nodeColor : theme.mapColor;
    ctx.fill();
  });

  ctx.restore();
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  theme: CertificateThemePalette,
) {
  ctx.save();
  ctx.strokeStyle = theme.borderInner;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y + dy * 72);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dx * 72, y);
  ctx.stroke();

  // Inner L-step + geometric rosette
  ctx.strokeStyle = theme.borderOuter;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + dx * 18, y + dy * 48);
  ctx.lineTo(x + dx * 18, y + dy * 18);
  ctx.lineTo(x + dx * 48, y + dy * 18);
  ctx.stroke();

  const rx = x + dx * 28;
  const ry = y + dy * 28;
  ctx.translate(rx, ry);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = theme.borderInner;
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
}

function drawMetallicSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  theme: CertificateThemePalette,
) {
  ctx.save();
  const teeth = 24;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth;
    const r = i % 2 === 0 ? radius : radius * 0.89;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = theme.pillBg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.borderInner;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = theme.accentColor;
  ctx.textAlign = "center";
  ctx.font = "900 18px sans-serif";
  ctx.fillText("VERIFIED", cx, cy - 3);
  ctx.fillStyle = theme.pillText;
  ctx.font = "bold 12px monospace";
  ctx.fillText("OFFICIAL SEAL", cx, cy + 16);
  ctx.restore();
}

function resolveEffectivePartners(branding?: BrandingSettings): CertificatePartnerLogo[] {
  const list: CertificatePartnerLogo[] = [];
  if (branding?.showPartnerLogo && (branding.partnerName || branding.partnerLogoUrl)) {
    list.push({
      id: "primary-partner",
      name: branding.partnerName || "Joint Academic Partner",
      logoUrl: branding.partnerLogoUrl || "",
    });
  }
  if (Array.isArray(branding?.partnerLogos)) {
    branding.partnerLogos.forEach((p) => {
      if ((p.name || p.logoUrl) && !list.some((x) => x.id === p.id)) {
        list.push(p);
      }
    });
  }
  return list.slice(0, 5);
}

function drawSignatoryColumn(
  ctx: CanvasRenderingContext2D,
  sig: CertificateSignatory,
  sigImg: HTMLImageElement | null,
  instructorFallback: string,
  centerX: number,
  lineY: number,
  colW: number,
  theme: CertificateThemePalette,
) {
  const resolvedName =
    sig.name.trim() === "{{instructor}}"
      ? instructorFallback
      : sig.name.trim() || instructorFallback;
  const displayScript = (sig.signatureText || "").trim() || resolvedName;
  const lineHalf = Math.min(220, colW * 0.41);

  if (sigImg) {
    drawContainedImage(ctx, sigImg, centerX - lineHalf, lineY - 98, lineHalf * 2, 86, "center");
  } else {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textPrimary;
    if (sig.signatureStyle === "mono") {
      fillTextAutoFit(
        ctx,
        displayScript.toUpperCase(),
        centerX,
        lineY - 22,
        colW - 36,
        28,
        18,
        "bold",
        "monospace",
      );
    } else if (sig.signatureStyle === "formal") {
      fillTextAutoFit(
        ctx,
        displayScript,
        centerX,
        lineY - 22,
        colW - 36,
        32,
        20,
        "bold",
        "Georgia, serif",
      );
    } else {
      fillTextAutoFit(
        ctx,
        displayScript,
        centerX,
        lineY - 22,
        colW - 36,
        40,
        22,
        "italic",
        "Georgia, 'Times New Roman', serif",
      );
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(centerX - lineHalf, lineY);
  ctx.lineTo(centerX + lineHalf, lineY);
  ctx.strokeStyle = theme.textMuted;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = theme.textPrimary;
  fillTextAutoFit(ctx, resolvedName, centerX, lineY + 34, colW - 24, 24, 15, "bold", "sans-serif");

  ctx.fillStyle = theme.textMuted;
  fillTextAutoFit(
    ctx,
    sig.title || "Authorized Official",
    centerX,
    lineY + 62,
    colW - 20,
    18,
    13,
    "600",
    "sans-serif",
  );
}

export interface CertificateRenderAssets {
  leftLogoImg?: HTMLImageElement | null;
  rightLogoImg?: HTMLImageElement | null;
  customBgImg?: HTMLImageElement | null;
  partnerImgs?: Record<string, HTMLImageElement | null>;
  signatureImgs?: Record<string, HTMLImageElement | null>;
  onneshaImg?: HTMLImageElement | null;
  partnerImg?: HTMLImageElement | null;
  qrImg?: HTMLImageElement | null;
}

export function drawCertificateOnCanvas(
  canvas: HTMLCanvasElement,
  certificate: CertificateData,
  branding?: BrandingSettings,
  assets?: CertificateRenderAssets,
): void {
  const W = 2400;
  const H = 1700;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const certKind = certificate.kind === "course_completion" ? "course_completion" : "quiz_session";
  // Overlay quiz/course design profile onto top-level cert* fields for this render.
  branding = branding ? brandingWithCertificateProfile(branding, certKind) : branding;
  const theme = resolveCertificateTheme(branding, certKind);
  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificate.certificateNumber}`
      : certificate.verificationUrl ||
        `https://arena.onnesha.courses/verify/${certificate.certificateNumber}`;

  const leftLogoImg = assets?.leftLogoImg ?? assets?.onneshaImg ?? null;
  const rightLogoImg = assets?.rightLogoImg ?? assets?.partnerImg ?? null;
  const customBgImg = assets?.customBgImg ?? null;
  const partners = resolveEffectivePartners(branding);

  // 1. Base Gradient Background & Optional Custom Full-Bleed Image
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, theme.bgPrimary);
  bgGrad.addColorStop(0.52, theme.isDark ? theme.bgSecondary : "#ffffff");
  bgGrad.addColorStop(1, theme.bgSecondary);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  if (customBgImg) {
    ctx.save();
    ctx.globalAlpha = branding?.certCustomBgOpacity ?? 0.22;
    const iw = Math.max(1, customBgImg.naturalWidth || customBgImg.width);
    const ih = Math.max(1, customBgImg.naturalHeight || customBgImg.height);
    const coverScale = Math.max(W / iw, H / ih);
    const cw = iw * coverScale;
    const ch = ih * coverScale;
    ctx.drawImage(customBgImg, (W - cw) / 2, (H - ch) / 2, cw, ch);
    ctx.restore();
  }

  // Ambient Radial Luminance
  const radial = ctx.createRadialGradient(W / 2, H / 2 - 40, 80, W / 2, H / 2, 1180);
  radial.addColorStop(0, theme.isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(16, 185, 129, 0.045)");
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  // 2. Modern Bangladesh AI Concept Map Watermark
  if (branding?.certShowBangladeshAiMap !== false) {
    drawBangladeshAiBackdrop(ctx, W, H, theme, branding?.certMapOpacity ?? 0.14);
  }

  // 3. Outer Security Guilloché Frame & Geometric Corner Rosettes
  ctx.strokeStyle = theme.borderOuter;
  ctx.lineWidth = 18;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.save();
  ctx.setLineDash([4, 10]);
  ctx.strokeStyle = theme.borderInner;
  ctx.lineWidth = 3;
  ctx.strokeRect(68, 68, W - 136, H - 136);
  ctx.restore();

  ctx.strokeStyle = theme.borderInner;
  ctx.lineWidth = 4;
  ctx.strokeRect(82, 82, W - 164, H - 164);

  const cornerCoords: ReadonlyArray<readonly [number, number, number, number]> = [
    [82, 82, 1, 1],
    [W - 82, 82, -1, 1],
    [82, H - 82, 1, -1],
    [W - 82, H - 82, -1, -1],
  ];
  cornerCoords.forEach(([cx, cy, dx, dy]) => drawCornerOrnament(ctx, cx, cy, dx, dy, theme));

  // 4. Header Section (Changeable Left Logo, Center Authority, Changeable Right Logo / Official Seal)
  if (leftLogoImg) {
    drawContainedImage(ctx, leftLogoImg, 138, 122, 260, 116, "left");
  } else {
    drawRoundedRect(ctx, 138, 132, 230, 96, 18);
    ctx.fillStyle = theme.borderOuter;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "900 28px sans-serif";
    ctx.fillText("ONNESHA", 253, 190);
  }
  if (branding?.leftLogoLabel) {
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textMuted;
    fillTextAutoFit(ctx, branding.leftLogoLabel, 253, 258, 250, 15, 11, "bold", "sans-serif");
  }

  if (rightLogoImg) {
    drawContainedImage(ctx, rightLogoImg, W - 398, 122, 260, 116, "right");
    if (branding?.rightLogoLabel) {
      ctx.textAlign = "center";
      ctx.fillStyle = theme.textMuted;
      fillTextAutoFit(
        ctx,
        branding.rightLogoLabel,
        W - 268,
        258,
        250,
        15,
        11,
        "bold",
        "sans-serif",
      );
    }
  } else {
    drawMetallicSeal(ctx, W - 210, 180, 62, theme);
  }

  // Center Institution Stack
  ctx.textAlign = "center";
  ctx.fillStyle = theme.accentColor;
  const instEyebrow = (branding?.institutionTitle || "ONNESHA ASSESSMENT ARENA").toUpperCase();
  fillTextAutoFit(ctx, instEyebrow, W / 2, 156, 1320, 23, 15, "bold", "sans-serif");

  ctx.fillStyle = theme.textPrimary;
  fillTextAutoFit(
    ctx,
    certificate.organizationName || branding?.institutionTitle || "Onnesha Assessment Arena",
    W / 2,
    210,
    1340,
    46,
    26,
    "900",
    "Georgia, serif",
  );

  ctx.fillStyle = theme.textMuted;
  fillTextAutoFit(
    ctx,
    branding?.certAuthoritySubtitle ||
      "National Training, Merit Evaluation & Cryptographic Examination Authority",
    W / 2,
    248,
    1360,
    21,
    14,
    "600",
    "sans-serif",
  );

  // 5. Optional Partner Strip (Dedicated Proper Location for Partner Images)
  const hasPartners = partners.length > 0;
  if (hasPartners) {
    const stripW = Math.min(1840, Math.max(960, partners.length * 360 + 360));
    const stripH = 68;
    const stripX = W / 2 - stripW / 2;
    const stripY = 274;
    drawRoundedRect(ctx, stripX, stripY, stripW, stripH, 34);
    ctx.fillStyle = theme.dockBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.dockBorder;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = theme.textMuted;
    ctx.font = "bold 14px sans-serif";
    const labelText = "IN PARTNERSHIP WITH";
    ctx.fillText(labelText, stripX + 28, stripY + 39);

    const slotStartX = stripX + 235;
    const availW = stripW - 260;
    const slotW = availW / partners.length;
    partners.forEach((p, idx) => {
      const sx = slotStartX + idx * slotW;
      const pImg = assets?.partnerImgs?.[p.id] ?? null;
      if (pImg && p.name) {
        drawContainedImage(ctx, pImg, sx + 8, stripY + 12, 82, 44, "center");
        ctx.textAlign = "left";
        ctx.fillStyle = theme.textPrimary;
        fillTextAutoFit(
          ctx,
          p.name,
          sx + 100,
          stripY + 40,
          Math.max(80, slotW - 112),
          19,
          13,
          "bold",
          "sans-serif",
        );
      } else if (pImg) {
        drawContainedImage(ctx, pImg, sx + 10, stripY + 10, slotW - 20, 48, "center");
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = theme.textPrimary;
        fillTextAutoFit(
          ctx,
          p.name || "Academic Partner",
          sx + slotW / 2,
          stripY + 40,
          slotW - 24,
          19,
          13,
          "bold",
          "sans-serif",
        );
      }
      if (idx < partners.length - 1) {
        ctx.beginPath();
        ctx.moveTo(sx + slotW, stripY + 16);
        ctx.lineTo(sx + slotW, stripY + stripH - 16);
        ctx.strokeStyle = theme.dockBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(150, 286);
    ctx.lineTo(W - 150, 286);
    ctx.strokeStyle = theme.dockBorder;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const yShift = hasPartners ? 30 : 0;

  // 6. Certificate Title Pill
  const badgeTitle = (
    branding?.certBadgeTitle || "CERTIFICATE OF MERIT & EXCELLENCE"
  ).toUpperCase();
  const pillW = Math.min(980, Math.max(660, badgeTitle.length * 19 + 120));
  const pillY = 330 + yShift;
  drawRoundedRect(ctx, W / 2 - pillW / 2, pillY, pillW, 58, 29);
  ctx.fillStyle = theme.pillBg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = theme.pillBorder;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = theme.pillText;
  fillTextAutoFit(
    ctx,
    `★  ${badgeTitle}  ★`,
    W / 2,
    pillY + 38,
    pillW - 50,
    23,
    16,
    "bold",
    "sans-serif",
  );

  // Bilingual Proclamation Line
  ctx.fillStyle = theme.textSecondary;
  ctx.font = "italic 27px Georgia, serif";
  ctx.fillText(
    "This official credential is proudly conferred upon  ·  এই মর্মে প্রত্যয়ন করা যাচ্ছে যে",
    W / 2,
    438 + yShift,
  );

  // 7. Candidate Name + Accent Rule
  ctx.fillStyle = theme.textPrimary;
  fillTextAutoFit(
    ctx,
    certificate.studentName || "Verified Candidate",
    W / 2,
    532 + yShift,
    1850,
    80,
    42,
    "900",
    "Georgia, serif",
  );

  const nameRuleGrad = ctx.createLinearGradient(W / 2 - 480, 0, W / 2 + 480, 0);
  nameRuleGrad.addColorStop(0, "transparent");
  nameRuleGrad.addColorStop(0.2, theme.borderInner);
  nameRuleGrad.addColorStop(0.5, theme.accentColor);
  nameRuleGrad.addColorStop(0.8, theme.borderInner);
  nameRuleGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = nameRuleGrad;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 480, 558 + yShift);
  ctx.lineTo(W / 2 + 480, 558 + yShift);
  ctx.stroke();

  const rollMeta = [
    certificate.studentRoll ? `ROLL ID: ${certificate.studentRoll}` : null,
    certificate.regionName ? `DIVISION: ${certificate.regionName.toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join("   •   ");

  if (rollMeta) {
    ctx.fillStyle = theme.accentColor;
    ctx.font = "bold 23px monospace";
    ctx.fillText(rollMeta, W / 2, 602 + yShift);
  }

  // 8. Achievement Citation & Assessment Title
  const isCourseCert = certificate.kind === "course_completion";
  ctx.fillStyle = theme.textSecondary;
  ctx.font = "500 26px sans-serif";
  ctx.fillText(
    isCourseCert
      ? "for successfully completing the full course programme, including Final Quiz and Practical:"
      : "for successfully completing and demonstrating outstanding proficiency in the assessment:",
    W / 2,
    658 + yShift,
  );

  ctx.fillStyle = theme.accentColor;
  const quizTitle =
    certificate.quizTitle ||
    (isCourseCert
      ? `${certificate.courseCode || ""} — Certificate of Course Completion`.trim()
      : "Institutional Merit Assessment");
  fillTextAutoFit(ctx, quizTitle, W / 2, 718 + yShift, 1950, 42, 24, "bold", "sans-serif");

  // 9. Three Metric Stat Cards
  const cardW = 540;
  const cardH = 185;
  const gap = 50;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  const cardY = 768 + yShift;

  const totalMarks = certificate.totalMarks ?? certificate.totalPoints ?? 100;
  const accuracy = certificate.accuracyPercent ?? certificate.scorePct ?? 100;
  const rawScoreVal = certificate.marksObtained ?? certificate.score ?? 0;
  const rawMarks =
    rawScoreVal > 0 ? rawScoreVal : accuracy > 0 ? Math.round((accuracy / 100) * totalMarks) : 0;

  const cards = isCourseCert
    ? [
        {
          label: "COMBINED SCORE",
          value: `${certificate.combinedScorePct ?? accuracy}%`,
          sub: "Quiz + Practical Weighted",
          accent: theme.borderOuter,
        },
        {
          label: "FINAL QUIZ",
          value: `${certificate.quizAccuracyPct ?? 0}%`,
          sub: "Part A Accuracy",
          accent: theme.accentColor,
        },
        {
          label: "PRACTICAL",
          value: `${certificate.practicalScorePct ?? 0}%`,
          sub: "Part B Instructor Mark",
          accent: theme.borderInner,
        },
      ]
    : [
        {
          label: "MERIT STANDING",
          value: `#${certificate.rank || 1}`,
          sub: `Out of ${certificate.totalParticipants || 1} Candidates`,
          accent: theme.borderOuter,
        },
        {
          label: "RAW MARKS OBTAINED",
          value: `${rawMarks}`,
          sub: `Out of ${totalMarks} Total Points`,
          accent: theme.accentColor,
        },
        {
          label: "ACCURACY VELOCITY",
          value: `${accuracy}%`,
          sub: "Verified Precision Index",
          accent: theme.borderInner,
        },
      ];

  cards.forEach((c, idx) => {
    const x = startX + idx * (cardW + gap);
    drawRoundedRect(ctx, x, cardY, cardW, cardH, 22);
    ctx.fillStyle = theme.cardBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = theme.cardBorder;
    ctx.stroke();

    // Sleek Top Accent Bar inside Card
    drawRoundedRect(ctx, x + 28, cardY + 12, cardW - 56, 6, 3);
    ctx.fillStyle = c.accent;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle = theme.textMuted;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(c.label, x + cardW / 2, cardY + 50);

    ctx.fillStyle = theme.textPrimary;
    ctx.font = "900 58px monospace";
    ctx.fillText(c.value, x + cardW / 2, cardY + 120);

    ctx.fillStyle = theme.textSecondary;
    ctx.font = "600 18px sans-serif";
    ctx.fillText(c.sub, x + cardW / 2, cardY + 158);
  });

  // 10. Dynamic Multi-Signatory Row (1 to 4 Signatories)
  const configuredSignatories =
    Array.isArray(branding?.certSignatories) && branding.certSignatories.length > 0
      ? branding.certSignatories.slice(0, 4)
      : DEFAULT_CERTIFICATE_SIGNATORIES;

  const sigRowLeft = 170;
  const sigRowWidth = W - 340;
  const sigColW = sigRowWidth / configuredSignatories.length;
  const sigLineY = 1148;
  const instructorFallback = certificate.instructorName || "Chief Assessment Officer";

  configuredSignatories.forEach((sig, idx) => {
    const centerX = sigRowLeft + sigColW * (idx + 0.5);
    const sigImg = assets?.signatureImgs?.[sig.id] ?? null;
    drawSignatoryColumn(ctx, sig, sigImg, instructorFallback, centerX, sigLineY, sigColW, theme);
  });

  // 11. Bottom Cryptographic Verification Dock (Issue Date + QR + Rekor/Ed25519 Proofs)
  const dockX = 140;
  const dockY = 1265;
  const dockW = W - 280;
  const dockH = 300;
  drawRoundedRect(ctx, dockX, dockY, dockW, dockH, 28);
  ctx.fillStyle = theme.dockBg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = theme.dockBorder;
  ctx.stroke();

  // Left Wing: Issue Date, Certificate ID & URL
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textMuted;
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("CREDENTIAL REGISTRY & SERIAL", dockX + 52, dockY + 56);

  ctx.fillStyle = theme.textPrimary;
  ctx.font = "bold 36px monospace";
  ctx.fillText(certificate.certificateNumber, dockX + 52, dockY + 108);

  ctx.fillStyle = theme.accentColor;
  ctx.font = "bold 24px monospace";
  ctx.fillText(
    `ISSUED: ${certificate.issueDate || new Date().toISOString().slice(0, 10)}`,
    dockX + 52,
    dockY + 152,
  );

  ctx.fillStyle = theme.textSecondary;
  fillTextAutoFit(
    ctx,
    verifyUrl.replace(/^https?:\/\//, ""),
    dockX + 52,
    dockY + 210,
    720,
    18,
    13,
    "600",
    "monospace",
  );

  ctx.fillStyle = theme.textMuted;
  ctx.font = "600 15px sans-serif";
  ctx.fillText("Scan QR or open portal URL for live cryptographic audit", dockX + 52, dockY + 250);

  // Center: High-Contrast ISO-18004 QR Code on bright plate
  const qrSize = 212;
  const qrPlateX = W / 2 - (qrSize + 24) / 2;
  const qrPlateY = dockY + 22;
  drawRoundedRect(ctx, qrPlateX, qrPlateY, qrSize + 24, qrSize + 24, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.borderInner;
  ctx.stroke();

  drawRealQrOnCanvas(ctx, W / 2 - qrSize / 2, qrPlateY + 12, qrSize, verifyUrl);

  ctx.textAlign = "center";
  ctx.fillStyle = theme.accentColor;
  ctx.font = "bold 15px monospace";
  ctx.fillText("SCAN TO VERIFY", W / 2, qrPlateY + qrSize + 48);

  // Right Wing: Cryptographic & External Anchor Status
  const rightX = dockX + dockW - 52;
  ctx.textAlign = "right";
  ctx.fillStyle = theme.textMuted;
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("CRYPTOGRAPHIC ATTESTATION & ANCHOR", rightX, dockY + 56);

  ctx.fillStyle = certificate.cryptoSignature ? theme.accentColor : theme.textPrimary;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(
    certificate.cryptoSignature ? "✓ ED25519 SIGNATURE VERIFIED" : "✓ VERIFIED REGISTRY CREDENTIAL",
    rightX,
    dockY + 106,
  );

  const rekorLine =
    certificate.rekorStatus === "anchored" && typeof certificate.rekorLogIndex === "number"
      ? `SIGSTORE REKOR #${certificate.rekorLogIndex} · BLK #${certificate.ledgerIndex || 1}`
      : certificate.payloadHash
        ? `SHA-256: ${certificate.payloadHash.slice(0, 18)}… · BLK #${certificate.ledgerIndex || 1}`
        : "ONNESHA W3C VERIFIABLE CREDENTIAL";

  ctx.fillStyle = theme.textPrimary;
  fillTextAutoFit(ctx, rekorLine, rightX, dockY + 154, 720, 22, 15, "bold", "monospace");

  const otsStatusText =
    certificate.otsStatus === "bitcoin_confirmed"
      ? `BITCOIN OTS CONFIRMED${certificate.otsBitcoinBlockHeight ? ` · BLOCK #${certificate.otsBitcoinBlockHeight}` : ""}`
      : certificate.otsStatus === "pending_bitcoin"
        ? "BITCOIN OTS CALENDAR SUBMITTED (CONFIRMING)"
        : "W3C DID:WEB · TAMPER-EVIDENT HASH CHAIN";

  ctx.fillStyle = theme.textSecondary;
  fillTextAutoFit(ctx, otsStatusText, rightX, dockY + 210, 720, 18, 13, "600", "monospace");

  ctx.fillStyle = theme.textMuted;
  ctx.font = "600 15px sans-serif";
  ctx.fillText("Independent third-party audit trail without PII exposure", rightX, dockY + 250);
}

/**
 * Renders the certificate onto an HTMLCanvasElement (with immediate fallback paint + async image paint).
 */
export async function populateCertificateCanvas(
  canvas: HTMLCanvasElement,
  certificate: CertificateData,
  branding?: BrandingSettings,
): Promise<void> {
  const certKind = certificate.kind === "course_completion" ? "course_completion" : "quiz_session";
  branding = branding ? brandingWithCertificateProfile(branding, certKind) : branding;

  // 1. Immediate synchronous draw (even better: reuse cached images immediately if already preloaded!)
  const leftSrc = (branding?.leftLogoUrl || "").trim() || onnesha.url;
  const rightSrc =
    (branding?.rightLogoUrl || "").trim() ||
    (branding?.showPartnerLogo && branding?.partnerLogoUrl ? branding.partnerLogoUrl.trim() : "");
  const customBgSrc = (branding?.certCustomBgUrl || "").trim();
  const partners = resolveEffectivePartners(branding);
  const signatories =
    Array.isArray(branding?.certSignatories) && branding.certSignatories.length > 0
      ? branding.certSignatories.slice(0, 4)
      : DEFAULT_CERTIFICATE_SIGNATORIES;

  const cachedPartnerImgs: Record<string, HTMLImageElement | null> = {};
  partners.forEach((p) => {
    const img = p.logoUrl ? (imageCache.get(p.logoUrl.trim()) ?? null) : null;
    if (img) cachedPartnerImgs[p.id] = img;
  });

  const cachedSigImgs: Record<string, HTMLImageElement | null> = {};
  signatories.forEach((s) => {
    const img = s.signatureImageUrl ? (imageCache.get(s.signatureImageUrl.trim()) ?? null) : null;
    if (img) cachedSigImgs[s.id] = img;
  });

  drawCertificateOnCanvas(canvas, certificate, branding, {
    leftLogoImg: imageCache.get(leftSrc) ?? null,
    rightLogoImg: rightSrc ? (imageCache.get(rightSrc) ?? null) : null,
    customBgImg: customBgSrc ? (imageCache.get(customBgSrc) ?? null) : null,
    partnerImgs: cachedPartnerImgs,
    signatureImgs: cachedSigImgs,
  });

  // 2. Load any uncached images in parallel and redraw once ready
  const [leftLogoImg, rightLogoImg, customBgImg, partnerEntries, sigEntries] = await Promise.all([
    loadImageSafe(leftSrc),
    rightSrc ? loadImageSafe(rightSrc) : Promise.resolve(null),
    customBgSrc ? loadImageSafe(customBgSrc) : Promise.resolve(null),
    Promise.all(partners.map(async (p) => [p.id, await loadImageSafe(p.logoUrl)] as const)),
    Promise.all(
      signatories.map(async (s) => [s.id, await loadImageSafe(s.signatureImageUrl)] as const),
    ),
  ]);

  const partnerImgs: Record<string, HTMLImageElement | null> = {};
  partnerEntries.forEach(([id, img]) => {
    partnerImgs[id] = img;
  });

  const signatureImgs: Record<string, HTMLImageElement | null> = {};
  sigEntries.forEach(([id, img]) => {
    signatureImgs[id] = img;
  });

  drawCertificateOnCanvas(canvas, certificate, branding, {
    leftLogoImg,
    rightLogoImg,
    customBgImg,
    partnerImgs,
    signatureImgs,
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

  const [omrLeftLogo, omrPartnerLogo] = await Promise.all([
    loadImageSafe(branding?.leftLogoUrl || onnesha.url),
    branding?.showPartnerLogo && branding.partnerLogoUrl
      ? loadImageSafe(branding.partnerLogoUrl)
      : Promise.resolve(null),
  ]);

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

  // Brand Crests (kept clear of optical timing marks & centered titles)
  if (omrLeftLogo) {
    drawContainedImage(ctx, omrLeftLogo, 148, 128, 118, 118, "left");
  }
  if (omrPartnerLogo) {
    drawContainedImage(ctx, omrPartnerLogo, W - 148 - 135, 128, 135, 118, "right");
  }

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

const GAZETTE_SANS_FONT =
  '"Noto Sans Bengali", "Hind Siliguri", "Kalpurush", "Segoe UI", system-ui, -apple-system, sans-serif';
const GAZETTE_MONO_FONT = '"JetBrains Mono", "Cascadia Mono", Consolas, "Courier New", monospace';

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        // Put remaining text on final line cleanly truncated if needed
        continue;
      }
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    const tailText = lines.slice(maxLines - 1).join(" ");
    head.push(fitCellText(ctx, tailText, maxWidth));
    return head;
  }
  return lines.map((line) =>
    ctx.measureText(line).width > maxWidth ? fitCellText(ctx, line, maxWidth) : line,
  );
}

function fitCellText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const clean = (text || "").trim();
  if (!clean || maxWidth <= 8) return "";
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  let lo = 0;
  let hi = clean.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${clean.slice(0, mid)}…`).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? `${clean.slice(0, lo)}…` : "…";
}

/**
 * Draws the official Gazette banner header matching MeritGazetteView preview.
 * Returns the Y coordinate directly below the horizontal divider rule.
 */
function drawGazetteHeader(params: {
  ctx: CanvasRenderingContext2D;
  W: number;
  M: number;
  quizTitle: string;
  regionLabel: string;
  branding?: BrandingSettings | undefined;
  totalCandidates: number;
  pageIdx: number;
  totalPages: number;
  onneshaLogo: HTMLImageElement | null;
  partnerLogo: HTMLImageElement | null;
}): number {
  const {
    ctx,
    W,
    M,
    quizTitle,
    regionLabel,
    branding,
    totalCandidates,
    pageIdx,
    totalPages,
    onneshaLogo,
    partnerLogo,
  } = params;

  const topY = 70;
  const logoBoxW = 248;
  const metaBoxW = 266;
  const metaBoxX = W - M - metaBoxW;
  const headerMinBottom = topY + 118;

  // 1. Left Logos Zone (Onnesha + optional Partner Co-brand)
  const hasCustomLeftLogo = Boolean((branding?.leftLogoUrl || "").trim());
  if (onneshaLogo && partnerLogo) {
    if (!hasCustomLeftLogo) {
      drawContainedImage(ctx, onneshaLogo, M, topY + 14, 62, 62, "left");
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font = `900 18px ${GAZETTE_SANS_FONT}`;
      ctx.fillText("ONNESHA", M + 68, topY + 34);
      ctx.fillStyle = "#0369a1";
      ctx.font = `700 15px ${GAZETTE_SANS_FONT}`;
      ctx.fillText("অন্বেষা", M + 68, topY + 56);
      ctx.restore();
      drawContainedImage(ctx, partnerLogo, M + 178, topY + 14, 118, 66, "left");
    } else {
      drawContainedImage(ctx, onneshaLogo, M, topY + 12, 116, 84, "left");
      drawContainedImage(ctx, partnerLogo, M + 124, topY + 12, 134, 84, "left");
    }
  } else if (onneshaLogo && !hasCustomLeftLogo) {
    drawContainedImage(ctx, onneshaLogo, M, topY + 14, 80, 80, "left");
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0f172a";
    ctx.font = `900 22px ${GAZETTE_SANS_FONT}`;
    ctx.fillText("ONNESHA", M + 90, topY + 42);
    ctx.fillStyle = "#0369a1";
    ctx.font = `700 18px ${GAZETTE_SANS_FONT}`;
    ctx.fillText("অন্বেষা", M + 90, topY + 69);
    ctx.restore();
  } else if (onneshaLogo) {
    drawContainedImage(ctx, onneshaLogo, M, topY + 10, 175, 88, "left");
  } else if (partnerLogo) {
    drawContainedImage(ctx, partnerLogo, M, topY + 10, 175, 88, "left");
  } else {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#047857";
    ctx.font = `900 28px ${GAZETTE_SANS_FONT}`;
    ctx.fillText("ONNESHA", M, topY + 54);
    ctx.restore();
  }

  // 2. Right Bordered Metadata Card
  ctx.save();
  drawRoundedRect(ctx, metaBoxX, topY + 4, metaBoxW, 108, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();

  const metaRows: ReadonlyArray<readonly [string, string]> = [
    ["GAZETTE:", "ONN-2026-GZ"],
    ["DATE:", new Date().toLocaleDateString()],
    ["CANDIDATES:", String(totalCandidates)],
    ["PAGE:", `${pageIdx + 1} / ${totalPages}`],
  ];
  ctx.textBaseline = "middle";
  metaRows.forEach(([k, v], idx) => {
    const ry = topY + 21 + idx * 23;
    ctx.textAlign = "left";
    ctx.fillStyle = "#475569";
    ctx.font = `bold 15px ${GAZETTE_MONO_FONT}`;
    ctx.fillText(k, metaBoxX + 14, ry);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `900 15px ${GAZETTE_MONO_FONT}`;
    ctx.fillText(v, metaBoxX + metaBoxW - 14, ry);
  });
  ctx.restore();

  // 3. Center Title Block (bounded cleanly between logos and metadata box)
  const centerLeft = M + logoBoxW + 18;
  const centerRight = metaBoxX - 18;
  const centerW = Math.max(400, centerRight - centerLeft);
  const centerX = (centerLeft + centerRight) / 2;

  const orgKicker =
    branding?.showPartnerLogo && branding.partnerName
      ? `${branding.partnerName.toUpperCase()} · ONNESHA ASSESSMENT`
      : (branding?.institutionTitle || "ONNESHA ASSESSMENT ARENA").toUpperCase();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#4b5563";
  fillTextAutoFit(ctx, orgKicker, centerX, topY + 24, centerW, 17, 13, "bold", GAZETTE_SANS_FONT);

  ctx.fillStyle = "#000000";
  fillTextAutoFit(
    ctx,
    pageIdx === 0 ? "EXAMINATION EVALUATION GAZETTE" : "EXAMINATION EVALUATION GAZETTE (CONT.)",
    centerX,
    topY + 64,
    centerW,
    34,
    24,
    "900",
    GAZETTE_SANS_FONT,
  );

  ctx.fillStyle = "#1f2937";
  ctx.font = `bold 18px ${GAZETTE_SANS_FONT}`;
  const scopeSubtitle = `Examination: ${quizTitle} · Scope: ${regionLabel}`;
  const subtitleLines = wrapCanvasLines(ctx, scopeSubtitle, centerW, 2);
  let subY = topY + 95;
  subtitleLines.forEach((line) => {
    ctx.fillText(line, centerX, subY);
    subY += 25;
  });

  const dividerY = Math.max(headerMinBottom, subY - 4) + 12;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, dividerY);
  ctx.lineTo(W - M, dividerY);
  ctx.stroke();

  return dividerY;
}

/**
 * Draws the black-bordered Notice Declaration box on Page 1.
 * Returns the Y coordinate directly below the box.
 */
function drawGazetteNoticeBox(params: {
  ctx: CanvasRenderingContext2D;
  M: number;
  CW: number;
  startY: number;
  regionLabel: string;
  thresholdDisplay: string;
  thresholdLabel?: string | undefined;
  negativeMarking?: number | undefined;
}): number {
  const {
    ctx,
    M,
    CW,
    startY,
    regionLabel,
    thresholdDisplay,
    thresholdLabel,
    negativeMarking = 0.25,
  } = params;
  const padX = 22;
  const padY = 18;
  const innerW = CW - padX * 2;
  const thresholdSuffix = thresholdLabel ? "" : " accuracy";
  const penaltyText =
    typeof negativeMarking === "number" && Number.isFinite(negativeMarking) && negativeMarking > 0
      ? `-${negativeMarking} penalty per wrong answer`
      : "no negative marking deduction";
  const body = `NOTICE FOR CANDIDATES (${regionLabel.toUpperCase()}): The following merit list contains verified final rankings based on raw marks, speed velocity, and applicable negative marking (${penaltyText}). This gazette is officially certified for public notice boards and regional archives. Qualifying passing threshold: ${thresholdDisplay}${thresholdSuffix}.`;

  ctx.font = `600 18px ${GAZETTE_SANS_FONT}`;
  const lines = wrapCanvasLines(ctx, body, innerW, 4);
  const lineH = 28;
  const boxH = padY * 2 + lines.length * lineH;

  ctx.save();
  drawRoundedRect(ctx, M, startY, CW, boxH, 10);
  ctx.fillStyle = "#f9fafb";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    const ly = startY + padY + i * lineH + lineH / 2;
    if (i === 0) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const prefix = line.slice(0, colonIdx + 1);
        const rest = line.slice(colonIdx + 1);
        ctx.fillStyle = "#0f172a";
        ctx.font = `900 18px ${GAZETTE_SANS_FONT}`;
        ctx.fillText(prefix, M + padX, ly);
        const prefixW = ctx.measureText(prefix).width;
        ctx.fillStyle = "#1f2937";
        ctx.font = `500 18px ${GAZETTE_SANS_FONT}`;
        ctx.fillText(rest, M + padX + prefixW, ly);
        return;
      }
    }
    ctx.fillStyle = "#1f2937";
    ctx.font = `500 18px ${GAZETTE_SANS_FONT}`;
    ctx.fillText(line, M + padX, ly);
  });
  ctx.restore();

  return startY + boxH;
}

/**
 * Generates and downloads an Official Merit Gazette PDF directly to the user's device,
 * closely mirroring the MeritGazetteView preview layout, typography, full grid borders,
 * logos, notice box, and authority signature blocks.
 */
export async function downloadMeritGazettePdf(params: {
  quizTitle: string;
  regionLabel: string;
  participants: MeritParticipant[];
  branding?: BrandingSettings | undefined;
  passThresholdPct?: number | undefined;
  thresholdLabel?: string | undefined;
  negativeMarking?: number | undefined;
}): Promise<void> {
  const {
    quizTitle,
    regionLabel,
    participants,
    branding,
    passThresholdPct,
    thresholdLabel,
    negativeMarking = 0.25,
  } = params;
  const effectiveThreshold = resolvePassThresholdPct({
    sessionThreshold: passThresholdPct,
    brandingDefaultThreshold: branding?.defaultPassThresholdPct,
  });
  const thresholdDisplay = thresholdLabel || `${effectiveThreshold}%`;

  const [onneshaLogo, partnerLogo] = await Promise.all([
    loadImageSafe(branding?.leftLogoUrl || onnesha.url),
    branding?.showPartnerLogo && branding.partnerLogoUrl
      ? loadImageSafe(branding.partnerLogoUrl)
      : Promise.resolve(null),
  ]);

  // Sort deterministically preserving rank tie-breaking
  const ordered = [...participants].sort((a, b) =>
    b.finalScore !== a.finalScore
      ? b.finalScore - a.finalScore
      : (a.rank || 999999) - (b.rank || 999999),
  );

  // A4 portrait at 200 DPI
  const W = 1654;
  const H = 2339;
  const M = 84;
  const CW = W - M * 2; // 1486px
  const tableHeaderH = 54;
  const rowH = 52;

  // Measure Page 1 header & notice height on a scratch 2d context so row budget is exact
  const scratchCanvas = document.createElement("canvas");
  scratchCanvas.width = W;
  scratchCanvas.height = H;
  const scratchCtx = scratchCanvas.getContext("2d");
  if (!scratchCtx) return;

  const estDividerP1 = drawGazetteHeader({
    ctx: scratchCtx,
    W,
    M,
    quizTitle,
    regionLabel,
    branding,
    totalCandidates: ordered.length,
    pageIdx: 0,
    totalPages: 1,
    onneshaLogo,
    partnerLogo,
  });
  const estNoticeBottom = drawGazetteNoticeBox({
    ctx: scratchCtx,
    M,
    CW,
    startY: estDividerP1 + 20,
    regionLabel,
    thresholdDisplay,
    thresholdLabel,
    negativeMarking,
  });
  const page1TableTop = estNoticeBottom + 24;

  const estDividerP2 = drawGazetteHeader({
    ctx: scratchCtx,
    W,
    M,
    quizTitle,
    regionLabel,
    branding,
    totalCandidates: ordered.length,
    pageIdx: 1,
    totalPages: 2,
    onneshaLogo,
    partnerLogo,
  });
  const contTableTop = estDividerP2 + 24;

  const maxNonFinalTableBottom = H - 110;
  const maxFinalTableBottom = H - 275; // leaves room for Authority Signatures + page footer

  const p1FinalCap = Math.max(
    1,
    Math.floor((maxFinalTableBottom - page1TableTop - tableHeaderH) / rowH),
  );
  const p1NonFinalCap = Math.max(
    1,
    Math.floor((maxNonFinalTableBottom - page1TableTop - tableHeaderH) / rowH),
  );
  const contFinalCap = Math.max(
    1,
    Math.floor((maxFinalTableBottom - contTableTop - tableHeaderH) / rowH),
  );
  const contNonFinalCap = Math.max(
    1,
    Math.floor((maxNonFinalTableBottom - contTableTop - tableHeaderH) / rowH),
  );

  // Build balanced page slices so the final page ALWAYS leaves room for signatures & at least 1 row
  const pageSlices: Array<{ items: MeritParticipant[]; startRank: number }> = [];
  if (ordered.length === 0) {
    pageSlices.push({ items: [], startRank: 1 });
  } else {
    let offset = 0;
    while (offset < ordered.length) {
      const isFirst = pageSlices.length === 0;
      const finalCap = isFirst ? p1FinalCap : contFinalCap;
      const nonFinalCap = isFirst ? p1NonFinalCap : contNonFinalCap;
      const remaining = ordered.length - offset;

      let take: number;
      if (remaining <= finalCap) {
        take = remaining;
      } else {
        // Leave >= 1 row for subsequent page so signatures never stand orphan on empty page
        take = Math.max(1, Math.min(nonFinalCap, remaining - 1));
      }
      pageSlices.push({
        items: ordered.slice(offset, offset + take),
        startRank: offset + 1,
      });
      offset += take;
    }
  }

  // Exact 9-column specification matching MeritGazetteView (sums to 1486px)
  const columns: ReadonlyArray<{
    key: string;
    label: string;
    width: number;
    align: "left" | "center";
  }> = [
    { key: "rank", label: "Rank", width: 76, align: "center" },
    { key: "roll", label: "Roll Number", width: 166, align: "left" },
    { key: "name", label: "Candidate Name", width: 310, align: "left" },
    { key: "region", label: "Region / Range", width: 230, align: "left" },
    { key: "correct", label: "Correct", width: 96, align: "center" },
    { key: "wrong", label: "Wrong", width: 96, align: "center" },
    { key: "acc", label: "Accuracy", width: 114, align: "center" },
    { key: "score", label: "Net Score", width: 144, align: "center" },
    { key: "status", label: "Status", width: 254, align: "center" },
  ];

  const colEdges: number[] = [M];
  columns.forEach((col) => colEdges.push(colEdges[colEdges.length - 1]! + col.width));

  const canvases: HTMLCanvasElement[] = [];
  const totalPages = pageSlices.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const sliceObj = pageSlices[pageIdx]!;
    const isLastPage = pageIdx === totalPages - 1;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Header
    const dividerY = drawGazetteHeader({
      ctx,
      W,
      M,
      quizTitle,
      regionLabel,
      branding,
      totalCandidates: ordered.length,
      pageIdx,
      totalPages,
      onneshaLogo,
      partnerLogo,
    });

    // Notice box only on Page 1
    const tableTop =
      pageIdx === 0
        ? drawGazetteNoticeBox({
            ctx,
            M,
            CW,
            startY: dividerY + 20,
            regionLabel,
            thresholdDisplay,
            thresholdLabel,
            negativeMarking,
          }) + 24
        : dividerY + 24;

    // Table Header Row (#f3f4f6 light slate matching preview bg-gray-100)
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(M, tableTop, CW, tableHeaderH);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.strokeRect(M, tableTop, CW, tableHeaderH);

    ctx.textBaseline = "middle";
    const hdrMidY = tableTop + tableHeaderH / 2;
    columns.forEach((col, cIdx) => {
      const xStart = colEdges[cIdx]!;
      const xCenter = xStart + col.width / 2;
      if (cIdx > 0) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xStart, tableTop);
        ctx.lineTo(xStart, tableTop + tableHeaderH);
        ctx.stroke();
      }
      ctx.fillStyle = "#000000";
      ctx.font = `bold 18px ${GAZETTE_SANS_FONT}`;
      if (col.align === "center") {
        ctx.textAlign = "center";
        ctx.fillText(col.label, xCenter, hdrMidY);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(col.label, xStart + 14, hdrMidY);
      }
    });

    // Table Body Rows
    const bodyRows = sliceObj.items;
    let currentY = tableTop + tableHeaderH;

    if (bodyRows.length === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(M, currentY, CW, 76);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(M, currentY, CW, 76);
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.font = `600 18px ${GAZETTE_SANS_FONT}`;
      ctx.fillText(
        "No examinee records available for the selected scope.",
        M + CW / 2,
        currentY + 38,
      );
      currentY += 76;
    } else {
      bodyRows.forEach((p, idx) => {
        const globalRank = sliceObj.startRank + idx;
        const y = tableTop + tableHeaderH + idx * rowH;
        const midY = y + rowH / 2;

        // Top 3 amber highlight matching preview `bg-amber-50/60`
        ctx.fillStyle = globalRank <= 3 ? "#fffbeb" : idx % 2 === 1 ? "#f8fafc" : "#ffffff";
        ctx.fillRect(M, y, CW, rowH);

        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(M, y, CW, rowH);
        for (let cIdx = 1; cIdx < colEdges.length - 1; cIdx++) {
          const seamX = colEdges[cIdx]!;
          ctx.beginPath();
          ctx.moveTo(seamX, y);
          ctx.lineTo(seamX, y + rowH);
          ctx.stroke();
        }

        const totalQ = (p.correctCount ?? 0) + (p.incorrectCount ?? 0) + (p.unansweredCount ?? 0);
        const acc =
          typeof p.accuracyPct === "number"
            ? p.accuracyPct
            : totalQ > 0
              ? computeParticipantAccuracyPct({
                  correctCount: p.correctCount,
                  totalQuestions: totalQ,
                  score: p.finalScore,
                })
              : 0;
        const isPassed =
          typeof p.passed === "boolean" ? p.passed : isPassingScore(acc, effectiveThreshold);

        ctx.textBaseline = "middle";

        // Col 0: Rank
        ctx.textAlign = "center";
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold 17px ${GAZETTE_MONO_FONT}`;
        ctx.fillText(`#${globalRank}`, colEdges[0]! + columns[0]!.width / 2, midY);

        // Col 1: Roll Number
        ctx.textAlign = "left";
        ctx.fillStyle = "#0f172a";
        ctx.font = `600 17px ${GAZETTE_MONO_FONT}`;
        const rollStr = p.rollNumber || `2026-${100 + globalRank}`;
        ctx.fillText(fitCellText(ctx, rollStr, columns[1]!.width - 24), colEdges[1]! + 14, midY);

        // Col 2: Candidate Name
        ctx.fillStyle = "#000000";
        ctx.font = `bold 17px ${GAZETTE_SANS_FONT}`;
        ctx.fillText(
          fitCellText(ctx, p.nickname || "Candidate", columns[2]!.width - 24),
          colEdges[2]! + 14,
          midY,
        );

        // Col 3: Region / Range
        ctx.fillStyle = "#1f2937";
        ctx.font = `600 16px ${GAZETTE_SANS_FONT}`;
        ctx.fillText(
          fitCellText(ctx, p.regionName || "Dhaka Range", columns[3]!.width - 24),
          colEdges[3]! + 14,
          midY,
        );

        // Col 4: Correct
        ctx.textAlign = "center";
        ctx.fillStyle = "#047857";
        ctx.font = `bold 17px ${GAZETTE_SANS_FONT}`;
        ctx.fillText(String(p.correctCount ?? 0), colEdges[4]! + columns[4]!.width / 2, midY);

        // Col 5: Wrong
        ctx.fillStyle = "#b91c1c";
        ctx.fillText(String(p.incorrectCount ?? 0), colEdges[5]! + columns[5]!.width / 2, midY);

        // Col 6: Accuracy
        ctx.fillStyle = "#0f172a";
        ctx.font = `600 17px ${GAZETTE_MONO_FONT}`;
        ctx.fillText(`${acc}%`, colEdges[6]! + columns[6]!.width / 2, midY);

        // Col 7: Net Score
        ctx.fillStyle = "#000000";
        ctx.font = `900 18px ${GAZETTE_MONO_FONT}`;
        ctx.fillText(String(p.finalScore ?? 0), colEdges[7]! + columns[7]!.width / 2, midY);

        // Col 8: Status
        ctx.font = `bold 17px ${GAZETTE_SANS_FONT}`;
        ctx.fillStyle = isPassed ? "#047857" : "#b91c1c";
        const statusText = isPassed ? "PASSED" : `FAILED (<${effectiveThreshold}%)`;
        ctx.fillText(
          fitCellText(ctx, statusText, columns[8]!.width - 20),
          colEdges[8]! + columns[8]!.width / 2,
          midY,
        );

        currentY = y + rowH;
      });
    }

    // Crisp 2px outer border around entire table
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.strokeRect(M, tableTop, CW, currentY - tableTop);

    // Authority Signatures block on the final page (matching preview lines 244-258)
    if (isLastPage) {
      const sigRuleY = Math.max(currentY + 34, H - 235);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(M, sigRuleY);
      ctx.lineTo(W - M, sigRuleY);
      ctx.stroke();

      const sigLineY = sigRuleY + 78;
      // Left Signatory
      ctx.beginPath();
      ctx.moveTo(M + 20, sigLineY);
      ctx.lineTo(M + 340, sigLineY);
      ctx.stroke();

      // Right Signatory
      ctx.beginPath();
      ctx.moveTo(W - M - 340, sigLineY);
      ctx.lineTo(W - M - 20, sigLineY);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#000000";
      ctx.font = `bold 19px ${GAZETTE_SANS_FONT}`;
      ctx.fillText("Prepared by Examiner", M + 180, sigLineY + 26);

      ctx.fillText("Controller of Examinations", W - M - 180, sigLineY + 26);
      ctx.fillStyle = "#4b5563";
      ctx.font = `600 15px ${GAZETTE_SANS_FONT}`;
      const authorityLabel =
        branding?.showPartnerLogo && branding.partnerName
          ? `${branding.partnerName} / Onnesha`
          : branding?.institutionTitle || "Onnesha Assessment Arena";
      ctx.fillText(authorityLabel, W - M - 180, sigLineY + 49);
    }

    // Footer Page Metadata Line
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#64748b";
    ctx.font = `bold 15px ${GAZETTE_MONO_FONT}`;
    ctx.fillText(
      `Page ${pageIdx + 1} of ${totalPages}  •  Gazette ONN-2026-GZ  •  ${new Date().toLocaleDateString()}  •  ${regionLabel}`,
      W / 2,
      H - 52,
    );

    canvases.push(canvas);
  }

  const pdfBytes = buildPdfFromCanvases(canvases, "portrait");
  triggerBlobDownload(
    pdfBytes,
    `Onnesha-Merit-Gazette-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

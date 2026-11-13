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
  CertificateThemePalette,
  DEFAULT_CERTIFICATE_SIGNATORIES,
  resolveCertificateTheme,
} from "./branding";
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

  const theme = resolveCertificateTheme(branding);
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
  ctx.fillStyle = theme.textSecondary;
  ctx.font = "500 26px sans-serif";
  ctx.fillText(
    "for successfully completing and demonstrating outstanding proficiency in the assessment:",
    W / 2,
    658 + yShift,
  );

  ctx.fillStyle = theme.accentColor;
  const quizTitle = certificate.quizTitle || "Institutional Merit Assessment";
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

  const cards = [
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

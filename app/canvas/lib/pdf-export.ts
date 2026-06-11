import type { CanvasNode, Connection } from "./canvas-types";

// Canvas background in RGB — used to composite rgba node colors into solid values.
const PDF_BG_RGB: [number, number, number] = [12, 32, 24]; // #0C2018

// Parses any color format nodes can store (hex, rgb, rgba) into [r,g,b] integers
// for jsPDF, which has no alpha channel on fill colors. rgba colors are composited
// over the canvas background so the tinted solid color matches on-screen appearance.
// Never throws — returns the default node fill on any unparseable value.
function parseColorForPdf(color: string): [number, number, number] {
  try {
    if (
      typeof color === "string" &&
      color.startsWith("#") &&
      color.length === 7
    ) {
      const h = color.slice(1);
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    const m =
      typeof color === "string" &&
      color.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
      );
    if (m) {
      const r = parseInt(m[1]),
        g = parseInt(m[2]),
        b = parseInt(m[3]);
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (a >= 1) return [r, g, b];
      return [
        Math.round(a * r + (1 - a) * PDF_BG_RGB[0]),
        Math.round(a * g + (1 - a) * PDF_BG_RGB[1]),
        Math.round(a * b + (1 - a) * PDF_BG_RGB[2]),
      ];
    }
  } catch {
    // fall through to default
  }
  return [29, 92, 80]; // #1D5C50
}

// ── Vector PDF export (jsPDF direct) ────────────────────────────────────────
export async function exportBoardPdf(
  nodes: CanvasNode[],
  connections: Connection[],
  boardName: string,
): Promise<void> {
  if (nodes.length === 0) return;

  const { jsPDF } = await import("jspdf");

  const PAD = 40;
  const minX = nodes.reduce((m, n) => Math.min(m, n.x), Infinity) - PAD;
  const minY = nodes.reduce((m, n) => Math.min(m, n.y), Infinity) - PAD;
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.w), -Infinity) + PAD;
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.h), -Infinity) + PAD;
  const contentW = Math.ceil(maxX - minX);
  const contentH = Math.ceil(maxY - minY);

  // Same 14000-unit safety cap as before.
  const SAFE_MAX = 14000;
  const exportScale =
    Math.max(contentW, contentH) > SAFE_MAX
      ? SAFE_MAX / Math.max(contentW, contentH)
      : 1;
  const pdfW = Math.round(contentW * exportScale);
  const pdfH = Math.round(contentH * exportScale);

  const doc = new jsPDF({
    orientation: pdfW >= pdfH ? "landscape" : "portrait",
    unit: "px",
    format: [pdfW, pdfH],
  });

  // Translate world coordinate → PDF coordinate.
  const px = (wx: number) => (wx - minX) * exportScale;
  const py = (wy: number) => (wy - minY) * exportScale;

  // Background fill.
  const [bgR, bgG, bgB] = parseColorForPdf("#0C2018");
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(0, 0, pdfW, pdfH, "F");

  // ── 1. Connection lines (drawn first so they sit behind nodes) ─────────────
  // Geometry replicates ConnectionLine exactly: axis-dominant edge selection,
  // cpOffset = max(40, dist*0.4), cubic bezier tangent perpendicular to edge.
  // On-screen stroke is rgba(255,255,255,0.7) on #0C2018.
  // Blended opaque equivalent: rgb(182,188,186) — used here since jsPDF has no alpha.
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  doc.setDrawColor(182, 188, 186);
  doc.setLineWidth(1.5);
  doc.setLineCap("round");

  for (const c of connections) {
    const fn = nodeMap.get(c.from);
    const tn = nodeMap.get(c.to);
    if (!fn || !tn) continue;

    const fcx = fn.x + fn.w / 2;
    const fcy = fn.y + fn.h / 2;
    const tcx = tn.x + tn.w / 2;
    const tcy = tn.y + tn.h / 2;
    const dx = tcx - fcx;
    const dy = tcy - fcy;

    let x1: number, y1: number, x2: number, y2: number, cpOffset: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
      const dist = Math.abs(dx);
      cpOffset = Math.max(40, dist * 0.4);
      if (dx >= 0) {
        x1 = fn.x + fn.w;
        y1 = fcy;
        x2 = tn.x;
        y2 = tcy;
      } else {
        x1 = fn.x;
        y1 = fcy;
        x2 = tn.x + tn.w;
        y2 = tcy;
      }
    } else {
      const dist = Math.abs(dy);
      cpOffset = Math.max(40, dist * 0.4);
      if (dy >= 0) {
        x1 = fcx;
        y1 = fn.y + fn.h;
        x2 = tcx;
        y2 = tn.y;
      } else {
        x1 = fcx;
        y1 = fn.y;
        x2 = tcx;
        y2 = tn.y + tn.h;
      }
    }

    let c1x: number, c1y: number, c2x: number, c2y: number;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sign = dx >= 0 ? 1 : -1;
      c1x = x1 + sign * cpOffset;
      c1y = y1;
      c2x = x2 - sign * cpOffset;
      c2y = y2;
    } else {
      const sign = dy >= 0 ? 1 : -1;
      c1x = x1;
      c1y = y1 + sign * cpOffset;
      c2x = x2;
      c2y = y2 - sign * cpOffset;
    }

    doc.moveTo(px(x1), py(y1));
    doc.curveTo(px(c1x), py(c1y), px(c2x), py(c2y), px(x2), py(y2));
    doc.stroke();
  }

  // ── 2. All shape nodes (drawn over connection lines) ────────────────────────
  // "text" nodes have no filled background on-screen, so we skip them.
  // All other types get a filled shape so connection line endpoints are visible.
  // Image nodes: n.imageUrl is already a data URL in React state (loaded from
  // IndexedDB at hydration time) — no async fetch needed. addImage() is
  // synchronous for data URLs, so all images are embedded before doc.save().
  for (const n of nodes) {
    if (n.type === "text") continue;
    const [r, g, b] = parseColorForPdf(n.color || "#1D5C50");
    doc.setFillColor(r, g, b);
    const nx = px(n.x),
      ny = py(n.y);
    const nw = n.w * exportScale,
      nh = n.h * exportScale;

    if (n.type === "image") {
      let embedded = false;
      if (n.imageUrl) {
        try {
          const fmtMatch = n.imageUrl.match(/^data:image\/([a-z0-9]+);/i);
          const rawFmt = fmtMatch ? fmtMatch[1].toUpperCase() : "JPEG";
          const fmt = rawFmt === "JPG" ? "JPEG" : rawFmt;
          doc.addImage(n.imageUrl, fmt, nx, ny, nw, nh);
          embedded = true;
        } catch {
          // Unsupported format or corrupt data — fall through to rectangle
        }
      }
      if (!embedded) doc.rect(nx, ny, nw, nh, "F");
    } else if (n.type === "circle" || n.type === "oval") {
      doc.ellipse(nx + nw / 2, ny + nh / 2, nw / 2, nh / 2, "F");
    } else if (n.type === "diamond") {
      const cx = nx + nw / 2,
        cy = ny + nh / 2;
      doc.moveTo(cx, ny);
      doc.lineTo(nx + nw, cy);
      doc.lineTo(cx, ny + nh);
      doc.lineTo(nx, cy);
      doc.fill();
    } else if (n.type === "rounded") {
      const cr = Math.min(12 * exportScale, nw / 4, nh / 4);
      doc.roundedRect(nx, ny, nw, nh, cr, cr, "F");
    } else {
      // block, textfile — solid rectangle
      doc.rect(nx, ny, nw, nh, "F");
    }
  }

  // ── 3. Text labels (drawn last so they sit above shapes) ─────────────────
  // Padding values mirror NodeView's CSS exactly.
  // Font sizes: CSS px × 0.75 = pt (jsPDF always takes pt for setFontSize).
  // Line heights: 1.2× for title (no explicit lineHeight on screen),
  //               1.55× for body (matches on-screen lineHeight: 1.55).
  // Wrapping: splitTextToSize uses the current font size for char-width
  //           measurement, so setFontSize must be called before it.
  for (const n of nodes) {
    if (n.type === "image") continue;
    try {
      const [fr, fg, fb] = parseColorForPdf(n.color || "#1D5C50");
      const isDark = (0.299 * fr + 0.587 * fg + 0.114 * fb) / 255 < 0.45;
      const nx = px(n.x),
        ny = py(n.y);
      const nw = n.w * exportScale,
        nh = n.h * exportScale;
      // text nodes have no fill — composite against canvas background
      const bgR = n.type === "text" ? PDF_BG_RGB[0] : fr;
      const bgG = n.type === "text" ? PDF_BG_RGB[1] : fg;
      const bgB = n.type === "text" ? PDF_BG_RGB[2] : fb;

      const fs = n.fontSize ?? 13;
      const sTitleFs = fs * exportScale; // title font size, px
      const sBodyFs = Math.max(11, fs - 2) * exportScale; // body font size, px
      const titleFsPt = sTitleFs * 0.75;
      const bodyFsPt = sBodyFs * 0.75;
      const titleLineH = sTitleFs * 1.2;
      const bodyLineH = sBodyFs * 1.55;
      const fStyle: string =
        n.bold && n.italic
          ? "bolditalic"
          : n.bold
            ? "bold"
            : n.italic
              ? "italic"
              : "normal";

      // Title color
      const [tcR, tcG, tcB] = parseColorForPdf(
        n.textColor ?? (isDark ? "#FFFFFF" : "#111111"),
      );

      // Body color — matches NodeView: n.textColor+"bb" (≈73% alpha) or rgba(255,255,255,0.82)
      const AB = 0xbb / 0xff; // 73.3%
      let bR: number, bG: number, bB: number;
      if (n.textColor) {
        const [tR, tG, tB] = parseColorForPdf(n.textColor);
        bR = Math.round(AB * tR + (1 - AB) * bgR);
        bG = Math.round(AB * tG + (1 - AB) * bgG);
        bB = Math.round(AB * tB + (1 - AB) * bgB);
      } else if (isDark) {
        bR = Math.round(0.82 * 255 + 0.18 * bgR);
        bG = Math.round(0.82 * 255 + 0.18 * bgG);
        bB = Math.round(0.82 * 255 + 0.18 * bgB);
      } else {
        bR = bG = bB = 136; // #888
      }

      const title = (n.title ?? "").trim();
      const body = (n.body ?? "").trim();

      if (n.type === "text") {
        if (!title) continue;
        const [cr, cg, cb] = parseColorForPdf(n.textColor ?? "#FFFFFF");
        doc.setFont("helvetica", fStyle);
        doc.setFontSize(titleFsPt);
        doc.setTextColor(cr, cg, cb);
        const maxW = Math.max(10, nw - 24 * exportScale);
        const lines: string[] = doc.splitTextToSize(title, maxW);
        const totalH = lines.length * titleLineH;
        const startY = ny + nh / 2 - totalH / 2;
        lines.forEach((line: string, i: number) =>
          doc.text(line, nx + nw / 2, startY + i * titleLineH, {
            baseline: "top",
            align: "center",
          }),
        );
      } else if (n.type === "textfile") {
        const label = (n.textFileName ?? n.title ?? "").trim();
        if (!label) continue;
        // rgba(255,255,255,0.82) over node fill
        const lfR = Math.round(0.82 * 255 + 0.18 * fr);
        const lfG = Math.round(0.82 * 255 + 0.18 * fg);
        const lfB = Math.round(0.82 * 255 + 0.18 * fb);
        const padH = 12 * exportScale;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(titleFsPt);
        doc.setTextColor(lfR, lfG, lfB);
        const maxW = Math.max(10, nw - 2 * padH);
        const lines: string[] = doc.splitTextToSize(label, maxW);
        const startY = ny + nh / 2 - titleLineH / 2;
        doc.text(lines[0], nx + padH, startY, { baseline: "top" });
      } else if (n.type === "diamond") {
        const padH = 28 * exportScale;
        const maxW = Math.max(10, nw - 2 * padH);
        doc.setFont("helvetica", fStyle);
        doc.setFontSize(titleFsPt);
        const titleLines: string[] = title
          ? doc.splitTextToSize(title, maxW)
          : [];
        doc.setFontSize(bodyFsPt);
        const bodyLines: string[] = body ? doc.splitTextToSize(body, maxW) : [];
        const totalH =
          titleLines.length * titleLineH +
          (bodyLines.length > 0
            ? 3 * exportScale + bodyLines.length * bodyLineH
            : 0);
        let curY = ny + (nh - totalH) / 2;
        if (titleLines.length > 0) {
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(titleFsPt);
          doc.setTextColor(tcR, tcG, tcB);
          titleLines.forEach((line: string) => {
            doc.text(line, nx + nw / 2, curY, {
              baseline: "top",
              align: "center",
            });
            curY += titleLineH;
          });
        }
        if (bodyLines.length > 0) {
          curY += 3 * exportScale;
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(bodyFsPt);
          doc.setTextColor(bR, bG, bB);
          bodyLines.forEach((line: string) => {
            doc.text(line, nx + nw / 2, curY, {
              baseline: "top",
              align: "center",
            });
            curY += bodyLineH;
          });
        }
      } else if (n.type === "circle" || n.type === "oval") {
        const padH = 16 * exportScale;
        const maxW = Math.max(10, nw - 2 * padH);
        doc.setFont("helvetica", fStyle);
        doc.setFontSize(titleFsPt);
        const titleLines: string[] = title
          ? doc.splitTextToSize(title, maxW)
          : [];
        doc.setFontSize(bodyFsPt);
        const bodyLines: string[] = body ? doc.splitTextToSize(body, maxW) : [];
        const totalH =
          titleLines.length * titleLineH +
          (bodyLines.length > 0
            ? 5 * exportScale + bodyLines.length * bodyLineH
            : 0);
        let curY = ny + (nh - totalH) / 2;
        if (titleLines.length > 0) {
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(titleFsPt);
          doc.setTextColor(tcR, tcG, tcB);
          titleLines.forEach((line: string) => {
            doc.text(line, nx + nw / 2, curY, {
              baseline: "top",
              align: "center",
            });
            curY += titleLineH;
          });
        }
        if (bodyLines.length > 0) {
          curY += 5 * exportScale;
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(bodyFsPt);
          doc.setTextColor(bR, bG, bB);
          bodyLines.forEach((line: string) => {
            doc.text(line, nx + nw / 2, curY, {
              baseline: "top",
              align: "center",
            });
            curY += bodyLineH;
          });
        }
      } else {
        // block, rounded — top-left aligned
        const padH = 18 * exportScale;
        const padTop = 14 * exportScale;
        const maxW = Math.max(10, nw - 2 * padH);
        doc.setFont("helvetica", fStyle);
        doc.setFontSize(titleFsPt);
        const titleLines: string[] = title
          ? doc.splitTextToSize(title, maxW)
          : [];
        doc.setFontSize(bodyFsPt);
        const bodyLines: string[] = body ? doc.splitTextToSize(body, maxW) : [];
        let curY = ny + padTop;
        if (titleLines.length > 0) {
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(titleFsPt);
          doc.setTextColor(tcR, tcG, tcB);
          titleLines.forEach((line: string) => {
            doc.text(line, nx + padH, curY, { baseline: "top" });
            curY += titleLineH;
          });
        }
        if (bodyLines.length > 0) {
          curY += 5 * exportScale;
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(bodyFsPt);
          doc.setTextColor(bR, bG, bB);
          bodyLines.forEach((line: string) => {
            doc.text(line, nx + padH, curY, { baseline: "top" });
            curY += bodyLineH;
          });
        }
      }
    } catch {
      // Never crash the export over one node's text
    }
  }

  const safeName = boardName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "board";
  doc.save(`${safeName}-vector.pdf`);
}

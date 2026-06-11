import type { CanvasNode, Connection, RichText } from "./canvas-types";
import { plainToRich } from "./rich-text";

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
  // Run-aware layout. Each field is a list of lines of styled runs (plain
  // fields become one unstyled run per line via plainToRich). Tokens are
  // measured with their own font/size, wrapped greedily, and each laid line
  // takes its height from its largest run. Inline marks are additive on top
  // of the node's base bold/italic/underline.
  // Padding and line-height factors mirror NodeView's CSS exactly.
  // Font sizes: CSS px × 0.75 = pt (jsPDF always takes pt for setFontSize).

  type LaidSeg = {
    t: string;
    w: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fsPx: number;
  };
  type LaidLine = { segs: LaidSeg[]; width: number; height: number; ascent: number };

  const fontStyleFor = (bold: boolean, italic: boolean): string =>
    bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";

  const setSegFont = (bold: boolean, italic: boolean, fsPx: number) => {
    doc.setFont("helvetica", fontStyleFor(bold, italic));
    doc.setFontSize(fsPx * exportScale * 0.75);
  };

  const layoutField = (
    rich: RichText,
    maxW: number,
    baseFsPx: number,
    lineHFactor: number,
    base: { bold: boolean; italic: boolean; underline: boolean },
  ): LaidLine[] => {
    type Tok = LaidSeg & { ws: boolean };
    const measure = (
      t: string,
      bold: boolean,
      italic: boolean,
      fsPx: number,
    ): number => {
      setSegFont(bold, italic, fsPx);
      return doc.getTextWidth(t);
    };
    const laid: LaidLine[] = [];
    for (const srcLine of rich) {
      const toks: Tok[] = [];
      for (const run of srcLine) {
        const bold = !!run.b || base.bold;
        const italic = !!run.i || base.italic;
        const underline = !!run.u || base.underline;
        const fsPx = run.fs ?? baseFsPx;
        for (const piece of run.t.split(/(\s+)/)) {
          if (piece === "") continue;
          toks.push({
            t: piece,
            bold,
            italic,
            underline,
            fsPx,
            w: measure(piece, bold, italic, fsPx),
            ws: /^\s+$/.test(piece),
          });
        }
      }
      if (toks.length === 0) {
        // Intentional empty line — keeps base line height.
        laid.push({
          segs: [],
          width: 0,
          height: lineHFactor * baseFsPx * exportScale,
          ascent: 0.8 * baseFsPx * exportScale,
        });
        continue;
      }

      let cur: Tok[] = [];
      let wrapped = false;
      const curW = () => cur.reduce((sum, t) => sum + t.w, 0);
      const flush = () => {
        // Wrapped continuation lines shouldn't start with the break's space;
        // trailing whitespace never renders (splitTextToSize trimmed it too).
        if (wrapped) while (cur.length && cur[0].ws) cur.shift();
        while (cur.length && cur[cur.length - 1].ws) cur.pop();
        const segs: LaidSeg[] = [];
        for (const t of cur) {
          const prev = segs[segs.length - 1];
          if (
            prev &&
            prev.bold === t.bold &&
            prev.italic === t.italic &&
            prev.underline === t.underline &&
            prev.fsPx === t.fsPx
          ) {
            prev.t += t.t;
            prev.w += t.w;
          } else {
            segs.push({
              t: t.t,
              w: t.w,
              bold: t.bold,
              italic: t.italic,
              underline: t.underline,
              fsPx: t.fsPx,
            });
          }
        }
        const maxFs = segs.reduce((m, sg) => Math.max(m, sg.fsPx), baseFsPx);
        laid.push({
          segs,
          width: segs.reduce((sum, sg) => sum + sg.w, 0),
          height: lineHFactor * maxFs * exportScale,
          ascent: 0.8 * maxFs * exportScale,
        });
        cur = [];
        wrapped = true;
      };

      for (const tok of toks) {
        if (cur.length > 0 && !tok.ws && curW() + tok.w > maxW) flush();
        if (!tok.ws && tok.w > maxW) {
          // Hard-split a token wider than the field (long words / URLs).
          let rest = tok.t;
          while (rest.length > 1) {
            let lo = 1,
              hi = rest.length,
              fit = 1;
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              if (
                measure(rest.slice(0, mid), tok.bold, tok.italic, tok.fsPx) <=
                maxW
              ) {
                fit = mid;
                lo = mid + 1;
              } else hi = mid - 1;
            }
            if (fit >= rest.length) break;
            const head = rest.slice(0, fit);
            cur.push({
              ...tok,
              t: head,
              w: measure(head, tok.bold, tok.italic, tok.fsPx),
            });
            flush();
            rest = rest.slice(fit);
          }
          cur.push({
            ...tok,
            t: rest,
            w: measure(rest, tok.bold, tok.italic, tok.fsPx),
          });
          continue;
        }
        cur.push(tok);
      }
      flush();
    }
    return laid;
  };

  const fieldHeight = (laid: LaidLine[]): number =>
    laid.reduce((sum, l) => sum + l.height, 0);

  const drawField = (
    laid: LaidLine[],
    xLeft: number,
    centerX: number | null,
    yTop: number,
    color: [number, number, number],
  ) => {
    let y = yTop;
    for (const line of laid) {
      let x = centerX !== null ? centerX - line.width / 2 : xLeft;
      const yBase = y + line.ascent;
      for (const seg of line.segs) {
        setSegFont(seg.bold, seg.italic, seg.fsPx);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(seg.t, x, yBase);
        if (seg.underline) {
          doc.setDrawColor(color[0], color[1], color[2]);
          doc.setLineWidth(Math.max(0.4, seg.fsPx * exportScale * 0.05));
          const uy = yBase + seg.fsPx * exportScale * 0.1;
          doc.line(x, uy, x + seg.w, uy);
        }
        x += seg.w;
      }
      y += line.height;
    }
  };

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
      const bodyFsPx = Math.max(11, fs - 2);
      const base = {
        bold: !!n.bold,
        italic: !!n.italic,
        underline: !!n.underline,
      };

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
      const titleSrc: RichText | null =
        n.titleRich ?? (title ? plainToRich(title) : null);
      const bodySrc: RichText | null =
        n.bodyRich ?? (body ? plainToRich(body) : null);

      if (n.type === "text") {
        if (!titleSrc) continue;
        const [cr, cg, cb] = parseColorForPdf(n.textColor ?? "#FFFFFF");
        const maxW = Math.max(10, nw - 24 * exportScale);
        const laid = layoutField(titleSrc, maxW, fs, 1.2, base);
        const startY = ny + nh / 2 - fieldHeight(laid) / 2;
        drawField(laid, 0, nx + nw / 2, startY, [cr, cg, cb]);
      } else if (n.type === "textfile") {
        const label = (n.textFileName ?? n.title ?? "").trim();
        if (!label) continue;
        // rgba(255,255,255,0.82) over node fill
        const lfR = Math.round(0.82 * 255 + 0.18 * fr);
        const lfG = Math.round(0.82 * 255 + 0.18 * fg);
        const lfB = Math.round(0.82 * 255 + 0.18 * fb);
        const padH = 12 * exportScale;
        const titleFsPt = fs * exportScale * 0.75;
        const titleLineH = fs * exportScale * 1.2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(titleFsPt);
        doc.setTextColor(lfR, lfG, lfB);
        const maxW = Math.max(10, nw - 2 * padH);
        const lines: string[] = doc.splitTextToSize(label, maxW);
        const startY = ny + nh / 2 - titleLineH / 2;
        doc.text(lines[0], nx + padH, startY, { baseline: "top" });
      } else {
        // diamond / circle / oval — centered; block / rounded — top-left
        const centered =
          n.type === "diamond" || n.type === "circle" || n.type === "oval";
        const padH =
          (n.type === "diamond" ? 28 : centered ? 16 : 18) * exportScale;
        const gap = (n.type === "diamond" ? 3 : 5) * exportScale;
        const maxW = Math.max(10, nw - 2 * padH);
        const titleLaid = titleSrc
          ? layoutField(titleSrc, maxW, fs, 1.2, base)
          : [];
        const bodyLaid = bodySrc
          ? layoutField(bodySrc, maxW, bodyFsPx, 1.55, base)
          : [];
        const titleH = fieldHeight(titleLaid);
        const bodyH = fieldHeight(bodyLaid);
        const totalH = titleH + (bodyLaid.length > 0 ? gap + bodyH : 0);
        let curY = centered ? ny + (nh - totalH) / 2 : ny + 14 * exportScale;
        if (titleLaid.length > 0) {
          drawField(
            titleLaid,
            nx + padH,
            centered ? nx + nw / 2 : null,
            curY,
            [tcR, tcG, tcB],
          );
          curY += titleH;
        }
        if (bodyLaid.length > 0) {
          curY += gap;
          drawField(
            bodyLaid,
            nx + padH,
            centered ? nx + nw / 2 : null,
            curY,
            [bR, bG, bB],
          );
        }
      }
    } catch {
      // Never crash the export over one node's text
    }
  }

  const safeName = boardName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "board";
  doc.save(`${safeName}-vector.pdf`);
}

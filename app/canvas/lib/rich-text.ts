import type { RichText, TextRun } from "./canvas-types";
import { rgbToHex } from "./color-helpers";

// ── Rich text model helpers ───────────────────────────────────────────────────
// RichText is the source of truth for formatted fields; the node's plain
// `title` / `body` strings are mirrors derived with richToPlain at commit
// time. Runs are treated as immutable — every edit produces new arrays, so
// history snapshots can share them safely.

export const MIN_RUN_FONT_SIZE = 8;
export const MAX_RUN_FONT_SIZE = 72;

// Per-document character budget. Documents live in board state (undo
// snapshots, .dnkrm files) and in the IndexedDB asset store — 50k chars keeps
// 40 retained history versions in the single-digit-MB range and stays far
// inside browser quotas. The editor enforces this gracefully (counter +
// blocked insertions), never by truncating silently.
export const MAX_DOC_CHARS = 50_000;

// Per-image budget for inline document images (data-URL length, ≈1.5MB of
// binary). Images live in docRich, which is IndexedDB-persisted like the
// existing image-node assets.
export const MAX_DOC_IMAGE_CHARS = 2_000_000;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Inline styles read back as rgb(...) even when set as hex — normalize.
function cssColorToHex(v: string): string | undefined {
  if (HEX_COLOR.test(v)) return v;
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return undefined;
}

export function richToPlain(rich: RichText): string {
  return rich.map((line) => line.map((r) => r.t).join("")).join("\n");
}

export function plainToRich(plain: string): RichText {
  return plain.split("\n").map((line) => (line === "" ? [] : [{ t: line }]));
}

export function richHasMarks(rich: RichText): boolean {
  return rich.some((line) =>
    line.some(
      (r) =>
        r.b || r.i || r.u || r.fs !== undefined || r.c || r.bg || r.img,
    ),
  );
}

// Merge adjacent runs with identical marks so state stays compact no matter
// how fragmented the edited DOM was.
function normalizeLine(line: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of line) {
    if (run.img) {
      out.push({ ...run });
      continue;
    }
    if (run.t === "") continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      !prev.img &&
      !prev.b === !run.b &&
      !prev.i === !run.i &&
      !prev.u === !run.u &&
      prev.fs === run.fs &&
      prev.c === run.c &&
      prev.bg === run.bg
    ) {
      prev.t += run.t;
    } else {
      out.push({ ...run });
    }
  }
  return out;
}

// ── DOM ↔ runs ────────────────────────────────────────────────────────────────

// Renders a field into its contenteditable host. Built with DOM APIs (never
// innerHTML) so run text can't inject markup. Lines are joined with literal
// "\n" — the host renders with white-space: pre-wrap.
export function setEditableContent(
  el: HTMLElement,
  rich: RichText | undefined,
  plain: string,
): void {
  if (!rich) {
    el.textContent = plain;
    return;
  }
  el.textContent = "";
  rich.forEach((line, li) => {
    if (li > 0) el.appendChild(document.createTextNode("\n"));
    for (const run of line) {
      if (run.img) {
        const img = document.createElement("img");
        img.src = run.img;
        img.draggable = false;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "3px";
        el.appendChild(img);
        continue;
      }
      if (
        !run.b &&
        !run.i &&
        !run.u &&
        run.fs === undefined &&
        run.c === undefined &&
        run.bg === undefined
      ) {
        el.appendChild(document.createTextNode(run.t));
        continue;
      }
      const span = document.createElement("span");
      if (run.b) span.style.fontWeight = "700";
      if (run.i) span.style.fontStyle = "italic";
      if (run.u) span.style.textDecoration = "underline";
      if (run.fs !== undefined) span.style.fontSize = `${run.fs}px`;
      if (run.c !== undefined) span.style.color = run.c;
      if (run.bg !== undefined) span.style.backgroundColor = run.bg;
      span.textContent = run.t;
      el.appendChild(span);
    }
  });
}

type MarkCtx = {
  b: boolean;
  i: boolean;
  u: boolean;
  fs?: number;
  c?: string;
  bg?: string;
};

// Marks are additive overrides on the node's base style, so only positive
// signals (tags, explicit styles) set them — "font-weight: normal" spans the
// browser may emit are ignored rather than treated as un-bolding.
function ctxFromElement(el: HTMLElement, ctx: MarkCtx): MarkCtx {
  const next = { ...ctx };
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") next.b = true;
  if (tag === "I" || tag === "EM") next.i = true;
  if (tag === "U") next.u = true;
  const st = el.style;
  if (st) {
    const fw = parseInt(st.fontWeight, 10);
    if (st.fontWeight === "bold" || fw >= 600) next.b = true;
    if (st.fontStyle === "italic") next.i = true;
    if (
      st.textDecoration.includes("underline") ||
      st.textDecorationLine.includes("underline")
    )
      next.u = true;
    const m = st.fontSize.match(/^([\d.]+)px$/);
    if (m) {
      next.fs = Math.min(
        MAX_RUN_FONT_SIZE,
        Math.max(MIN_RUN_FONT_SIZE, Math.round(parseFloat(m[1]))),
      );
    }
    if (st.color) {
      const hex = cssColorToHex(st.color);
      if (hex) next.c = hex;
    }
    if (
      st.backgroundColor &&
      st.backgroundColor !== "transparent" &&
      !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(st.backgroundColor)
    ) {
      const hex = cssColorToHex(st.backgroundColor);
      if (hex) next.bg = hex;
    }
  }
  return next;
}

function makeRun(t: string, ctx: MarkCtx): TextRun {
  const run: TextRun = { t };
  if (ctx.b) run.b = true;
  if (ctx.i) run.i = true;
  if (ctx.u) run.u = true;
  if (ctx.fs !== undefined) run.fs = ctx.fs;
  if (ctx.c !== undefined) run.c = ctx.c;
  if (ctx.bg !== undefined) run.bg = ctx.bg;
  return run;
}

// Serializes a contenteditable's DOM back to runs with exactly one line per
// visual line. Same line semantics as the plain-text serializer this
// supersedes: Chrome wraps each Enter-created line in a <div> (an empty line
// becomes <div><br></div>), and a trailing <br> is the browser's placeholder
// for the line that produced it — not an extra break.
export function editableRichText(root: HTMLElement): RichText {
  const blockLines = (block: Node, blockCtx: MarkCtx): TextRun[][] => {
    const out: TextRun[][] = [];
    let cur: TextRun[] = [];
    // True when the last thing seen was a literal "\n" in a text node — those
    // are real breaks (our own rendered line separators), unlike a trailing
    // <br>, and must keep their empty final line.
    let trailingNewline = false;
    const endLine = () => {
      out.push(cur);
      cur = [];
    };
    const visit = (node: Node, ctx: MarkCtx) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = (node.textContent ?? "").split("\n");
        parts.forEach((part, idx) => {
          if (idx > 0) {
            endLine();
            trailingNewline = true;
          }
          if (part !== "") {
            cur.push(makeRun(part, ctx));
            trailingNewline = false;
          }
        });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === "IMG") {
        // Images occupy a line of their own; only bounded data URLs survive.
        const src = el.getAttribute("src") ?? "";
        if (
          src.startsWith("data:image/") &&
          src.length <= MAX_DOC_IMAGE_CHARS
        ) {
          if (cur.length > 0) endLine();
          out.push([{ t: "", img: src }]);
          trailingNewline = false;
        }
        return;
      }
      if (tag === "BR") {
        endLine();
        trailingNewline = false;
        return;
      }
      if (tag === "DIV" || tag === "P") {
        if (cur.length > 0) endLine();
        out.push(...blockLines(el, ctxFromElement(el, ctx)));
        trailingNewline = false;
        return;
      }
      const childCtx = ctxFromElement(el, ctx);
      for (const child of Array.from(el.childNodes)) visit(child, childCtx);
    };
    for (const child of Array.from(block.childNodes)) visit(child, blockCtx);
    if (cur.length > 0 || out.length === 0 || trailingNewline) endLine();
    return out;
  };
  return blockLines(root, { b: false, i: false, u: false }).map(normalizeLine);
}

export const FONT_SIZE_LADDER = [9, 11, 13, 15, 18, 24, 32, 48];

// Wraps the current selection in a font-size span. execCommand("fontSize")
// only supports the legacy 1–7 scale, so this is done with range surgery:
// extractContents auto-splits partially-selected nodes; nested size spans in
// the extracted fragment are cleared so the new size wins; the blur-time
// parser re-normalizes whatever nesting this produces.
export function applyFontSizeToSelection(px: number): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const clamped = Math.min(
    MAX_RUN_FONT_SIZE,
    Math.max(MIN_RUN_FONT_SIZE, Math.round(px)),
  );
  const range = sel.getRangeAt(0);
  const frag = range.extractContents();
  frag.querySelectorAll("span").forEach((s) => {
    if (s.style.fontSize) s.style.fontSize = "";
  });
  const span = document.createElement("span");
  span.style.fontSize = `${clamped}px`;
  span.appendChild(frag);
  range.insertNode(span);
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(r);
}

// Wraps the current selection in a colored span (text or highlight) —
// same range surgery as applyFontSizeToSelection, clearing nested overrides
// of the same property so the new value wins.
export function applyColorToSelection(
  prop: "color" | "backgroundColor",
  value: string,
): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const frag = range.extractContents();
  frag.querySelectorAll("span").forEach((sp) => {
    if (sp.style[prop]) sp.style[prop] = "";
  });
  const span = document.createElement("span");
  span.style[prop] = value;
  span.appendChild(frag);
  range.insertNode(span);
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(r);
}

// Structural validation for untrusted payloads (localStorage, .dnkrm files) —
// same philosophy as sanitizeLoadedNode: accept only known fields with the
// right types, clamp numbers, reject anything malformed.
export function sanitizeRichText(raw: unknown): RichText | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines: RichText = [];
  for (const rawLine of raw) {
    if (!Array.isArray(rawLine)) return null;
    const line: TextRun[] = [];
    for (const rawRun of rawLine) {
      if (!rawRun || typeof rawRun !== "object") return null;
      const r = rawRun as Record<string, unknown>;
      if (typeof r.t !== "string") return null;
      if (typeof r.img === "string") {
        if (r.img.startsWith("data:image/") && r.img.length <= MAX_DOC_IMAGE_CHARS) {
          line.push({ t: "", img: r.img });
        }
        continue;
      }
      if (r.t === "") continue;
      const run: TextRun = { t: r.t };
      if (r.b === true) run.b = true;
      if (r.i === true) run.i = true;
      if (r.u === true) run.u = true;
      if (typeof r.fs === "number" && Number.isFinite(r.fs)) {
        run.fs = Math.min(
          MAX_RUN_FONT_SIZE,
          Math.max(MIN_RUN_FONT_SIZE, Math.round(r.fs)),
        );
      }
      if (typeof r.c === "string" && HEX_COLOR.test(r.c)) run.c = r.c;
      if (typeof r.bg === "string" && HEX_COLOR.test(r.bg)) run.bg = r.bg;
      line.push(run);
    }
    lines.push(line);
  }
  return lines;
}

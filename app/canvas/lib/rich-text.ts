import type { RichText, TextRun } from "./canvas-types";

// ── Rich text model helpers ───────────────────────────────────────────────────
// RichText is the source of truth for formatted fields; the node's plain
// `title` / `body` strings are mirrors derived with richToPlain at commit
// time. Runs are treated as immutable — every edit produces new arrays, so
// history snapshots can share them safely.

export const MIN_RUN_FONT_SIZE = 8;
export const MAX_RUN_FONT_SIZE = 72;

export function richToPlain(rich: RichText): string {
  return rich.map((line) => line.map((r) => r.t).join("")).join("\n");
}

export function plainToRich(plain: string): RichText {
  return plain.split("\n").map((line) => (line === "" ? [] : [{ t: line }]));
}

export function richHasMarks(rich: RichText): boolean {
  return rich.some((line) =>
    line.some((r) => r.b || r.i || r.u || r.fs !== undefined),
  );
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
      line.push(run);
    }
    lines.push(line);
  }
  return lines;
}

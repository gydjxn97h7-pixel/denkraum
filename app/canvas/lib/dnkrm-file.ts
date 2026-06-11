import type { CanvasNode, NodeType } from "./canvas-types";

// ── .dnkrm file validation ────────────────────────────────────────────────────

const VALID_NODE_TYPES = new Set<string>([
  "block",
  "text",
  "circle",
  "oval",
  "diamond",
  "rounded",
  "image",
  "textfile",
]);

export function sanitizeLoadedNode(raw: unknown): CanvasNode | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== "number" || !Number.isFinite(n.id)) return null;
  if (typeof n.x !== "number" || !Number.isFinite(n.x)) return null;
  if (typeof n.y !== "number" || !Number.isFinite(n.y)) return null;
  if (typeof n.w !== "number" || !Number.isFinite(n.w) || n.w < 1) return null;
  if (typeof n.h !== "number" || !Number.isFinite(n.h) || n.h < 1) return null;
  if (typeof n.type !== "string" || !VALID_NODE_TYPES.has(n.type)) return null;
  return {
    id: Math.trunc(n.id as number),
    x: n.x as number,
    y: n.y as number,
    w: Math.max(10, n.w as number),
    h: Math.max(10, n.h as number),
    type: n.type as NodeType,
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    color: typeof n.color === "string" ? n.color : "#1D5C50",
    ...(typeof n.fontSize === "number" &&
      Number.isFinite(n.fontSize) && { fontSize: n.fontSize as number }),
    ...(typeof n.label === "string" && { label: n.label }),
    ...(typeof n.imageUrl === "string" && { imageUrl: n.imageUrl }),
    ...(typeof n.textFileContent === "string" && {
      textFileContent: n.textFileContent,
    }),
    ...(typeof n.textFileName === "string" && { textFileName: n.textFileName }),
    ...(typeof n.bold === "boolean" && { bold: n.bold }),
    ...(typeof n.italic === "boolean" && { italic: n.italic }),
    ...(typeof n.underline === "boolean" && { underline: n.underline }),
    ...(typeof n.textColor === "string" && { textColor: n.textColor }),
    ...(typeof n.excludeFromPresentation === "boolean" && {
      excludeFromPresentation: n.excludeFromPresentation,
    }),
  };
}

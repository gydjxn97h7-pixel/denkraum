// ── AI Generate: prompt → node graph ───────────────────────────────────────────
// Calls Claude (Haiku, fast + cheap) with a structured-output schema so the
// response is guaranteed parseable JSON, then sanitizes it into a graph the
// canvas can place. The SDK is loaded on demand to stay out of the initial
// bundle. dangerouslyAllowBrowser is required for a direct browser call (the
// user supplies their own key locally; there is no server to proxy through).

import type { NodeType } from "./canvas-types";

// The node types the generator is allowed to use — text-bearing shapes that
// need no assets (image/textfile/link/checklist are excluded).
export const GEN_NODE_TYPES = [
  "block",
  "rounded",
  "circle",
  "oval",
  "diamond",
  "text",
  "sticky",
] as const;
export type GenNodeType = (typeof GEN_NODE_TYPES)[number];

// Default size per generated node type — also drives the auto-layout spacing.
export const GEN_SIZE: Record<GenNodeType, { w: number; h: number }> = {
  block: { w: 200, h: 90 },
  rounded: { w: 200, h: 90 },
  circle: { w: 110, h: 110 },
  oval: { w: 170, h: 110 },
  diamond: { w: 150, h: 110 },
  text: { w: 160, h: 52 },
  sticky: { w: 150, h: 150 },
};

// Curated DNKRM fill palette the generator may assign as a node's card colour.
// Deliberately a warm, mid/light subset of the full palette — every value keeps
// the node's dark text (#2A2823) readable, so the AI can never produce an
// unreadable card. "cream" is the neutral default.
export const GEN_FILL_COLORS = [
  "#FCFBF8", // cream — neutral default
  "#D8C9A8", // sand — grouping / area / phase
  "#EAD884", // yellow — note / highlight / watch
  "#D4A04A", // ochre — caution / important detail
  "#C56B47", // terracotta — key node / decision / primary path
  "#B0795E", // clay — secondary accent
  "#7C7A4E", // olive — success / positive end state / "done"
] as const;

// Font sizes the generator may assign, smallest set that still reads as a clear
// hierarchy. 13 is the default body size (matches manually-created nodes).
export const GEN_FONT_SIZES = [20, 16, 13, 11] as const;

// Bounds for the AI-assigned node size (importance, not text volume). Single
// source of truth shared by the JSON schema and the sanitizer's clamp.
export const GEN_W_RANGE = { min: 120, max: 360 } as const;
export const GEN_H_RANGE = { min: 56, max: 200 } as const;

export type GenNode = {
  id: string;
  type: GenNodeType;
  title: string;
  body: string;
  color: string;
  fontSize: number;
  width: number;
  height: number;
};
export type GenConn = { from: string; to: string };
export type GeneratedGraph = { nodes: GenNode[]; connections: GenConn[] };

export type GenResult =
  | { ok: true; graph: GeneratedGraph }
  | { ok: false; message: string };

const MAX_NODES = 40;

const NODE_TYPE_GUIDE = `Node types you may use — pick the most fitting for each node:
- "block": a standard rectangular card. The sensible default for most ideas, steps, or items.
- "rounded": a rounded rectangle, good for a grouping, area, or phase.
- "circle": a small circle, good for a single focal point or a start/end marker.
- "oval": an ellipse, good for start and end states.
- "diamond": a decision or branch point.
- "text": a bare text label with no card — use sparingly, for a heading or a loose note.
- "sticky": a square sticky note, good for an aside, reminder, or annotation.`;

const COLOR_GUIDE = `Colors — give each node a "color" (its card fill) from this warm DNKRM palette so the graph reads at a glance. Use color with restraint: most nodes stay cream, and color carries meaning.
- "#FCFBF8" cream — neutral default (use for the majority of nodes)
- "#D8C9A8" sand — a grouping, area, or phase
- "#EAD884" yellow — a note, highlight, or thing to watch
- "#D4A04A" ochre — caution or an important detail
- "#C56B47" terracotta — a key node, decision, or the primary path
- "#B0795E" clay — a secondary accent
- "#7C7A4E" olive — a positive end state, success, or "done"
Share a color across related nodes to group them, and reserve terracotta for the few most important nodes. (Text is always dark; every color above keeps it readable.)`;

const TYPOGRAPHY_GUIDE = `Typography — give each node a "fontSize" to build a clear hierarchy:
- 20 — the root or single central topic (use once, or not at all)
- 16 — major headings or section anchors
- 13 — the default for ordinary nodes (use this for most)
- 11 — small leaf details or asides
Make a few anchor nodes larger; keep the rest at 13 so the structure stays calm.`;

const SIZE_GUIDE = `Size — give each node a "width" and "height" that reflect how CENTRAL and IMPORTANT it is, NOT how much text it holds. Size is your strongest signal of hierarchy:
- Root / central node: large, about 240×100 (go wider for a single dominant hub).
- Key supporting nodes: medium, about 180×80.
- Detail / peripheral / leaf nodes: small, about 140×60.
Pick sizes from a continuum (width ${GEN_W_RANGE.min}–${GEN_W_RANGE.max}, height ${GEN_H_RANGE.min}–${GEN_H_RANGE.max}); a node with little text can still be large if it is central, and a node with lots of text stays small if it is peripheral. Circles and sticky notes are kept square automatically, so their size still reads as importance.`;

const SYSTEM_PROMPT = `You generate a node graph for DNKRM, a visual canvas / mind-mapping tool. Given the user's request, return a graph of nodes and the directed connections between them.

${NODE_TYPE_GUIDE}

${COLOR_GUIDE}

${TYPOGRAPHY_GUIDE}

${SIZE_GUIDE}

Each node has:
- "id": a short unique string within this response (e.g. "n1"), referenced by connections.
- "type": exactly one of the types above.
- "title": a short label, a few words.
- "body": an optional one-sentence detail, or "" if none.
- "color": exactly one of the palette hex values above.
- "fontSize": exactly one of the allowed sizes above.
- "width" and "height": numbers reflecting the node's importance (see the size guide).

"connections" are directed edges { "from": <id>, "to": <id> } that reference node ids, showing flow or relationship.

Guidance:
- Produce a focused graph of roughly 5–15 nodes unless the user asks for more or fewer.
- Keep titles concise. Use diamonds for decisions and connect each branch.
- Use color and size to express structure (group with color, anchor the central nodes with size), not decoration.
- Do not include positions or coordinates — the app lays the graph out.
Return only JSON matching the provided schema.`;

const EXPAND_SYSTEM_PROMPT = `You expand one node in DNKRM, a visual canvas / mind-mapping tool, into a few child nodes that branch out from it.

Given a parent node (its type, title, and detail) and what it is already connected to, generate 3–7 NEW child nodes that deepen or branch the idea. Do not restate the parent, and do not duplicate anything it is already connected to.

${NODE_TYPE_GUIDE}

${COLOR_GUIDE}

${TYPOGRAPHY_GUIDE}

${SIZE_GUIDE}

Each node has:
- "id": a short unique string within this response (e.g. "c1").
- "type": exactly one of the types above.
- "title": a short label, a few words.
- "body": an optional one-sentence detail, or "" if none.
- "color": exactly one of the palette hex values above.
- "fontSize": exactly one of the allowed sizes above.
- "width" and "height": numbers reflecting the node's importance (see the size guide).

"connections" are directed edges { "from": <id>, "to": <id> } BETWEEN the child nodes only (for sub-branches) — do NOT reference the parent; the app links the children to it automatically.

Color the children to fit the branch's meaning (often a shared color reads as one cluster), and keep most at fontSize 13 — these are a sub-branch, so rarely use 20. These are peripheral nodes, so size them mostly medium (~180×80) to small (~140×60); reserve the largest sizes for a child that clearly anchors a sub-branch. Return only JSON matching the provided schema, with 3 to 7 nodes.`;

const GRAPH_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...GEN_NODE_TYPES] },
          title: { type: "string" },
          body: { type: "string" },
          color: { type: "string", enum: [...GEN_FILL_COLORS] },
          fontSize: { type: "number", enum: [...GEN_FONT_SIZES] },
          // Anthropic structured outputs do NOT support numeric constraints
          // (minimum/maximum/multipleOf) — including them 400s the whole schema.
          // The allowed range is conveyed in the prompt and enforced by
          // sanitizeGraph()'s clampSize() instead.
          width: { type: "number" },
          height: { type: "number" },
        },
        required: [
          "id",
          "type",
          "title",
          "body",
          "color",
          "fontSize",
          "width",
          "height",
        ],
        additionalProperties: false,
      },
    },
    connections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes", "connections"],
  additionalProperties: false,
};

type TextResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

// Shared core for every AI request: load the SDK (module-cached after the first
// call), call Haiku, map errors, and return the response text. `maxTokens` and
// the optional structured-output schema vary by caller (graph requests pass the
// graph schema; prose requests pass none).
async function callModel(
  system: string,
  user: string,
  apiKey: string,
  maxTokens: number,
  schema?: Record<string, unknown>,
): Promise<TextResult> {
  if (!apiKey) return { ok: false, message: "No API key set." };

  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    return {
      ok: false,
      message: "Couldn’t load the AI client — check your connection.",
    };
  }

  const request = {
    model: "claude-haiku-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user" as const, content: user }],
    ...(schema && {
      output_config: { format: { type: "json_schema" as const, schema } },
    }),
  };

  let response: Awaited<
    ReturnType<InstanceType<typeof Anthropic>["messages"]["create"]>
  >;
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    response = await client.messages.create(request);
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      return { ok: false, message: "Invalid API key." };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, message: "Network error — check your connection." };
    }
    if (err instanceof Anthropic.APIError) {
      // Log the exact request payload + full API error so schema/parameter
      // rejections (e.g. a 400 from an unsupported JSON-schema keyword) are
      // diagnosable instead of hiding behind a generic status message.
      console.error("[ai-generate] Anthropic API error", {
        status: err.status,
        type: (err as { error?: { error?: { type?: string } } }).error?.error
          ?.type,
        message: err.message,
        request,
      });
      return { ok: false, message: `AI request failed (status ${err.status}).` };
    }
    console.error("[ai-generate] Unexpected error contacting the AI", err);
    return { ok: false, message: "Something went wrong contacting the AI." };
  }

  if ("stop_reason" in response && response.stop_reason === "refusal") {
    return { ok: false, message: "The model declined this request." };
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || !("text" in textBlock)) {
    return { ok: false, message: "The AI returned an empty response." };
  }
  if (response.stop_reason === "max_tokens") {
    return {
      ok: false,
      message: "The response was cut off — try a simpler prompt.",
    };
  }
  return { ok: true, text: textBlock.text };
}

// Graph requests: structured JSON → parse → sanitize.
async function runGraphRequest(
  system: string,
  user: string,
  apiKey: string,
): Promise<GenResult> {
  const r = await callModel(system, user, apiKey, 4096, GRAPH_SCHEMA);
  if (!r.ok) return r;
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    return {
      ok: false,
      message: "Couldn’t read the AI response (invalid JSON).",
    };
  }
  return sanitizeGraph(parsed);
}

export async function generateGraph(
  prompt: string,
  apiKey: string,
): Promise<GenResult> {
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, message: "Enter a prompt." };
  return runGraphRequest(SYSTEM_PROMPT, trimmed, apiKey);
}

// Context describing the node being expanded — passed to the model so the
// children deepen the idea without repeating existing connections.
export type ExpandContext = {
  type: string;
  title: string;
  body: string;
  neighbors: string[];
};

// Expand one node into 3–7 child nodes. The returned graph's nodes are the
// children and its connections are child→child only; the caller links them to
// the parent.
export async function expandNode(
  ctx: ExpandContext,
  apiKey: string,
): Promise<GenResult> {
  const user =
    `Parent node (type: ${ctx.type}):\n` +
    `Title: ${ctx.title.trim() || "(untitled)"}\n` +
    (ctx.body.trim() ? `Detail: ${ctx.body.trim()}\n` : "") +
    `Already connected to: ${
      ctx.neighbors.length > 0 ? ctx.neighbors.join(", ") : "(nothing yet)"
    }\n\n` +
    `Generate 3–7 child nodes that branch or deepen this idea, avoiding anything already connected.`;
  return runGraphRequest(EXPAND_SYSTEM_PROMPT, user, apiKey);
}

// Coerce a model-supplied dimension into the allowed range, rounding to a whole
// pixel; fall back to the type's default when it's not a finite number.
function clampSize(
  v: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.round(Math.max(range.min, Math.min(range.max, v)));
}

// Validate + coerce the model's JSON into a safe graph: known ids only, types
// clamped to the allowed set, connections referencing real nodes, deduped.
function sanitizeGraph(parsed: unknown): GenResult {
  const allowed = GEN_NODE_TYPES as readonly string[];
  const obj = (parsed ?? {}) as { nodes?: unknown; connections?: unknown };
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];

  const nodes: GenNode[] = [];
  const ids = new Set<string>();
  for (const raw of rawNodes.slice(0, MAX_NODES)) {
    if (!raw || typeof raw !== "object") continue;
    const n = raw as Record<string, unknown>;
    if (typeof n.id !== "string" || n.id === "" || ids.has(n.id)) continue;
    const type = (
      typeof n.type === "string" && allowed.includes(n.type) ? n.type : "block"
    ) as GenNodeType;
    // Clamp colour + size to the allowed sets so a stray value can never produce
    // an off-palette fill or an unreadable card; default to cream / body size.
    const color =
      typeof n.color === "string" &&
      (GEN_FILL_COLORS as readonly string[]).includes(n.color)
        ? n.color
        : "#FCFBF8";
    const fontSize =
      typeof n.fontSize === "number" &&
      (GEN_FONT_SIZES as readonly number[]).includes(n.fontSize)
        ? n.fontSize
        : 13;
    // Size encodes importance. Clamp to the allowed range, falling back to the
    // type's default when missing/garbled. Circles and sticky notes are kept
    // square so an importance size can't distort their shape.
    const def = GEN_SIZE[type];
    let width = clampSize(n.width, GEN_W_RANGE, def.w);
    let height = clampSize(n.height, GEN_H_RANGE, def.h);
    if (type === "circle" || type === "sticky") {
      const side = Math.round((width + height) / 2);
      width = side;
      height = side;
    }
    ids.add(n.id);
    nodes.push({
      id: n.id,
      type,
      title: typeof n.title === "string" ? n.title : "",
      body: typeof n.body === "string" ? n.body : "",
      color,
      fontSize,
      width,
      height,
    });
  }

  if (nodes.length === 0) {
    return { ok: false, message: "The AI returned no nodes — try rephrasing." };
  }

  const rawConns = Array.isArray(obj.connections) ? obj.connections : [];
  const connections: GenConn[] = [];
  const seen = new Set<string>();
  for (const raw of rawConns) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.from !== "string" || typeof c.to !== "string") continue;
    if (c.from === c.to || !ids.has(c.from) || !ids.has(c.to)) continue;
    const key = `${c.from}→${c.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    connections.push({ from: c.from, to: c.to });
  }

  return { ok: true, graph: { nodes, connections } };
}

// Layered left-to-right layout in local coordinates (cluster's top-left ≈ 0,0).
// Column = longest-path depth from the roots (bounded so cycles can't loop);
// rows stack within a column and each column is vertically centered.
export function layoutGraph(
  nodes: GenNode[],
  connections: GenConn[],
): Map<string, { x: number; y: number }> {
  const H_GAP = 80;
  const V_GAP = 36;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const depth = new Map<string, number>();
  for (const n of nodes) depth.set(n.id, 0);
  // Relax edges up to N times — converges for DAGs, caps depth on cycles.
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const c of connections) {
      if (!byId.has(c.from) || !byId.has(c.to)) continue;
      const nd = depth.get(c.from)! + 1;
      if (nd > depth.get(c.to)!) {
        depth.set(c.to, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const cols = new Map<number, GenNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    const col = cols.get(d);
    if (col) col.push(n);
    else cols.set(d, [n]);
  }
  const depths = [...cols.keys()].sort((a, b) => a - b);

  // Spacing follows each node's own (importance-driven) size, not the type
  // default, so larger nodes get the room they need and never overlap.
  const colHeight = (col: GenNode[]) =>
    col.reduce((s, n) => s + n.height, 0) +
    V_GAP * Math.max(0, col.length - 1);
  const maxH = Math.max(...depths.map((d) => colHeight(cols.get(d)!)));

  const result = new Map<string, { x: number; y: number }>();
  let colX = 0;
  for (const d of depths) {
    const col = cols.get(d)!;
    const colW = Math.max(...col.map((n) => n.width));
    let y = (maxH - colHeight(col)) / 2;
    for (const n of col) {
      result.set(n.id, { x: colX, y });
      y += n.height + V_GAP;
    }
    colX += colW + H_GAP;
  }
  return result;
}

// Narrowing helper so callers can treat a GenNodeType as the broader NodeType.
export function asNodeType(t: GenNodeType): NodeType {
  return t;
}

// ── Summarize: board → one prose paragraph ─────────────────────────────────────

export type SummaryItem = { title: string; body: string };

export type SummaryResult =
  | { ok: true; summary: string }
  | { ok: false; message: string };

const SUMMARY_SYSTEM_PROMPT = `You summarize a DNKRM board (a visual canvas of nodes) for the user. You'll receive the nodes' titles and content in order.

Return a single flowing prose summary, 3–5 sentences. Do not use bullet points, headers, or lists. Capture the main ideas and how they relate, in plain text with no markdown and no preamble (do not start with "This board" or "Summary:").`;

// Summarize the board into one prose paragraph (plain text, no schema).
export async function summarizeBoard(
  items: SummaryItem[],
  apiKey: string,
): Promise<SummaryResult> {
  if (items.length === 0) return { ok: false, message: "Nothing to summarize." };

  const user =
    `Board nodes (in order):\n` +
    items
      .map(
        (it, i) =>
          `${i + 1}. ${it.title || "(untitled)"}${
            it.body ? ` — ${it.body}` : ""
          }`,
      )
      .join("\n") +
    `\n\nWrite a single flowing prose summary of this board (3–5 sentences).`;

  const r = await callModel(SUMMARY_SYSTEM_PROMPT, user, apiKey, 1024);
  if (!r.ok) return r;
  const summary = r.text.trim();
  if (!summary) return { ok: false, message: "The AI returned an empty summary." };
  return { ok: true, summary };
}

import { tokens } from "./design-tokens";

export const ACCENT = "#C56B47"; // terracotta — primary interactive accent

export type NodeType =
  | "block"
  | "text"
  | "circle"
  | "oval"
  | "diamond"
  | "rounded"
  | "triangle"
  | "star"
  | "arrow"
  | "parallelogram"
  | "sticky"
  | "checklist"
  | "link"
  | "image"
  | "textfile";

// One row of a checklist node. `id` is unique within its node only.
export type ChecklistItem = { id: number; text: string; checked: boolean };

// Inline rich text: a field is a list of lines, each line a list of styled
// runs. Marks are additive overrides on top of the node's base style
// (n.bold / n.italic / n.underline / n.fontSize). Plain-string mirrors in
// `title` / `body` are kept in sync at every commit so search, sidebar
// labels, and older .dnkrm readers keep working on plain text.
export type TextRun = {
  t: string;
  b?: true;
  i?: true;
  u?: true;
  fs?: number; // CSS px, overrides the node's base fontSize for this run
  c?: string; // text color, #rrggbb
  bg?: string; // highlight color, #rrggbb
  // Inline image (data URL). Image runs carry no text and always occupy a
  // line of their own — insertion and parsing both enforce this.
  img?: string;
};
// A line is either a bare run array (the original, still-valid shape used by
// plain/inline-only content — no migration needed) or a metadata object that
// additionally carries block-level formatting: text alignment and list type.
// Lists group consecutive lines sharing the same `list` value.
export type RichLineMeta = {
  runs: TextRun[];
  align?: "center" | "right"; // omitted = left (default)
  list?: "bullet" | "number"; // omitted = not a list item
};
export type RichLine = TextRun[] | RichLineMeta;
export type RichText = RichLine[];

export type CanvasNode = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
  type: NodeType;
  color: string;
  fontSize?: number;
  imageUrl?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  textFileContent?: string;
  textFileName?: string;
  label?: string;
  // Rows for "checklist" nodes — toggled on-canvas, edited in edit mode.
  checklistItems?: ChecklistItem[];
  // "link" nodes: the target URL and its cached favicon URL. The fetched page
  // title is stored in `title` (so search/exports pick it up for free).
  linkUrl?: string;
  linkFavicon?: string;
  excludeFromPresentation?: boolean;
  // Nodes sharing a presentationGroupId form one presentation step (the camera
  // zooms to fit all of them at once). Members are kept contiguous in
  // presentationOrder; see lib/presentation.ts.
  presentationGroupId?: string;
  // Present only when the field carries inline formatting; `title` / `body`
  // always hold the derived plain text.
  titleRich?: RichText;
  bodyRich?: RichText;
  // Document content for "textfile" nodes authored in the editor panel.
  // Present only when the content carries inline formatting;
  // `textFileContent` always holds the derived plain text. Both are stripped
  // from localStorage and persisted via the IndexedDB asset store.
  docRich?: RichText;
};

export type Connection = { from: number; to: number };

// Active drag-to-connect state (canvas coordinates)
export type ConnectDrag = { fromId: number } | null;

export type ContextMenu =
  | { kind: "canvas"; x: number; y: number; cx: number; cy: number }
  | { kind: "node"; x: number; y: number; id: number }
  | null;

export type ColorPicker = {
  nodeId: number;
  x: number;
  y: number;
  color: string;
} | null;

export type AssetRecord = {
  textFileContent?: string;
  imageUrl?: string;
  docRich?: RichText;
};

export const PRESET_COLORS = [
  "#2A2823",
  "#5A5346",
  "#8A7E6A",
  "#C56B47",
  "#B0795E",
  "#D4A04A",
  "#7C7A4E",
  "#A8553A",
  "#D8C9A8",
  "#EBE8E1",
  "#FCFBF8",
  "#9C8F75",
];

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3;

export type PanelSection =
  | "board"
  | "nodes"
  | "presentation"
  | "saveload"
  | "shortcuts"
  | "ai"
  | "settings";

export const LS_NODES = "denkraum_nodes";
export const LS_CONNECTIONS = "denkraum_connections";
export const LS_BOARD_NAME = "denkraum_board_name";
export const LS_PRESENTATION_ORDER = "denkraum_presentation_order";
export const LS_CAMERA = "denkraum_camera";
// AI workspace marker — a world coordinate where AI output is placed. Kept
// separate from board state and never written to .dnkrm exports.
export const LS_AI_WORKSPACE = "denkraum_ai_workspace";

export const DEFAULT_NODES: CanvasNode[] = [
  {
    id: 0,
    x: 200,
    y: 180,
    w: 200,
    h: 90,
    title: "Project Idea",
    body: "Capture your thoughts here",
    type: "block",
    color: tokens.color.surface,
    fontSize: 13,
  },
  {
    id: 1,
    x: 500,
    y: 150,
    w: 200,
    h: 90,
    title: "Concept",
    body: "Connect your ideas",
    type: "block",
    color: tokens.color.surface,
    fontSize: 13,
  },
  {
    id: 2,
    x: 420,
    y: 320,
    w: 200,
    h: 70,
    title: "Next Steps",
    body: "",
    type: "block",
    color: tokens.color.surface,
    fontSize: 13,
  },
];

export const DEFAULT_CONNECTIONS: Connection[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
];

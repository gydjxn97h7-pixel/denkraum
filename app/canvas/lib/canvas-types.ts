export const ACCENT = "#F1B24A";

export type NodeType =
  | "block"
  | "text"
  | "circle"
  | "oval"
  | "diamond"
  | "rounded"
  | "image"
  | "textfile";

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
  excludeFromPresentation?: boolean;
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

export type AssetRecord = { textFileContent?: string; imageUrl?: string };

export const PRESET_COLORS = [
  "#0C2018",
  "#1D5C50",
  "#4D774E",
  "#9DC88D",
  "#F1B24A",
  "#FFFFFF",
  "#f5f4f0",
  "#F0EDE8",
  "#FFF3CD",
  "#D4EDDA",
  "#D1ECF1",
  "#F8D7DA",
  "#E2D9F3",
  "#FCE4D6",
  "#C8A847",
  "#6c757d",
  "#343a40",
  "#2C3E50",
  "#1A1A2E",
  "#0a0a0a",
];

export const SIDEBAR_W = 220;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3;

export type PanelSection =
  | "board"
  | "nodes"
  | "presentation"
  | "saveload"
  | "shortcuts";

export const LS_NODES = "denkraum_nodes";
export const LS_CONNECTIONS = "denkraum_connections";
export const LS_BOARD_NAME = "denkraum_board_name";
export const LS_PRESENTATION_ORDER = "denkraum_presentation_order";
export const LS_CAMERA = "denkraum_camera";

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
    color: "#1D5C50",
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
    color: "#1D5C50",
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
    color: "#1D5C50",
    fontSize: 13,
  },
];

export const DEFAULT_CONNECTIONS: Connection[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
];

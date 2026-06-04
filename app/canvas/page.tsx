"use client";
import { useRef, useState, useCallback, useEffect, useMemo, memo } from "react";
import "./canvas.css";
import {
  ACCENT,
  LS_NODES,
  LS_CONNECTIONS,
  LS_BOARD_NAME,
  LS_PRESENTATION_ORDER,
  DEFAULT_NODES,
  DEFAULT_CONNECTIONS,
} from "./lib/canvas-types";
import type {
  NodeType,
  CanvasNode,
  Connection,
  ConnectDrag,
  ContextMenu,
  ColorPicker,
  AssetRecord,
} from "./lib/canvas-types";
import { stripHtml } from "./lib/color-helpers";
import {
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
  getMaxNodeId,
} from "./lib/canvas-helpers";
import { setAsset, deleteAsset, getAllAssets } from "./lib/idb";
import { ColorPickerWindow } from "./components/ColorPickerWindow";
import { TextFileViewerWindow } from "./components/TextFileViewerWindow";
import { NodeView } from "./components/NodeView";
import { SidebarNodeItem } from "./components/SidebarNodeItem";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function renderShapeIcon(
  type: string,
  stroke: string,
  active: boolean,
): React.ReactNode {
  const fid = active ? "gShapeA" : "gShapeN";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      {type === "block" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="2"
            y="2"
            width="16"
            height="4"
            rx="1"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "rounded" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="6"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="2"
            y="2"
            width="16"
            height="4"
            rx="2"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "circle" && (
        <>
          <circle
            cx="10"
            cy="10"
            r="9"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <ellipse
            cx="7"
            cy="6"
            rx="4"
            ry="2.5"
            fill="rgba(255,255,255,0.07)"
          />
        </>
      )}
      {type === "oval" && (
        <>
          <ellipse
            cx="10"
            cy="10"
            rx="9"
            ry="6"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <ellipse cx="7" cy="7" rx="4" ry="2" fill="rgba(255,255,255,0.07)" />
        </>
      )}
      {type === "diamond" && (
        <>
          <polygon
            points="10,1 19,10 10,19 1,10"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          <polygon
            points="10,1 19,10 10,10 1,10"
            fill="rgba(255,255,255,0.05)"
            stroke="none"
          />
          <line
            x1="10"
            y1="1"
            x2="10"
            y2="19"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.8"
          />
        </>
      )}
      {type === "text" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <rect
            x="3"
            y="5"
            width="14"
            height="3.5"
            rx="0.5"
            fill="rgba(255,255,255,0.82)"
          />
          <rect
            x="8.5"
            y="5"
            width="3"
            height="11"
            rx="0.5"
            fill="rgba(255,255,255,0.82)"
          />
        </>
      )}
      {type === "image" && (
        <>
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="1.5"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
          />
          <circle cx="5.5" cy="5.5" r="2.5" fill="rgba(255,255,255,0.55)" />
          <polyline
            points="1,14 6,9 10,13 14,8 19,14"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {type === "textfile" && (
        <>
          <path
            d="M3 1 L13 1 L19 7 L19 19 L3 19 Z"
            fill={`url(#${fid})`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M13 1 L13 7 L19 7"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="6"
            y="10"
            width="9"
            height="2"
            rx="1"
            fill="rgba(255,255,255,0.55)"
          />
          <rect
            x="6"
            y="14"
            width="7"
            height="2"
            rx="1"
            fill="rgba(255,255,255,0.35)"
          />
        </>
      )}
    </svg>
  );
}

function ShapeButton({
  label,
  isActive,
  onClick,
  children,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: (stroke: string, isActive: boolean) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const stroke = isActive
    ? "#A07030"
    : hovered
      ? "rgba(255,255,255,1)"
      : "rgba(255,255,255,0.8)";
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36,
        height: 36,
        border: "none",
        background: isActive ? "rgba(241,178,74,0.06)" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        padding: 0,
        transition: "background 0.12s",
      }}
    >
      {children(stroke, isActive)}
    </button>
  );
}

// ── Connection line ───────────────────────────────────────────────────────────
const ConnectionLine = memo(function ConnectionLine({
  connKey,
  fromNode,
  toNode,
  isHovered,
  zoom,
  connDimmed,
  onHoverEnter,
  onHoverLeave,
  onDelete,
}: {
  connKey: string;
  fromNode: CanvasNode;
  toNode: CanvasNode;
  isHovered: boolean;
  zoom: number;
  connDimmed: boolean;
  onHoverEnter: (key: string) => void;
  onHoverLeave: (key: string) => void;
  onDelete: (from: number, to: number) => void;
}) {
  const x1 = fromNode.x + fromNode.w;
  const y1 = fromNode.y + fromNode.h / 2;
  const x2 = toNode.x;
  const y2 = toNode.y + toNode.h / 2;
  const cxm = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${cxm} ${y1}, ${cxm} ${y2}, ${x2} ${y2}`;
  return (
    <g
      style={{
        opacity: connDimmed ? 0.15 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <path
        d={d}
        stroke={isHovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.7)"}
        strokeWidth={isHovered ? 2.5 / zoom : 1.5 / zoom}
        fill="none"
        strokeLinecap="round"
        style={{
          pointerEvents: "none",
          transition: "stroke 0.12s, stroke-width 0.12s",
        }}
      />
      <path
        d={d}
        stroke="transparent"
        strokeWidth={12 / zoom}
        fill="none"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHoverEnter(connKey)}
        onMouseLeave={() => onHoverLeave(connKey)}
        onDoubleClick={() => onDelete(fromNode.id, toNode.id)}
      />
    </g>
  );
});

// ── Main Canvas ───────────────────────────────────────────────────────────────
export default function Canvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>(DEFAULT_NODES);
  const [connections, setConnections] =
    useState<Connection[]>(DEFAULT_CONNECTIONS);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [connectDrag, setConnectDrag] = useState<ConnectDrag>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [colorPicker, setColorPicker] = useState<ColorPicker>(null);
  const [textColorPicker, setTextColorPicker] = useState<ColorPicker>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [hoveredConnKey, setHoveredConnKey] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [activePanel, setActivePanel] = useState<"board" | "nodes" | "presentation" | "saveload" | "shortcuts" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [textFileViewer, setTextFileViewer] = useState<{
    nodeId: number;
    fileName: string;
    content: string;
  } | null>(null);
  const [copiedNode, setCopiedNode] = useState<CanvasNode | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});
  const [editingSidebarNodeId, setEditingSidebarNodeId] = useState<
    number | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterType, setFilterType] = useState<NodeType | "all">("all");
  const [filterJumpIndex, setFilterJumpIndex] = useState(0);
  const [activeShapeType, setActiveShapeType] = useState<NodeType | null>(null);
  const [boardName, setBoardName] = useState("Untitled Board");
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [presentationOrder, setPresentationOrder] = useState<number[]>(
    () => DEFAULT_NODES.map((n) => n.id),
  );
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [showPresentOverlay, setShowPresentOverlay] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    variant: "success" | "error";
  } | null>(null);

  const dragging = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const resizing = useRef<{
    id: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    constrain: boolean; // keep w === h (circle)
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const denkraumFileInputRef = useRef<HTMLInputElement>(null);
  const saveBoardRef = useRef<() => void>(() => {});
  const filterInputRef = useRef<HTMLInputElement>(null);
  const filterOpenRef = useRef(false);
  const filterActiveRef = useRef(false);
  const filterJumpIndexRef = useRef(0);
  const matchedNodesSortedRef = useRef<CanvasNode[]>([]);
  const selectedIdsRef = useRef<Set<number>>(new Set());
  const marquee = useRef<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const multiDragging = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPositions: Map<number, { x: number; y: number }>;
  } | null>(null);
  const pendingMultiDragDelta = useRef<{ dx: number; dy: number } | null>(null);
  const pendingImagePos = useRef<{ cx: number; cy: number } | null>(null);
  const pendingTextFilePos = useRef<{ cx: number; cy: number } | null>(null);
  // Tracks which node is actively being edited so ref callbacks never clobber
  // in-progress input (more reliable than document.activeElement checks).
  const editingNodeIdRef = useRef<number | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const idCounterRef = useRef(3);
  const copiedNodeRef = useRef<CanvasNode | null>(null);

  // ── rAF-based interaction refs ────────────────────────────────────────────────
  // Mirror latest state into refs so mouse handlers never capture stale closures
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const connectDragRef = useRef(connectDrag);
  const selectedRef = useRef(selected);
  const presentationOrderRef = useRef(presentationOrder);
  const presentationIndexRef = useRef(presentationIndex);
  const isPresentingRef = useRef(isPresenting);
  const prePresentState = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);
  panRef.current = pan;
  zoomRef.current = zoom;
  connectDragRef.current = connectDrag;
  selectedIdsRef.current = selectedIds;
  copiedNodeRef.current = copiedNode;
  presentationOrderRef.current = presentationOrder;
  presentationIndexRef.current = presentationIndex;
  isPresentingRef.current = isPresenting;
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Presentation camera animation
  const animRafRef = useRef<number | null>(null);
  const animCurrentRef = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);

  // Pending values accumulated during a mousemove burst; applied once per frame
  const rafRef = useRef<number | null>(null);
  const pendingPanDelta = useRef({ x: 0, y: 0 });
  const pendingDragPos = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  const pendingResizeSize = useRef<{ id: number; w: number; h: number } | null>(
    null,
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which node IDs currently have an entry in IndexedDB so we can
  // delete stale records when a node is removed or loses its asset fields.
  const prevAssetNodeIdsRef = useRef(new Set<number>());

  const saveBoard = useCallback(() => {
    try {
      const slug =
        boardName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 40) || "untitled-board";
      const date = new Date().toISOString().slice(0, 10);
      const payload = JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          boardName,
          nodes,
          connections,
          presentationOrder,
        },
        null,
        2,
      );
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${date}.dnkrm`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: "Board saved", variant: "success" });
    } catch {
      setToast({ msg: "Save failed", variant: "error" });
    }
  }, [nodes, connections, boardName, presentationOrder]);

  saveBoardRef.current = saveBoard;

  const onDenkraumFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(data.nodes) || !Array.isArray(data.connections))
            throw new Error("bad format");
          setNodes(data.nodes);
          setConnections(data.connections);
          setSelected(null);
          setSelectedIds(new Set());
          setColorPicker(null);
          setTextColorPicker(null);
          setHoveredId(null);
          setConnectDrag(null);
          setContextMenu(null);
          setSnapGuides({});
          const maxId = (data.nodes as CanvasNode[]).reduce(
            (m: number, n: CanvasNode) => Math.max(m, n.id),
            -1,
          );
          if (maxId >= idCounterRef.current) idCounterRef.current = maxId + 1;
          if (typeof data.boardName === "string" && data.boardName.trim()) {
            const name = data.boardName.trim();
            setBoardName(name);
            localStorage.setItem(LS_BOARD_NAME, name);
          }
          const fileNodeIds = new Set<number>(
            (data.nodes as CanvasNode[]).map((n: CanvasNode) => n.id),
          );
          if (Array.isArray(data.presentationOrder)) {
            const parsedSet = new Set<number>(data.presentationOrder as number[]);
            const missing = (data.nodes as CanvasNode[])
              .filter((n: CanvasNode) => !parsedSet.has(n.id))
              .sort((a: CanvasNode, b: CanvasNode) => a.id - b.id)
              .map((n: CanvasNode) => n.id);
            setPresentationOrder([
              ...(data.presentationOrder as number[]).filter((id: number) =>
                fileNodeIds.has(id),
              ),
              ...missing,
            ]);
          } else {
            setPresentationOrder(
              [...(data.nodes as CanvasNode[])]
                .sort((a: CanvasNode, b: CanvasNode) => a.id - b.id)
                .map((n: CanvasNode) => n.id),
            );
          }
          setToast({ msg: "Board loaded", variant: "success" });
        } catch {
          setToast({ msg: "Invalid .dnkrm file", variant: "error" });
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const addNode = useCallback((cx: number, cy: number, type: NodeType) => {
    const isText = type === "text";
    const isCircle = type === "circle";
    const isOval = type === "oval";
    const isDiamond = type === "diamond";
    const w = isText
      ? 160
      : isCircle
        ? 100
        : isOval
          ? 160
          : isDiamond
            ? 130
            : 200;
    const h = isText
      ? 40
      : isCircle
        ? 100
        : isOval
          ? 100
          : isDiamond
            ? 100
            : 80;
    const maxExistingId = getMaxNodeId(nodeMapRef.current);
    if (idCounterRef.current <= maxExistingId)
      idCounterRef.current = maxExistingId + 1;
    const newId = idCounterRef.current;
    idCounterRef.current += 1;

    const TYPE_LABEL: Partial<Record<NodeType, string>> = {
      block: "Block",
      rounded: "Area",
      circle: "Circle",
      oval: "Oval",
      diamond: "Diamond",
      text: "Text",
      image: "Image",
    };
    const baseLabel = TYPE_LABEL[type];
    let autoLabel = "";
    if (baseLabel) {
      const re = new RegExp(`^${baseLabel}\\s+(\\d+)$`);
      let maxIdx = 0;
      for (const node of nodeMapRef.current.values()) {
        if (node.type === type) {
          const m = (node.label ?? "").match(re);
          if (m) maxIdx = Math.max(maxIdx, parseInt(m[1], 10));
        }
      }
      autoLabel = `${baseLabel} ${maxIdx + 1}`;
    }

    setNodes((prev) => [
      ...prev,
      {
        id: newId,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        title: "",
        label: autoLabel,
        body: "",
        type,
        color: isText ? "transparent" : "#1D5C50",
        fontSize: isText ? 15 : 13,
      },
    ]);
    setPresentationOrder((prev) => [...prev, newId]);
    setSelected(newId);
    setContextMenu(null);
    setTimeout(() => setActiveShapeType(null), 600);
    if (isText) {
      editingNodeIdRef.current = newId;
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-node-id="${newId}"] [contenteditable]`,
        );
        el?.focus();
      }, 50);
    }
  }, []);

  const handleImageInsert = useCallback((cx: number, cy: number) => {
    pendingImagePos.current = { cx, cy };
    setContextMenu(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  const onImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const pos = pendingImagePos.current;
      if (!file || !pos) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imageUrl = ev.target?.result as string;
        if (!imageUrl) return;
        const img = new window.Image();
        img.onload = () => {
          const aspect = img.naturalWidth / img.naturalHeight;
          const w = 300;
          const h = Math.round(w / aspect);
          const maxExistingId = getMaxNodeId(nodeMapRef.current);
          if (idCounterRef.current <= maxExistingId)
            idCounterRef.current = maxExistingId + 1;
          const newId = idCounterRef.current;
          idCounterRef.current += 1;
          setNodes((prev) => [
            ...prev,
            {
              id: newId,
              x: pos.cx - w / 2,
              y: pos.cy - h / 2,
              w,
              h,
              title: "",
              label: (() => {
                const re = /^Image\s+(\d+)$/;
                let maxIdx = 0;
                for (const node of nodeMapRef.current.values()) {
                  if (node.type === "image") {
                    const m = (node.label ?? "").match(re);
                    if (m) maxIdx = Math.max(maxIdx, parseInt(m[1], 10));
                  }
                }
                return `Image ${maxIdx + 1}`;
              })(),
              body: "",
              type: "image",
              color: "#1D5C50",
              imageUrl,
            },
          ]);
          setPresentationOrder((prev) => [...prev, newId]);
          pendingImagePos.current = null;
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const handleTextFileInsert = useCallback((cx: number, cy: number) => {
    pendingTextFilePos.current = { cx, cy };
    setTimeout(() => textFileInputRef.current?.click(), 50);
  }, []);

  const onTextFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const pos = pendingTextFilePos.current;
      if (!file || !pos) return;
      const fileName = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const textFileContent = ev.target?.result as string;
        if (textFileContent == null) return;
        const w = 200;
        const h = 60;
        const maxExistingId = getMaxNodeId(nodeMapRef.current);
        if (idCounterRef.current <= maxExistingId)
          idCounterRef.current = maxExistingId + 1;
        const newId = idCounterRef.current;
        idCounterRef.current += 1;
        setNodes((prev) => [
          ...prev,
          {
            id: newId,
            x: pos.cx - w / 2,
            y: pos.cy - h / 2,
            w,
            h,
            title: "",
            label: fileName,
            body: "",
            type: "textfile",
            color: "#1D5C50",
            fontSize: 13,
            textFileContent,
            textFileName: fileName,
          },
        ]);
        setPresentationOrder((prev) => [...prev, newId]);
        pendingTextFilePos.current = null;
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  const openColorPicker = useCallback(
    (
      nodeId: number,
      currentColor: string,
      screenX: number,
      screenY: number,
    ) => {
      setColorPicker({
        nodeId,
        x: screenX - 280,
        y: screenY - 20,
        color: currentColor,
      });
      setContextMenu(null);
    },
    [],
  );

  const onPickerColorChange = useCallback((nodeId: number, color: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, color } : n)),
    );
    setColorPicker((prev) => (prev ? { ...prev, color } : null));
  }, []);

  const openTextColorPicker = useCallback(
    (
      nodeId: number,
      currentColor: string,
      screenX: number,
      screenY: number,
    ) => {
      setTextColorPicker({
        nodeId,
        x: screenX - 280,
        y: screenY - 20,
        color: currentColor,
      });
      setContextMenu(null);
    },
    [],
  );

  const onPickerTextColorChange = useCallback(
    (nodeId: number, color: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, textColor: color } : n)),
      );
      setTextColorPicker((prev) => (prev ? { ...prev, color } : null));
    },
    [],
  );

  // ── localStorage ─────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        // ① localStorage (synchronous)
        const savedBoardName = localStorage.getItem(LS_BOARD_NAME);
        if (savedBoardName) setBoardName(savedBoardName);

        const rawConns = localStorage.getItem(LS_CONNECTIONS);
        if (rawConns) {
          const seen = new Set<string>();
          const deduped = (JSON.parse(rawConns) as Connection[]).filter((c) => {
            const key = `${c.from}→${c.to}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setConnections(deduped);
        }

        const rawNodes = localStorage.getItem(LS_NODES);
        if (rawNodes) {
          let loadedNodes: CanvasNode[] = (
            JSON.parse(rawNodes) as CanvasNode[]
          ).map((n) => ({
            ...n,
            title: stripHtml(n.title),
            body: stripHtml(n.body),
            ...(n.label != null && { label: stripHtml(n.label) }),
            ...(n.textFileName != null && {
              textFileName: stripHtml(n.textFileName),
            }),
          }));
          const maxId = loadedNodes.reduce((m, n) => Math.max(m, n.id), -1);
          if (maxId >= idCounterRef.current) idCounterRef.current = maxId + 1;

          // ② IndexedDB (async) — merge textFileContent / imageUrl back in
          try {
            const allAssets = await getAllAssets();
            if (allAssets.size > 0) {
              loadedNodes = loadedNodes.map((n) => {
                const a = allAssets.get(n.id);
                return a
                  ? {
                      ...n,
                      ...(a.textFileContent != null && {
                        textFileContent: a.textFileContent,
                      }),
                      ...(a.imageUrl != null && { imageUrl: a.imageUrl }),
                    }
                  : n;
              });
              // Orphan cleanup: IDB keys with no matching node
              const nodeIdSet = new Set(loadedNodes.map((n) => n.id));
              for (const id of allAssets.keys()) {
                if (!nodeIdSet.has(id)) deleteAsset(id).catch(() => {});
              }
            }
          } catch {
            // IDB unavailable (e.g. private-browsing) — proceed without assets
          }

          // ③ Initialise prevAssetNodeIdsRef before setHydrated triggers the
          //    save effect, so the first save doesn't delete any IDB entries.
          prevAssetNodeIdsRef.current = new Set(
            loadedNodes
              .filter((n) => n.textFileContent != null || n.imageUrl != null)
              .map((n) => n.id),
          );
          setNodes(loadedNodes);

          // ④ presentationOrder — load from localStorage, migrate if needed
          const rawOrder = localStorage.getItem(LS_PRESENTATION_ORDER);
          const loadedIdSet = new Set(loadedNodes.map((n) => n.id));
          if (rawOrder) {
            try {
              const parsed: number[] = JSON.parse(rawOrder);
              const parsedSet = new Set(parsed);
              const missing = loadedNodes
                .filter((n) => !parsedSet.has(n.id))
                .sort((a, b) => a.id - b.id)
                .map((n) => n.id);
              setPresentationOrder([
                ...parsed.filter((id) => loadedIdSet.has(id)),
                ...missing,
              ]);
            } catch {
              setPresentationOrder(
                [...loadedNodes].sort((a, b) => a.id - b.id).map((n) => n.id),
              );
            }
          } else {
            setPresentationOrder(
              [...loadedNodes].sort((a, b) => a.id - b.id).map((n) => n.id),
            );
          }
        }
      } catch {
        // JSON parse error — keep DEFAULT_NODES
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // ── localStorage: strip large asset fields ──────────────────────────────
      try {
        const nodesToSave = nodes.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ textFileContent: _tc, imageUrl: _iu, ...rest }) => rest,
        );
        localStorage.setItem(LS_NODES, JSON.stringify(nodesToSave));
        localStorage.setItem(LS_CONNECTIONS, JSON.stringify(connections));
        localStorage.setItem(LS_BOARD_NAME, boardName);
        localStorage.setItem(LS_PRESENTATION_ORDER, JSON.stringify(presentationOrder));
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "QuotaExceededError" ||
            err.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ) {
          console.warn(
            "[dnkrm] localStorage quota exceeded — canvas not saved.",
          );
        }
      }

      // ── IndexedDB: write assets / delete stale entries ──────────────────────
      const currentAssetIds = new Set<number>();
      for (const n of nodes) {
        const record: AssetRecord = {};
        if (n.textFileContent != null)
          record.textFileContent = n.textFileContent;
        if (n.imageUrl != null) record.imageUrl = n.imageUrl;
        if (Object.keys(record).length > 0) {
          currentAssetIds.add(n.id);
          setAsset(n.id, record).catch(() => {});
        }
      }
      // Delete entries whose node was removed or lost all asset fields
      for (const id of prevAssetNodeIdsRef.current) {
        if (!currentAssetIds.has(id)) deleteAsset(id).catch(() => {});
      }
      prevAssetNodeIdsRef.current = currentAssetIds;
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, connections, boardName, presentationOrder, hydrated]);

  // Show entry overlay once each time presentation mode is entered
  useEffect(() => {
    if (!isPresenting) return;
    setShowPresentOverlay(true);
    const t = setTimeout(() => setShowPresentOverlay(false), 2000);
    return () => clearTimeout(t);
  }, [isPresenting]);

  // ── Wheel ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = -e.deltaY * 0.005;
        setZoom((prev) => {
          const next = Math.min(3, Math.max(0.2, prev + delta * prev));
          setPan((p) => ({
            x: mx - (mx - p.x) * (next / prev),
            y: my - (my - p.y) * (next / prev),
          }));
          return next;
        });
      } else {
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Context menus ─────────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPresentingRef.current) return;
    setSelected(id);
    setContextMenu({ kind: "node", x: e.clientX, y: e.clientY, id });
  }, []);

  const onCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t !== canvasRef.current && !t.dataset.bg) return;
      e.preventDefault();
      if (isPresentingRef.current) return;
      if (!canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
      const cy = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
      setContextMenu({ kind: "canvas", x: e.clientX, y: e.clientY, cx, cy });
    },
    [],
  );

  // ── Mouse down handlers ───────────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-node-id]")) return;
      // Cancel any in-progress connect drag
      if (connectDragRef.current) {
        setConnectDrag(null);
        return;
      }
      if (!canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
      const cy = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
      marquee.current = { startX: cx, startY: cy, x: cx, y: cy, w: 0, h: 0 };
      setSelected(null);
      setSelectedIds(new Set());
    },
    [contextMenu],
  );

  // ── Node lookup map (rebuilt only when nodes changes) ────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const nodeMapRef = useRef(nodeMap);
  nodeMapRef.current = nodeMap;

  // Nodes whose excludeFromPresentation is truthy are skipped from navigation
  const presentActiveSeq = useMemo(
    () => presentationOrder.filter((id) => !nodeMap.get(id)?.excludeFromPresentation),
    [presentationOrder, nodeMap],
  );
  const presentActiveSeqRef = useRef(presentActiveSeq);
  presentActiveSeqRef.current = presentActiveSeq;

  const filterActive = filterText !== "" || filterType !== "all";
  const matchedNodeIds = useMemo(() => {
    if (filterText === "" && filterType === "all") return new Set<number>();
    const s = new Set<number>();
    for (const n of nodes) {
      const typeOk = filterType === "all" || n.type === filterType;
      const q = filterText.toLowerCase();
      const textOk =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.label ?? "").toLowerCase().includes(q);
      if (typeOk && textOk) s.add(n.id);
    }
    return s;
  }, [nodes, filterText, filterType]);
  const matchedNodes = useMemo(
    () => nodes.filter((n) => matchedNodeIds.has(n.id)),
    [nodes, matchedNodeIds],
  );
  filterOpenRef.current = filterOpen;
  filterActiveRef.current = filterActive;
  filterJumpIndexRef.current = filterJumpIndex;
  matchedNodesSortedRef.current = matchedNodes;

  const startNodeDrag = useCallback((e: React.MouseEvent, id: number) => {
    setContextMenu(null);
    setSelected(id);
    setSelectedIds(new Set());
    const n = nodeMapRef.current.get(id);
    if (!n || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
    const my = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
    dragging.current = { id, ox: mx - n.x, oy: my - n.y };
    e.preventDefault();
  }, []);

  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: number) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.isContentEditable) return;
    if (t.dataset.role === "connect-dot") return;
    if (t.dataset.role === "resize-handle") return;
    if (t.dataset.role === "move-handle") return;
    if (connectDragRef.current) return;
    e.stopPropagation();
    if (selectedIdsRef.current.size > 0 && selectedIdsRef.current.has(id)) {
      // Multi-drag: move all selected nodes together
      if (!canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
      const my = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
      const startPositions = new Map<number, { x: number; y: number }>();
      for (const nid of selectedIdsRef.current) {
        const node = nodeMapRef.current.get(nid);
        if (node) startPositions.set(nid, { x: node.x, y: node.y });
      }
      multiDragging.current = {
        startMouseX: mx,
        startMouseY: my,
        startPositions,
      };
      e.preventDefault();
    } else {
      startNodeDrag(e, id);
    }
  }, []);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    const n = nodeMapRef.current.get(id);
    if (!n) return;
    resizing.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: n.w,
      startH: n.h,
      constrain: n.type === "circle",
    };
  }, []);

  const onDotClick = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (connectDragRef.current?.fromId === id) {
      setConnectDrag(null);
    } else {
      setConnectDrag({ fromId: id });
    }
  }, []);

  const onConnHoverEnter = useCallback((key: string) => {
    setHoveredConnKey(key);
  }, []);
  const onConnHoverLeave = useCallback((key: string) => {
    setHoveredConnKey((k) => (k === key ? null : k));
  }, []);
  const onConnDelete = useCallback((from: number, to: number) => {
    setConnections((prev) =>
      prev.filter((x) => !(x.from === from && x.to === to)),
    );
  }, []);

  // Finalizes a pending connection on click (fires after mouseup, so
  // connectDragRef is guaranteed to hold the latest state).
  const onNodeClick = useCallback((e: React.MouseEvent, id: number) => {
    const cd = connectDragRef.current;
    if (!cd) return;
    e.stopPropagation();
    if (id !== cd.fromId) {
      setConnections((prev) => {
        const dup = prev.some((c) => c.from === cd.fromId && c.to === id);
        return dup ? prev : [...prev, { from: cd.fromId, to: id }];
      });
    }
    setConnectDrag(null);
  }, []);

  // ── Global mouse move + up ────────────────────────────────────────────────────

  // Apply all pending updates in a single React render (called from rAF or mouseup)
  const flushPending = useCallback(() => {
    rafRef.current = null;

    const panDelta = pendingPanDelta.current;
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      const { x, y } = panDelta;
      pendingPanDelta.current = { x: 0, y: 0 };
      setPan((prev) => ({ x: prev.x + x, y: prev.y + y }));
    }

    const drag = pendingDragPos.current;
    if (drag) {
      pendingDragPos.current = null;
      const SNAP_T = 8;
      let finalX = drag.x;
      let finalY = drag.y;
      const guides: { x?: number; y?: number } = {};
      const dragNode = nodeMapRef.current.get(drag.id);
      if (dragNode) {
        const dw = dragNode.w;
        const dh = dragNode.h;
        outer: for (const node of nodeMapRef.current.values()) {
          if (node.id === drag.id) continue;
          const xPairs: [number, number][] = [
            [finalX, node.x],
            [finalX, node.x + node.w],
            [finalX + dw, node.x],
            [finalX + dw, node.x + node.w],
            [finalX + dw / 2, node.x + node.w / 2],
          ];
          for (const [a, b] of xPairs) {
            if (Math.abs(a - b) < SNAP_T) {
              finalX += b - a;
              guides.x = b;
              break;
            }
          }
          const yPairs: [number, number][] = [
            [finalY, node.y],
            [finalY, node.y + node.h],
            [finalY + dh, node.y],
            [finalY + dh, node.y + node.h],
            [finalY + dh / 2, node.y + node.h / 2],
          ];
          for (const [a, b] of yPairs) {
            if (Math.abs(a - b) < SNAP_T) {
              finalY += b - a;
              guides.y = b;
              break;
            }
          }
          if (guides.x !== undefined && guides.y !== undefined) break outer;
        }
        if (guides.x === undefined) {
          const gx = Math.round(finalX / 20) * 20;
          if (Math.abs(finalX - gx) < SNAP_T) finalX = gx;
        }
        if (guides.y === undefined) {
          const gy = Math.round(finalY / 20) * 20;
          if (Math.abs(finalY - gy) < SNAP_T) finalY = gy;
        }
      }
      setSnapGuides(guides);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === drag.id ? { ...n, x: finalX, y: finalY } : n,
        ),
      );
    }

    const resize = pendingResizeSize.current;
    if (resize) {
      pendingResizeSize.current = null;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === resize.id ? { ...n, w: resize.w, h: resize.h } : n,
        ),
      );
    }

    const multiDelta = pendingMultiDragDelta.current;
    if (multiDelta && multiDragging.current) {
      pendingMultiDragDelta.current = null;
      const { startPositions } = multiDragging.current;
      const { dx, dy } = multiDelta;
      setNodes((prev) =>
        prev.map((n) => {
          const start = startPositions.get(n.id);
          return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
        }),
      );
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        lastMousePosRef.current = {
          x: (e.clientX - r.left - panRef.current.x) / zoomRef.current,
          y: (e.clientY - r.top - panRef.current.y) / zoomRef.current,
        };
      }

      if (
        !dragging.current &&
        !resizing.current &&
        !marquee.current &&
        !multiDragging.current
      )
        return;

      const pan = panRef.current;
      const zoom = zoomRef.current;
      let dirty = false;

      if (dragging.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        const { id, ox, oy } = dragging.current;
        pendingDragPos.current = { id, x: mx - ox, y: my - oy };
        dirty = true;
      }

      if (multiDragging.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        pendingMultiDragDelta.current = {
          dx: mx - multiDragging.current.startMouseX,
          dy: my - multiDragging.current.startMouseY,
        };
        dirty = true;
      }

      if (marquee.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const cx = (e.clientX - r.left - pan.x) / zoom;
        const cy = (e.clientY - r.top - pan.y) / zoom;
        const { startX, startY } = marquee.current;
        const x = Math.min(startX, cx);
        const y = Math.min(startY, cy);
        const w = Math.abs(cx - startX);
        const h = Math.abs(cy - startY);
        marquee.current = { startX, startY, x, y, w, h };
        setMarqueeRect({ x, y, w, h });
        dirty = true;
      }

      if (resizing.current) {
        const dx = (e.clientX - resizing.current.startX) / zoom;
        const dy = (e.clientY - resizing.current.startY) / zoom;
        const { id, startW, startH, constrain } = resizing.current;
        let newW: number, newH: number;
        if (constrain) {
          // Circle: keep square — drive size by the larger delta
          const d = Math.max(dx, dy);
          newW = Math.max(80, startW + d);
          newH = newW;
        } else {
          newW = Math.max(80, startW + dx);
          newH = Math.max(50, startH + dy);
        }
        pendingResizeSize.current = { id, w: newW, h: newH };
        dirty = true;
      }

      if (dirty && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPending);
      }
    },
    [flushPending],
  );

  const onMouseUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPending();

    // Marquee completion: select all intersecting nodes
    if (marquee.current) {
      const { x, y, w, h } = marquee.current;
      if (w > 4 || h > 4) {
        const matchingIds: number[] = [];
        for (const [, node] of nodeMapRef.current) {
          if (
            node.x < x + w &&
            node.x + node.w > x &&
            node.y < y + h &&
            node.y + node.h > y
          ) {
            matchingIds.push(node.id);
          }
        }
        setSelectedIds(new Set(matchingIds));
      } else {
        setSelectedIds(new Set());
      }
      marquee.current = null;
      setMarqueeRect(null);
    }

    dragging.current = null;
    resizing.current = null;
    multiDragging.current = null;
    pendingMultiDragDelta.current = null;
    setSnapGuides({});
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    if (filterOpen) setTimeout(() => filterInputRef.current?.focus(), 50);
  }, [filterOpen]);

  useEffect(() => {
    setFilterJumpIndex(0);
  }, [filterText, filterType]);

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  const arrangeBringToFront = useCallback((id: number) => {
    setNodes((prev) => bringToFront(prev, id));
  }, []);
  const arrangeBringForward = useCallback((id: number) => {
    setNodes((prev) => bringForward(prev, id));
  }, []);
  const arrangeSendBackward = useCallback((id: number) => {
    setNodes((prev) => sendBackward(prev, id));
  }, []);
  const arrangeSendToBack = useCallback((id: number) => {
    setNodes((prev) => sendToBack(prev, id));
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIdsRef.current.size > 0) {
      const ids = selectedIdsRef.current;
      setNodes((prev) => prev.filter((n) => !ids.has(n.id)));
      setConnections((prev) =>
        prev.filter((c) => !ids.has(c.from) && !ids.has(c.to)),
      );
      setPresentationOrder((prev) => prev.filter((id) => !ids.has(id)));
      setSelectedIds(new Set());
      setSelected(null);
    } else {
      const id = selectedRef.current;
      if (id === null) return;
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setConnections((prev) =>
        prev.filter((c) => c.from !== id && c.to !== id),
      );
      setPresentationOrder((prev) => prev.filter((p) => p !== id));
      setSelected(null);
    }
  }, []);

  const cleanUpCanvas = useCallback(() => {
    setNodes((prev) => {
      if (prev.length === 0) return prev;
      const sorted = [...prev].sort((a, b) => a.x - b.x);
      const rows: CanvasNode[][] = [];
      for (const node of sorted) {
        const cy = node.y + node.h / 2;
        const row = rows.find(
          (r) => Math.abs(cy - (r[0].y + r[0].h / 2)) < 150,
        );
        if (row) row.push(node);
        else rows.push([node]);
      }
      rows.sort((a, b) => {
        const ay = a.reduce((s, n) => s + n.y + n.h / 2, 0) / a.length;
        const by = b.reduce((s, n) => s + n.y + n.h / 2, 0) / b.length;
        return ay - by;
      });
      let curY = rows[0][0].y;
      const result: CanvasNode[] = [];
      for (const row of rows) {
        row.sort((a, b) => a.x - b.x);
        const rowH = row.reduce((max, n) => Math.max(max, n.h), 0);
        let curX = row[0].x;
        for (const node of row) {
          result.push({ ...node, x: curX, y: curY });
          curX += node.w + 40;
        }
        curY += rowH + 60;
      }
      return result;
    });
  }, []);

  const copySelected = useCallback(() => {
    const id = selectedRef.current;
    if (id === null) return;
    const n = nodeMapRef.current.get(id);
    if (n) setCopiedNode(n);
  }, []);

  const pasteNode = useCallback((cx?: number, cy?: number) => {
    const node = copiedNodeRef.current;
    if (!node) return;
    const maxExistingId = getMaxNodeId(nodeMapRef.current);
    if (idCounterRef.current <= maxExistingId)
      idCounterRef.current = maxExistingId + 1;
    const newId = idCounterRef.current;
    idCounterRef.current += 1;
    const tx =
      cx !== undefined
        ? cx - node.w / 2
        : lastMousePosRef.current.x - node.w / 2 + 10;
    const ty =
      cy !== undefined
        ? cy - node.h / 2
        : lastMousePosRef.current.y - node.h / 2 + 10;
    setNodes((prev) => [...prev, { ...node, id: newId, x: tx, y: ty }]);
    setPresentationOrder((prev) => [...prev, newId]);
    setSelected(newId);
    setContextMenu(null);
  }, []);

  const movePresentationNodeUp = useCallback((id: number) => {
    setPresentationOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const movePresentationNodeDown = useCallback((id: number) => {
    setPresentationOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const updateNodeField = useCallback(
    (id: number, field: "title" | "body", value: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
      );
    },
    [],
  );

  const updateNodeLabel = useCallback((id: number, label: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)));
  }, []);

  const updateFontSize = useCallback((id: number, size: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fontSize: size } : n)),
    );
  }, []);

  const updateNodeFormat = useCallback(
    (id: number, field: "bold" | "italic" | "underline", value: boolean) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
      );
    },
    [],
  );

  const toggleExcludeFromPresentation = useCallback(
    (id: number, toExclude: boolean) => {
      const ids =
        selectedIdsRef.current.size > 0 && selectedIdsRef.current.has(id)
          ? selectedIdsRef.current
          : new Set([id]);
      setNodes((prev) =>
        prev.map((n) =>
          ids.has(n.id) ? { ...n, excludeFromPresentation: toExclude } : n,
        ),
      );
    },
    [],
  );

  const focusNode = useCallback((id: number) => {
    const n = nodeMapRef.current.get(id);
    if (!n) return;
    setSelected(id);
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setPan({
      x: r.width / 2 - (n.x + n.w / 2) * zoomRef.current,
      y: r.height / 2 - (n.y + n.h / 2) * zoomRef.current,
    });
  }, []);

  const centerNodeForPresentation = useCallback((id: number) => {
    const n = nodeMapRef.current.get(id);
    if (!n || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const toZoom = Math.min(
      1.5,
      Math.max(0.1, Math.min((r.width * 0.8) / n.w, (r.height * 0.8) / n.h)),
    );
    const toPan = {
      x: r.width / 2 - (n.x + n.w / 2) * toZoom,
      y: r.height / 2 - (n.y + n.h / 2) * toZoom,
    };

    // Cancel in-flight animation; start from the last interpolated position
    // so a mid-animation interrupt never jumps to a stale state.
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    const fromPan = animCurrentRef.current?.pan ?? panRef.current;
    const fromZoom = animCurrentRef.current?.zoom ?? zoomRef.current;
    animCurrentRef.current = { pan: fromPan, zoom: fromZoom };

    const DURATION = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const raw = Math.min((now - startTime) / DURATION, 1);
      const t = easeInOutCubic(raw);
      const curZoom = fromZoom + (toZoom - fromZoom) * t;
      const curPan = {
        x: fromPan.x + (toPan.x - fromPan.x) * t,
        y: fromPan.y + (toPan.y - fromPan.y) * t,
      };
      animCurrentRef.current = { pan: curPan, zoom: curZoom };
      setZoom(curZoom);
      setPan(curPan);
      if (raw < 1) {
        animRafRef.current = requestAnimationFrame(tick);
      } else {
        animRafRef.current = null;
        animCurrentRef.current = null;
      }
    }

    animRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;

      if (
        (e.key === "f" || e.key === "F") &&
        !t.isContentEditable &&
        t.tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (filterOpenRef.current) {
          setFilterOpen(false);
          setFilterText("");
          setFilterType("all");
        } else {
          setFilterOpen(true);
        }
        return;
      }

      if (filterOpenRef.current && filterActiveRef.current) {
        const matched = matchedNodesSortedRef.current;
        if (e.key === "ArrowDown" && matched.length > 0) {
          e.preventDefault();
          const next = (filterJumpIndexRef.current + 1) % matched.length;
          setFilterJumpIndex(next);
          focusNode(matched[next].id);
          return;
        }
        if (e.key === "ArrowUp" && matched.length > 0) {
          e.preventDefault();
          const next =
            (filterJumpIndexRef.current - 1 + matched.length) % matched.length;
          setFilterJumpIndex(next);
          focusNode(matched[next].id);
          return;
        }
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !t.isContentEditable &&
        t.tagName !== "INPUT" &&
        (selectedRef.current !== null || selectedIdsRef.current.size > 0)
      )
        deleteSelected();
      if (e.key === "Escape") {
        if (isPresentingRef.current) {
          if (animRafRef.current !== null) {
            cancelAnimationFrame(animRafRef.current);
            animRafRef.current = null;
            animCurrentRef.current = null;
          }
          setIsPresenting(false);
          if (prePresentState.current) {
            setPan(prePresentState.current.pan);
            setZoom(prePresentState.current.zoom);
            prePresentState.current = null;
          }
          return;
        }
        if (editingNodeIdRef.current !== null) {
          (document.activeElement as HTMLElement)?.blur();
        }
        setConnectDrag(null);
        setContextMenu(null);
        setColorPicker(null);
        setTextColorPicker(null);
        if (filterOpenRef.current) {
          setFilterOpen(false);
          setFilterText("");
          setFilterType("all");
        }
      }
      if (isPresentingRef.current) {
        const seq = presentActiveSeqRef.current;
        const idx = presentationIndexRef.current;
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          const next = Math.min(idx + 1, seq.length - 1);
          if (next !== idx) {
            setPresentationIndex(next);
            centerNodeForPresentation(seq[next]);
          }
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(idx - 1, 0);
          if (prev !== idx) {
            setPresentationIndex(prev);
            centerNodeForPresentation(seq[prev]);
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveBoardRef.current();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !t.isContentEditable)
        copySelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && !t.isContentEditable)
        pasteNode();
      if (
        e.key === "Tab" &&
        !t.isContentEditable &&
        selectedRef.current !== null
      ) {
        e.preventDefault();
        const selId = selectedRef.current;
        const n = nodeMapRef.current.get(selId);
        if (n) {
          const maxId = getMaxNodeId(nodeMapRef.current);
          if (idCounterRef.current <= maxId) idCounterRef.current = maxId + 1;
          const newId = idCounterRef.current;
          idCounterRef.current += 1;
          const re1 = /^Block\s+(\d+)$/;
          let maxBlockIdx1 = 0;
          for (const node of nodeMapRef.current.values())
            if (node.type === "block") {
              const m = (node.label ?? "").match(re1);
              if (m) maxBlockIdx1 = Math.max(maxBlockIdx1, parseInt(m[1], 10));
            }
          setNodes((prev) => [
            ...prev,
            {
              id: newId,
              x: n.x + n.w + 80,
              y: n.y,
              w: 200,
              h: 80,
              title: "",
              label: `Block ${maxBlockIdx1 + 1}`,
              body: "",
              type: "block",
              color: "#1D5C50",
              fontSize: 13,
            },
          ]);
          setConnections((prev) => [...prev, { from: selId, to: newId }]);
          setPresentationOrder((prev) => [...prev, newId]);
          setSelected(newId);
          editingNodeIdRef.current = newId;
          setTimeout(() => {
            document
              .querySelector<HTMLElement>(
                `[data-node-id="${newId}"] [contenteditable]`,
              )
              ?.focus();
          }, 50);
        }
      }
      if (
        e.key === "Enter" &&
        !t.isContentEditable &&
        selectedRef.current !== null
      ) {
        e.preventDefault();
        const selId = selectedRef.current;
        const n = nodeMapRef.current.get(selId);
        if (n) {
          const maxId = getMaxNodeId(nodeMapRef.current);
          if (idCounterRef.current <= maxId) idCounterRef.current = maxId + 1;
          const newId = idCounterRef.current;
          idCounterRef.current += 1;
          const re2 = /^Block\s+(\d+)$/;
          let maxBlockIdx2 = 0;
          for (const node of nodeMapRef.current.values())
            if (node.type === "block") {
              const m = (node.label ?? "").match(re2);
              if (m) maxBlockIdx2 = Math.max(maxBlockIdx2, parseInt(m[1], 10));
            }
          setNodes((prev) => [
            ...prev,
            {
              id: newId,
              x: n.x,
              y: n.y + n.h + 40,
              w: 200,
              h: 80,
              title: "",
              label: `Block ${maxBlockIdx2 + 1}`,
              body: "",
              type: "block",
              color: "#1D5C50",
              fontSize: 13,
            },
          ]);
          setPresentationOrder((prev) => [...prev, newId]);
          setSelected(newId);
          editingNodeIdRef.current = newId;
          setTimeout(() => {
            document
              .querySelector<HTMLElement>(
                `[data-node-id="${newId}"] [contenteditable]`,
              )
              ?.focus();
          }, 50);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, copySelected, pasteNode, focusNode, centerNodeForPresentation]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const menuItem = (danger = false): React.CSSProperties => ({
    padding: "9px 14px",
    cursor: "pointer",
    fontSize: 13.5,
    color: danger ? "#FF6B6B" : "#FFFFFF",
    display: "flex",
    alignItems: "center",
    gap: 10,
  });

  const hoverMenu = (e: React.MouseEvent, on: boolean, danger = false) => {
    (e.currentTarget as HTMLElement).style.background = on
      ? danger
        ? "rgba(255,107,107,0.1)"
        : "rgba(255,255,255,0.06)"
      : "transparent";
  };

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (!canvasRef.current || nodes.length === 0) return;
    setExporting(true);

    const savedPan = { ...panRef.current };
    const savedZoom = zoomRef.current;

    try {
      // Bug 1: compute tight bounding box of all nodes + padding
      const PAD = 40;
      const minX = nodes.reduce((m, n) => Math.min(m, n.x), Infinity) - PAD;
      const minY = nodes.reduce((m, n) => Math.min(m, n.y), Infinity) - PAD;
      const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.w), -Infinity) + PAD;
      const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.h), -Infinity) + PAD;
      const contentW = Math.ceil(maxX - minX);
      const contentH = Math.ceil(maxY - minY);

      // Pan so the bounding box top-left lands exactly at canvas (0, 0)
      setPan({ x: -minX, y: -minY });
      setZoom(1);

      // Two rAF ticks — let React commit pan/zoom before capture
      await new Promise<void>((r) =>
        requestAnimationFrame(() => {
          requestAnimationFrame(() => r());
        }),
      );

      // Temporarily expand the canvas div to the full content size so
      // html2canvas can see nodes that lie outside the current viewport
      const el = canvasRef.current;
      el.style.width = `${contentW}px`;
      el.style.height = `${contentH}px`;

      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const cvs = await html2canvas(el, {
        backgroundColor: "#0C2018",
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        // Skip all fixed-position overlays (sidebar, toolbars, pickers)
        ignoreElements: (el) =>
          window.getComputedStyle(el).position === "fixed",
      });

      const imgData = cvs.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: contentW >= contentH ? "landscape" : "portrait",
        unit: "px",
        format: [contentW, contentH],
      });
      pdf.addImage(imgData, "JPEG", 0, 0, contentW, contentH);
      pdf.save("dnkrm.pdf");
    } catch {
      setToast({ msg: "Export failed", variant: "error" });
    } finally {
      if (canvasRef.current) {
        canvasRef.current.style.width = "";
        canvasRef.current.style.height = "";
      }
      setPan(savedPan);
      setZoom(savedZoom);
      setExporting(false);
    }
  }, [nodes]);


  // ── Render ────────────────────────────────────────────────────────────────────
  const panelOpen = activePanel !== null;
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0C2018",
        overflow: "hidden",
        position: "relative",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
      onClick={() => setContextMenu(null)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={onImageFileChange}
      />
      <input
        ref={textFileInputRef}
        type="file"
        accept="text/plain,text/markdown,text/csv,text/rtf,text/xml,text/html,text/css,text/javascript,application/json,application/xml,application/x-yaml,application/x-sh,.txt,.md,.markdown,.csv,.rtf,.log,.json,.xml,.yaml,.yml,.toml,.ini,.env,.ts,.tsx,.js,.jsx,.html,.css,.py,.rb,.java,.c,.cpp,.h,.sh"
        style={{ display: "none" }}
        onChange={onTextFileChange}
      />
      <input
        ref={denkraumFileInputRef}
        type="file"
        accept=".dnkrm,.json"
        style={{ display: "none" }}
        onChange={onDenkraumFileChange}
      />

      {/* Shared gradient defs for shape icons */}
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gShapeN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#265048" />
            <stop offset="100%" stopColor="#143F38" />
          </linearGradient>
          <linearGradient id="gShapeA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D3216" />
            <stop offset="100%" stopColor="#2A2410" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Sidebar Strip (always visible, 52px) ── */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          height: "calc(100vh - 24px)",
          width: 52,
          background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(30,74,65,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.12)",
          zIndex: 151,
          display: isPresenting ? "none" : "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        {/* Logo mark — decorative, not clickable */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          style={{ flexShrink: 0, display: "block" }}
        >
          <rect
            x="0.5"
            y="0.5"
            width="21"
            height="21"
            rx="5"
            stroke="rgba(241,178,74,0.3)"
            strokeWidth="1"
          />
          <rect
            x="4"
            y="4"
            width="14"
            height="14"
            rx="3"
            fill="rgba(241,178,74,0.12)"
          />
          <rect
            x="7"
            y="7"
            width="8"
            height="8"
            rx="2"
            fill="rgba(241,178,74,0.45)"
          />
        </svg>

        {/* gap */}
        <div style={{ height: 20 }} />

        {/* Nav buttons */}
        {(
          [
            {
              section: "board" as const,
              title: "Board",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
              ),
            },
            {
              section: "nodes" as const,
              title: "Nodes",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2.5"/>
                  <circle cx="18" cy="18" r="2.5"/>
                  <line x1="8" y1="8" x2="16" y2="16"/>
                </svg>
              ),
            },
            {
              section: "presentation" as const,
              title: "Presentation",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              ),
            },
            {
              section: "saveload" as const,
              title: "Save / Load",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              ),
            },
            {
              section: "shortcuts" as const,
              title: "Shortcuts",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <line x1="6" y1="10" x2="6.01" y2="10"/>
                  <line x1="10" y1="10" x2="10.01" y2="10"/>
                  <line x1="14" y1="10" x2="14.01" y2="10"/>
                  <line x1="8" y1="14" x2="16" y2="14"/>
                </svg>
              ),
            },
          ] as { section: "board" | "nodes" | "presentation" | "saveload" | "shortcuts"; title: string; icon: React.ReactNode }[]
        ).map(({ section, title, icon }) => {
          const isActive = activePanel === section;
          return (
            <button
              key={section}
              title={title}
              onClick={() => setActivePanel((prev) => prev === section ? null : section)}
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: 9,
                marginBottom: 6,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isActive ? "#F1B24A" : "rgba(255,255,255,0.75)",
                background: isActive ? "rgba(241,178,74,0.12)" : "transparent",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    left: -8,
                    top: 6,
                    width: 2.5,
                    height: 24,
                    background: "#F1B24A",
                    borderRadius: "0 2px 2px 0",
                  }}
                />
              )}
              {icon}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Avatar */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        >
          A
        </div>
      </div>

      {/* ── Sidebar Panel (220px, shown when panel open) ── */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 76,
          height: "calc(100vh - 24px)",
          width: 220,
          background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(30,74,65,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.12)",
          zIndex: 149,
          display: panelOpen && !isPresenting ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        {/* ── Panel Header (dynamic title) ── */}
        <div
          style={{
            height: 52,
            flexShrink: 0,
            background: "rgba(0,0,0,0.15)",
            borderBottom: "0.5px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px 0 16px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "1.4px",
              color: "#FFFFFF",
            }}
          >
            {activePanel === "board" && "BOARD"}
            {activePanel === "nodes" && "NODES"}
            {activePanel === "presentation" && "PRESENT"}
            {activePanel === "saveload" && "BOARD FILES"}
            {activePanel === "shortcuts" && "SHORTCUTS"}
          </span>
          <button
            onClick={() => setActivePanel(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              cursor: "pointer",
              padding: "4px 6px",
              lineHeight: 1,
              borderRadius: 5,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Icon gradient defs — always in DOM for SidebarNodeItem icons */}
        <svg
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
        >
          <defs>
            {(
              [
                "iconGradBlock",
                "iconGradRounded",
                "iconGradCircle",
                "iconGradOval",
                "iconGradDiamond",
                "iconGradText",
                "iconGradImage",
                "iconGradTextfile",
              ] as string[]
            ).map((id) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#265048" />
                <stop offset="100%" stopColor="#143F38" />
              </linearGradient>
            ))}
          </defs>
        </svg>

        {/* ── BOARD section ── */}
        {activePanel === "board" && (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 12 }}>
            {/* Board row */}
            <div
              onDoubleClick={() => setEditingBoardName(true)}
              style={{
                position: "relative",
                height: 40,
                display: "flex",
                alignItems: "center",
                cursor: "text",
                background:
                  "linear-gradient(to right, rgba(241,178,74,0.07), transparent)",
                justifyContent: "flex-start",
              }}
            >
              {/* Left accent bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 2.5,
                  height: 40,
                  background: "#F1B24A",
                  borderRadius: "0 1px 1px 0",
                }}
              />

              {/* Board icon */}
              <div
                style={{
                  paddingLeft: 20,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{ display: "block" }}
                >
                  <rect
                    x="0.7"
                    y="0.7"
                    width="12.6"
                    height="12.6"
                    rx="2"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="0.7"
                    y="0.7"
                    width="12.6"
                    height="3.5"
                    rx="2"
                    fill="rgba(255,255,255,0.10)"
                  />
                </svg>
              </div>

              {editingBoardName ? (
                <input
                  autoFocus
                  defaultValue={boardName}
                  maxLength={60}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const val = e.target.value.trim() || "Untitled Board";
                    setBoardName(val);
                    setEditingBoardName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val =
                        (e.target as HTMLInputElement).value.trim() ||
                        "Untitled Board";
                      setBoardName(val);
                      setEditingBoardName(false);
                    }
                    if (e.key === "Escape") setEditingBoardName(false);
                    e.stopPropagation();
                  }}
                  style={{
                    flex: 1,
                    marginLeft: 10,
                    marginRight: 12,
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    background: "rgba(255,255,255,0.07)",
                    border: "none",
                    outline: "1px solid rgba(241,178,74,0.4)",
                    borderRadius: 5,
                    padding: "1px 5px",
                    color: "#FFFFFF",
                    minWidth: 0,
                  }}
                />
              ) : (
                <>
                  <span
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#FFFFFF",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {boardName}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    style={{ marginRight: 20, flexShrink: 0 }}
                  >
                    <circle cx="8" cy="8" r="6" fill="rgba(241,178,74,0.12)" />
                    <circle cx="8" cy="8" r="3.5" fill="#F1B24A" />
                  </svg>
                </>
              )}
            </div>

            {/* Info line */}
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.75)",
                padding: "12px 16px",
              }}
            >
              Canvas · {nodes.length} nodes
            </div>
          </div>
        )}

        {/* ── NODES section ── */}
        {activePanel === "nodes" && (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 12 }}>
            {nodes.length === 0 ? (
              <div
                style={{ padding: "6px 20px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}
              >
                No nodes yet
              </div>
            ) : (
              nodes.map((n) => (
                <SidebarNodeItem
                  key={n.id}
                  id={n.id}
                  type={n.type}
                  label={
                    (n.label ?? n.title).replace(/<[^>]*>/g, "").trim() ||
                    "Untitled"
                  }
                  defaultLabelValue={n.label ?? n.title}
                  isActive={selected === n.id}
                  isEditingSidebar={editingSidebarNodeId === n.id}
                  focusNode={focusNode}
                  updateNodeLabel={updateNodeLabel}
                  setEditingSidebarNodeId={setEditingSidebarNodeId}
                />
              ))
            )}
          </div>
        )}

        {/* ── PRESENTATION section ── */}
        {activePanel === "presentation" && (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
              {presentationOrder.length === 0 ? (
                <div style={{ padding: "6px 20px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  No nodes yet
                </div>
              ) : (() => {
                let activePos = 0;
                return presentationOrder.map((id, idx) => {
                  const n = nodeMap.get(id);
                  if (!n) return null;
                  const excluded = !!n.excludeFromPresentation;
                  if (!excluded) activePos += 1;
                  const seqNum = excluded ? "–" : String(activePos);
                  const label =
                    (n.label ?? n.title).replace(/<[^>]*>/g, "").trim() || "Untitled";
                  const isFirst = idx === 0;
                  const isLast = idx === presentationOrder.length - 1;
                  return (
                    <div
                      key={id}
                      style={{
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 8px 0 16px",
                        gap: 8,
                        opacity: excluded ? 0.45 : 1,
                      }}
                    >
                      {/* Sequence number */}
                      <span
                        style={{
                          fontSize: 10.5,
                          color: excluded ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.3)",
                          flexShrink: 0,
                          width: 16,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {seqNum}
                      </span>

                      {/* Label */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          color: excluded ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.8)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          textDecoration: excluded ? "line-through" : "none",
                        }}
                      >
                        {label}
                      </span>

                      {/* Exclude / include toggle */}
                      <button
                        onClick={() => toggleExcludeFromPresentation(id, !excluded)}
                        title={excluded ? "Include in presentation" : "Exclude from presentation"}
                        style={{
                          width: 22,
                          height: 22,
                          border: "none",
                          borderRadius: 5,
                          background: "transparent",
                          color: excluded ? "rgba(255,255,255,0.4)" : "rgba(157,200,141,0.7)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                          (e.currentTarget as HTMLElement).style.color = excluded ? "rgba(255,255,255,0.75)" : "#9DC88D";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = excluded ? "rgba(255,255,255,0.4)" : "rgba(157,200,141,0.7)";
                        }}
                      >
                        {excluded ? (
                          /* eye-off: slash through eye */
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          /* eye: visible */
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>

                      {/* Up/Down buttons */}
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={() => movePresentationNodeUp(id)}
                          disabled={isFirst}
                          title="Move up"
                          style={{
                            width: 22,
                            height: 22,
                            border: "none",
                            borderRadius: 5,
                            background: "transparent",
                            color: isFirst ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                            cursor: isFirst ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                          onMouseEnter={(e) => {
                            if (!isFirst)
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 7L5 3L8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => movePresentationNodeDown(id)}
                          disabled={isLast}
                          title="Move down"
                          style={{
                            width: 22,
                            height: 22,
                            border: "none",
                            borderRadius: 5,
                            background: "transparent",
                            color: isLast ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                            cursor: isLast ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                          onMouseEnter={(e) => {
                            if (!isLast)
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 3L5 7L8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Present button */}
            <div style={{ padding: "12px 14px", flexShrink: 0, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
              <button
                disabled={presentActiveSeq.length === 0}
                onClick={() => {
                  if (presentActiveSeq.length === 0) return;
                  prePresentState.current = { pan: panRef.current, zoom: zoomRef.current };
                  setPresentationIndex(0);
                  setIsPresenting(true);
                  setActivePanel(null);
                  setContextMenu(null);
                  setColorPicker(null);
                  setTextColorPicker(null);
                  centerNodeForPresentation(presentActiveSeq[0]);
                }}
                style={{
                  width: "100%",
                  height: 38,
                  borderRadius: 10,
                  border: "none",
                  background: presentActiveSeq.length === 0 ? "rgba(241,178,74,0.35)" : "#F1B24A",
                  color: "#0C2018",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: presentActiveSeq.length === 0 ? "default" : "pointer",
                  letterSpacing: "-0.1px",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (presentActiveSeq.length > 0)
                    (e.currentTarget as HTMLElement).style.opacity = "0.88";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = "1";
                }}
              >
                Present
              </button>
            </div>
          </div>
        )}

        {/* ── SAVELOAD section ── */}
        {activePanel === "saveload" && (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
            {/* Save row */}
            <button
              title="Save board"
              onClick={() => saveBoard()}
              style={{
                height: 44,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-start",
                paddingLeft: 16,
                paddingRight: 16,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ flexShrink: 0, color: "rgba(255,255,255,0.75)" }}
              >
                <path
                  d="M2 12h10M7 2v7M4 6l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                Save board
              </span>
              <kbd
                style={{
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.55)",
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                ⌘S
              </kbd>
            </button>

            {/* Load row */}
            <button
              title="Load board"
              onClick={() => denkraumFileInputRef.current?.click()}
              style={{
                height: 44,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-start",
                paddingLeft: 16,
                paddingRight: 16,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ flexShrink: 0, color: "rgba(255,255,255,0.6)" }}
              >
                <path
                  d="M2 12h10M7 9V2M4 5l3-3 3 3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                Load board
              </span>
            </button>
          </div>
        )}

        {/* ── SHORTCUTS section ── */}
        {activePanel === "shortcuts" && (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 12 }}>
            {(
              [
                { kbd: "⌫  Delete", desc: "Delete selected" },
                { kbd: "Tab", desc: "Add child node" },
                { kbd: "Enter", desc: "Add sibling node" },
                { kbd: "Esc", desc: "Cancel connect" },
                { kbd: "⌃ Scroll", desc: "Zoom in / out" },
                { kbd: "Right-click", desc: "Insert shape" },
                { kbd: "Click dot →", desc: "Connect nodes" },
              ] as { kbd: string; desc: string }[]
            ).map(({ kbd, desc }) => (
              <div
                key={kbd}
                style={{
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 16px",
                  gap: 10,
                }}
              >
                <kbd
                  style={{
                    fontSize: 10.5,
                    color: "rgba(255,255,255,0.7)",
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.07)",
                    borderRadius: 5,
                    padding: "2px 7px",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  {kbd}
                </kbd>
                <span
                  style={{
                    fontSize: 11.5,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {desc}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Export Toolbar ── */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "6px 10px",
          display: isPresenting ? "none" : "flex",
          gap: 8,
          alignItems: "center",
          boxShadow: "0 2px 24px rgba(0,0,0,0.3), inset 0 1px 0 0 rgba(255,255,255,0.12)",
          zIndex: 201,
        }}
      >
        {/* ── Shape insert buttons ── */}
        {(
          [
            { type: "block" as NodeType, label: "Block" },
            { type: "rounded" as NodeType, label: "Area" },
            { type: "circle" as NodeType, label: "Circle" },
            { type: "oval" as NodeType, label: "Oval" },
            { type: "diamond" as NodeType, label: "Diamond" },
            { type: "text" as NodeType, label: "Text" },
          ] as { type: NodeType; label: string }[]
        ).map(({ type, label }) => (
          <ShapeButton
            key={type}
            label={label}
            isActive={activeShapeType === type}
            onClick={() => {
              if (!canvasRef.current) return;
              const cx =
                (canvasRef.current.clientWidth / 2 - panRef.current.x) /
                zoomRef.current;
              const cy =
                (canvasRef.current.clientHeight / 2 - panRef.current.y) /
                zoomRef.current;
              setActiveShapeType(type);
              addNode(cx, cy, type);
            }}
          >
            {(stroke, active) => renderShapeIcon(type, stroke, active)}
          </ShapeButton>
        ))}

        {/* Image insert button */}
        <ShapeButton
          label="Insert Image"
          isActive={false}
          onClick={() => {
            if (!canvasRef.current) return;
            const cx =
              (canvasRef.current.clientWidth / 2 - panRef.current.x) /
              zoomRef.current;
            const cy =
              (canvasRef.current.clientHeight / 2 - panRef.current.y) /
              zoomRef.current;
            handleImageInsert(cx, cy);
          }}
        >
          {(stroke, active) => renderShapeIcon("image", stroke, active)}
        </ShapeButton>

        {/* Text file insert button */}
        <ShapeButton
          label="Insert Text File"
          isActive={false}
          onClick={() => {
            if (!canvasRef.current) return;
            const cx =
              (canvasRef.current.clientWidth / 2 - panRef.current.x) /
              zoomRef.current;
            const cy =
              (canvasRef.current.clientHeight / 2 - panRef.current.y) /
              zoomRef.current;
            handleTextFileInsert(cx, cy);
          }}
        >
          {(stroke, active) => renderShapeIcon("textfile", stroke, active)}
        </ShapeButton>

        {/* Divider */}
        <div
          style={{
            width: "0.5px",
            height: 16,
            background: "rgba(255,255,255,0.1)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        <button
          onClick={handleExportPDF}
          disabled={exporting}
          style={{
            padding: "6px 13px",
            borderRadius: 8,
            border: "none",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: exporting ? "default" : "pointer",
            background: "transparent",
            color: exporting ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
            transition: "color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: "-0.1px",
          }}
          onMouseEnter={(e) => {
            if (!exporting)
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            if (!exporting)
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
          }}
        >
          {exporting ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Exporting…
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF
            </>
          )}
        </button>

        {/* Divider */}
        <div
          style={{
            width: "0.5px",
            height: 16,
            background: "rgba(255,255,255,0.1)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        <button
          onClick={cleanUpCanvas}
          title="Clean up layout"
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            color: "rgba(255,255,255,0.85)",
            transition: "color 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="2.5" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="11.5" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="2.5" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="11.5" cy="7" r="1.2" fill="currentColor" />
            <circle cx="2.5" cy="11.5" r="1.2" fill="currentColor" />
            <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
            <circle cx="11.5" cy="11.5" r="1.2" fill="currentColor" />
          </svg>
        </button>

        {/* Divider */}
        <div
          style={{
            width: "0.5px",
            height: 16,
            background: "rgba(255,255,255,0.1)",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        {/* Filter button */}
        <button
          title="Filter nodes (F)"
          onClick={() => setFilterOpen((o) => !o)}
          style={{
            width: 28,
            height: 28,
            border: "none",
            background: filterOpen ? `${ACCENT}22` : "transparent",
            color: filterOpen ? ACCENT : "rgba(255,255,255,0.85)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            padding: 0,
            transition: "color 0.12s, background 0.12s",
          }}
          onMouseEnter={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }
          }}
          onMouseLeave={(e) => {
            if (!filterOpen) {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* ── Filter Bar ── */}
      {filterOpen && (
        <div
          style={{
            position: "fixed",
            top: 68,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
            boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.12)",
            zIndex: 202,
            minWidth: 420,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={filterInputRef}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Suchen…"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilterOpen(false);
                  setFilterText("");
                  setFilterType("all");
                }
                e.stopPropagation();
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#FFFFFF",
                fontSize: 13,
                fontFamily: "inherit",
                caretColor: ACCENT,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {filterActive
                ? `${matchedNodeIds.size} Treffer`
                : `${nodes.length} Nodes`}
            </span>
            <button
              onClick={() => {
                setFilterOpen(false);
                setFilterText("");
                setFilterType("all");
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 2,
                borderRadius: 4,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)")
              }
            >
              ✕
            </button>
          </div>

          {/* Type buttons */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(
              [
                { value: "all", label: "Alle" },
                { value: "block", label: "Block" },
                { value: "rounded", label: "Area" },
                { value: "circle", label: "Circle" },
                { value: "oval", label: "Oval" },
                { value: "diamond", label: "Diamond" },
                { value: "text", label: "Text" },
                { value: "image", label: "Image" },
                { value: "textfile", label: "File" },
              ] as { value: NodeType | "all"; label: string }[]
            ).map(({ value, label }) => {
              const active = filterType === value;
              return (
                <button
                  key={value}
                  onClick={() => setFilterType(value)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 6,
                    border: active
                      ? `1px solid ${ACCENT}66`
                      : "1px solid rgba(255,255,255,0.07)",
                    background: active ? `${ACCENT}22` : "transparent",
                    color: active ? ACCENT : "rgba(255,255,255,0.7)",
                    fontSize: 11.5,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(255,255,255,0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(255,255,255,0.07)";
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        data-bg="true"
        onMouseDown={onCanvasMouseDown}
        onContextMenu={onCanvasContextMenu}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          cursor: connectDrag ? "crosshair" : "grab",
          overflow: "hidden",
        }}
      >
        {/* Dot grid */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern
              id="dots"
              x={pan.x % (20 * zoom)}
              y={pan.y % (20 * zoom)}
              width={20 * zoom}
              height={20 * zoom}
              patternUnits="userSpaceOnUse"
            >
              <circle cx={1} cy={1} r={0.8} fill="rgba(255,255,255,0.08)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* World */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0,
            height: 0,
          }}
        >
          {/* Connections SVG — positioned at (-5000,-5000) so the internal
              coordinate origin matches world (0,0) via the translate below. */}
          <svg
            style={{
              position: "absolute",
              left: -5000,
              top: -5000,
              width: 10000,
              height: 10000,
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <g
              transform="translate(5000, 5000)"
              style={{ pointerEvents: "auto" }}
            >
              {connections.map((c) => {
                const fn = nodeMap.get(c.from);
                const tn = nodeMap.get(c.to);
                if (!fn || !tn) return null;
                const key = `${c.from}-${c.to}`;
                return (
                  <ConnectionLine
                    key={key}
                    connKey={key}
                    fromNode={fn}
                    toNode={tn}
                    isHovered={hoveredConnKey === key}
                    zoom={zoom}
                    connDimmed={
                      filterActive &&
                      !matchedNodeIds.has(c.from) &&
                      !matchedNodeIds.has(c.to)
                    }
                    onHoverEnter={onConnHoverEnter}
                    onHoverLeave={onConnHoverLeave}
                    onDelete={onConnDelete}
                  />
                );
              })}
            </g>
          </svg>

          {/* Marquee selection rect */}
          {marqueeRect && (
            <div
              style={{
                position: "absolute",
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
                border: `1px solid ${ACCENT}`,
                background: "rgba(241,178,74,0.08)",
                pointerEvents: "none",
                zIndex: 999,
              }}
            />
          )}

          {/* Nodes */}
          {nodes.map((n) => (
            <NodeView
              key={n.id}
              n={n}
              selected={selected}
              connectDrag={connectDrag}
              hoveredId={hoveredId}
              editingNodeIdRef={editingNodeIdRef}
              connectDragRef={connectDragRef}
              onNodeMouseDown={onNodeMouseDown}
              onNodeContextMenu={onNodeContextMenu}
              onNodeClick={onNodeClick}
              setTextFileViewer={setTextFileViewer}
              setHoveredId={setHoveredId}
              updateNodeField={updateNodeField}
              startNodeDrag={startNodeDrag}
              onDotClick={onDotClick}
              onResizeMouseDown={onResizeMouseDown}
              dimmed={filterActive && !matchedNodeIds.has(n.id)}
              isMultiSelected={selectedIds.has(n.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Snap Guides ── */}
      {snapGuides.x !== undefined && (
        <div
          style={{
            position: "fixed",
            left: Math.round(snapGuides.x * zoom + pan.x),
            top: 0,
            width: 1,
            height: "100%",
            background: "rgba(241,178,74,0.6)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}
      {snapGuides.y !== undefined && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: Math.round(snapGuides.y * zoom + pan.y),
            width: "100%",
            height: 1,
            background: "rgba(241,178,74,0.6)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      {/* ── Node Context Menu ── */}
      {contextMenu?.kind === "node" &&
        (() => {
          const n = nodeMap.get(contextMenu.id);
          if (!n) return null;
          const canColor = n.type !== "text" && n.type !== "image";
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: contextMenu.x,
                top: contextMenu.y,
                background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.97)",
                backdropFilter: "blur(24px)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.12)",
                zIndex: 300,
                minWidth: 240,
                padding: "6px 0",
              }}
            >
              {/* ── Copy ── */}
              <div
                onClick={() => {
                  copySelected();
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => hoverMenu(e, true)}
                onMouseLeave={(e) => hoverMenu(e, false)}
                style={menuItem()}
              >
                <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>
                  ⎘
                </span>
                Copy
              </div>
              <div
                style={{
                  height: "0.5px",
                  background: "rgba(255,255,255,0.10)",
                  margin: "2px 0",
                }}
              />
              {/* ── Text formatting ── */}
              <div style={{ padding: "8px 14px 10px" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 9,
                  }}
                >
                  Text
                </div>
                {/* Font size slider */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", flexShrink: 0 }}
                  >
                    A
                  </span>
                  <input
                    type="range"
                    className="fmt-slider"
                    min={8}
                    max={72}
                    value={n.fontSize ?? 13}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => updateFontSize(n.id, +e.target.value)}
                    style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.85)",
                      minWidth: 20,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {n.fontSize ?? 13}
                  </span>
                </div>
                {/* B / I / U */}
                <div style={{ display: "flex", gap: 5 }}>
                  {(
                    [
                      { field: "bold", label: "B", style: { fontWeight: 700 } },
                      {
                        field: "italic",
                        label: "I",
                        style: { fontStyle: "italic" },
                      },
                      {
                        field: "underline",
                        label: "U",
                        style: { textDecoration: "underline" },
                      },
                    ] as {
                      field: "bold" | "italic" | "underline";
                      label: string;
                      style: React.CSSProperties;
                    }[]
                  ).map(({ field, label, style }) => {
                    const active = !!n[field];
                    return (
                      <button
                        key={field}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => updateNodeFormat(n.id, field, !active)}
                        style={{
                          flex: 1,
                          height: 28,
                          border: active
                            ? "1px solid rgba(255,255,255,0.25)"
                            : "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 7,
                          background: active
                            ? "rgba(255,255,255,0.12)"
                            : "transparent",
                          color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontFamily: "inherit",
                          transition: "all 0.1s",
                          ...style,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* Text Color */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: n.textColor ?? "#FFFFFF",
                      border: "1px solid rgba(255,255,255,0.1)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      fontFamily: "monospace",
                      flex: 1,
                    }}
                  >
                    {n.textColor ?? "#FFFFFF"}
                  </span>
                  <div
                    onClick={() =>
                      openTextColorPicker(
                        contextMenu.id,
                        n.textColor ?? "#FFFFFF",
                        contextMenu.x,
                        contextMenu.y,
                      )
                    }
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.07)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.85)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.12)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.07)")
                    }
                  >
                    ···
                  </div>
                </div>
              </div>

              {canColor && (
                <>
                  <div
                    style={{
                      height: "0.5px",
                      background: "rgba(255,255,255,0.10)",
                      margin: "2px 0",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      padding: "6px 14px 4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Color
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 14px 10px",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: n.color,
                        border: "1px solid rgba(255,255,255,0.1)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        fontFamily: "monospace",
                        flex: 1,
                      }}
                    >
                      {n.color}
                    </span>
                    <div
                      onClick={() =>
                        openColorPicker(
                          contextMenu.id,
                          n.color,
                          contextMenu.x,
                          contextMenu.y,
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.07)",
                        border: "0.5px solid rgba(255,255,255,0.08)",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.85)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.12)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.07)")
                      }
                    >
                      ···
                    </div>
                  </div>
                </>
              )}

              <div
                style={{
                  height: "0.5px",
                  background: "rgba(255,255,255,0.10)",
                  margin: "2px 0",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  padding: "6px 14px 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Arrange
              </div>
              {(
                [
                  {
                    label: "Bring to Front",
                    icon: "⤒",
                    action: () => arrangeBringToFront(contextMenu.id),
                  },
                  {
                    label: "Bring Forward",
                    icon: "↑",
                    action: () => arrangeBringForward(contextMenu.id),
                  },
                  {
                    label: "Send Backward",
                    icon: "↓",
                    action: () => arrangeSendBackward(contextMenu.id),
                  },
                  {
                    label: "Send to Back",
                    icon: "⤓",
                    action: () => arrangeSendToBack(contextMenu.id),
                  },
                ] as const
              ).map(({ label, icon, action }) => (
                <div
                  key={label}
                  onClick={() => {
                    action();
                    setContextMenu(null);
                  }}
                  onMouseEnter={(e) => hoverMenu(e, true)}
                  onMouseLeave={(e) => hoverMenu(e, false)}
                  style={menuItem()}
                >
                  <span
                    style={{
                      width: 22,
                      textAlign: "center",
                      fontSize: 14,
                      fontFamily: "monospace",
                    }}
                  >
                    {icon}
                  </span>
                  {label}
                </div>
              ))}

              <div
                style={{
                  height: "0.5px",
                  background: "rgba(255,255,255,0.10)",
                  margin: "2px 0",
                }}
              />
              {/* ── Exclude / Include from presentation ── */}
              <div
                onClick={() => {
                  toggleExcludeFromPresentation(contextMenu.id, !n.excludeFromPresentation);
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => hoverMenu(e, true)}
                onMouseLeave={(e) => hoverMenu(e, false)}
                style={menuItem()}
              >
                <span style={{ width: 22, textAlign: "center", fontSize: 13 }}>
                  {n.excludeFromPresentation ? "▷" : "⊘"}
                </span>
                {n.excludeFromPresentation
                  ? "Include in presentation"
                  : "Exclude from presentation"}
              </div>
              <div
                style={{
                  height: "0.5px",
                  background: "rgba(255,255,255,0.10)",
                  margin: "2px 0",
                }}
              />
              <div
                onClick={() => {
                  deleteSelected();
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => hoverMenu(e, true, true)}
                onMouseLeave={(e) => hoverMenu(e, false, true)}
                style={menuItem(true)}
              >
                <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>
                  ✕
                </span>
                Delete
              </div>
            </div>
          );
        })()}

      {/* ── Canvas Context Menu ── */}
      {contextMenu?.kind === "canvas" && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "linear-gradient(180deg, rgba(157,200,141,0.04) 0%, rgba(157,200,141,0) 100%), rgba(22,64,56,0.97)",
            backdropFilter: "blur(24px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 0 rgba(255,255,255,0.12)",
            zIndex: 300,
            minWidth: 220,
            padding: "6px 0",
          }}
        >
          <div
            onClick={() => {
              if (!copiedNode) return;
              pasteNode(contextMenu.cx, contextMenu.cy);
            }}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={{
              ...menuItem(),
              opacity: copiedNode ? 1 : 0.35,
              cursor: copiedNode ? "pointer" : "default",
            }}
          >
            <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>
              ⎘
            </span>
            Paste
          </div>
          <div
            style={{
              height: "0.5px",
              background: "rgba(255,255,255,0.10)",
              margin: "2px 0",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              padding: "6px 14px 4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Insert
          </div>
          {(
            [
              {
                type: "block" as const,
                label: "Block",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="11"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                ),
              },
              {
                type: "rounded" as const,
                label: "Area",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="11"
                      height="11"
                      rx="5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                ),
              },
              {
                type: "circle" as const,
                label: "Circle",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                ),
              },
              {
                type: "oval" as const,
                label: "Oval",
                icon: (
                  <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
                    <ellipse
                      cx="6.5"
                      cy="4.5"
                      rx="5.5"
                      ry="3.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                ),
              },
              {
                type: "diamond" as const,
                label: "Diamond",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <polygon
                      points="6.5,1 12,6.5 6.5,12 1,6.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      fill="none"
                    />
                  </svg>
                ),
              },
              {
                type: "text" as const,
                label: "Free Text",
                icon: (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <text
                      x="1"
                      y="11"
                      fontSize="11"
                      fill="currentColor"
                      fontFamily="serif"
                      fontWeight="bold"
                    >
                      T
                    </text>
                  </svg>
                ),
              },
            ] as const
          ).map(({ type, label, icon }) => (
            <div
              key={type}
              onClick={() => {
                addNode(contextMenu.cx, contextMenu.cy, type);
                setContextMenu(null);
              }}
              onMouseEnter={(e) => hoverMenu(e, true)}
              onMouseLeave={(e) => hoverMenu(e, false)}
              style={menuItem()}
            >
              <span
                style={{
                  width: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {icon}
              </span>
              {label}
            </div>
          ))}
          <div
            style={{
              height: "0.5px",
              background: "rgba(255,255,255,0.10)",
              margin: "2px 0",
            }}
          />
          <div
            onClick={() => handleImageInsert(contextMenu.cx, contextMenu.cy)}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={menuItem()}
          >
            <span
              style={{
                width: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="11"
                  height="11"
                  rx="2"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.3"
                />
                <circle
                  cx="4.5"
                  cy="4.5"
                  r="1.2"
                  fill="rgba(255,255,255,0.75)"
                />
                <path
                  d="M1 9l3-3 2.5 2.5L9 6l3 4"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Image
          </div>
          <div
            onClick={() => {
              setContextMenu(null);
              handleTextFileInsert(contextMenu.cx, contextMenu.cy);
            }}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={menuItem()}
          >
            <span
              style={{
                width: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                <path
                  d="M2 1h5l3 3v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.2"
                />
                <path
                  d="M7 1v3h3"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Text File
          </div>
        </div>
      )}

      {/* ── Color Picker ── */}
      {colorPicker && (
        <ColorPickerWindow
          picker={colorPicker}
          onColorChange={onPickerColorChange}
          onClose={() => setColorPicker(null)}
        />
      )}

      {/* ── Text Color Picker ── */}
      {textColorPicker && (
        <ColorPickerWindow
          picker={textColorPicker}
          onColorChange={onPickerTextColorChange}
          onClose={() => setTextColorPicker(null)}
        />
      )}

      {/* ── Text File Viewer ── */}
      {textFileViewer &&
        (() => {
          const tn = nodeMap.get(textFileViewer.nodeId);
          const spawnX = tn
            ? tn.x * zoom + pan.x + 20
            : window.innerWidth / 2 - 240;
          const spawnY = tn
            ? tn.y * zoom + pan.y - 40
            : window.innerHeight / 2 - 170;
          return (
            <TextFileViewerWindow
              viewer={{ ...textFileViewer, x: spawnX, y: spawnY }}
              onClose={() => setTextFileViewer(null)}
            />
          );
        })()}

      {/* ── Zoom controls ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "rgba(22,64,56,0.92)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "6px 10px",
          display: isPresenting ? "none" : "flex",
          gap: 8,
          alignItems: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          zIndex: 100,
        }}
      >
        <button
          onClick={() =>
            setZoom((z) => Math.max(0.2, parseFloat((z - 0.1).toFixed(2))))
          }
          style={{
            border: "none",
            background: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1,
          }}
        >
          −
        </button>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            minWidth: 38,
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setZoom((z) => Math.min(3, parseFloat((z + 0.1).toFixed(2))))
          }
          style={{
            border: "none",
            background: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1,
          }}
        >
          +
        </button>
        <div
          style={{
            width: "0.5px",
            height: 16,
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={{
            border: "none",
            background: "none",
            fontSize: 11,
            cursor: "pointer",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Reset
        </button>
      </div>

      {/* ── Hint ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(22,64,56,0.88)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "7px 16px",
          fontSize: 11.5,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          zIndex: 100,
          display: isPresenting ? "none" : undefined,
        }}
      >
        {connectDrag
          ? "Click any node to connect · Esc to cancel"
          : "Right-click → Shapes & Images · Click dot → select target to connect · Pinch / Ctrl+Scroll = Zoom"}
      </div>

      {/* ── Presentation viewport frame ── */}
      {isPresenting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 249,
            boxShadow:
              "inset 0 0 0 2px rgba(241,178,74,0.38), inset 0 0 28px rgba(157,200,141,0.07)",
            borderRadius: 0,
          }}
        />
      )}

      {/* ── Presentation entry overlay ── */}
      {showPresentOverlay && (
        <div
          className="present-overlay"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(160deg, #265048 0%, #143F38 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "0.5px solid rgba(157,200,141,0.18)",
            borderRadius: 18,
            boxShadow:
              "0 8px 40px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
            padding: "18px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            zIndex: 350,
            userSelect: "none",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: "-0.2px",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
            }}
          >
            Presentation mode
          </span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
            }}
          >
            ← → navigate &nbsp;·&nbsp;{" "}
            <span style={{ color: "#F1B24A" }}>Esc</span> to exit
          </span>
        </div>
      )}

      {/* ── Presentation HUD ── */}
      {isPresenting && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(12,32,24,0.82)",
            backdropFilter: "blur(12px)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "7px 18px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 11.5,
            color: "rgba(255,255,255,0.55)",
            zIndex: 300,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span style={{ color: "#F1B24A", fontWeight: 600 }}>
            {presentationIndex + 1} / {presentActiveSeq.length}
          </span>
          <span>← → navigate · Esc exit</span>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="toast"
          style={{
            position: "fixed",
            bottom: 28,
            left: 80,
            background:
              toast.variant === "success"
                ? "rgba(30,40,30,0.97)"
                : "rgba(40,22,22,0.97)",
            border:
              toast.variant === "success"
                ? "0.5px solid rgba(100,200,100,0.2)"
                : "0.5px solid rgba(255,100,100,0.2)",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 12.5,
            color: toast.variant === "success" ? "#86EFAC" : "#FCA5A5",
            boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
            zIndex: 500,
            display: "flex",
            alignItems: "center",
            gap: 7,
            pointerEvents: "none",
          }}
        >
          {toast.variant === "success" ? (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle
                cx="6.5"
                cy="6.5"
                r="6"
                stroke="#86EFAC"
                strokeWidth="1.2"
              />
              <path
                d="M3.5 6.5l2 2 4-4"
                stroke="#86EFAC"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle
                cx="6.5"
                cy="6.5"
                r="6"
                stroke="#FCA5A5"
                strokeWidth="1.2"
              />
              <path
                d="M6.5 4v3.5M6.5 9.2v.3"
                stroke="#FCA5A5"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

"use client";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import "./canvas.css";
import { ACCENT, LS_BOARD_NAME, DEFAULT_NODES, DEFAULT_CONNECTIONS } from "./lib/canvas-types";
import type {
  NodeType,
  CanvasNode,
  Connection,
  ConnectDrag,
  ContextMenu,
  ColorPicker,
  PanelSection,
  RichText,
} from "./lib/canvas-types";
import { richToPlain, richHasMarks, MAX_DOC_CHARS } from "./lib/rich-text";
import {
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
  getMaxNodeId,
} from "./lib/canvas-helpers";
import { sanitizeLoadedNode } from "./lib/dnkrm-file";
import { exportBoardPdf } from "./lib/pdf-export";
import { exportBoardMarkdown } from "./lib/md-export";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useBoardPersistence } from "./hooks/useBoardPersistence";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useForceLayout } from "./hooks/useForceLayout";
import { usePresentation } from "./hooks/usePresentation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ColorPickerWindow } from "./components/ColorPickerWindow";
import { NodeView } from "./components/NodeView";
import { ConnectionLine } from "./components/ConnectionLine";
import { SidebarStrip } from "./components/SidebarStrip";
import { SidebarPanel } from "./components/SidebarPanel";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { FilterBar } from "./components/FilterBar";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { ZoomControls } from "./components/ZoomControls";
import { PresentationOverlays } from "./components/PresentationOverlays";
import { Toast } from "./components/Toast";
import { FormatBar } from "./components/FormatBar";
import { DocEditorPanel } from "./components/DocEditorPanel";

// ── Main Canvas ───────────────────────────────────────────────────────────────
export default function Canvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>(DEFAULT_NODES);
  const [connections, setConnections] =
    useState<Connection[]>(DEFAULT_CONNECTIONS);
  const [selected, setSelected] = useState<number | null>(null);
  const [connectDrag, setConnectDrag] = useState<ConnectDrag>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [colorPicker, setColorPicker] = useState<ColorPicker>(null);
  const [textColorPicker, setTextColorPicker] = useState<ColorPicker>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [hoveredConnKey, setHoveredConnKey] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [activePanel, setActivePanel] = useState<PanelSection | null>(null);
  // Document editor panel: nodeId null = new, not-yet-saved document.
  // seq bumps on every open so the panel remounts (and re-reads the node)
  // per session, but not when a first save assigns the new node's id.
  const [docEditor, setDocEditor] = useState<{
    nodeId: number | null;
    seq: number;
  } | null>(null);
  const docEditorSeqRef = useRef(0);
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
  const [presentationOrder, setPresentationOrder] = useState<number[]>(() =>
    DEFAULT_NODES.map((n) => n.id),
  );
  const [toast, setToast] = useState<{
    msg: string;
    variant: "success" | "error";
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
  const pendingImagePos = useRef<{ cx: number; cy: number } | null>(null);
  const pendingTextFilePos = useRef<{ cx: number; cy: number } | null>(null);
  // Tracks which node is actively being edited so ref callbacks never clobber
  // in-progress input (more reliable than document.activeElement checks).
  const editingNodeIdRef = useRef<number | null>(null);
  const idCounterRef = useRef(3);
  const copiedNodeRef = useRef<CanvasNode | null>(null);
  const connectionsRef = useRef(connections);
  const nodesRef = useRef(nodes); // mirrors nodes state; kept current in the sync block below

  // ── rAF-based interaction refs ────────────────────────────────────────────────
  // Mirror latest state into refs so mouse handlers never capture stale closures
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const connectDragRef = useRef(connectDrag);
  const selectedRef = useRef(selected);
  const presentationOrderRef = useRef(presentationOrder);
  panRef.current = pan;
  zoomRef.current = zoom;
  connectDragRef.current = connectDrag;
  selectedIdsRef.current = selectedIds;
  copiedNodeRef.current = copiedNode;
  connectionsRef.current = connections;
  nodesRef.current = nodes;
  presentationOrderRef.current = presentationOrder;
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const needsHistoryPushRef = useRef(false);

  // ── Node lookup map (rebuilt only when nodes changes) ────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const nodeMapRef = useRef(nodeMap);
  nodeMapRef.current = nodeMap;

  // ── Presentation mode (state + animated camera) ──────────────────────────────
  const {
    isPresenting,
    setIsPresenting,
    presentationIndex,
    setPresentationIndex,
    showPresentOverlay,
    isPresentingRef,
    presentationIndexRef,
    prePresentStateRef,
    animRafRef,
    animCurrentRef,
    centerNodeForPresentation,
  } = usePresentation({ canvasRef, nodeMapRef, panRef, zoomRef, setPan, setZoom });

  // Nodes whose excludeFromPresentation is truthy are skipped from navigation
  const presentActiveSeq = useMemo(
    () =>
      presentationOrder.filter(
        (id) => !nodeMap.get(id)?.excludeFromPresentation,
      ),
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

  // ── Undo / Redo history ───────────────────────────────────────────────────────
  const { pushHistory, undo, redo } = useUndoRedo({
    nodesRef,
    connectionsRef,
    presentationOrderRef,
    setNodes,
    setConnections,
    setPresentationOrder,
  });

  // ── Wheel zoom/pan + global mouse pipeline (drag / resize / marquee) ─────────
  const {
    draggingRef,
    resizingRef,
    marqueeRef,
    multiDraggingRef,
    lastMousePosRef,
    lastInteractionMovedRef,
  } =
    useCanvasInteraction({
      canvasRef,
      panRef,
      zoomRef,
      nodeMapRef,
      needsHistoryPushRef,
      pushHistory,
      setPan,
      setZoom,
      setNodes,
      setSnapGuides,
      setMarqueeRect,
      setSelectedIds,
    });

  // ── Force-directed layout ──────────────────────────────────────────────────
  const runForceLayout = useForceLayout({
    nodeMapRef,
    connectionsRef,
    needsHistoryPushRef,
    setNodes,
  });

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
          pan,
          zoom,
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
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a short delay so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 100);
      setToast({ msg: "Board saved", variant: "success" });
    } catch {
      setToast({ msg: "Save failed", variant: "error" });
    }
  }, [nodes, connections, boardName, presentationOrder, pan, zoom]);

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

          // Validate and sanitize every node — reject fields that are missing,
          // wrong type, non-finite, or reference an unknown node type.
          const loadedNodes: CanvasNode[] = [];
          for (const raw of data.nodes as unknown[]) {
            const sanitized = sanitizeLoadedNode(raw);
            if (sanitized) loadedNodes.push(sanitized);
          }
          if (loadedNodes.length === 0 && (data.nodes as unknown[]).length > 0)
            throw new Error("bad format");

          // Validate and deduplicate connections — must reference known node IDs.
          const validNodeIds = new Set(loadedNodes.map((n) => n.id));
          const seenConns = new Set<string>();
          const loadedConns: Connection[] = [];
          for (const c of data.connections as unknown[]) {
            if (!c || typeof c !== "object") continue;
            const { from, to } = c as Record<string, unknown>;
            if (typeof from !== "number" || typeof to !== "number") continue;
            if (!validNodeIds.has(from) || !validNodeIds.has(to)) continue;
            const key = `${from}→${to}`;
            if (seenConns.has(key)) continue;
            seenConns.add(key);
            loadedConns.push({ from, to });
          }

          setNodes(loadedNodes);
          setConnections(loadedConns);
          setSelected(null);
          setSelectedIds(new Set());
          setColorPicker(null);
          setTextColorPicker(null);
          setHoveredId(null);
          setConnectDrag(null);
          setContextMenu(null);
          setSnapGuides({});
          const maxId = loadedNodes.reduce(
            (m: number, n: CanvasNode) => Math.max(m, n.id),
            -1,
          );
          if (maxId >= idCounterRef.current) idCounterRef.current = maxId + 1;
          if (typeof data.boardName === "string" && data.boardName.trim()) {
            const name = data.boardName.trim();
            setBoardName(name);
            localStorage.setItem(LS_BOARD_NAME, name);
          }
          if (Array.isArray(data.presentationOrder)) {
            const parsedSet = new Set<number>(
              data.presentationOrder as number[],
            );
            const missing = loadedNodes
              .filter((n) => !parsedSet.has(n.id))
              .sort((a, b) => a.id - b.id)
              .map((n) => n.id);
            setPresentationOrder([
              ...(data.presentationOrder as number[]).filter((id: number) =>
                validNodeIds.has(id),
              ),
              ...missing,
            ]);
          } else {
            setPresentationOrder(
              [...loadedNodes].sort((a, b) => a.id - b.id).map((n) => n.id),
            );
          }
          if (
            data.pan &&
            typeof data.pan.x === "number" &&
            typeof data.pan.y === "number"
          ) {
            setPan(data.pan as { x: number; y: number });
          } else {
            setPan({ x: 0, y: 0 });
          }
          if (typeof data.zoom === "number" && isFinite(data.zoom)) {
            setZoom(data.zoom as number);
          } else {
            setZoom(1);
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

    const newNode: CanvasNode = {
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
    };
    const newNodes = [...nodesRef.current, newNode];
    const newOrder = [...presentationOrderRef.current, newId];
    nodesRef.current = newNodes;
    presentationOrderRef.current = newOrder;
    pushHistory();
    setNodes(newNodes);
    setPresentationOrder(newOrder);
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
  }, [pushHistory]);

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
          const re = /^Image\s+(\d+)$/;
          let maxIdx = 0;
          for (const node of nodeMapRef.current.values()) {
            if (node.type === "image") {
              const m = (node.label ?? "").match(re);
              if (m) maxIdx = Math.max(maxIdx, parseInt(m[1], 10));
            }
          }
          const imgNode: CanvasNode = {
            id: newId, x: pos.cx - w / 2, y: pos.cy - h / 2, w, h,
            title: "", label: `Image ${maxIdx + 1}`, body: "",
            type: "image", color: "#1D5C50", imageUrl,
          };
          const newNodes = [...nodesRef.current, imgNode];
          const newOrder = [...presentationOrderRef.current, newId];
          nodesRef.current = newNodes;
          presentationOrderRef.current = newOrder;
          pushHistory();
          setNodes(newNodes);
          setPresentationOrder(newOrder);
          pendingImagePos.current = null;
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [pushHistory],
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
        const rawContent = ev.target?.result as string;
        if (rawContent == null) return;
        const textFileContent = rawContent.slice(0, MAX_DOC_CHARS);
        if (rawContent.length > MAX_DOC_CHARS) {
          setToast({
            msg: `File truncated to ${MAX_DOC_CHARS.toLocaleString("en-US")} characters`,
            variant: "error",
          });
        }
        const w = 200;
        const h = 60;
        const maxExistingId = getMaxNodeId(nodeMapRef.current);
        if (idCounterRef.current <= maxExistingId)
          idCounterRef.current = maxExistingId + 1;
        const newId = idCounterRef.current;
        idCounterRef.current += 1;
        const tfNode: CanvasNode = {
          id: newId, x: pos.cx - w / 2, y: pos.cy - h / 2, w, h,
          title: "", label: fileName, body: "",
          type: "textfile", color: "#1D5C50", fontSize: 13,
          textFileContent, textFileName: fileName,
        };
        const newNodes = [...nodesRef.current, tfNode];
        const newOrder = [...presentationOrderRef.current, newId];
        nodesRef.current = newNodes;
        presentationOrderRef.current = newOrder;
        pushHistory();
        setNodes(newNodes);
        setPresentationOrder(newOrder);
        pendingTextFilePos.current = null;
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [pushHistory],
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

  // ── localStorage + IndexedDB persistence ─────────────────────────────────────
  const hydrated = useBoardPersistence({
    nodes,
    connections,
    boardName,
    presentationOrder,
    pan,
    zoom,
    idCounterRef,
    setNodes,
    setConnections,
    setBoardName,
    setPresentationOrder,
    setPan,
    setZoom,
  });

  // Push initial history snapshot once after the board has hydrated
  useEffect(() => {
    if (hydrated) pushHistory();
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push one history snapshot after drag/resize/layout completes (flag set in mouseUp/layout)
  useEffect(() => {
    if (needsHistoryPushRef.current) {
      needsHistoryPushRef.current = false;
      pushHistory();
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context menus ─────────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPresentingRef.current) return;
    setSelected(id);
    setContextMenu({ kind: "node", x: e.clientX, y: e.clientY, id });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== canvasRef.current && !t.dataset.bg) return;
    e.preventDefault();
    if (isPresentingRef.current) return;
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
    const cy = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
    setContextMenu({ kind: "canvas", x: e.clientX, y: e.clientY, cx, cy });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      marqueeRef.current = { startX: cx, startY: cy, x: cx, y: cy, w: 0, h: 0 };
      setSelected(null);
      setSelectedIds(new Set());
    },
    [contextMenu], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startNodeDrag = useCallback((e: React.MouseEvent, id: number) => {
    setContextMenu(null);
    setSelected(id);
    setSelectedIds(new Set());
    const n = nodeMapRef.current.get(id);
    if (!n || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
    const my = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
    draggingRef.current = { id, ox: mx - n.x, oy: my - n.y };
    e.preventDefault();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      multiDraggingRef.current = {
        startMouseX: mx,
        startMouseY: my,
        startPositions,
      };
      e.preventDefault();
    } else {
      startNodeDrag(e, id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onResizeMouseDown = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    const n = nodeMapRef.current.get(id);
    if (!n) return;
    resizingRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: n.w,
      startH: n.h,
      constrain: n.type === "circle",
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const newConns = connectionsRef.current.filter(
      (x) => !(x.from === from && x.to === to),
    );
    connectionsRef.current = newConns;
    pushHistory();
    setConnections(newConns);
  }, [pushHistory]);

  // Finalizes a pending connection on click (fires after mouseup, so
  // connectDragRef is guaranteed to hold the latest state).
  const onNodeClick = useCallback((e: React.MouseEvent, id: number) => {
    const cd = connectDragRef.current;
    if (!cd) return;
    e.stopPropagation();
    if (id !== cd.fromId) {
      const dup = connectionsRef.current.some(
        (c) => c.from === cd.fromId && c.to === id,
      );
      if (!dup) {
        const newConns = [
          ...connectionsRef.current,
          { from: cd.fromId, to: id },
        ];
        connectionsRef.current = newConns;
        pushHistory();
        setConnections(newConns);
      }
    }
    setConnectDrag(null);
  }, [pushHistory]);

  useEffect(() => {
    if (filterOpen) setTimeout(() => filterInputRef.current?.focus(), 50);
  }, [filterOpen]);

  useEffect(() => {
    setFilterJumpIndex(0);
  }, [filterText, filterType]);

  const arrangeBringToFront = useCallback((id: number) => {
    const newNodes = bringToFront(nodesRef.current, id);
    nodesRef.current = newNodes;
    pushHistory();
    setNodes(newNodes);
  }, [pushHistory]);
  const arrangeBringForward = useCallback((id: number) => {
    const newNodes = bringForward(nodesRef.current, id);
    nodesRef.current = newNodes;
    pushHistory();
    setNodes(newNodes);
  }, [pushHistory]);
  const arrangeSendBackward = useCallback((id: number) => {
    const newNodes = sendBackward(nodesRef.current, id);
    nodesRef.current = newNodes;
    pushHistory();
    setNodes(newNodes);
  }, [pushHistory]);
  const arrangeSendToBack = useCallback((id: number) => {
    const newNodes = sendToBack(nodesRef.current, id);
    nodesRef.current = newNodes;
    pushHistory();
    setNodes(newNodes);
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (selectedIdsRef.current.size > 0) {
      const ids = selectedIdsRef.current;
      const newNodes = nodesRef.current.filter((n) => !ids.has(n.id));
      const newConns = connectionsRef.current.filter(
        (c) => !ids.has(c.from) && !ids.has(c.to),
      );
      const newOrder = presentationOrderRef.current.filter((id) => !ids.has(id));
      nodesRef.current = newNodes;
      connectionsRef.current = newConns;
      presentationOrderRef.current = newOrder;
      pushHistory();
      setNodes(newNodes);
      setConnections(newConns);
      setPresentationOrder(newOrder);
      setSelectedIds(new Set());
      setSelected(null);
    } else {
      const id = selectedRef.current;
      if (id === null) return;
      const newNodes = nodesRef.current.filter((n) => n.id !== id);
      const newConns = connectionsRef.current.filter(
        (c) => c.from !== id && c.to !== id,
      );
      const newOrder = presentationOrderRef.current.filter((p) => p !== id);
      nodesRef.current = newNodes;
      connectionsRef.current = newConns;
      presentationOrderRef.current = newOrder;
      pushHistory();
      setNodes(newNodes);
      setConnections(newConns);
      setPresentationOrder(newOrder);
      setSelected(null);
    }
  }, [pushHistory]);

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
    const pastedNode = { ...node, id: newId, x: tx, y: ty };
    const newNodes = [...nodesRef.current, pastedNode];
    const newOrder = [...presentationOrderRef.current, newId];
    nodesRef.current = newNodes;
    presentationOrderRef.current = newOrder;
    pushHistory();
    setNodes(newNodes);
    setPresentationOrder(newOrder);
    setSelected(newId);
    setContextMenu(null);
  }, [pushHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const movePresentationNodeUp = useCallback((id: number) => {
    const prev = presentationOrderRef.current;
    const idx = prev.indexOf(id);
    if (idx <= 0) return;
    const next = [...prev];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    presentationOrderRef.current = next;
    pushHistory();
    setPresentationOrder(next);
  }, [pushHistory]);

  const movePresentationNodeDown = useCallback((id: number) => {
    const prev = presentationOrderRef.current;
    const idx = prev.indexOf(id);
    if (idx === -1 || idx === prev.length - 1) return;
    const next = [...prev];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    presentationOrderRef.current = next;
    pushHistory();
    setPresentationOrder(next);
  }, [pushHistory]);

  // Commits an edited field: runs are the source of truth, the plain string
  // mirror is derived, and rich storage is dropped when no marks remain.
  const commitNodeText = useCallback(
    (id: number, field: "title" | "body", rich: RichText) => {
      const plain = richToPlain(rich);
      const richKey = field === "title" ? "titleRich" : "bodyRich";
      const keepRich = richHasMarks(rich) ? rich : undefined;
      const oldNode = nodesRef.current.find((n) => n.id === id);
      const oldPlain = oldNode?.[field] ?? "";
      const changed =
        plain !== oldPlain ||
        JSON.stringify(keepRich) !== JSON.stringify(oldNode?.[richKey]);
      const newNodes = nodesRef.current.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, [field]: plain };
        if (keepRich) next[richKey] = keepRich;
        else delete next[richKey];
        return next;
      });
      nodesRef.current = newNodes;
      if (changed) pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

  const updateNodeLabel = useCallback((id: number, label: string) => {
    const old = nodesRef.current.find((n) => n.id === id)?.label ?? "";
    const newNodes = nodesRef.current.map((n) => (n.id === id ? { ...n, label } : n));
    nodesRef.current = newNodes;
    if (label !== old) pushHistory();
    setNodes(newNodes);
  }, [pushHistory]);

  const updateFontSize = useCallback((id: number, size: number) => {
    const newNodes = nodesRef.current.map((n) =>
      n.id === id ? { ...n, fontSize: size } : n,
    );
    nodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  const updateNodeFormat = useCallback(
    (id: number, field: "bold" | "italic" | "underline", value: boolean) => {
      const newNodes = nodesRef.current.map((n) =>
        n.id === id ? { ...n, [field]: value } : n,
      );
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

  const toggleExcludeFromPresentation = useCallback(
    (id: number, toExclude: boolean) => {
      const ids =
        selectedIdsRef.current.size > 0 && selectedIdsRef.current.has(id)
          ? selectedIdsRef.current
          : new Set([id]);
      const newNodes = nodesRef.current.map((n) =>
        ids.has(n.id) ? { ...n, excludeFromPresentation: toExclude } : n,
      );
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
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

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  useKeyboardShortcuts({
    filterOpenRef,
    filterActiveRef,
    filterJumpIndexRef,
    matchedNodesSortedRef,
    setFilterOpen,
    setFilterText,
    setFilterType,
    setFilterJumpIndex,
    focusNode,
    selectedRef,
    selectedIdsRef,
    deleteSelected,
    copySelected,
    pasteNode,
    isPresentingRef,
    presentationIndexRef,
    presentActiveSeqRef,
    prePresentStateRef,
    animRafRef,
    animCurrentRef,
    setIsPresenting,
    setPresentationIndex,
    centerNodeForPresentation,
    setPan,
    setZoom,
    editingNodeIdRef,
    setConnectDrag,
    setContextMenu,
    setColorPicker,
    setTextColorPicker,
    saveBoardRef,
    undo,
    redo,
    pushHistory,
    nodeMapRef,
    idCounterRef,
    nodesRef,
    connectionsRef,
    presentationOrderRef,
    setNodes,
    setConnections,
    setPresentationOrder,
    setSelected,
  });

  // ── Vector PDF export (jsPDF direct) ────────────────────────────────────────
  const exportPdfVector = useCallback(async () => {
    await exportBoardPdf(nodes, connections, boardName);
  }, [nodes, connections, boardName]);

  // ── Markdown export ─────────────────────────────────────────────────────────
  const exportMarkdown = useCallback(() => {
    exportBoardMarkdown(nodes, connections, presentationOrder, boardName);
  }, [nodes, connections, presentationOrder, boardName]);

  // ── Document editor ─────────────────────────────────────────────────────────
  const openDocument = useCallback((nodeId: number) => {
    // A click also fires at the tail end of a node drag — only open for
    // stationary clicks.
    if (lastInteractionMovedRef.current) return;
    docEditorSeqRef.current += 1;
    setDocEditor({ nodeId, seq: docEditorSeqRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewDocument = useCallback(() => {
    docEditorSeqRef.current += 1;
    setDocEditor({ nodeId: null, seq: docEditorSeqRef.current });
  }, []);

  // Commits the panel's content to board state. For a new document the node
  // is created centered in the viewport on first save.
  const saveDocument = (title: string, rich: RichText) => {
    if (!docEditor) return;
    const plain = richToPlain(rich);
    const keepRich = richHasMarks(rich) ? rich : undefined;
    const cleanTitle = title.trim();
    if (docEditor.nodeId === null) {
      if (cleanTitle === "" && plain.trim() === "") return; // nothing to save
      const r = canvasRef.current?.getBoundingClientRect();
      const cx = r ? (r.width / 2 - panRef.current.x) / zoomRef.current : 0;
      const cy = r ? (r.height / 2 - panRef.current.y) / zoomRef.current : 0;
      const maxExistingId = getMaxNodeId(nodeMapRef.current);
      if (idCounterRef.current <= maxExistingId)
        idCounterRef.current = maxExistingId + 1;
      const newId = idCounterRef.current;
      idCounterRef.current += 1;
      const w = 240;
      const h = 140;
      const docNode: CanvasNode = {
        id: newId, x: cx - w / 2, y: cy - h / 2, w, h,
        title: cleanTitle, label: cleanTitle || "Document", body: "",
        type: "textfile", color: "#1D5C50", fontSize: 13,
        textFileContent: plain,
        ...(keepRich && { docRich: keepRich }),
      };
      const newNodes = [...nodesRef.current, docNode];
      const newOrder = [...presentationOrderRef.current, newId];
      nodesRef.current = newNodes;
      presentationOrderRef.current = newOrder;
      pushHistory();
      setNodes(newNodes);
      setPresentationOrder(newOrder);
      setSelected(newId);
      setDocEditor((prev) =>
        prev ? { nodeId: newId, seq: prev.seq } : prev,
      );
      setToast({ msg: "Document saved", variant: "success" });
      return;
    }
    const id = docEditor.nodeId;
    const old = nodesRef.current.find((n) => n.id === id);
    if (!old) return;
    const changed =
      old.title !== cleanTitle ||
      (old.textFileContent ?? "") !== plain ||
      JSON.stringify(old.docRich) !== JSON.stringify(keepRich);
    if (!changed) return;
    const newNodes = nodesRef.current.map((n) => {
      if (n.id !== id) return n;
      const next = { ...n, title: cleanTitle, textFileContent: plain };
      if (keepRich) next.docRich = keepRich;
      else delete next.docRich;
      return next;
    });
    nodesRef.current = newNodes;
    pushHistory();
    setNodes(newNodes);
    setToast({ msg: "Document saved", variant: "success" });
  };

  // Close the panel when its node disappears (deleted, undone, board loaded).
  useEffect(() => {
    if (docEditor?.nodeId != null && !nodeMap.has(docEditor.nodeId)) {
      // Derived-at-render hiding would resurface the panel if a later node
      // reuses the id — clearing state here is the correct semantics.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocEditor(null);
    }
  }, [nodeMap, docEditor]);

  const startPresentation = () => {
    if (presentActiveSeq.length === 0) return;
    prePresentStateRef.current = {
      pan: panRef.current,
      zoom: zoomRef.current,
    };
    setPresentationIndex(0);
    setIsPresenting(true);
    setActivePanel(null);
    setDocEditor(null);
    setContextMenu(null);
    setColorPicker(null);
    setTextColorPicker(null);
    centerNodeForPresentation(presentActiveSeq[0]);
  };

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

      <SidebarStrip
        isPresenting={isPresenting}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
      />

      <SidebarPanel
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        isPresenting={isPresenting}
        boardName={boardName}
        setBoardName={setBoardName}
        editingBoardName={editingBoardName}
        setEditingBoardName={setEditingBoardName}
        nodes={nodes}
        selected={selected}
        editingSidebarNodeId={editingSidebarNodeId}
        setEditingSidebarNodeId={setEditingSidebarNodeId}
        focusNode={focusNode}
        updateNodeLabel={updateNodeLabel}
        presentationOrder={presentationOrder}
        nodeMap={nodeMap}
        presentActiveSeqLength={presentActiveSeq.length}
        toggleExcludeFromPresentation={toggleExcludeFromPresentation}
        movePresentationNodeUp={movePresentationNodeUp}
        movePresentationNodeDown={movePresentationNodeDown}
        onPresent={startPresentation}
        saveBoard={saveBoard}
        onLoadBoardClick={() => denkraumFileInputRef.current?.click()}
      />

      <CanvasToolbar
        panelOpen={panelOpen}
        isPresenting={isPresenting}
        canvasRef={canvasRef}
        panRef={panRef}
        zoomRef={zoomRef}
        activeShapeType={activeShapeType}
        setActiveShapeType={setActiveShapeType}
        addNode={addNode}
        handleImageInsert={handleImageInsert}
        handleTextFileInsert={handleTextFileInsert}
        onNewDocument={openNewDocument}
        exportPdfVector={exportPdfVector}
        exportMarkdown={exportMarkdown}
        runForceLayout={runForceLayout}
        nodeCount={nodes.length}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
      />

      {/* ── Filter Bar ── */}
      {filterOpen && (
        <FilterBar
          filterInputRef={filterInputRef}
          filterText={filterText}
          setFilterText={setFilterText}
          filterType={filterType}
          setFilterType={setFilterType}
          setFilterOpen={setFilterOpen}
          filterActive={filterActive}
          matchCount={matchedNodeIds.size}
          nodeCount={nodes.length}
        />
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
              onOpenDocument={openDocument}
              setHoveredId={setHoveredId}
              commitNodeText={commitNodeText}
              startNodeDrag={startNodeDrag}
              onDotClick={onDotClick}
              onResizeMouseDown={onResizeMouseDown}
              dimmed={filterActive && !matchedNodeIds.has(n.id)}
              isMultiSelected={selectedIds.has(n.id)}
              zoom={zoom}
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
          return (
            <NodeContextMenu
              menu={contextMenu}
              node={n}
              copySelected={copySelected}
              updateFontSize={updateFontSize}
              pushHistory={pushHistory}
              updateNodeFormat={updateNodeFormat}
              openColorPicker={openColorPicker}
              openTextColorPicker={openTextColorPicker}
              arrangeBringToFront={arrangeBringToFront}
              arrangeBringForward={arrangeBringForward}
              arrangeSendBackward={arrangeSendBackward}
              arrangeSendToBack={arrangeSendToBack}
              toggleExcludeFromPresentation={toggleExcludeFromPresentation}
              deleteSelected={deleteSelected}
              onClose={() => setContextMenu(null)}
            />
          );
        })()}

      {/* ── Canvas Context Menu ── */}
      {contextMenu?.kind === "canvas" && (
        <CanvasContextMenu
          menu={contextMenu}
          hasCopiedNode={!!copiedNode}
          pasteNode={pasteNode}
          addNode={addNode}
          handleImageInsert={handleImageInsert}
          handleTextFileInsert={handleTextFileInsert}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Color Picker ── */}
      {colorPicker && (
        <ColorPickerWindow
          picker={colorPicker}
          onColorChange={onPickerColorChange}
          onClose={() => { pushHistory(); setColorPicker(null); }}
        />
      )}

      {/* ── Text Color Picker ── */}
      {textColorPicker && (
        <ColorPickerWindow
          picker={textColorPicker}
          onColorChange={onPickerTextColorChange}
          onClose={() => { pushHistory(); setTextColorPicker(null); }}
        />
      )}

      {/* ── Document Editor ── */}
      {docEditor && !isPresenting && (
        <DocEditorPanel
          key={docEditor.seq}
          node={
            docEditor.nodeId !== null
              ? (nodeMap.get(docEditor.nodeId) ?? null)
              : null
          }
          onSave={saveDocument}
          onClose={() => setDocEditor(null)}
        />
      )}

      <ZoomControls
        zoom={zoom}
        setZoom={setZoom}
        setPan={setPan}
        isPresenting={isPresenting}
      />

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

      <PresentationOverlays
        isPresenting={isPresenting}
        showPresentOverlay={showPresentOverlay}
        presentationIndex={presentationIndex}
        presentActiveCount={presentActiveSeq.length}
      />

      <Toast toast={toast} />

      {/* ── Inline formatting bar (shows above text selections in nodes) ── */}
      <FormatBar />

      {/* ── Mobile fallback ── */}
      <div className="mobile-fallback">
        <span style={{ color: "#F1B24A", fontSize: 22, fontWeight: 700, letterSpacing: "0.12em" }}>DNKRM</span>
        <div style={{ width: 32, height: 2, background: "#F1B24A", borderRadius: 1, margin: "20px 0 24px" }} />
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, lineHeight: 1.6, textAlign: "center", maxWidth: 280, margin: 0 }}>
          DNKRM is built for desktop.<br />Open it on your computer for the full experience.
        </p>
      </div>
    </div>
  );
}

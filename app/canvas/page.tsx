"use client";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  Profiler,
} from "react";
import "./canvas.css";
import {
  ACCENT,
  LS_BOARD_NAME,
  LS_AI_WORKSPACE,
  LS_CANVAS_BG,
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
  PanelSection,
  CanvasBg,
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
import { normalizeUrl, faviconUrl, fetchLinkTitle } from "./lib/link-preview";
import { useApiKey } from "./lib/ai-key";
import {
  layoutGraph,
  expandNode,
  generateGraph,
  summarizeBoard,
  type GeneratedGraph,
  type ExpandContext,
  type SummaryItem,
} from "./lib/ai-generate";
import { fitGeneratedHeights } from "./lib/node-measure";
import { tokens } from "./lib/design-tokens";
import {
  buildPresentationSteps,
  flattenSteps,
  activeStepIds,
  clusterContiguous,
  normalizePresentation,
  newGroupId,
} from "./lib/presentation";
import { DEBUG_CAMERA, perfCommit } from "./lib/camera-perf";
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
import { FloatingSidebar } from "./components/FloatingSidebar";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { AiGenerateModal } from "./components/AiGenerateModal";
import type { AiCharacterState } from "./components/AiCharacter";
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

  // Canvas background style (Blank / Grid / Atmospheric). Grid is the default;
  // hydrated from localStorage after mount to avoid an SSR mismatch.
  const [canvasBg, setCanvasBg] = useState<CanvasBg>("grid");
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_CANVAS_BG);
      if (v === "blank" || v === "grid" || v === "atmospheric") setCanvasBg(v);
    } catch {}
  }, []);
  const changeCanvasBg = useCallback((v: CanvasBg) => {
    setCanvasBg(v);
    try {
      localStorage.setItem(LS_CANVAS_BG, v);
    } catch {}
  }, []);
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

  // AI: key presence gates the Generate button; the modal drives prompt→graph.
  const { hasKey: aiHasKey, apiKey: aiApiKey } = useApiKey();
  const [generateOpen, setGenerateOpen] = useState(false);
  // Assistant character state, shared by the toolbar button + the modal.
  const [aiState, setAiState] = useState<AiCharacterState>("idle");
  // Guards against overlapping AI operations (e.g. a double-triggered Expand).
  const aiBusyRef = useRef(false);
  // "done" / "error" are momentary — settle back to "idle" shortly after.
  useEffect(() => {
    if (aiState !== "done" && aiState !== "error") return;
    const t = setTimeout(() => setAiState("idle"), 1200);
    return () => clearTimeout(t);
  }, [aiState]);

  // AI workspace marker — a world coordinate where AI output lands. Persisted
  // on its own localStorage key, kept entirely out of board state / .dnkrm.
  const [aiWorkspace, setAiWorkspace] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const aiWorkspaceRef = useRef(aiWorkspace);
  aiWorkspaceRef.current = aiWorkspace;
  // Placement mode: while active the next canvas click drops the marker.
  const [placingWorkspace, setPlacingWorkspace] = useState(false);
  const placingWorkspaceRef = useRef(placingWorkspace);
  placingWorkspaceRef.current = placingWorkspace;

  // Hydrate the marker from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_AI_WORKSPACE);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.x === "number" && typeof p?.y === "number")
        setAiWorkspace({ x: p.x, y: p.y });
    } catch {
      /* ignore malformed marker */
    }
  }, []);

  // Persist (or clear) the marker whenever it changes.
  useEffect(() => {
    try {
      if (aiWorkspace)
        localStorage.setItem(LS_AI_WORKSPACE, JSON.stringify(aiWorkspace));
      else localStorage.removeItem(LS_AI_WORKSPACE);
    } catch {
      /* storage unavailable */
    }
  }, [aiWorkspace]);

  const assignWorkspace = useCallback(() => setPlacingWorkspace(true), []);
  const clearWorkspace = useCallback(() => {
    setAiWorkspace(null);
    setPlacingWorkspace(false);
  }, []);

  // Escape cancels an active placement (without clearing an existing marker).
  useEffect(() => {
    if (!placingWorkspace) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacingWorkspace(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placingWorkspace]);

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
  const boardNameRef = useRef(boardName);
  boardNameRef.current = boardName;

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
  // Built with a direct loop instead of `new Map(nodes.map(...))` so a drag
  // frame doesn't also allocate N throwaway [id, node] tuple arrays.
  const nodeMap = useMemo(() => {
    const m = new Map<number, CanvasNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);
  const nodeMapRef = useRef(nodeMap);
  nodeMapRef.current = nodeMap;

  // ── Presentation mode (state + animated camera) ──────────────────────────────
  const {
    isPresenting,
    setIsPresenting,
    presentationIndex,
    setPresentationIndex,
    showPresentOverlay,
    cameraAnimating,
    isPresentingRef,
    presentationIndexRef,
    prePresentStateRef,
    animRafRef,
    animCurrentRef,
    centerNodesForPresentation,
  } = usePresentation({
    canvasRef,
    nodeMapRef,
    panRef,
    zoomRef,
    setPan,
    setZoom,
  });

  // Story Path steps: each node is its own step unless it shares a
  // presentationGroupId with its neighbours, in which case the contiguous run
  // collapses into one group step. Drives both the sidebar list and navigation.
  const presentSteps = useMemo(
    () => buildPresentationSteps(presentationOrder, nodeMap),
    [presentationOrder, nodeMap],
  );
  // Navigation sequence: one entry per non-empty step, holding the node ids the
  // camera fits for that step (one for a node, several for a group). Excluded
  // members are dropped; fully-excluded steps disappear.
  const presentActiveSeq = useMemo(
    () => activeStepIds(presentSteps, nodeMap),
    [presentSteps, nodeMap],
  );
  const presentActiveSeqRef = useRef(presentActiveSeq);
  presentActiveSeqRef.current = presentActiveSeq;

  // The node ids in the currently spotlighted step. They are lifted out of the
  // (blurred + dimmed) world into a sharp top layer, so the spotlight backdrop
  // never touches the active step. null when not presenting.
  const focusedIds = useMemo(() => {
    if (!isPresenting || presentActiveSeq.length === 0) return null;
    const step =
      presentActiveSeq[
        Math.min(presentationIndex, presentActiveSeq.length - 1)
      ];
    return new Set(step);
  }, [isPresenting, presentActiveSeq, presentationIndex]);
  const focusedNodes = useMemo(
    () =>
      focusedIds
        ? [...focusedIds]
            .map((id) => nodeMap.get(id))
            .filter((n): n is CanvasNode => !!n)
        : [],
    [focusedIds, nodeMap],
  );

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
        (n.label ?? "").toLowerCase().includes(q) ||
        (n.linkUrl ?? "").toLowerCase().includes(q) ||
        (n.checklistItems ?? []).some((it) =>
          it.text.toLowerCase().includes(q),
        );
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
  } = useCanvasInteraction({
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
      // Read live values from refs so this callback stays referentially stable
      // (it's passed to the memoized sidebar and bound to a keyboard shortcut).
      const boardName = boardNameRef.current;
      const payload = JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          boardName,
          pan: panRef.current,
          zoom: zoomRef.current,
          nodes: nodesRef.current,
          connections: connectionsRef.current,
          presentationOrder: presentationOrderRef.current,
        },
        null,
        2,
      );
      const slug =
        boardName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 40) || "untitled-board";
      const date = new Date().toISOString().slice(0, 10);
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
  }, []);

  saveBoardRef.current = saveBoard;

  const onLoadBoardClick = useCallback(
    () => denkraumFileInputRef.current?.click(),
    [],
  );

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
          let rawOrder: number[];
          if (Array.isArray(data.presentationOrder)) {
            const parsedSet = new Set<number>(
              data.presentationOrder as number[],
            );
            const missing = loadedNodes
              .filter((n) => !parsedSet.has(n.id))
              .sort((a, b) => a.id - b.id)
              .map((n) => n.id);
            rawOrder = [
              ...(data.presentationOrder as number[]).filter((id: number) =>
                validNodeIds.has(id),
              ),
              ...missing,
            ];
          } else {
            rawOrder = [...loadedNodes]
              .sort((a, b) => a.id - b.id)
              .map((n) => n.id);
          }
          // Drop singleton/empty groups and restore member contiguity before
          // committing the loaded board to state.
          const norm = normalizePresentation(rawOrder, loadedNodes);
          setNodes(norm.nodes);
          setPresentationOrder(norm.order);
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

  const addNode = useCallback(
    (cx: number, cy: number, type: NodeType) => {
      const isText = type === "text";
      // Default insert size per shape; block/rounded/etc. fall back to 200×80.
      const DEFAULT_SIZE: Partial<Record<NodeType, { w: number; h: number }>> =
        {
          text: { w: 160, h: 40 },
          circle: { w: 100, h: 100 },
          oval: { w: 160, h: 100 },
          diamond: { w: 130, h: 100 },
          triangle: { w: 130, h: 110 },
          star: { w: 120, h: 120 },
          arrow: { w: 170, h: 90 },
          parallelogram: { w: 160, h: 90 },
          sticky: { w: 150, h: 150 },
          checklist: { w: 220, h: 170 },
          link: { w: 240, h: 100 },
        };
      const { w, h } = DEFAULT_SIZE[type] ?? { w: 200, h: 80 };
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
        triangle: "Triangle",
        star: "Star",
        arrow: "Arrow",
        parallelogram: "Parallelogram",
        sticky: "Sticky Note",
        checklist: "Checklist",
        link: "Link",
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
        color: isText ? "transparent" : tokens.color.surface,
        fontSize: isText ? 15 : 13,
        // Seed a checklist with a few empty rows so it reads as a list on
        // insert; the node opens straight into edit mode (below).
        ...(type === "checklist" && {
          checklistItems: [
            { id: 1, text: "", checked: false },
            { id: 2, text: "", checked: false },
            { id: 3, text: "", checked: false },
          ],
        }),
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
      if (isText || type === "checklist" || type === "link") {
        editingNodeIdRef.current = newId;
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-node-id="${newId}"] [contenteditable]`,
          );
          el?.focus();
        }, 50);
      }
    },
    [pushHistory],
  );

  // Append AI-built nodes + connections as ONE undo snapshot, select them, and
  // pan to centre `center`. Shared by Generate and Expand.
  const commitNewGraph = useCallback(
    (
      newNodes: CanvasNode[],
      newConns: Connection[],
      center: { cx: number; cy: number },
    ) => {
      const newIds = newNodes.map((n) => n.id);
      const allNodes = [...nodesRef.current, ...newNodes];
      const allConns = [...connectionsRef.current, ...newConns];
      const allOrder = [...presentationOrderRef.current, ...newIds];
      nodesRef.current = allNodes;
      connectionsRef.current = allConns;
      presentationOrderRef.current = allOrder;
      pushHistory();
      setNodes(allNodes);
      setConnections(allConns);
      setPresentationOrder(allOrder);
      setSelected(null);
      setSelectedIds(new Set(newIds));

      const r = canvasRef.current?.getBoundingClientRect();
      if (r) {
        const z = zoomRef.current;
        setPan({
          x: r.width / 2 - center.cx * z,
          y: r.height / 2 - center.cy * z,
        });
      }
    },
    [pushHistory],
  );

  // Place an AI-generated graph: lay it out, drop it to the right of existing
  // content (or at the viewport centre on an empty board), commit as ONE undo
  // snapshot, select the new nodes, and pan to reveal them. Generated nodes are
  // plain CanvasNodes — no AI marking.
  const addGeneratedGraph = useCallback(
    (graph: GeneratedGraph) => {
      if (graph.nodes.length === 0) return;
      // Grow card nodes to fit their text before layout, so spacing accounts for
      // the real heights (no overlap) and nothing clips.
      fitGeneratedHeights(graph.nodes);
      const local = layoutGraph(graph.nodes, graph.connections);

      // Cluster bounding box (layout coordinates start near 0,0).
      let clusterW = 0;
      let clusterH = 0;
      for (const gn of graph.nodes) {
        const p = local.get(gn.id);
        if (!p) continue;
        clusterW = Math.max(clusterW, p.x + gn.width);
        clusterH = Math.max(clusterH, p.y + gn.height);
      }

      // Placement origin: the AI workspace marker if set, otherwise right of all
      // existing content, else viewport centre.
      const existing = nodesRef.current;
      const marker = aiWorkspaceRef.current;
      let originX: number;
      let originY: number;
      if (marker) {
        originX = marker.x;
        originY = marker.y;
      } else if (existing.length > 0) {
        let maxX = -Infinity;
        let minY = Infinity;
        for (const n of existing) {
          if (n.x + n.w > maxX) maxX = n.x + n.w;
          if (n.y < minY) minY = n.y;
        }
        originX = maxX + 120;
        originY = minY;
      } else {
        const r = canvasRef.current?.getBoundingClientRect();
        const z = zoomRef.current;
        const p = panRef.current;
        const cx = r ? (r.width / 2 - p.x) / z : 0;
        const cy = r ? (r.height / 2 - p.y) / z : 0;
        originX = cx - clusterW / 2;
        originY = cy - clusterH / 2;
      }

      // Fresh ids ahead of every existing node id.
      const maxExistingId = getMaxNodeId(nodeMapRef.current);
      if (idCounterRef.current <= maxExistingId)
        idCounterRef.current = maxExistingId + 1;
      const idMap = new Map<string, number>();
      const newNodes: CanvasNode[] = graph.nodes.map((gn) => {
        const id = idCounterRef.current;
        idCounterRef.current += 1;
        idMap.set(gn.id, id);
        const p = local.get(gn.id) ?? { x: 0, y: 0 };
        const isText = gn.type === "text";
        return {
          id,
          x: originX + p.x,
          y: originY + p.y,
          w: gn.width,
          h: gn.height,
          title: gn.title,
          body: gn.body,
          type: gn.type,
          // AI-assigned card fill (text nodes have no card) + size hierarchy.
          color: isText ? "transparent" : gn.color,
          fontSize: gn.fontSize,
        };
      });
      const newConns: Connection[] = [];
      for (const c of graph.connections) {
        const from = idMap.get(c.from);
        const to = idMap.get(c.to);
        if (from !== undefined && to !== undefined) newConns.push({ from, to });
      }

      commitNewGraph(newNodes, newConns, {
        cx: originX + clusterW / 2,
        cy: originY + clusterH / 2,
      });
    },
    [commitNewGraph],
  );

  // Generate a node graph from a prompt. Runs in the background: the modal
  // closes the moment the user submits, the canvas stays interactive, and
  // aiState drives the assistant character while the call is in flight. Success
  // and failure both surface as a toast.
  const generateFromPrompt = useCallback(
    async (prompt: string) => {
      if (!aiHasKey || aiBusyRef.current) return;
      aiBusyRef.current = true;
      setAiState("thinking");
      const r = await generateGraph(prompt, aiApiKey);
      aiBusyRef.current = false;
      if (!r.ok) {
        setAiState("error");
        setToast({ msg: `AI: ${r.message}`, variant: "error" });
        return;
      }
      setAiState("done");
      addGeneratedGraph(r.graph);
      const n = r.graph.nodes.length;
      setToast({
        msg: `Generated ${n} node${n === 1 ? "" : "s"}`,
        variant: "success",
      });
    },
    [aiHasKey, aiApiKey, addGeneratedGraph],
  );

  // Expand a selected node into AI-generated child nodes branching off it. The
  // children fan out to the right of the node (sliding clear of any existing
  // node), connect back to it, and commit as one undo snapshot. Errors surface
  // as a toast (Expand has no modal); aiState drives the assistant character.
  const expandSelectedNode = useCallback(
    async (nodeId: number) => {
      if (!aiHasKey || aiBusyRef.current) return;
      const node = nodeMapRef.current.get(nodeId);
      if (!node) return;

      // Titles of already-connected nodes (both directions) so the AI doesn't
      // duplicate them.
      const neighbors: string[] = [];
      const seen = new Set<number>();
      for (const c of connectionsRef.current) {
        const other =
          c.from === nodeId ? c.to : c.to === nodeId ? c.from : null;
        if (other === null || seen.has(other)) continue;
        seen.add(other);
        const t = (
          nodeMapRef.current.get(other)?.title ??
          nodeMapRef.current.get(other)?.label ??
          ""
        ).trim();
        if (t) neighbors.push(t);
      }

      aiBusyRef.current = true;
      setAiState("thinking");
      const ctx: ExpandContext = {
        type: node.type,
        title: node.title ?? "",
        body: node.body ?? "",
        neighbors,
      };
      const r = await expandNode(ctx, aiApiKey);
      aiBusyRef.current = false;
      if (!r.ok) {
        setAiState("error");
        setToast({ msg: `AI: ${r.message}`, variant: "error" });
        return;
      }
      setAiState("done");

      // Cap to a sensible fan; keep only child→child edges.
      const children = r.graph.nodes.slice(0, 8);
      const childIds = new Set(children.map((n) => n.id));
      const childConns = r.graph.connections.filter(
        (c) => childIds.has(c.from) && childIds.has(c.to),
      );

      // Grow card children to fit their text before layout (no clip, no overlap).
      fitGeneratedHeights(children);
      const local = layoutGraph(children, childConns);
      let clusterW = 0;
      let clusterH = 0;
      for (const gn of children) {
        const p = local.get(gn.id);
        if (!p) continue;
        clusterW = Math.max(clusterW, p.x + gn.width);
        clusterH = Math.max(clusterH, p.y + gn.height);
      }

      // Right of the parent, vertically centred; slide right past any existing
      // node it would overlap (never the parent itself).
      const GAP = 80;
      let originX = node.x + node.w + GAP;
      const originY = node.y + node.h / 2 - clusterH / 2;
      const others = nodesRef.current.filter((n) => n.id !== nodeId);
      for (let iter = 0; iter < 12; iter++) {
        const M = 24;
        let pushTo = -Infinity;
        for (const o of others) {
          const overlapX =
            originX - M < o.x + o.w && originX + clusterW + M > o.x;
          const overlapY =
            originY - M < o.y + o.h && originY + clusterH + M > o.y;
          if (overlapX && overlapY) pushTo = Math.max(pushTo, o.x + o.w + GAP);
        }
        if (pushTo === -Infinity) break;
        originX = pushTo;
      }

      const maxExistingId = getMaxNodeId(nodeMapRef.current);
      if (idCounterRef.current <= maxExistingId)
        idCounterRef.current = maxExistingId + 1;
      const idMap = new Map<string, number>();
      const newNodes: CanvasNode[] = children.map((gn) => {
        const id = idCounterRef.current;
        idCounterRef.current += 1;
        idMap.set(gn.id, id);
        const p = local.get(gn.id) ?? { x: 0, y: 0 };
        const isText = gn.type === "text";
        return {
          id,
          x: originX + p.x,
          y: originY + p.y,
          w: gn.width,
          h: gn.height,
          title: gn.title,
          body: gn.body,
          type: gn.type,
          // AI-assigned card fill (text nodes have no card) + size hierarchy.
          color: isText ? "transparent" : gn.color,
          fontSize: gn.fontSize,
        };
      });

      // child→child sub-branch edges.
      const newConns: Connection[] = [];
      const hasIncoming = new Set<string>();
      for (const c of childConns) hasIncoming.add(c.to);
      for (const c of childConns) {
        const from = idMap.get(c.from);
        const to = idMap.get(c.to);
        if (from !== undefined && to !== undefined) newConns.push({ from, to });
      }

      // Link the parent to the root children (those with no incoming child
      // edge). If the model returned a structure with NO root — a cycle, or one
      // where every child is targeted — `roots` is empty and the parent loop
      // adds nothing, leaving the whole cluster floating. Fall back to linking
      // the parent to ALL children so it's always attached.
      const roots = children.filter((gn) => !hasIncoming.has(gn.id));
      const parentTargets = roots.length > 0 ? roots : children;
      for (const gn of parentTargets) {
        const childId = idMap.get(gn.id);
        if (childId !== undefined) newConns.push({ from: nodeId, to: childId });
      }

      commitNewGraph(newNodes, newConns, {
        cx: originX + clusterW / 2,
        cy: originY + clusterH / 2,
      });
    },
    [aiHasKey, aiApiKey, commitNewGraph],
  );

  // Summarize the whole board into one prose Text node, placed below all
  // existing content. One undo snapshot; errors via toast; plain Text node.
  const summarizeBoardToNode = useCallback(async () => {
    if (!aiHasKey || aiBusyRef.current) return;
    const all = nodesRef.current;
    if (all.length === 0) return;

    // Order by the Story Path (presentationOrder); append any stragglers.
    const map = nodeMapRef.current;
    const ordered: CanvasNode[] = [];
    const used = new Set<number>();
    for (const id of presentationOrderRef.current) {
      const n = map.get(id);
      if (n) {
        ordered.push(n);
        used.add(id);
      }
    }
    for (const n of all) if (!used.has(n.id)) ordered.push(n);

    // Title + content per node (type-aware), truncated and capped.
    const items: SummaryItem[] = [];
    for (const n of ordered) {
      const title = (n.title || n.label || "").replace(/<[^>]*>/g, "").trim();
      let body = (n.body || "").trim();
      if (!body && n.type === "textfile" && n.textFileContent)
        body = n.textFileContent.trim();
      if (n.type === "checklist" && n.checklistItems?.length)
        body =
          body ||
          n.checklistItems
            .map((it) => `${it.checked ? "[x]" : "[ ]"} ${it.text}`)
            .join("; ");
      if (n.type === "link" && n.linkUrl) body = body || n.linkUrl;
      const t = title.slice(0, 120);
      const b = body.slice(0, 200);
      if (!t && !b) continue;
      items.push({ title: t, body: b });
      if (items.length >= 60) break;
    }
    if (items.length === 0) {
      setToast({
        msg: "AI: nothing on the board to summarize.",
        variant: "error",
      });
      return;
    }

    aiBusyRef.current = true;
    setAiState("thinking");
    const r = await summarizeBoard(items, aiApiKey);
    aiBusyRef.current = false;
    if (!r.ok) {
      setAiState("error");
      setToast({ msg: `AI: ${r.message}`, variant: "error" });
      return;
    }
    setAiState("done");

    // A generously-sized "rounded" card (renders both fields, so the prose sits
    // in `body`). Anchored at the AI workspace marker if set, otherwise centred
    // below all existing content.
    const W = 360;
    const H = 140;
    const marker = aiWorkspaceRef.current;
    let x: number;
    let y: number;
    if (marker) {
      x = marker.x;
      y = marker.y;
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of all) {
        if (n.x < minX) minX = n.x;
        if (n.x + n.w > maxX) maxX = n.x + n.w;
        if (n.y + n.h > maxY) maxY = n.y + n.h;
      }
      x = (minX + maxX) / 2 - W / 2;
      y = maxY + 80;
    }

    const maxExistingId = getMaxNodeId(nodeMapRef.current);
    if (idCounterRef.current <= maxExistingId)
      idCounterRef.current = maxExistingId + 1;
    const id = idCounterRef.current;
    idCounterRef.current += 1;
    const node: CanvasNode = {
      id,
      x,
      y,
      w: W,
      h: H,
      title: "Summary",
      body: r.summary,
      type: "rounded",
      color: tokens.color.surface,
      fontSize: 13,
    };
    commitNewGraph([node], [], { cx: x + W / 2, cy: y + H / 2 });
    setToast({ msg: "Board summarized", variant: "success" });
  }, [aiHasKey, aiApiKey, commitNewGraph]);

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
            id: newId,
            x: pos.cx - w / 2,
            y: pos.cy - h / 2,
            w,
            h,
            title: "",
            label: `Image ${maxIdx + 1}`,
            body: "",
            type: "image",
            color: tokens.color.surface,
            imageUrl,
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
          id: newId,
          x: pos.cx - w / 2,
          y: pos.cy - h / 2,
          w,
          h,
          title: "",
          label: fileName,
          body: "",
          type: "textfile",
          color: tokens.color.surface,
          fontSize: 13,
          textFileContent,
          textFileName: fileName,
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
  const { hydrated, saveState } = useBoardPersistence({
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
    onError: (msg) => setToast({ msg, variant: "error" }),
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
      // Workspace placement mode: this click drops the marker at the clicked
      // world point and exits the mode — nothing else happens.
      if (placingWorkspaceRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const wx = (e.clientX - r.left - panRef.current.x) / zoomRef.current;
        const wy = (e.clientY - r.top - panRef.current.y) / zoomRef.current;
        setAiWorkspace({ x: wx, y: wy });
        setPlacingWorkspace(false);
        return;
      }
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
  const onConnDelete = useCallback(
    (from: number, to: number) => {
      const newConns = connectionsRef.current.filter(
        (x) => !(x.from === from && x.to === to),
      );
      connectionsRef.current = newConns;
      pushHistory();
      setConnections(newConns);
    },
    [pushHistory],
  );

  // Finalizes a pending connection on click (fires after mouseup, so
  // connectDragRef is guaranteed to hold the latest state).
  const onNodeClick = useCallback(
    (e: React.MouseEvent, id: number) => {
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
    },
    [pushHistory],
  );

  useEffect(() => {
    if (filterOpen) setTimeout(() => filterInputRef.current?.focus(), 50);
  }, [filterOpen]);

  useEffect(() => {
    setFilterJumpIndex(0);
  }, [filterText, filterType]);

  const arrangeBringToFront = useCallback(
    (id: number) => {
      const newNodes = bringToFront(nodesRef.current, id);
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );
  const arrangeBringForward = useCallback(
    (id: number) => {
      const newNodes = bringForward(nodesRef.current, id);
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );
  const arrangeSendBackward = useCallback(
    (id: number) => {
      const newNodes = sendBackward(nodesRef.current, id);
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );
  const arrangeSendToBack = useCallback(
    (id: number) => {
      const newNodes = sendToBack(nodesRef.current, id);
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

  const deleteSelected = useCallback(() => {
    if (selectedIdsRef.current.size > 0) {
      const ids = selectedIdsRef.current;
      const newNodes = nodesRef.current.filter((n) => !ids.has(n.id));
      const newConns = connectionsRef.current.filter(
        (c) => !ids.has(c.from) && !ids.has(c.to),
      );
      const filteredOrder = presentationOrderRef.current.filter(
        (id) => !ids.has(id),
      );
      // Dissolve any group left with <2 members after the deletion.
      const norm = normalizePresentation(filteredOrder, newNodes);
      nodesRef.current = norm.nodes;
      connectionsRef.current = newConns;
      presentationOrderRef.current = norm.order;
      pushHistory();
      setNodes(norm.nodes);
      setConnections(newConns);
      setPresentationOrder(norm.order);
      setSelectedIds(new Set());
      setSelected(null);
    } else {
      const id = selectedRef.current;
      if (id === null) return;
      const newNodes = nodesRef.current.filter((n) => n.id !== id);
      const newConns = connectionsRef.current.filter(
        (c) => c.from !== id && c.to !== id,
      );
      const filteredOrder = presentationOrderRef.current.filter(
        (p) => p !== id,
      );
      const norm = normalizePresentation(filteredOrder, newNodes);
      nodesRef.current = norm.nodes;
      connectionsRef.current = newConns;
      presentationOrderRef.current = norm.order;
      pushHistory();
      setNodes(norm.nodes);
      setConnections(newConns);
      setPresentationOrder(norm.order);
      setSelected(null);
    }
  }, [pushHistory]);

  const copySelected = useCallback(() => {
    const id = selectedRef.current;
    if (id === null) return;
    const n = nodeMapRef.current.get(id);
    if (n) setCopiedNode(n);
  }, []);

  const pasteNode = useCallback(
    (cx?: number, cy?: number) => {
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushHistory],
  );

  // Move a whole Story Path step (a node or an entire group) past its
  // neighbour. Operating on the derived step list keeps a group's members
  // contiguous automatically.
  const movePresentationStep = useCallback(
    (stepIndex: number, dir: -1 | 1) => {
      const order = presentationOrderRef.current;
      const steps = buildPresentationSteps(order, nodeMapRef.current);
      const target = stepIndex + dir;
      if (stepIndex < 0 || stepIndex >= steps.length) return;
      if (target < 0 || target >= steps.length) return;
      const next = [...steps];
      [next[stepIndex], next[target]] = [next[target], next[stepIndex]];
      const newOrder = flattenSteps(next);
      presentationOrderRef.current = newOrder;
      pushHistory();
      setPresentationOrder(newOrder);
    },
    [pushHistory],
  );

  // Reorder a node within its group (swap with the adjacent member; never
  // crosses the group boundary).
  const moveGroupMember = useCallback(
    (groupId: string, memberId: number, dir: -1 | 1) => {
      const order = presentationOrderRef.current;
      const idx = order.indexOf(memberId);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= order.length) return;
      const map = nodeMapRef.current;
      if (
        map.get(memberId)?.presentationGroupId !== groupId ||
        map.get(order[target])?.presentationGroupId !== groupId
      )
        return;
      const next = [...order];
      [next[idx], next[target]] = [next[target], next[idx]];
      presentationOrderRef.current = next;
      pushHistory();
      setPresentationOrder(next);
    },
    [pushHistory],
  );

  // Combine selected nodes into one group step: stamp them with a fresh group
  // id and cluster them contiguously at the earliest selected position.
  const groupNodes = useCallback(
    (ids: number[]) => {
      const order = presentationOrderRef.current;
      const sorted = order.filter((id) => ids.includes(id));
      if (sorted.length < 2) return;
      const gid = newGroupId();
      const idSet = new Set(sorted);
      const stamped = nodesRef.current.map((n) =>
        idSet.has(n.id) ? { ...n, presentationGroupId: gid } : n,
      );
      const clustered = clusterContiguous(order, sorted);
      // Normalize in case a member came from another group that now has <2.
      const norm = normalizePresentation(clustered, stamped);
      nodesRef.current = norm.nodes;
      presentationOrderRef.current = norm.order;
      pushHistory();
      setNodes(norm.nodes);
      setPresentationOrder(norm.order);
    },
    [pushHistory],
  );

  // Add a single ungrouped node to an existing group (drag & drop from the
  // Story Path list). Stamp it with the group's id, then re-cluster so it joins
  // the group's contiguous block; normalize cleans up any group the node left.
  const addNodeToGroup = useCallback(
    (nodeId: number, groupId: string) => {
      const node = nodeMapRef.current.get(nodeId);
      if (!node || node.presentationGroupId === groupId) return;
      const stamped = nodesRef.current.map((n) =>
        n.id === nodeId ? { ...n, presentationGroupId: groupId } : n,
      );
      const stampedMap = new Map(stamped.map((n) => [n.id, n] as const));
      const order = presentationOrderRef.current;
      const members = order.filter(
        (id) => stampedMap.get(id)?.presentationGroupId === groupId,
      );
      const clustered = clusterContiguous(order, members);
      const norm = normalizePresentation(clustered, stamped);
      nodesRef.current = norm.nodes;
      presentationOrderRef.current = norm.order;
      pushHistory();
      setNodes(norm.nodes);
      setPresentationOrder(norm.order);
    },
    [pushHistory],
  );

  // Remove a single node from its group (drag it out in the Story Path list):
  // clear its group id so it becomes a standalone slide. normalizePresentation
  // then re-clusters the remaining members contiguously (the freed node lands
  // just after the group) and dissolves the group entirely if it's left with a
  // lone member — single-node groups aren't a thing.
  const removeNodeFromGroup = useCallback(
    (nodeId: number) => {
      const node = nodeMapRef.current.get(nodeId);
      if (!node || !node.presentationGroupId) return;
      const cleared = nodesRef.current.map((n) => {
        if (n.id !== nodeId) return n;
        const copy = { ...n };
        delete copy.presentationGroupId;
        return copy;
      });
      const norm = normalizePresentation(presentationOrderRef.current, cleared);
      nodesRef.current = norm.nodes;
      presentationOrderRef.current = norm.order;
      pushHistory();
      setNodes(norm.nodes);
      setPresentationOrder(norm.order);
    },
    [pushHistory],
  );

  // Dissolve a group back into individual steps (members keep their order).
  const dissolveGroup = useCallback(
    (groupId: string) => {
      const newNodes = nodesRef.current.map((n) => {
        if (n.presentationGroupId === groupId) {
          const copy = { ...n };
          delete copy.presentationGroupId;
          return copy;
        }
        return n;
      });
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

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

  // Replace a checklist node's items wholesale (toggle / add / remove / reorder /
  // text edit are all computed in NodeView and committed here). One discrete
  // change = one undo entry.
  const commitChecklist = useCallback(
    (id: number, items: { id: number; text: string; checked: boolean }[]) => {
      const newNodes = nodesRef.current.map((n) =>
        n.id === id ? { ...n, checklistItems: items } : n,
      );
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

  // Commit a link node's URL: normalize it, cache the favicon URL, reset the
  // title, then fetch the page title in the background (best-effort; CORS often
  // blocks it, in which case the node just shows the URL). The async update is
  // guarded so it never clobbers a node the user has since deleted or re-pointed.
  const commitLinkUrl = useCallback(
    (id: number, rawUrl: string) => {
      const url = normalizeUrl(rawUrl);
      const old = nodesRef.current.find((n) => n.id === id);
      if (!old) return;
      const urlChanged = old.linkUrl !== url;
      const newNodes = nodesRef.current.map((n) =>
        n.id === id
          ? {
              ...n,
              linkUrl: url,
              linkFavicon: url ? faviconUrl(url) : undefined,
              title: urlChanged ? "" : n.title,
            }
          : n,
      );
      nodesRef.current = newNodes;
      pushHistory();
      setNodes(newNodes);

      if (url && urlChanged) {
        fetchLinkTitle(url).then((title) => {
          if (!title) return;
          const cur = nodeMapRef.current.get(id);
          if (!cur || cur.linkUrl !== url) return; // deleted or re-pointed
          const updated = nodesRef.current.map((n) =>
            n.id === id ? { ...n, title } : n,
          );
          nodesRef.current = updated;
          // Background metadata — not a discrete user action, so no history push.
          setNodes(updated);
        });
      }
    },
    [pushHistory],
  );

  // Open a link node's URL in a new tab. Skipped when the "click" was actually
  // the tail of a drag (same gate as opening a document).
  const openLink = useCallback((url: string) => {
    if (lastInteractionMovedRef.current) return;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateNodeLabel = useCallback(
    (id: number, label: string) => {
      const old = nodesRef.current.find((n) => n.id === id)?.label ?? "";
      const newNodes = nodesRef.current.map((n) =>
        n.id === id ? { ...n, label } : n,
      );
      nodesRef.current = newNodes;
      if (label !== old) pushHistory();
      setNodes(newNodes);
    },
    [pushHistory],
  );

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
    centerNodesForPresentation,
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
  // Read from refs so these stay stable for the memoized toolbar.
  const exportPdfVector = useCallback(async () => {
    await exportBoardPdf(
      nodesRef.current,
      connectionsRef.current,
      boardNameRef.current,
    );
  }, []);

  // ── Markdown export ─────────────────────────────────────────────────────────
  const exportMarkdown = useCallback(() => {
    exportBoardMarkdown(
      nodesRef.current,
      connectionsRef.current,
      presentationOrderRef.current,
      boardNameRef.current,
    );
  }, []);

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
        id: newId,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        title: cleanTitle,
        label: cleanTitle || "Document",
        body: "",
        type: "textfile",
        color: tokens.color.surface,
        fontSize: 13,
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
      setDocEditor((prev) => (prev ? { nodeId: newId, seq: prev.seq } : prev));
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

  const startPresentation = useCallback(() => {
    const seq = presentActiveSeqRef.current;
    if (seq.length === 0) return;
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
    centerNodesForPresentation(seq[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerNodesForPresentation]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const panelOpen = activePanel !== null;
  const tree = (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: tokens.color.canvas,
        overflow: "hidden",
        position: "relative",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
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
            <stop offset="0%" stopColor="#FCFBF8" />
            <stop offset="100%" stopColor="#E8DEC8" />
          </linearGradient>
          <linearGradient id="gShapeA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C56B47" />
            <stop offset="100%" stopColor="#A8553A" />
          </linearGradient>
        </defs>
      </svg>

      <FloatingSidebar
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        isPresenting={isPresenting}
        canvasBg={canvasBg}
        setCanvasBg={changeCanvasBg}
        boardName={boardName}
        setBoardName={setBoardName}
        editingBoardName={editingBoardName}
        setEditingBoardName={setEditingBoardName}
        nodes={nodes}
        connectionCount={connections.length}
        saveState={saveState}
        selected={selected}
        editingSidebarNodeId={editingSidebarNodeId}
        setEditingSidebarNodeId={setEditingSidebarNodeId}
        focusNode={focusNode}
        updateNodeLabel={updateNodeLabel}
        presentSteps={presentSteps}
        nodeMap={nodeMap}
        presentActiveSeqLength={presentActiveSeq.length}
        toggleExcludeFromPresentation={toggleExcludeFromPresentation}
        movePresentationStep={movePresentationStep}
        moveGroupMember={moveGroupMember}
        groupNodes={groupNodes}
        addNodeToGroup={addNodeToGroup}
        removeNodeFromGroup={removeNodeFromGroup}
        dissolveGroup={dissolveGroup}
        onPresent={startPresentation}
        saveBoard={saveBoard}
        onLoadBoardClick={onLoadBoardClick}
        aiState={aiState}
        onSummarize={summarizeBoardToNode}
        onGenerate={() => setGenerateOpen(true)}
        aiWorkspace={aiWorkspace}
        placingWorkspace={placingWorkspace}
        onAssignWorkspace={assignWorkspace}
        onClearWorkspace={clearWorkspace}
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
          cursor: placingWorkspace || connectDrag ? "crosshair" : "grab",
          overflow: "hidden",
        }}
      >
        {/* Atmospheric background — a blurred image under a light stone veil. */}
        {canvasBg === "atmospheric" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                // Overscan past the edges so the 50px blur never reveals gaps.
                inset: -80,
                backgroundImage: "url(/backgrounds/atmospheric-1.jpg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(50px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(248,246,241,0.4)",
              }}
            />
          </div>
        )}

        {/* Dot grid */}
        {canvasBg === "grid" && (
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
                <circle cx={1} cy={1} r={0.9} fill="rgba(42,40,35,0.12)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        )}

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
            // While the presentation camera glides, promote the world to its own
            // GPU layer so the changing scale composites a cached raster instead
            // of re-rasterising the whole scaled subtree every frame — the
            // measured per-frame bottleneck (paint ≈ full 16ms budget). Dropped
            // once the camera settles so the world re-rasterises crisply at rest.
            willChange: cameraAnimating ? "transform" : undefined,
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
                background: "rgba(197,107,71,0.10)",
                pointerEvents: "none",
                zIndex: 999,
              }}
            />
          )}

          {/* Nodes — the active presentation step's nodes are rendered
              separately in the sharp spotlight layer below, so skip them here. */}
          {nodes.map((n) => {
            if (focusedIds?.has(n.id)) return null;
            return (
              <NodeView
                key={n.id}
                n={n}
                isSelected={selected === n.id}
                isHovered={hoveredId === n.id}
                isConnectSource={connectDrag?.fromId === n.id}
                connecting={connectDrag !== null}
                editingNodeIdRef={editingNodeIdRef}
                connectDragRef={connectDragRef}
                onNodeMouseDown={onNodeMouseDown}
                onNodeContextMenu={onNodeContextMenu}
                onNodeClick={onNodeClick}
                onOpenDocument={openDocument}
                setHoveredId={setHoveredId}
                commitNodeText={commitNodeText}
                commitChecklist={commitChecklist}
                commitLinkUrl={commitLinkUrl}
                onOpenLink={openLink}
                startNodeDrag={startNodeDrag}
                onDotClick={onDotClick}
                onResizeMouseDown={onResizeMouseDown}
                dimmed={filterActive && !matchedNodeIds.has(n.id)}
                isMultiSelected={selectedIds.has(n.id)}
                searchHit={filterText !== "" && matchedNodeIds.has(n.id)}
                // During presentation the live `zoom` changes every tween frame;
                // NodeView only uses it for hover/select affordances that never
                // render here, so freeze it to keep the memo from re-rendering
                // every node on every frame of the camera glide.
                zoom={isPresenting ? 1 : zoom}
              />
            );
          })}
        </div>

        {/* ── AI workspace marker ──
            A subtle anchor (not a node) showing where AI output will land.
            Rendered in screen space at a fixed pixel size — tracks pan/zoom but
            never scales — so it stays a small, quiet indicator at any zoom. */}
        {!isPresenting && aiWorkspace && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: pan.x + aiWorkspace.x * zoom,
              top: pan.y + aiWorkspace.y * zoom,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 120,
            }}
          >
            {/* Ring + center dot */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: `1.5px solid ${ACCENT}`,
                background: "rgba(197,107,71,0.10)",
                boxShadow: "0 1px 4px rgba(197,107,71,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: ACCENT,
                }}
              />
            </div>
            {/* Tiny label */}
            <span
              style={{
                position: "absolute",
                top: "calc(100% + 3px)",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: ACCENT,
                whiteSpace: "nowrap",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              }}
            >
              AI
            </span>
          </div>
        )}

        {/* ── Presentation spotlight backdrop ──
            Blurs + dims the entire canvas (dot grid, connections, every other
            node) so the focused node reads as lifted onto a stage. The dim is a
            translucent warm-dark wash — it never recolors nodes, it just pushes
            the backdrop back. Sits above the world but below the sharp focused
            node layer, so the focused node itself is never touched. */}
        {isPresenting && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 200,
              background: "rgba(24,18,12,0.46)",
              // Drop the backdrop blur while the camera glides — re-blurring the
              // whole viewport every frame as the world moves underneath is the
              // dominant per-frame cost and the main source of step-switch
              // stutter. The dim alone carries the transition; the blur snaps
              // back the instant the camera settles.
              backdropFilter: cameraAnimating ? "none" : "blur(14px)",
              WebkitBackdropFilter: cameraAnimating ? "none" : "blur(14px)",
            }}
          />
        )}

        {/* Sharp focused-node layer — mirrors the world transform so the active
            step's nodes sit exactly where they would on the canvas, but render
            above the spotlight backdrop and are therefore left untouched. A
            group step lifts all its members together. */}
        {isPresenting && focusedNodes.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: 0,
              height: 0,
              zIndex: 201,
              pointerEvents: "none",
              // Same GPU-layer promotion as the world layer: composite the cached
              // raster of the staged nodes during the glide, re-rasterise crisp
              // on settle (the audience only scrutinises them once at rest).
              willChange: cameraAnimating ? "transform" : undefined,
            }}
          >
            {focusedNodes.map((fn) => (
              <NodeView
                key={fn.id}
                n={fn}
                isSelected={false}
                isHovered={false}
                isConnectSource={false}
                connecting={false}
                editingNodeIdRef={editingNodeIdRef}
                connectDragRef={connectDragRef}
                onNodeMouseDown={onNodeMouseDown}
                onNodeContextMenu={onNodeContextMenu}
                onNodeClick={onNodeClick}
                onOpenDocument={openDocument}
                setHoveredId={setHoveredId}
                commitNodeText={commitNodeText}
                commitChecklist={commitChecklist}
                commitLinkUrl={commitLinkUrl}
                onOpenLink={openLink}
                startNodeDrag={startNodeDrag}
                onDotClick={onDotClick}
                onResizeMouseDown={onResizeMouseDown}
                dimmed={false}
                isMultiSelected={false}
                onStage
                // Frozen like the world layer — the glide must not re-render the
                // staged nodes each frame (see note above).
                zoom={1}
              />
            ))}
          </div>
        )}

        {/* Edge vignette — a soft inner shadow at the viewport edges so the
            dot-grid canvas reads as slightly recessed within the frame. Sits
            above the world but below all floating chrome, and never intercepts
            pointer events. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            boxShadow:
              "inset 0 0 60px rgba(58,48,38,0.10), inset 0 0 180px rgba(58,48,38,0.06)",
          }}
        />
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
            background: "rgba(197,107,71,0.6)",
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
            background: "rgba(197,107,71,0.6)",
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
              hasKey={aiHasKey}
              onExpand={expandSelectedNode}
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
          onClose={() => {
            pushHistory();
            setColorPicker(null);
          }}
        />
      )}

      {/* ── Text Color Picker ── */}
      {textColorPicker && (
        <ColorPickerWindow
          picker={textColorPicker}
          onColorChange={onPickerTextColorChange}
          onClose={() => {
            pushHistory();
            setTextColorPicker(null);
          }}
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
          onNotify={(msg) => setToast({ msg, variant: "error" })}
          getOriginRect={() => {
            // Screen rect of the source node, from canvas bounds + live camera,
            // so the zoom animation targets its current on-screen position.
            const id = docEditor.nodeId;
            if (id == null) return null;
            const n = nodeMapRef.current.get(id);
            const canvas = canvasRef.current;
            if (!n || !canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const z = zoomRef.current;
            const p = panRef.current;
            return {
              left: rect.left + p.x + n.x * z,
              top: rect.top + p.y + n.y * z,
              width: n.w * z,
              height: n.h * z,
            };
          }}
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
          background: "rgba(252,251,248,0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(42,40,35,0.1)",
          borderRadius: 12,
          padding: "8px 16px",
          fontSize: 11,
          color: "rgba(42,40,35,0.55)",
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

      <AiGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={generateFromPrompt}
        aiState={aiState}
      />

      <Toast toast={toast} />

      {/* ── Inline formatting bar (shows above text selections in nodes) ── */}
      <FormatBar />

      {/* ── Mobile fallback ── */}
      <div className="mobile-fallback">
        <span
          style={{
            color: "#C56B47",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.12em",
            fontFamily: "var(--font-clash), system-ui, sans-serif",
          }}
        >
          DNKRM
        </span>
        <div
          style={{
            width: 32,
            height: 2,
            background: "#C56B47",
            borderRadius: 1,
            margin: "20px 0 24px",
          }}
        />
        <p
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
            lineHeight: 1.6,
            textAlign: "center",
            maxWidth: 280,
            margin: 0,
          }}
        >
          DNKRM is built for desktop.
          <br />
          Open it on your computer for the full experience.
        </p>
      </div>
    </div>
  );

  // In debug mode, wrap the whole canvas in a Profiler so each commit's
  // render time (dev builds) is attributed to the frame that triggered it.
  if (DEBUG_CAMERA)
    return (
      <Profiler
        id="canvas"
        onRender={(_id, _phase, actualDuration) => perfCommit(actualDuration)}
      >
        {tree}
      </Profiler>
    );
  return tree;
}

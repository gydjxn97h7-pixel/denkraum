"use client";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
} from "react";
import "./canvas.css";
import {
  ACCENT,
  PRESET_COLORS,
  SIDEBAR_W,
  LS_NODES,
  LS_CONNECTIONS,
  DEFAULT_NODES,
  DEFAULT_CONNECTIONS,
  idCounter,
  setIdCounter,
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
import { hexToRgb, stripHtml } from "./lib/color-helpers";
import {
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
} from "./lib/canvas-helpers";
import { setAsset, deleteAsset, getAllAssets } from "./lib/idb";
import { ColorPickerWindow } from "./components/ColorPickerWindow";
import { TextFileViewerWindow } from "./components/TextFileViewerWindow";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [textFileViewer, setTextFileViewer] = useState<{
    nodeId: number;
    fileName: string;
    content: string;
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
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePos = useRef<{ cx: number; cy: number } | null>(null);
  const pendingTextFilePos = useRef<{ cx: number; cy: number } | null>(null);
  // Tracks which node is actively being edited so ref callbacks never clobber
  // in-progress input (more reliable than document.activeElement checks).
  const editingNodeIdRef = useRef<number | null>(null);

  // ── rAF-based interaction refs ────────────────────────────────────────────────
  // Mirror latest state into refs so mouse handlers never capture stale closures
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const connectDragRef = useRef(connectDrag);
  const selectedRef = useRef(selected);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  connectDragRef.current = connectDrag;
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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
    const maxExistingId =
      nodeMapRef.current.size > 0 ? Math.max(...nodeMapRef.current.keys()) : -1;
    if (idCounter <= maxExistingId) setIdCounter(maxExistingId + 1);
    const newId = idCounter;
    setIdCounter(idCounter + 1);

    setNodes((prev) => [
      ...prev,
      {
        id: newId,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        title: isText
          ? ""
          : type === "circle"
            ? "Circle"
            : type === "oval"
              ? "Oval"
              : type === "diamond"
                ? "Diamond"
                : type === "rounded"
                  ? "Area"
                  : "New Block",
        body: "",
        type,
        color: isText ? "transparent" : "#1E2226",
        fontSize: isText ? 15 : 13,
      },
    ]);
    setSelected(newId);
    setContextMenu(null);
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
          const maxExistingId =
            nodeMapRef.current.size > 0
              ? Math.max(...nodeMapRef.current.keys())
              : -1;
          if (idCounter <= maxExistingId) setIdCounter(maxExistingId + 1);
          const newId = idCounter;
          setIdCounter(idCounter + 1);
          setNodes((prev) => [
            ...prev,
            {
              id: newId,
              x: pos.cx - w / 2,
              y: pos.cy - h / 2,
              w,
              h,
              title: "Image",
              body: "",
              type: "image",
              color: "#1E2226",
              imageUrl,
            },
          ]);
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
        const maxExistingId =
          nodeMapRef.current.size > 0
            ? Math.max(...nodeMapRef.current.keys())
            : -1;
        if (idCounter <= maxExistingId) setIdCounter(maxExistingId + 1);
        const newId = idCounter;
        setIdCounter(idCounter + 1);
        setNodes((prev) => [
          ...prev,
          {
            id: newId,
            x: pos.cx - w / 2,
            y: pos.cy - h / 2,
            w,
            h,
            title: fileName,
            body: "",
            type: "textfile",
            color: "#1E2226",
            fontSize: 13,
            textFileContent,
            textFileName: fileName,
          },
        ]);
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
            ...(n.textFileName != null && {
              textFileName: stripHtml(n.textFileName),
            }),
          }));
          const maxId = loadedNodes.reduce((m, n) => Math.max(m, n.id), -1);
          if (maxId >= idCounter) setIdCounter(maxId + 1);

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
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "QuotaExceededError" ||
            err.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ) {
          console.warn(
            "[denkraum] localStorage quota exceeded — canvas not saved.",
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
  }, [nodes, connections, hydrated]);

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
    setSelected(id);
    setContextMenu({ kind: "node", x: e.clientX, y: e.clientY, id });
    setNodes((prev) => bringToFront(prev, id));
  }, []);

  // ── Mouse down handlers ───────────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      const t = e.target as HTMLElement;
      if (t !== canvasRef.current && !t.dataset.bg) return;
      if (e.button !== 0) return;
      // Cancel any in-progress connect drag
      if (connectDragRef.current) {
        setConnectDrag(null);
        return;
      }
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setSelected(null);
    },
    [contextMenu],
  );

  // ── Node lookup map (rebuilt only when nodes changes) ────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const nodeMapRef = useRef(nodeMap);
  nodeMapRef.current = nodeMap;

  const startNodeDrag = useCallback(
    (e: React.MouseEvent, id: number) => {
      setContextMenu(null);
      setSelected(id);
      setNodes((prev) => bringToFront(prev, id));
      const n = nodeMap.get(id);
      if (!n || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - r.left - pan.x) / zoom;
      const my = (e.clientY - r.top - pan.y) / zoom;
      dragging.current = { id, ox: mx - n.x, oy: my - n.y };
      e.preventDefault();
    },
    [nodeMap, pan, zoom],
  );

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable) return;
      if (t.dataset.role === "connect-dot") return;
      if (t.dataset.role === "resize-handle") return;
      if (t.dataset.role === "move-handle") return;
      if (connectDragRef.current) return;
      e.stopPropagation();
      startNodeDrag(e, id);
    },
    [startNodeDrag],
  );

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      e.preventDefault();
      setNodes((prev) => bringToFront(prev, id));
      const n = nodeMap.get(id);
      if (!n) return;
      resizing.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startW: n.w,
        startH: n.h,
        constrain: n.type === "circle",
      };
    },
    [nodeMap],
  );

  // ── Connect: click-to-connect ─────────────────────────────────────────────────
  const onDotClick = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (connectDragRef.current?.fromId === id) {
      setConnectDrag(null);
    } else {
      setConnectDrag({ fromId: id });
    }
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
      setNodes((prev) =>
        prev.map((n) =>
          n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n,
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
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning.current && !dragging.current && !resizing.current) return;

      const pan = panRef.current;
      const zoom = zoomRef.current;
      let dirty = false;

      if (isPanning.current) {
        const dx = e.clientX - lastPan.current.x;
        const dy = e.clientY - lastPan.current.y;
        lastPan.current = { x: e.clientX, y: e.clientY };
        pendingPanDelta.current.x += dx;
        pendingPanDelta.current.y += dy;
        dirty = true;
      }

      if (dragging.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        const { id, ox, oy } = dragging.current;
        pendingDragPos.current = { id, x: mx - ox, y: my - oy };
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
    dragging.current = null;
    resizing.current = null;
    isPanning.current = false;
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

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
    const id = selectedRef.current;
    if (id === null) return;
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
    setSelected(null);
  }, []);

  const updateNodeField = useCallback(
    (id: number, field: "title" | "body", value: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
      );
    },
    [],
  );

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !t.isContentEditable &&
        selectedRef.current !== null
      )
        deleteSelected();
      if (e.key === "Escape") {
        setConnectDrag(null);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const menuItem = (danger = false): React.CSSProperties => ({
    padding: "9px 14px",
    cursor: "pointer",
    fontSize: 13.5,
    color: danger ? "#FF6B6B" : "#E8E6E1",
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
      const minX = Math.min(...nodes.map((n) => n.x)) - PAD;
      const minY = Math.min(...nodes.map((n) => n.y)) - PAD;
      const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + PAD;
      const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + PAD;
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
        backgroundColor: "#141618",
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        // Skip all fixed-position overlays (sidebar, toolbars, pickers)
        ignoreElements: (el) =>
          window.getComputedStyle(el).position === "fixed",
      });

      // Restore canvas size before saving (even if jsPDF throws)
      el.style.width = "";
      el.style.height = "";

      const imgData = cvs.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: contentW >= contentH ? "landscape" : "portrait",
        unit: "px",
        format: [contentW, contentH],
      });
      pdf.addImage(imgData, "JPEG", 0, 0, contentW, contentH);
      pdf.save("denkraum.pdf");
    } finally {
      // Always restore canvas size in case the try block threw before cleanup
      if (canvasRef.current) {
        canvasRef.current.style.width = "";
        canvasRef.current.style.height = "";
      }
      setPan(savedPan);
      setZoom(savedZoom);
      setExporting(false);
    }
  }, [nodes]);

  // ── Sidebar width (collapsed = icon-only 48px, open = full 220px) ────────────
  const sidebarW = sidebarOpen ? SIDEBAR_W : 48;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#141618",
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

      {/* ── Sidebar ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100%",
          width: sidebarW,
          transition: "width 0.26s cubic-bezier(0.4, 0, 0.2, 1)",
          background: "rgba(18,20,22,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRight: "0.5px solid rgba(255,255,255,0.12)",
          boxShadow: "4px 0 32px rgba(0,0,0,0.3)",
          zIndex: 150,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        {/* App name header */}
        <div
          style={{
            padding: "0 10px",
            height: 58,
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
          }}
        >
          {sidebarOpen && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#E8E6E1",
                letterSpacing: "-0.4px",
                paddingLeft: 6,
              }}
            >
              denkraum
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            style={{
              border: "none",
              background: "transparent",
              color: "#6B7280",
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              borderRadius: 6,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#6B7280";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "6px 0 20px",
          }}
        >
          {/* ── Boards ── */}
          <div style={{ marginBottom: 6 }}>
            {sidebarOpen && (
              <div
                style={{
                  padding: "10px 16px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.7px",
                }}
              >
                Boards
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: sidebarOpen ? 9 : 0,
                padding: sidebarOpen ? "7px 12px" : "7px 0",
                margin: "1px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                cursor: "default",
                justifyContent: sidebarOpen ? "flex-start" : "center",
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280", flexShrink: 0 }}>
                ◫
              </span>
              {sidebarOpen && (
                <>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "#E8E6E1",
                      fontWeight: 500,
                      flex: 1,
                    }}
                  >
                    Board 1
                  </span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: ACCENT,
                      flexShrink: 0,
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* ── Nodes ── */}
          <div style={{ marginBottom: 6 }}>
            {sidebarOpen && (
              <div
                style={{
                  padding: "10px 16px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.7px",
                }}
              >
                Nodes
              </div>
            )}
            {nodes.length === 0 ? (
              sidebarOpen ? (
                <div
                  style={{
                    padding: "6px 16px",
                    fontSize: 12,
                    color: "#4B5563",
                  }}
                >
                  No nodes yet
                </div>
              ) : null
            ) : (
              nodes.map((n) => {
                const icon =
                  n.type === "text"
                    ? "T"
                    : n.type === "circle"
                      ? "○"
                      : n.type === "oval"
                        ? "◯"
                        : n.type === "diamond"
                          ? "◇"
                          : n.type === "image"
                            ? "▣"
                            : n.type === "rounded"
                              ? "▢"
                              : n.type === "textfile"
                                ? "📄"
                                : "▭";
                const label =
                  n.title.replace(/<[^>]*>/g, "").trim() || "Untitled";
                const isActive = selected === n.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => focusNode(n.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: sidebarOpen ? 9 : 0,
                      padding: sidebarOpen ? "7px 12px" : "7px 0",
                      margin: "1px 8px",
                      borderRadius: 8,
                      background: isActive ? `${ACCENT}1a` : "transparent",
                      cursor: "pointer",
                      transition: "background 0.12s",
                      justifyContent: sidebarOpen ? "flex-start" : "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: isActive ? ACCENT : "#4B5563",
                        width: 14,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </span>
                    {sidebarOpen && (
                      <span
                        style={{
                          fontSize: 12.5,
                          color: isActive ? "#E8E6E1" : "#9CA3AF",
                          fontWeight: isActive ? 500 : 400,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Shortcuts ── */}
          {sidebarOpen && (
            <div>
              <div
                style={{
                  padding: "10px 16px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.7px",
                }}
              >
                Shortcuts
              </div>
              {(
                [
                  { kbd: "⌫  Delete", desc: "Delete selected" },
                  { kbd: "Esc", desc: "Cancel connect" },
                  { kbd: "⌃ Scroll", desc: "Zoom in / out" },
                  { kbd: "Right-click", desc: "Insert shape" },
                  { kbd: "Click dot →", desc: "Connect nodes" },
                ] as { kbd: string; desc: string }[]
              ).map(({ kbd, desc }) => (
                <div
                  key={kbd}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 16px",
                    gap: 8,
                  }}
                >
                  <kbd
                    style={{
                      fontSize: 10.5,
                      color: "#9CA3AF",
                      background: "rgba(255,255,255,0.07)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      borderRadius: 5,
                      padding: "2px 6px",
                      fontFamily: "inherit",
                      flexShrink: 0,
                      letterSpacing: "-0.1px",
                    }}
                  >
                    {kbd}
                  </kbd>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "#6B7280",
                      textAlign: "right",
                      lineHeight: 1.3,
                    }}
                  >
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Export Toolbar ── */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: `calc(${sidebarW}px + (100vw - ${sidebarW}px) / 2)`,
          transform: "translateX(-50%)",
          background: "rgba(20,22,24,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "6px 10px",
          display: "flex",
          gap: 4,
          alignItems: "center",
          boxShadow: "0 2px 24px rgba(0,0,0,0.3)",
          zIndex: 201,
        }}
      >
        {/* ── Shape insert buttons ── */}
        {(
          [
            {
              type: "block" as NodeType,
              label: "Block",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="6" width="18" height="12" rx="1" />
                </svg>
              ),
            },
            {
              type: "rounded" as NodeType,
              label: "Area (rounded)",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="4" />
                </svg>
              ),
            },
            {
              type: "circle" as NodeType,
              label: "Circle",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ),
            },
            {
              type: "oval" as NodeType,
              label: "Oval",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <ellipse cx="12" cy="12" rx="9" ry="6" />
                </svg>
              ),
            },
            {
              type: "diamond" as NodeType,
              label: "Diamond",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12,3 21,12 12,21 3,12" />
                </svg>
              ),
            },
            {
              type: "text" as NodeType,
              label: "Free Text",
              icon: (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="12" y1="7" x2="12" y2="21" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                </svg>
              ),
            },
          ] as { type: NodeType; icon: React.ReactNode; label: string }[]
        ).map(({ type, icon, label }) => (
          <button
            key={type}
            title={label}
            onClick={() => {
              if (!canvasRef.current) return;
              const cx =
                (canvasRef.current.clientWidth / 2 - panRef.current.x) /
                zoomRef.current;
              const cy =
                (canvasRef.current.clientHeight / 2 - panRef.current.y) /
                zoomRef.current;
              addNode(cx, cy, type);
            }}
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: "transparent",
              color: "#9CA3AF",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              padding: 0,
              fontFamily: "inherit",
              transition: "color 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#E8E6E1";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {icon}
          </button>
        ))}

        {/* Image insert button */}
        <button
          title="Insert Image"
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
          style={{
            width: 28,
            height: 28,
            border: "none",
            background: "transparent",
            color: "#9CA3AF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            padding: 0,
            transition: "color 0.12s, background 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#E8E6E1";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.07)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        {/* Text file insert button */}
        <button
          title="Insert Text File"
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
          style={{
            width: 28,
            height: 28,
            border: "none",
            background: "transparent",
            color: "#9CA3AF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            padding: 0,
            transition: "color 0.12s, background 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#E8E6E1";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.07)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
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
            color: exporting ? "#4B5563" : "#9CA3AF",
            transition: "color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: "-0.1px",
          }}
          onMouseEnter={(e) => {
            if (!exporting)
              (e.currentTarget as HTMLElement).style.color = "#E8E6E1";
          }}
          onMouseLeave={(e) => {
            if (!exporting)
              (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
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
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        data-bg="true"
        onMouseDown={onCanvasMouseDown}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: sidebarW,
          transition: "left 0.26s cubic-bezier(0.4, 0, 0.2, 1)",
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
              <circle cx={1} cy={1} r={0.8} fill="rgba(255,255,255,0.06)" />
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
            }}
          >
            <g transform="translate(5000, 5000)">
              {connections.map((c) => {
                const fn = nodeMap.get(c.from);
                const tn = nodeMap.get(c.to);
                if (!fn || !tn) return null;
                const x1 = fn.x + fn.w,
                  y1 = fn.y + fn.h / 2;
                const x2 = tn.x,
                  y2 = tn.y + tn.h / 2;
                const cxm = (x1 + x2) / 2;
                const key = `${c.from}-${c.to}`;
                const isHovered = hoveredConnKey === key;
                const d = `M ${x1} ${y1} C ${cxm} ${y1}, ${cxm} ${y2}, ${x2} ${y2}`;
                return (
                  <g key={key}>
                    {/* Visible path */}
                    <path
                      d={d}
                      stroke={
                        isHovered
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(255,255,255,0.25)"
                      }
                      strokeWidth={isHovered ? 2.5 / zoom : 1.5 / zoom}
                      fill="none"
                      strokeLinecap="round"
                      style={{
                        pointerEvents: "none",
                        transition: "stroke 0.12s, stroke-width 0.12s",
                      }}
                    />
                    {/* Invisible hit target */}
                    <path
                      d={d}
                      stroke="transparent"
                      strokeWidth={12 / zoom}
                      fill="none"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredConnKey(key)}
                      onMouseLeave={() =>
                        setHoveredConnKey((k) => (k === key ? null : k))
                      }
                      onDoubleClick={() =>
                        setConnections((prev) =>
                          prev.filter(
                            (x) => !(x.from === c.from && x.to === c.to),
                          ),
                        )
                      }
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const isSel = selected === n.id;
            const isText = n.type === "text";
            const isCircle = n.type === "circle" || n.type === "oval";
            const isDiamond = n.type === "diamond";
            const isRounded = n.type === "rounded";
            const isImage = n.type === "image";
            const isTextFile = n.type === "textfile";
            const [_nr, _ng, _nb] = hexToRgb(n.color);
            const isDark =
              (0.299 * _nr + 0.587 * _ng + 0.114 * _nb) / 255 < 0.45;
            const fs = n.fontSize ?? 13;

            // All non-source nodes glow while connect-mode is active
            const isPotentialTarget =
              connectDrag !== null && n.id !== connectDrag.fromId && !isText;

            const hostBg =
              isDiamond || isText || isImage ? "transparent" : n.color;
            const hostBorder =
              isDiamond || isText || isImage
                ? "none"
                : isSel
                  ? "1px solid rgba(255,255,255,0.28)"
                  : "0.5px solid rgba(255,255,255,0.13)";
            const hostShadow =
              isDiamond || isText || isImage
                ? "none"
                : isPotentialTarget
                  ? "0 0 0 2px rgba(255,177,98,0.35)"
                  : isSel
                    ? "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)"
                    : "0 2px 12px rgba(0,0,0,0.4)";
            const hostRadius = isCircle ? "50%" : isRounded ? 24 : 12;

            const showResize = (hoveredId === n.id || isSel) && !isText;
            // Show connect dot on hover (or when it's the active source)
            const showDot =
              !isText && (hoveredId === n.id || connectDrag?.fromId === n.id);

            return (
              <div
                key={n.id}
                data-node-id={n.id}
                onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                onContextMenu={(e) => onNodeContextMenu(e, n.id)}
                onClick={(e) => {
                  // Connect finalization always runs first
                  const wasConnecting = !!connectDragRef.current;
                  onNodeClick(e, n.id);
                  // Open text-file viewer only when not in connect-mode
                  if (!wasConnecting && isTextFile) {
                    e.stopPropagation();
                    setTextFileViewer({
                      nodeId: n.id,
                      fileName: n.textFileName ?? n.title,
                      content: n.textFileContent ?? "",
                    });
                  }
                }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() =>
                  setHoveredId((prev) => (prev === n.id ? null : prev))
                }
                style={{
                  position: "absolute",
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: isText ? "auto" : n.h,
                  minHeight: isText ? Math.max(32, n.h) : undefined,
                  background: hostBg,
                  border: hostBorder,
                  borderRadius: hostRadius,
                  boxShadow: hostShadow,
                  padding: isText
                    ? "8px 12px"
                    : isCircle
                      ? 0
                      : isDiamond
                        ? 0
                        : "14px 18px",
                  cursor: connectDrag ? "crosshair" : "grab",
                  userSelect: "none",
                  outline:
                    isText && (isSel || n.title === "")
                      ? "1.5px dashed rgba(255,255,255,0.45)"
                      : "none",
                  transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: isCircle || isText ? "center" : "flex-start",
                  alignItems: isCircle || isText ? "center" : "flex-start",
                  overflow: "visible",
                  isolation: "isolate",
                }}
              >
                {/* Diamond */}
                {isDiamond && (
                  <>
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                      viewBox={`0 0 ${n.w} ${n.h}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <filter
                          id={`ds-${n.id}`}
                          x="-20%"
                          y="-20%"
                          width="140%"
                          height="140%"
                        >
                          <feDropShadow
                            dx="0"
                            dy="1"
                            stdDeviation={isSel ? 5 : 3}
                            floodColor={
                              isSel ? "rgba(0,0,0,0.13)" : "rgba(0,0,0,0.08)"
                            }
                          />
                        </filter>
                      </defs>
                      <polygon
                        points={`${n.w / 2},2 ${n.w - 2},${n.h / 2} ${n.w / 2},${n.h - 2} 2,${n.h / 2}`}
                        fill={n.color}
                        stroke={
                          isPotentialTarget
                            ? ACCENT
                            : isSel
                              ? "rgba(255,255,255,0.25)"
                              : "rgba(255,255,255,0.12)"
                        }
                        strokeWidth={isPotentialTarget || isSel ? 1.5 : 0.8}
                        filter={`url(#ds-${n.id})`}
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                        padding: "0 28px",
                      }}
                    >
                      <div
                        ref={(el) => {
                          if (el && editingNodeIdRef.current !== n.id)
                            el.textContent = n.title;
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={() => {
                          editingNodeIdRef.current = n.id;
                        }}
                        onBlur={(e) => {
                          updateNodeField(
                            n.id,
                            "title",
                            (e.target as HTMLElement).innerText,
                          );
                          editingNodeIdRef.current = null;
                        }}
                        style={{
                          fontSize: fs,
                          fontWeight: n.bold ? 700 : 500,
                          fontStyle: n.italic ? "italic" : "normal",
                          textDecoration: n.underline ? "underline" : "none",
                          color: n.textColor ?? (isDark ? "#E8E6E1" : "#111"),
                          outline: "none",
                          textAlign: "center",
                          letterSpacing: "-0.2px",
                          width: "100%",
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                          overflow: "hidden",
                        }}
                      />
                      {n.body && (
                        <div
                          ref={(el) => {
                            if (el && editingNodeIdRef.current !== n.id)
                              el.textContent = n.body;
                          }}
                          contentEditable
                          suppressContentEditableWarning
                          onMouseDown={(e) => e.stopPropagation()}
                          onFocus={() => {
                            editingNodeIdRef.current = n.id;
                          }}
                          onBlur={(e) => {
                            updateNodeField(
                              n.id,
                              "body",
                              (e.target as HTMLElement).innerText,
                            );
                            editingNodeIdRef.current = null;
                          }}
                          style={{
                            fontSize: Math.max(11, fs - 2),
                            fontWeight: n.bold ? 600 : 400,
                            fontStyle: n.italic ? "italic" : "normal",
                            textDecoration: n.underline ? "underline" : "none",
                            color: n.textColor
                              ? n.textColor + "bb"
                              : isDark
                                ? "rgba(255,255,255,0.82)"
                                : "#888",
                            outline: "none",
                            textAlign: "center",
                            marginTop: 3,
                            width: "100%",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                            overflow: "hidden",
                          }}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Image */}
                {isImage && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                    }}
                  >
                    {n.imageUrl ? (
                      <img
                        src={n.imageUrl}
                        alt=""
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          borderRadius: 12,
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#6B7280",
                          fontSize: 13,
                        }}
                      >
                        No Image
                      </div>
                    )}
                    {isSel && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 12,
                          border: "1.5px solid rgba(255,255,255,0.2)",
                          pointerEvents: "none",
                          zIndex: 5,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Block / Rounded / Circle */}
                {/* Text File */}
                {isTextFile && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 12px",
                      width: "100%",
                      height: "100%",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      pointerEvents: "none",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span
                      style={{
                        fontSize: fs,
                        color: "rgba(255,255,255,0.82)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        letterSpacing: "-0.1px",
                      }}
                    >
                      {n.textFileName ?? n.title}
                    </span>
                  </div>
                )}

                {!isText && !isDiamond && !isImage && !isTextFile && (
                  <>
                    <div
                      ref={(el) => {
                        if (el && editingNodeIdRef.current !== n.id)
                          el.textContent = n.title;
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={() => {
                        editingNodeIdRef.current = n.id;
                      }}
                      onBlur={(e) => {
                        updateNodeField(
                          n.id,
                          "title",
                          (e.target as HTMLElement).innerText,
                        );
                        editingNodeIdRef.current = null;
                      }}
                      style={{
                        fontSize: fs,
                        fontWeight: n.bold ? 700 : 500,
                        fontStyle: n.italic ? "italic" : "normal",
                        textDecoration: n.underline ? "underline" : "none",
                        color: n.textColor ?? (isDark ? "#E8E6E1" : "#111"),
                        outline: "none",
                        letterSpacing: "-0.2px",
                        textAlign: isCircle ? "center" : "left",
                        zIndex: 1,
                        background: "transparent",
                        minWidth: 40,
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        overflow: "hidden",
                      }}
                    />
                    <div
                      ref={(el) => {
                        if (el && editingNodeIdRef.current !== n.id)
                          el.textContent = n.body;
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={() => {
                        editingNodeIdRef.current = n.id;
                      }}
                      onBlur={(e) => {
                        updateNodeField(
                          n.id,
                          "body",
                          (e.target as HTMLElement).innerText,
                        );
                        editingNodeIdRef.current = null;
                      }}
                      style={{
                        fontSize: Math.max(11, fs - 2),
                        fontWeight: n.bold ? 600 : 400,
                        fontStyle: n.italic ? "italic" : "normal",
                        textDecoration: n.underline ? "underline" : "none",
                        color: n.textColor
                          ? n.textColor + "bb"
                          : isDark
                            ? "rgba(255,255,255,0.82)"
                            : "#888",
                        marginTop: 5,
                        outline: "none",
                        lineHeight: 1.55,
                        minHeight: 16,
                        zIndex: 1,
                        background: "transparent",
                        width: "100%",
                        textAlign: isCircle ? "center" : "left",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        overflow: "hidden",
                      }}
                    />
                  </>
                )}

                {/* Free text */}
                {isText && (
                  <div
                    ref={(el) => {
                      if (el && editingNodeIdRef.current !== n.id)
                        el.textContent = n.title;
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={() => {
                      editingNodeIdRef.current = n.id;
                    }}
                    onBlur={(e) => {
                      updateNodeField(
                        n.id,
                        "title",
                        (e.target as HTMLElement).innerText,
                      );
                      editingNodeIdRef.current = null;
                    }}
                    style={{
                      fontSize: fs,
                      fontWeight: n.bold ? 700 : 400,
                      fontStyle: n.italic ? "italic" : "normal",
                      textDecoration: n.underline ? "underline" : "none",
                      color: n.textColor ?? "#E8E6E1",
                      outline: "none",
                      textAlign: "center",
                      lineHeight: 1.55,
                      minHeight: 32,
                      minWidth: 120,
                      letterSpacing: "-0.2px",
                      background: "transparent",
                      width: "100%",
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                      overflow: "visible",
                    }}
                  />
                )}

                {/* Move handle — text nodes only, top-left, visible on hover/select */}
                {isText && (hoveredId === n.id || isSel) && (
                  <div
                    data-role="move-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startNodeDrag(e, n.id);
                    }}
                    style={{
                      position: "absolute",
                      left: -8,
                      top: -8,
                      width: 16,
                      height: 16,
                      background: "rgba(28,32,36,0.97)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 4,
                      cursor: "move",
                      zIndex: 20,
                      boxShadow: "0 1px 6px rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                      style={{ pointerEvents: "none", display: "block" }}
                    >
                      <circle
                        cx="2"
                        cy="2"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="4"
                        cy="2"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="6"
                        cy="2"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="2"
                        cy="4"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="4"
                        cy="4"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="6"
                        cy="4"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="2"
                        cy="6"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="4"
                        cy="6"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                      <circle
                        cx="6"
                        cy="6"
                        r="0.8"
                        fill="rgba(255,255,255,0.55)"
                      />
                    </svg>
                  </div>
                )}

                {/* Connect dot — appears on hover, click to connect */}
                {showDot && (
                  <div
                    data-role="connect-dot"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => onDotClick(e, n.id)}
                    title={
                      connectDrag?.fromId === n.id
                        ? "Cancel connect"
                        : "Click to connect"
                    }
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      background:
                        connectDrag?.fromId === n.id ? ACCENT : "#2A2E34",
                      border: `2px solid ${ACCENT}`,
                      position: "absolute",
                      right: isCircle ? -9 : isDiamond ? -8 : -7,
                      top: "50%",
                      transform: "translateY(-50%)",
                      cursor: "crosshair",
                      zIndex: 10,
                      boxShadow: "0 1px 5px rgba(0,0,0,0.5)",
                      transition: "background 0.12s, transform 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-50%) scale(1.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-50%) scale(1)";
                    }}
                  />
                )}

                {/* Resize handle — outside node boundary, appears on hover */}
                {showResize && (
                  <div
                    data-role="resize-handle"
                    onMouseDown={(e) => onResizeMouseDown(e, n.id)}
                    style={{
                      position: "absolute",
                      right: -8,
                      bottom: -8,
                      width: 16,
                      height: 16,
                      background: "rgba(28,32,36,0.97)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 4,
                      cursor: "nwse-resize",
                      zIndex: 20,
                      boxShadow: "0 1px 6px rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: hoveredId === n.id || isSel ? 1 : 0,
                      transition:
                        "opacity 0.15s ease, box-shadow 0.15s ease, background 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 10px rgba(0,0,0,0.7)";
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(40,46,54,0.99)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 1px 6px rgba(0,0,0,0.6)";
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(28,32,36,0.97)";
                    }}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                      style={{ pointerEvents: "none", display: "block" }}
                    >
                      <line
                        x1="1.5"
                        y1="7"
                        x2="7"
                        y2="1.5"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1="4.5"
                        y1="7"
                        x2="7"
                        y2="4.5"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Node Context Menu ── */}
      {contextMenu?.kind === "node" &&
        (() => {
          const n = nodes.find((x) => x.id === contextMenu.id);
          if (!n) return null;
          const canColor = n.type !== "text" && n.type !== "image";
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: contextMenu.x,
                top: contextMenu.y,
                background: "rgba(22,24,28,0.97)",
                backdropFilter: "blur(24px)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
                zIndex: 300,
                minWidth: 240,
                padding: "6px 0",
              }}
            >
              {/* ── Text formatting ── */}
              <div style={{ padding: "8px 14px 10px" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#4B5563",
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
                    style={{ fontSize: 10, color: "#6B7280", flexShrink: 0 }}
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
                      color: "#9CA3AF",
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
                          color: active ? "#E8E6E1" : "#6B7280",
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
                      background: n.textColor ?? "#E8E6E1",
                      border: "1px solid rgba(255,255,255,0.1)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "#6B7280",
                      fontFamily: "monospace",
                      flex: 1,
                    }}
                  >
                    {n.textColor ?? "#E8E6E1"}
                  </span>
                  <div
                    onClick={() =>
                      openTextColorPicker(
                        contextMenu.id,
                        n.textColor ?? "#E8E6E1",
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
                      color: "#9CA3AF",
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
                      color: "#4B5563",
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
                        color: "#6B7280",
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
                        color: "#9CA3AF",
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
                  color: "rgba(255,255,255,0.3)",
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
          background: "rgba(20,22,24,0.92)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "6px 10px",
          display: "flex",
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
            color: "#9CA3AF",
            lineHeight: 1,
          }}
        >
          −
        </button>
        <span
          style={{
            fontSize: 11,
            color: "#6B7280",
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
            color: "#9CA3AF",
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
            color: "#6B7280",
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
          background: "rgba(20,22,24,0.88)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "7px 16px",
          fontSize: 11.5,
          color: "#4B5563",
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          zIndex: 100,
        }}
      >
        {connectDrag
          ? "Click any node to connect · Esc to cancel"
          : "Right-click → Shapes & Images · Click dot → select target to connect · Pinch / Ctrl+Scroll = Zoom"}
      </div>
    </div>
  );
}

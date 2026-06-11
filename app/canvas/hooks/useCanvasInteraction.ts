"use client";
import { useCallback, useEffect, useRef } from "react";
import { MIN_ZOOM, MAX_ZOOM } from "../lib/canvas-types";
import type { CanvasNode } from "../lib/canvas-types";

interface CanvasInteractionArgs {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomRef: React.RefObject<number>;
  nodeMapRef: React.RefObject<Map<number, CanvasNode>>;
  needsHistoryPushRef: React.RefObject<boolean>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setSnapGuides: React.Dispatch<React.SetStateAction<{ x?: number; y?: number }>>;
  setMarqueeRect: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>
  >;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}

// Wheel pan/zoom plus the global mousemove/mouseup pipeline. Mousemove bursts
// accumulate into pending refs and are flushed once per animation frame so node
// drag / resize / marquee / multi-drag all commit in a single React render.
// Owns the interaction refs; mousedown handlers in the page write into them.
export function useCanvasInteraction({
  canvasRef,
  panRef,
  zoomRef,
  nodeMapRef,
  needsHistoryPushRef,
  setPan,
  setZoom,
  setNodes,
  setSnapGuides,
  setMarqueeRect,
  setSelectedIds,
}: CanvasInteractionArgs) {
  const draggingRef = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const resizingRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    constrain: boolean; // keep w === h (circle)
  } | null>(null);
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const multiDraggingRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPositions: Map<number, { x: number; y: number }>;
  } | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Pending values accumulated during a mousemove burst; applied once per frame
  const rafRef = useRef<number | null>(null);
  const pendingPanDelta = useRef({ x: 0, y: 0 });
  const pendingDragPos = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  const pendingResizeSize = useRef<{ id: number; w: number; h: number } | null>(
    null,
  );
  const pendingMultiDragDelta = useRef<{ dx: number; dy: number } | null>(null);

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
        const delta = -e.deltaY * 0.016;
        const prev = zoomRef.current;
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta * prev));
        const p = panRef.current;
        const newPanX = mx - (mx - p.x) * (next / prev);
        const newPanY = my - (my - p.y) * (next / prev);
        setZoom(next);
        setPan({ x: newPanX, y: newPanY });
      } else {
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (multiDelta && multiDraggingRef.current) {
      pendingMultiDragDelta.current = null;
      const { startPositions } = multiDraggingRef.current;
      const { dx, dy } = multiDelta;
      setNodes((prev) =>
        prev.map((n) => {
          const start = startPositions.get(n.id);
          return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        !draggingRef.current &&
        !resizingRef.current &&
        !marqueeRef.current &&
        !multiDraggingRef.current
      )
        return;

      const pan = panRef.current;
      const zoom = zoomRef.current;
      let dirty = false;

      if (draggingRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        const { id, ox, oy } = draggingRef.current;
        pendingDragPos.current = { id, x: mx - ox, y: my - oy };
        dirty = true;
      }

      if (multiDraggingRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        pendingMultiDragDelta.current = {
          dx: mx - multiDraggingRef.current.startMouseX,
          dy: my - multiDraggingRef.current.startMouseY,
        };
        dirty = true;
      }

      if (marqueeRef.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const cx = (e.clientX - r.left - pan.x) / zoom;
        const cy = (e.clientY - r.top - pan.y) / zoom;
        const { startX, startY } = marqueeRef.current;
        const x = Math.min(startX, cx);
        const y = Math.min(startY, cy);
        const w = Math.abs(cx - startX);
        const h = Math.abs(cy - startY);
        marqueeRef.current = { startX, startY, x, y, w, h };
        setMarqueeRect({ x, y, w, h });
        dirty = true;
      }

      if (resizingRef.current) {
        const dx = (e.clientX - resizingRef.current.startX) / zoom;
        const dy = (e.clientY - resizingRef.current.startY) / zoom;
        const { id, startW, startH, constrain } = resizingRef.current;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flushPending],
  );

  const onMouseUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPending();

    // Marquee completion: select all intersecting nodes
    if (marqueeRef.current) {
      const { x, y, w, h } = marqueeRef.current;
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
      marqueeRef.current = null;
      setMarqueeRect(null);
    }

    if (draggingRef.current || resizingRef.current || multiDraggingRef.current) {
      needsHistoryPushRef.current = true;
    }
    draggingRef.current = null;
    resizingRef.current = null;
    multiDraggingRef.current = null;
    pendingMultiDragDelta.current = null;
    setSnapGuides({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return { draggingRef, resizingRef, marqueeRef, multiDraggingRef, lastMousePosRef };
}

"use client";
import { useCallback, useEffect, useRef } from "react";
import { computeForceLayout } from "../lib/force-layout";
import { easeInOutCubic } from "../lib/canvas-helpers";
import type { CanvasNode, Connection } from "../lib/canvas-types";

interface ForceLayoutArgs {
  nodeMapRef: React.RefObject<Map<number, CanvasNode>>;
  connectionsRef: React.RefObject<Connection[]>;
  needsHistoryPushRef: React.RefObject<boolean>;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
}

// ── Force-directed layout ──────────────────────────────────────────────────
// Computes target positions with d3-force, then animates nodes there over 600ms.
export function useForceLayout({
  nodeMapRef,
  connectionsRef,
  needsHistoryPushRef,
  setNodes,
}: ForceLayoutArgs) {
  const layoutRafRef = useRef<number | null>(null);
  const layoutFromRef = useRef<Map<number, { x: number; y: number }> | null>(
    null,
  );
  // Guards against overlapping solves (the compute is now async / chunked).
  const busyRef = useRef(false);

  // Cancel any in-flight rAF loop when the component unmounts so we don't
  // call setState after unmount (wasted work; React 18 silences the warning
  // but the computation still runs).
  useEffect(() => {
    return () => {
      if (layoutRafRef.current !== null)
        cancelAnimationFrame(layoutRafRef.current);
    };
  }, []);

  const runForceLayout = useCallback(async () => {
    // Read current state from refs — avoids capturing nodes/connections as
    // closure deps, which would cause this callback to be recreated on every
    // drag frame and every animation frame.
    if (busyRef.current) return; // a solve is already in progress
    const currentNodes = Array.from(nodeMapRef.current.values());
    const currentConnections = connectionsRef.current;
    if (currentNodes.length <= 1) return;

    // The d3 solve is async (lazy-loaded + chunked so it doesn't block the
    // main thread); ignore re-clicks until it resolves.
    busyRef.current = true;
    let targets: Array<{ id: number; newX: number; newY: number }>;
    try {
      targets = await computeForceLayout(currentNodes, currentConnections);
    } finally {
      busyRef.current = false;
    }
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    // Capture starting positions (current interpolated state if mid-animation)
    const from = new Map(
      currentNodes.map((n) => {
        const mid = layoutFromRef.current?.get(n.id);
        return [n.id, mid ?? { x: n.x, y: n.y }];
      }),
    );

    // Cancel any in-flight animation
    if (layoutRafRef.current !== null) {
      cancelAnimationFrame(layoutRafRef.current);
      layoutRafRef.current = null;
    }
    layoutFromRef.current = from;

    const duration = 600;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const e = easeInOutCubic(t);

      if (t < 1) {
        setNodes((prev) =>
          prev.map((n) => {
            const f = from.get(n.id);
            const tgt = targetMap.get(n.id);
            if (!f || !tgt) return n;
            return {
              ...n,
              x: f.x + (tgt.newX - f.x) * e,
              y: f.y + (tgt.newY - f.y) * e,
            };
          }),
        );
        // Track interpolated positions using from+targetMap (both stable in this
        // closure), so a mid-animation interrupt reads the correct current position.
        layoutFromRef.current = new Map(
          Array.from(from.entries()).map(([id, f]) => {
            const tgt = targetMap.get(id);
            if (!tgt) return [id, f];
            return [
              id,
              { x: f.x + (tgt.newX - f.x) * e, y: f.y + (tgt.newY - f.y) * e },
            ];
          }),
        );
        layoutRafRef.current = requestAnimationFrame(tick);
      } else {
        setNodes((prev) =>
          prev.map((n) => {
            const tgt = targetMap.get(n.id);
            return tgt ? { ...n, x: tgt.newX, y: tgt.newY } : n;
          }),
        );
        layoutRafRef.current = null;
        layoutFromRef.current = null;
        needsHistoryPushRef.current = true;
      }
    };

    layoutRafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return runForceLayout;
}

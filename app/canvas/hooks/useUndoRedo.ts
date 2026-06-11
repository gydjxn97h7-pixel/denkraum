"use client";
import { useCallback, useRef } from "react";
import type { CanvasNode, Connection } from "../lib/canvas-types";

// ── Undo / Redo history ───────────────────────────────────────────────────────

type HistorySnapshot = {
  nodes: CanvasNode[];
  connections: Connection[];
  presentationOrder: number[];
};

const HISTORY_LIMIT = 40;

interface UndoRedoArgs {
  nodesRef: React.RefObject<CanvasNode[]>;
  connectionsRef: React.RefObject<Connection[]>;
  presentationOrderRef: React.RefObject<number[]>;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setPresentationOrder: React.Dispatch<React.SetStateAction<number[]>>;
}

export function useUndoRedo({
  nodesRef,
  connectionsRef,
  presentationOrderRef,
  setNodes,
  setConnections,
  setPresentationOrder,
}: UndoRedoArgs) {
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      connections: connectionsRef.current.map((c) => ({ ...c })),
      presentationOrder: [...presentationOrderRef.current],
    };
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);
    if (newHistory.length > HISTORY_LIMIT) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, [nodesRef, connectionsRef, presentationOrderRef]);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const target = historyIndexRef.current - 1;
    historyIndexRef.current = target;
    const snap = historyRef.current[target];
    setNodes(snap.nodes.map((n) => ({ ...n })));
    setConnections(snap.connections.map((c) => ({ ...c })));
    setPresentationOrder([...snap.presentationOrder]);
  }, [setNodes, setConnections, setPresentationOrder]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const target = historyIndexRef.current + 1;
    historyIndexRef.current = target;
    const snap = historyRef.current[target];
    setNodes(snap.nodes.map((n) => ({ ...n })));
    setConnections(snap.connections.map((c) => ({ ...c })));
    setPresentationOrder([...snap.presentationOrder]);
  }, [setNodes, setConnections, setPresentationOrder]);

  return { pushHistory, undo, redo };
}

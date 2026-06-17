"use client";
import { useEffect } from "react";
import { getMaxNodeId } from "../lib/canvas-helpers";
import type {
  CanvasNode,
  ColorPicker,
  ConnectDrag,
  Connection,
  ContextMenu,
  NodeType,
} from "../lib/canvas-types";

interface KeyboardShortcutsArgs {
  // Filter
  filterOpenRef: React.RefObject<boolean>;
  filterActiveRef: React.RefObject<boolean>;
  filterJumpIndexRef: React.RefObject<number>;
  matchedNodesSortedRef: React.RefObject<CanvasNode[]>;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFilterText: React.Dispatch<React.SetStateAction<string>>;
  setFilterType: React.Dispatch<React.SetStateAction<NodeType | "all">>;
  setFilterJumpIndex: React.Dispatch<React.SetStateAction<number>>;
  focusNode: (id: number) => void;
  // Selection / clipboard
  selectedRef: React.RefObject<number | null>;
  selectedIdsRef: React.RefObject<Set<number>>;
  deleteSelected: () => void;
  copySelected: () => void;
  pasteNode: (cx?: number, cy?: number) => void;
  // Presentation
  isPresentingRef: React.RefObject<boolean>;
  presentationIndexRef: React.RefObject<number>;
  // Each step is the set of node ids the camera fits (one for a node step,
  // several for a group step).
  presentActiveSeqRef: React.RefObject<number[][]>;
  prePresentStateRef: React.RefObject<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>;
  animRafRef: React.RefObject<number | null>;
  animCurrentRef: React.RefObject<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>;
  setIsPresenting: React.Dispatch<React.SetStateAction<boolean>>;
  setPresentationIndex: React.Dispatch<React.SetStateAction<number>>;
  centerNodesForPresentation: (ids: number[]) => void;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  // Editing / overlays
  editingNodeIdRef: React.RefObject<number | null>;
  setConnectDrag: React.Dispatch<React.SetStateAction<ConnectDrag>>;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenu>>;
  setColorPicker: React.Dispatch<React.SetStateAction<ColorPicker>>;
  setTextColorPicker: React.Dispatch<React.SetStateAction<ColorPicker>>;
  // Save / history
  saveBoardRef: React.RefObject<() => void>;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  // Node creation (Tab / Enter)
  nodeMapRef: React.RefObject<Map<number, CanvasNode>>;
  idCounterRef: React.RefObject<number>;
  nodesRef: React.RefObject<CanvasNode[]>;
  connectionsRef: React.RefObject<Connection[]>;
  presentationOrderRef: React.RefObject<number[]>;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setPresentationOrder: React.Dispatch<React.SetStateAction<number[]>>;
  setSelected: React.Dispatch<React.SetStateAction<number | null>>;
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
// Global keydown handler: filter toggle/cycling, delete, escape, presentation
// navigation, save, undo/redo, copy/paste, and Tab/Enter node creation.
export function useKeyboardShortcuts({
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
}: KeyboardShortcutsArgs) {
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
          if (prePresentStateRef.current) {
            setPan(prePresentStateRef.current.pan);
            setZoom(prePresentStateRef.current.zoom);
            prePresentStateRef.current = null;
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
            centerNodesForPresentation(seq[next]);
          }
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(idx - 1, 0);
          if (prev !== idx) {
            setPresentationIndex(prev);
            centerNodesForPresentation(seq[prev]);
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveBoardRef.current();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "z" &&
        !t.isContentEditable &&
        t.tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
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
          const tabNode: CanvasNode = {
            id: newId, x: n.x + n.w + 80, y: n.y, w: 200, h: 80,
            title: "", label: `Block ${maxBlockIdx1 + 1}`, body: "",
            type: "block", color: "#FCFBF8", fontSize: 13,
          };
          const tabNodes = [...nodesRef.current, tabNode];
          const tabConns = [...connectionsRef.current, { from: selId, to: newId }];
          const tabOrder = [...presentationOrderRef.current, newId];
          nodesRef.current = tabNodes;
          connectionsRef.current = tabConns;
          presentationOrderRef.current = tabOrder;
          pushHistory();
          setNodes(tabNodes);
          setConnections(tabConns);
          setPresentationOrder(tabOrder);
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
          const enterNode: CanvasNode = {
            id: newId, x: n.x, y: n.y + n.h + 40, w: 200, h: 80,
            title: "", label: `Block ${maxBlockIdx2 + 1}`, body: "",
            type: "block", color: "#FCFBF8", fontSize: 13,
          };
          const enterNodes = [...nodesRef.current, enterNode];
          const enterOrder = [...presentationOrderRef.current, newId];
          nodesRef.current = enterNodes;
          presentationOrderRef.current = enterOrder;
          pushHistory();
          setNodes(enterNodes);
          setPresentationOrder(enterOrder);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deleteSelected,
    copySelected,
    pasteNode,
    focusNode,
    centerNodesForPresentation,
    pushHistory,
  ]);
}

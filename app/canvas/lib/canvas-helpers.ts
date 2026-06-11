import type { CanvasNode } from "./canvas-types";

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function getMaxNodeId(nodeMap: Map<number, CanvasNode>): number {
  let max = -1;
  for (const id of nodeMap.keys()) {
    if (id > max) max = id;
  }
  return max;
}

export function bringToFront(prev: CanvasNode[], id: number): CanvasNode[] {
  const idx = prev.findIndex((n) => n.id === id);
  if (idx === -1 || idx === prev.length - 1) return prev;
  const next = [...prev];
  next.push(next.splice(idx, 1)[0]);
  return next;
}

export function bringForward(prev: CanvasNode[], id: number): CanvasNode[] {
  const idx = prev.findIndex((n) => n.id === id);
  if (idx === -1 || idx === prev.length - 1) return prev;
  const next = [...prev];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  return next;
}

export function sendBackward(prev: CanvasNode[], id: number): CanvasNode[] {
  const idx = prev.findIndex((n) => n.id === id);
  if (idx <= 0) return prev;
  const next = [...prev];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  return next;
}

export function sendToBack(prev: CanvasNode[], id: number): CanvasNode[] {
  const idx = prev.findIndex((n) => n.id === id);
  if (idx <= 0) return prev;
  const next = [...prev];
  next.unshift(next.splice(idx, 1)[0]);
  return next;
}

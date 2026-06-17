import type { CanvasNode } from "./canvas-types";

// ── Story Path stepping ───────────────────────────────────────────────────────
// The presentation sequence is derived from the flat `presentationOrder` plus
// each node's optional `presentationGroupId`. A maximal *contiguous* run of
// nodes sharing one group id collapses into a single group step (the camera
// fits all of them at once); every other node is its own step. Membership is
// kept contiguous in `presentationOrder`, which is what makes one group = one
// step and keeps the order human-readable.

export type PresentationStep =
  | { kind: "node"; id: number }
  | { kind: "group"; groupId: string; memberIds: number[] };

// Collapse the flat order into node/group steps. Ids missing from the map are
// skipped. A group that has collapsed to a single member degrades gracefully
// to a node step (defensive — normal edits never leave a lone grouped node).
export function buildPresentationSteps(
  order: number[],
  nodeMap: Map<number, CanvasNode>,
): PresentationStep[] {
  const steps: PresentationStep[] = [];
  let i = 0;
  while (i < order.length) {
    const node = nodeMap.get(order[i]);
    if (!node) {
      i += 1;
      continue;
    }
    const gid = node.presentationGroupId;
    if (!gid) {
      steps.push({ kind: "node", id: node.id });
      i += 1;
      continue;
    }
    const memberIds: number[] = [];
    while (i < order.length) {
      const member = nodeMap.get(order[i]);
      if (member && member.presentationGroupId === gid) {
        memberIds.push(member.id);
        i += 1;
      } else break;
    }
    if (memberIds.length <= 1) steps.push({ kind: "node", id: memberIds[0] });
    else steps.push({ kind: "group", groupId: gid, memberIds });
  }
  return steps;
}

// Flatten steps back to a single id list (the canonical presentationOrder).
export function flattenSteps(steps: PresentationStep[]): number[] {
  const out: number[] = [];
  for (const s of steps) {
    if (s.kind === "node") out.push(s.id);
    else out.push(...s.memberIds);
  }
  return out;
}

// Navigation sequence: each step reduced to its non-excluded member ids (the
// nodes the camera should fit). Steps with no active members are dropped.
export function activeStepIds(
  steps: PresentationStep[],
  nodeMap: Map<number, CanvasNode>,
): number[][] {
  const result: number[][] = [];
  for (const s of steps) {
    const ids = (s.kind === "node" ? [s.id] : s.memberIds).filter(
      (id) => !nodeMap.get(id)?.excludeFromPresentation,
    );
    if (ids.length > 0) result.push(ids);
  }
  return result;
}

// Move the given ids so they sit together, in the order given, at the position
// of their earliest current occurrence — preserving the order of everything
// else. Used when forming a group from a multi-selection.
export function clusterContiguous(
  order: number[],
  idsToCluster: number[],
): number[] {
  const clusterSet = new Set(idsToCluster);
  const firstIdx = order.findIndex((id) => clusterSet.has(id));
  if (firstIdx < 0) return order;
  const present = idsToCluster.filter((id) => order.includes(id));
  const rest = order.filter((id) => !clusterSet.has(id));
  // How many non-cluster items precede the first cluster member — that's where
  // the contiguous block is inserted within `rest`.
  const before = order
    .slice(0, firstIdx)
    .filter((id) => !clusterSet.has(id)).length;
  return [...rest.slice(0, before), ...present, ...rest.slice(before)];
}

// Reconcile loaded/edited data: drop singleton or empty groups (clear their
// id) and re-cluster every surviving group so its members are contiguous.
// Returns a possibly-new order and node list (nodes are only re-created where a
// group id is cleared). A safety net for hand-edited files and post-delete
// state; well-formed in-session data is already normal.
export function normalizePresentation(
  order: number[],
  nodes: CanvasNode[],
): { order: number[]; nodes: CanvasNode[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n] as const));
  const counts = new Map<string, number>();
  for (const id of order) {
    const g = nodeMap.get(id)?.presentationGroupId;
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const clearIds = new Set<string>();
  for (const [g, c] of counts) if (c < 2) clearIds.add(g);

  let nextNodes = nodes;
  if (clearIds.size > 0) {
    nextNodes = nodes.map((n) => {
      if (n.presentationGroupId && clearIds.has(n.presentationGroupId)) {
        const copy = { ...n };
        delete copy.presentationGroupId;
        return copy;
      }
      return n;
    });
  }

  const nextMap = new Map(nextNodes.map((n) => [n.id, n] as const));
  let nextOrder = order;
  const seen = new Set<string>();
  for (const id of order) {
    const g = nextMap.get(id)?.presentationGroupId;
    if (g && !seen.has(g)) {
      seen.add(g);
      const members = nextOrder.filter(
        (x) => nextMap.get(x)?.presentationGroupId === g,
      );
      nextOrder = clusterContiguous(nextOrder, members);
    }
  }
  return { order: nextOrder, nodes: nextNodes };
}

// A short, board-unique group id. Persisted on member nodes, so it only needs
// to be stable and collision-free within one board.
export function newGroupId(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

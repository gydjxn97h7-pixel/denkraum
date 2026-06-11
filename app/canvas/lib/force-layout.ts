import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { CanvasNode, Connection } from "./canvas-types";

// Runs a d3 force simulation to completion and returns the new top-left
// position for each node, re-centered on the previous layout's centroid.
export function computeForceLayout(
  sourceNodes: CanvasNode[],
  sourceConnections: Connection[],
): Array<{ id: number; newX: number; newY: number }> {
  const oldCx =
    sourceNodes.reduce((s, n) => s + n.x + n.w / 2, 0) / sourceNodes.length;
  const oldCy =
    sourceNodes.reduce((s, n) => s + n.y + n.h / 2, 0) / sourceNodes.length;

  type SimNode = { id: number; x: number; y: number; w: number; h: number };
  const simNodes: SimNode[] = sourceNodes.map((n) => ({
    id: n.id,
    x: n.x + n.w / 2,
    y: n.y + n.h / 2,
    w: n.w,
    h: n.h,
  }));
  const idToSim = new Map(simNodes.map((n) => [n.id, n]));

  const simLinks = sourceConnections
    .filter((c) => idToSim.has(c.from) && idToSim.has(c.to))
    .map((c) => ({ source: c.from, target: c.to }));

  const sim = forceSimulation<SimNode>(simNodes)
    .force(
      "link",
      forceLink<SimNode, { source: number; target: number }>(simLinks)
        .id((d) => d.id)
        .distance(180)
        .strength(0.5),
    )
    .force("charge", forceManyBody<SimNode>().strength(-150))
    .force("center", forceCenter<SimNode>(oldCx, oldCy))
    .force("x", forceX<SimNode>(oldCx).strength(0.05))
    .force("y", forceY<SimNode>(oldCy).strength(0.05))
    .force(
      "collide",
      forceCollide<SimNode>((d) => Math.hypot(d.w, d.h) / 2 + 20),
    )
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();

  const newCxRaw = simNodes.reduce((s, n) => s + n.x, 0) / simNodes.length;
  const newCyRaw = simNodes.reduce((s, n) => s + n.y, 0) / simNodes.length;
  const dx = oldCx - newCxRaw;
  const dy = oldCy - newCyRaw;

  return simNodes.map((sn) => ({
    id: sn.id,
    newX: sn.x + dx - sn.w / 2,
    newY: sn.y + dy - sn.h / 2,
  }));
}

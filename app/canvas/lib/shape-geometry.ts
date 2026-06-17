import type { NodeType } from "./canvas-types";

// ── Polygon shape geometry ─────────────────────────────────────────────────────
// Vertices (in node-local coordinates, 0..w / 0..h) for the shape types that
// render as an SVG polygon silhouette rather than a CSS card. Shared by the
// on-screen renderer (NodeView) and the vector PDF export so both draw an
// identical outline. Returns null for the CSS-rendered types
// (block / rounded / circle / oval / text / image / textfile).
//
// `inset` keeps the outline a couple of px off the box edge so the stroke and
// drop shadow aren't clipped (matches the diamond's original 2px inset).

export type Point = { x: number; y: number };

export function polygonPoints(
  type: NodeType,
  w: number,
  h: number,
  inset = 2,
): Point[] | null {
  const lo = inset;
  const rx = w - inset;
  const by = h - inset;
  switch (type) {
    case "diamond":
      return [
        { x: w / 2, y: lo },
        { x: rx, y: h / 2 },
        { x: w / 2, y: by },
        { x: lo, y: h / 2 },
      ];
    case "triangle":
      return [
        { x: w / 2, y: lo },
        { x: rx, y: by },
        { x: lo, y: by },
      ];
    case "parallelogram": {
      // Right-leaning: top edge shifted right, bottom edge shifted left.
      const slant = Math.min(w * 0.22, h);
      return [
        { x: slant, y: lo },
        { x: rx, y: lo },
        { x: rx - slant, y: by },
        { x: lo, y: by },
      ];
    }
    case "arrow": {
      // Right-pointing block arrow: a rectangular shaft + triangular head.
      const headW = Math.min(w * 0.4, h); // head depth
      const shaftR = rx - headW; // x where the head begins
      const shaftTop = h * 0.3;
      const shaftBot = h * 0.7;
      return [
        { x: lo, y: shaftTop },
        { x: shaftR, y: shaftTop },
        { x: shaftR, y: lo },
        { x: rx, y: h / 2 },
        { x: shaftR, y: by },
        { x: shaftR, y: shaftBot },
        { x: lo, y: shaftBot },
      ];
    }
    case "star": {
      // 5-point star fitted to the box (ellipse-fitted radii).
      const cx = w / 2;
      const cy = h / 2;
      const orx = w / 2 - inset;
      const ory = h / 2 - inset;
      const INNER = 0.42; // inner/outer radius ratio
      const pts: Point[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : INNER;
        pts.push({
          x: cx + Math.cos(a) * orx * k,
          y: cy + Math.sin(a) * ory * k,
        });
      }
      return pts;
    }
    default:
      return null;
  }
}

// Serialize points for an SVG <polygon points="…"> attribute.
export function pointsAttr(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

// Shapes that render as an SVG polygon silhouette (transparent host background,
// shadow via SVG filter, text in a centered overlay) rather than a CSS card.
export const POLYGON_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  "diamond",
  "triangle",
  "star",
  "arrow",
  "parallelogram",
]);

export function isPolygonType(type: NodeType): boolean {
  return POLYGON_TYPES.has(type);
}

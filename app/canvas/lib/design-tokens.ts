// Shared design tokens for the canvas UI. Single source of truth for
// typography, radius, spacing, and surface treatment so components stop
// drifting into the mixed-fonts / arbitrary-pixel look they had before.

// ── Typography ──────────────────────────────────────────────────────────────
// Two-typeface system (loaded in app/layout.tsx):
//   FONT_DISPLAY (Clash Grotesk) — the display voice: titles, headlines, panel
//     section labels, node/document titles, nav. Used at 500/600 for presence.
//   FONT_BODY (Geist Mono) — all body/content + smaller UI text + metadata, and
//     the global default.
export const FONT_DISPLAY = "var(--font-clash), system-ui, sans-serif";
export const FONT_BODY = "var(--font-geist-mono), ui-monospace, monospace";
// Back-compat aliases. Container-level fontFamily should default to the body
// face; titles/labels opt into FONT_DISPLAY explicitly. FONT_MONO == body.
export const FONT_SANS = FONT_BODY;
export const FONT_MONO = FONT_BODY;

// Only two weights are used anywhere in the app.
export const WEIGHT = {
  regular: 400,
  semibold: 600,
} as const;

// ── Corner-radius scale ─────────────────────────────────────────────────────
// pill → action buttons / filters / badges / status pills
// sm   → icon buttons, inputs, swatches, menu rows, small tiles
// md   → context menus, dropdowns, popovers, cards, block nodes
// lg   → top-level surfaces: floating control bars, side panels, overlays
export const RADIUS = {
  pill: 999,
  sm: 8,
  md: 12,
  lg: 16,
} as const;

// ── Icon-button sizing ──────────────────────────────────────────────────────
// Diameters for square or circular icon buttons. A circular icon button pairs
// one of these sizes with RADIUS.pill ("50%"). Keeps icon-circle controls a
// consistent size instead of the ad-hoc 28/36px values they used before.
export const CONTROL = {
  sm: 28, // dense inline icon buttons
  md: 32, // standard circular icon button (e.g. editor formatting toolbar)
  lg: 36, // prominent icon buttons (e.g. canvas shape tools)
} as const;

// ── Iconography (lucide-react) ──────────────────────────────────────────────
// One icon system app-wide. ICON_PROPS pins a single visual stroke weight at
// any size (absoluteStrokeWidth keeps the stroke a fixed px, not scaled), so
// every icon shares the same weight regardless of glyph size. Icons inherit
// `currentColor` from their button, matching the text/accent tokens.
export const ICON = {
  sm: 15, // menu rows, metadata, inline
  md: 17, // default UI buttons (toolbar/doc-toolbar/zoom)
  lg: 19, // nav strip, shape tools, prominent
} as const;
export const ICON_STROKE = 1.75;
export const ICON_PROPS = {
  strokeWidth: ICON_STROKE,
  absoluteStrokeWidth: true,
} as const;

// ── Spacing scale (px), 4-based ─────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// ── Palette: warm mediterranean (cream / clay / terracotta) ─────────────────
// No green, no pure white. Nodes are a single cream surface; accents live only
// in UI chrome.
export const CANVAS_BG = "#EBE8E1"; // warm greige canvas
export const NODE_SURFACE = "#FCFBF8"; // warm cream/chalk node surface (all types)
export const NODE_TEXT = "#2A2823"; // warm near-black node text
export const STICKY_FILL = "#EAD884"; // muted mediterranean yellow — sticky notes

// Accents — UI chrome only (toolbar/sidebar/buttons/active states/connection
// lines/editor header), never node fills.
export const TERRACOTTA = "#C56B47"; // PRIMARY interactive (selection/active)
export const CLAY = "#B0795E"; // secondary surfaces / editor header / hover
export const OCHRE = "#D4A04A"; // attention / highlight / "saving"
export const OLIVE = "#7C7A4E"; // calm resting (connection lines, "saved")
export const SAND = "#D8C9A8"; // subtle tint / glass sheen / dividers
export const ACCENT = TERRACOTTA;

// ── Chrome surfaces: light cream glass with warm-dark ink ───────────────────
export const CHROME_GLASS =
  "linear-gradient(180deg, rgba(216,201,168,0.12) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.9)";
export const CHROME_SOLID = "rgba(252,251,248,0.97)";
export const INK = "#2A2823"; // primary chrome text
export const INK_MUTED = "rgba(42,40,35,0.6)";
export const INK_FAINT = "rgba(42,40,35,0.4)";

// Thin hairline borders + hover tints, warm-dark on the light chrome.
export const BORDER_DARK = "1px solid rgba(42,40,35,0.12)"; // hairline on chrome
export const BORDER_LIGHT = "1px solid rgba(42,40,35,0.08)"; // fainter hairline
export const HOVER_TINT = "rgba(42,40,35,0.06)";
// Soft, warm elevation for floating chrome panels (toolbar, sidebar, zoom,
// filter, menus) so they read as panels floating above the canvas — two layers
// (tight contact + broad diffuse ambient), large blur, low opacity.
export const ELEVATION =
  "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)";

// Node elevation scale — soft, diffuse, two-layer shadows (tight contact +
// broad ambient) so the cream cards float distinctly above the greige canvas,
// lit from above. Warm-brown tinted (rgba(58,48,38)). Present but soft.
// rest → resting node · hover → cursor over · active → selected / dragged.
// Blur radii were trimmed ~30% from their peak (and opacity nudged up slightly
// to keep the same perceived float): a soft shadow's paint cost grows with the
// square of the blur radius, so on a 200-node board this is a large cut to the
// total blur area rasterized on each repaint, with no real change to the look.
export const NODE_SHADOW = {
  rest: "0 2px 6px rgba(58,48,38,0.10), 0 12px 30px rgba(58,48,38,0.17)",
  hover: "0 5px 12px rgba(58,48,38,0.13), 0 18px 40px rgba(58,48,38,0.21)",
  active: "0 10px 22px rgba(58,48,38,0.17), 0 30px 60px rgba(58,48,38,0.27)",
  // Presentation-focused node: a deeper drop shadow + a faint cream halo so the
  // node reads as lit "on stage" against the blurred, dimmed backdrop.
  stage:
    "0 16px 40px rgba(58,48,38,0.26), 0 48px 104px rgba(58,48,38,0.34), 0 0 72px rgba(252,251,248,0.12)",
} as const;

// ── Reusable style fragments ────────────────────────────────────────────────
// Small uppercase metadata / section label — display voice (Clash Grotesk).
export const LABEL_STYLE = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11,
  fontWeight: WEIGHT.semibold,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

// Pill action button — consistent height + padding regardless of location.
export const BUTTON_PILL = {
  height: 30,
  padding: "0 14px",
  borderRadius: RADIUS.pill,
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: WEIGHT.semibold,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: SPACE.sm,
  cursor: "pointer",
} as const;

// ── DNKRM Design System — stone / wood / nature palette ─────────────────────
// New token system (Phase 2). Added alongside the existing exports above; the
// old values are migrated to these file by file in subsequent steps. Nothing
// references `tokens` yet, so this block is purely additive.
export const tokens = {
  // Base — Stone & Sand
  color: {
    canvas: "#F8F6F1",
    surface: "#F0EDE5",
    muted: "#E6E2D8",
    border: "#C9C5B8",
    subtle: "#8E8A82",
    text: "#3E3C38",
    ink: "#1D1C1A",

    // Warm — Wood & Sand
    sand: "#EDE0CC",
    linen: "#D4BFA0",
    driftwood: "#B09070",
    wood: "#8A6E50",
    bark: "#5E4A34",

    // Nature — Green (use sparingly, max one element per view)
    sage: "#B8C9A0",
    fern: "#8A9E72",
    moss: "#5C6B4A",

    // Sticky Note (unchanged)
    sticky: "#F5E97A",
    stickyBorder: "#D4C860",
  },

  radius: {
    xs: "2px", // buttons
    sm: "6px", // nodes
    md: "12px", // panels, sidebar
  },

  shadow: {
    node: "0 1px 3px rgba(0,0,0,0.05)",
    selected: "0 4px 12px rgba(0,0,0,0.08)",
    panel: "0 8px 24px rgba(0,0,0,0.10)",
  },

  motion: {
    micro: "80ms ease-out",
    standard: "180ms ease-out",
    deliberate: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
    breathe: "2800ms ease-in-out infinite",
  },
} as const;

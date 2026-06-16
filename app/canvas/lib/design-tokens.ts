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
export const NODE_SHADOW = {
  rest: "0 3px 8px rgba(58,48,38,0.10), 0 16px 36px rgba(58,48,38,0.16)",
  hover: "0 6px 14px rgba(58,48,38,0.12), 0 24px 48px rgba(58,48,38,0.20)",
  active: "0 12px 26px rgba(58,48,38,0.16), 0 40px 76px rgba(58,48,38,0.26)",
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

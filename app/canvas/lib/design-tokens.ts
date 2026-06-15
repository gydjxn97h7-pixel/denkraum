// Shared design tokens for the canvas UI. Single source of truth for
// typography, radius, spacing, and surface treatment so components stop
// drifting into the mixed-fonts / arbitrary-pixel look they had before.

// ── Typography ──────────────────────────────────────────────────────────────
// One geometric sans for all UI + content (loaded in app/layout.tsx). Geist
// Mono is kept only for tabular hex / numeric readouts.
export const FONT_SANS = "var(--font-geist-sans), system-ui, sans-serif";
export const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";

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

// ── Spacing scale (px), 4-based ─────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// ── Surfaces: borders over shadows ──────────────────────────────────────────
// Thin hairline borders replace heavy drop shadows for separation.
export const BORDER_DARK = "1px solid rgba(255,255,255,0.10)"; // on dark surfaces
export const BORDER_LIGHT = "1px solid rgba(20,40,33,0.10)"; // on light surfaces
// A single soft elevation for genuinely floating surfaces (menus, popovers),
// used sparingly alongside a border rather than as the primary separator.
export const ELEVATION = "0 8px 24px rgba(0,0,0,0.22)";

// ── Reusable style fragments ────────────────────────────────────────────────
// Small uppercase metadata / section label.
export const LABEL_STYLE = {
  fontFamily: FONT_SANS,
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

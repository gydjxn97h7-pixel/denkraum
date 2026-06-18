"use client";
import { ICON, ICON_STROKE } from "../lib/design-tokens";

// ── AI character — the DNKRM assistant persona ─────────────────────────────────
// Modelled on the IKEA manual figure: a 3/4 head, not a face-on smiley. The
// silhouette is an asymmetric egg with a small nose notch poking out the left
// edge; there's a single off-centre eye and one long, slightly lopsided mouth.
// That reduction + asymmetry is what reads as "a person", not an emoji.
//
// Line-only, Lucide idiom (absolute stroke 1.75, round caps). Expression is
// pure CSS: the head + nose are static; the eye and mouth groups scale on Y
// (with a transition), so smile / flat / skeptical morph without JS or path
// tweening. Readable around 48px.

export type AiCharacterState = "idle" | "thinking" | "done" | "error";

// scaleY of the single eye dot — 1 = open, <1 = narrowed.
const EYE_SCALE: Record<AiCharacterState, number> = {
  idle: 1,
  thinking: 0.35,
  done: 1,
  error: 0.4,
};
// scaleY of the mouth arc — 1 = full curve, ~0 = flat, negative = inverted (wry).
const MOUTH_SCALE: Record<AiCharacterState, number> = {
  idle: 0.45,
  thinking: 0.05,
  done: 1,
  error: -0.5,
};

// Asymmetric head with a nose notch on the lower-left silhouette.
const HEAD_PATH =
  "M9 3.6 C12.5 2.6 17 4.2 17.6 9 C18.2 13 17.4 17.2 14.2 19.6 " +
  "C11.6 21.5 8.4 20.8 7 17.8 C6.3 16.3 6.2 15 6.3 13.9 " +
  "L4.7 13 L6.5 11.8 C6.9 7.2 6.6 4.8 9 3.6 Z";

// One long mouth; control point sits left of centre so the dip is lopsided.
const MOUTH_PATH = "M7.8 15.3 Q10.3 17.4 13.8 15.3";

export function AiCharacter({
  state = "idle",
  size = ICON.md,
  color = "currentColor",
}: {
  state?: AiCharacterState;
  size?: number;
  color?: string;
}) {
  // Keep the stroke a fixed visual weight regardless of render size (same
  // technique as OvalIcon / PolygonGlyph).
  const strokeWidth = (ICON_STROKE * 24) / size;
  const transition = "transform 0.28s ease";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Head + nose notch (static) */}
      <path d={HEAD_PATH} />

      {/* Single eye — high and off-centre toward the nose side */}
      <g
        style={{
          transition,
          transformBox: "view-box",
          transformOrigin: "10.3px 9px",
          transform: `scaleY(${EYE_SCALE[state]})`,
        }}
      >
        <circle cx="10.3" cy="9" r="1.1" fill={color} stroke="none" />
      </g>

      {/* Mouth — scaleY morphs smile / flat / wry */}
      <path
        d={MOUTH_PATH}
        style={{
          transition,
          transformBox: "view-box",
          transformOrigin: "10.8px 15.3px",
          transform: `scaleY(${MOUTH_SCALE[state]})`,
        }}
      />
    </svg>
  );
}

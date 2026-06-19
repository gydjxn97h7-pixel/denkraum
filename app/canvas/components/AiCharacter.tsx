"use client";
import { ICON, ICON_STROKE } from "../lib/design-tokens";

// ── AI companion ───────────────────────────────────────────────────────────────
// The companion IS the DNKRM brand mark, brought to life: three nested rounded
// squares — the "thinking space" — with a glowing core that represents the active
// thought. Pure SVG + CSS (no WebGL, no dependency, crisp at any size), so it's
// fast and unmistakably this app's. Identity stays constant; only the core's
// colour + motion change with mood:
//   idle      terracotta core, a slow steady pulse
//   thinking  ochre core that rotates back and forth, glow quickens
//   done      olive core, a single bloom outward
//   error     deep-clay core, a brief shake of the whole mark
//
// All ambient life + per-state moods live in canvas.css, keyed off data-state, so
// this stays a static, cache-friendly tree. The fixed-stroke trick keeps the
// frame's line weight constant at any render size.

export type AiCharacterState = "idle" | "thinking" | "done" | "error";

export function AiCharacter({
  state = "idle",
  size = ICON.md,
}: {
  state?: AiCharacterState;
  size?: number;
  /** Kept for API compatibility; the mark carries its own brand colours. */
  color?: string;
}) {
  // Constant visual stroke weight regardless of render size.
  const strokeWidth = (ICON_STROKE * 24) / size;

  return (
    <svg
      className="ai-mark"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="ai-mark__breathe">
        {/* The room — outer frame (brand identity, always terracotta) */}
        <rect
          className="ai-mark__frame"
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          rx="5.5"
          stroke="rgba(197,107,71,0.34)"
          strokeWidth={strokeWidth}
        />
        {/* Inner space — a soft warm tint */}
        <rect
          x="5.5"
          y="5.5"
          width="13"
          height="13"
          rx="4"
          fill="rgba(197,107,71,0.13)"
        />
        {/* Soft glow behind the core (pulses / blooms) */}
        <rect
          className="ai-mark__glow"
          x="8.5"
          y="8.5"
          width="7"
          height="7"
          rx="3"
        />
        {/* The thought — the living core, coloured by mood */}
        <rect
          className="ai-mark__core"
          x="8.5"
          y="8.5"
          width="7"
          height="7"
          rx="3"
        />
      </g>
    </svg>
  );
}

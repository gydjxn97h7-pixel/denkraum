"use client";
import { useId } from "react";
import { ICON, ICON_STROKE, ACCENT } from "../lib/design-tokens";

// ── AI companion ───────────────────────────────────────────────────────────────
// DNKRM's assistant is a small living companion, not an icon: a soft, warm-cream
// body with a faint terracotta tint that *breathes*, two eyes that blink on their
// own, and a little antenna whose "spark" pulses — the one overtly digital cue on
// an otherwise hand-made-feeling creature. It always feels alive; state only
// changes its mood:
//   idle      gentle float + slow blink, soft smile
//   thinking  eyes lift and narrow (curious), spark races, mouth purses
//   done      caret "^ ^" eyes, big smile, blush, a happy little pop
//   error     worried brows, a frown, a quick shake
//
// All the ambient life (breathe / blink / spark / float) is CSS in canvas.css so
// it costs nothing here; per-state moods are CSS too, toggled by data-state, so
// this component stays a static, cache-friendly tree. The fixed-stroke trick
// (stroke scaled by 24/size) keeps line weight constant at any render size.

export type AiCharacterState = "idle" | "thinking" | "done" | "error";

// Soft warm body fill — a faint terracotta-tinted gradient so the companion has
// presence on the cream chrome without shouting. Stroke is a quiet clay hairline.
const HULL_STROKE = "rgba(197,107,71,0.42)";
const HULL_TOP = "#FEFBF7";
const HULL_BOTTOM = "#F1DECC";

export function AiCharacter({
  state = "idle",
  size = ICON.md,
  color = "currentColor",
}: {
  state?: AiCharacterState;
  size?: number;
  color?: string;
}) {
  // Constant visual stroke weight regardless of render size.
  const strokeWidth = (ICON_STROKE * 24) / size;
  // Unique gradient id per instance (several render at once: sidebar, modal,
  // flight clone) so their <defs> never collide.
  const uid = useId().replace(/:/g, "");
  const hullGrad = `aicomp-hull-${uid}`;

  return (
    <svg
      className="ai-comp"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={hullGrad} x1="12" y1="6" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={HULL_TOP} />
          <stop offset="1" stopColor={HULL_BOTTOM} />
        </linearGradient>
      </defs>

      {/* Whole-creature motion: float at rest, pop on done, shake on error */}
      <g className="ai-comp__bob">
        {/* Breathing — scales gently from the base so everything tracks the body */}
        <g className="ai-comp__breathe">
          {/* Antenna + spark (the one digital tell) */}
          <circle
            className="ai-comp__glow"
            cx="12"
            cy="2.9"
            r="2.6"
            fill={ACCENT}
            stroke="none"
          />
          <line className="ai-comp__antenna" x1="12" y1="6.4" x2="12" y2="3.7" />
          <circle
            className="ai-comp__spark"
            cx="12"
            cy="2.9"
            r="1.35"
            fill={ACCENT}
            stroke="none"
          />

          {/* Body */}
          <rect
            className="ai-comp__hull"
            x="3.6"
            y="6.6"
            width="16.8"
            height="14.9"
            rx="6.6"
            fill={`url(#${hullGrad})`}
            stroke={HULL_STROKE}
          />

          {/* Blush */}
          <g className="ai-comp__cheeks" fill="rgba(197,107,71,0.45)" stroke="none">
            <ellipse cx="8.1" cy="16.2" rx="1.35" ry="0.85" />
            <ellipse cx="15.9" cy="16.2" rx="1.35" ry="0.85" />
          </g>

          {/* Eyes — outer group shifts/narrows by mood, inner group blinks */}
          <g className="ai-comp__eyes">
            <g className="ai-comp__blink">
              <g className="ai-comp__eyes-open" fill={color} stroke="none">
                <circle cx="9.3" cy="13" r="1.45" />
                <circle cx="14.7" cy="13" r="1.45" />
              </g>
              <g className="ai-comp__eyes-happy" fill="none" stroke={color}>
                <path d="M7.95 13.5 Q9.3 12 10.65 13.5" />
                <path d="M13.35 13.5 Q14.7 12 16.05 13.5" />
              </g>
            </g>
          </g>

          {/* Worried brows — only on error (inner ends raised = concerned, not
              angry, so a failure reads as the companion fretting, not scowling) */}
          <g className="ai-comp__brows" stroke={color}>
            <line x1="7.8" y1="11.5" x2="10.4" y2="10.5" />
            <line x1="16.2" y1="11.5" x2="13.6" y2="10.5" />
          </g>

          {/* Mouth — scaleY morphs smile / purse / frown */}
          <path className="ai-comp__mouth" d="M9.9 16.9 Q12 18.7 14.1 16.9" stroke={color} />
        </g>
      </g>
    </svg>
  );
}

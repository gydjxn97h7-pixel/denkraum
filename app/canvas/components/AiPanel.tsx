"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, FileText, GitBranch, Crosshair, X } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";
import { ACCENT } from "../lib/canvas-types";
import { PanelSectionLabel } from "./panel-ui";
import { useApiKey } from "../lib/ai-key";
import { AiCharacter, type AiCharacterState } from "./AiCharacter";

// The companion has a name so it reads as a presence, not a status icon.
const COMPANION_NAME = "Sol";

// A warm, in-character mood line per state — the companion "speaking".
const STATE_MOOD: Record<AiCharacterState, string> = {
  idle: "Ready when you are",
  thinking: "Thinking it through…",
  done: "There you go!",
  error: "That didn't work",
};

// Soft status dot colour matching the mood.
const STATE_DOT: Record<AiCharacterState, string> = {
  idle: "#7C7A4E", // olive — calm
  thinking: "#D4A04A", // ochre — working
  done: "#7C7A4E", // olive — happy/settled
  error: "#C56B47", // terracotta — attention
};

// What the assistant can do today — strictly the features that work now.
const FEATURES: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}[] = [
  {
    icon: <Sparkles size={ICON.sm} {...ICON_PROPS} />,
    title: "Generate",
    desc: "Describe an idea and AI builds a node graph.",
  },
  {
    icon: <GitBranch size={ICON.sm} {...ICON_PROPS} />,
    title: "Expand",
    desc: "Right-click any node to branch it with AI.",
  },
  {
    icon: <FileText size={ICON.sm} {...ICON_PROPS} />,
    title: "Summarize",
    desc: "Condense your entire board into one text node.",
  },
];

// ── AI assistant actions + feature overview ──
export function AiPanel({
  aiState,
  nodeCount,
  onSummarize,
  onGenerate,
  workspace,
  placingWorkspace,
  onAssignWorkspace,
  onClearWorkspace,
  flightSignal,
  getFlightTarget,
}: {
  aiState: AiCharacterState;
  nodeCount: number;
  onSummarize: () => void;
  onGenerate: () => void;
  workspace: { x: number; y: number } | null;
  placingWorkspace: boolean;
  onAssignWorkspace: () => void;
  onClearWorkspace: () => void;
  flightSignal: number;
  getFlightTarget: () => { sx: number; sy: number } | null;
}) {
  const { hasKey } = useApiKey();

  // "Flight": when a marker-targeted AI call starts, the character glides once
  // toward the marker's on-screen position, then snaps back. Subtle, not a romp.
  // It flies as a fixed-position clone (the sidebar clips overflow, so the real
  // character can't leave the panel) while the real one fades for the trip.
  const charRef = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    dx: number;
    dy: number;
    armed: boolean;
  } | null>(null);
  useEffect(() => {
    if (flightSignal === 0) return;
    const el = charRef.current;
    // Recompute the marker's screen position from the live camera right now; if
    // the marker is off-screen the getter returns null and we skip the flight
    // (nodes still place — the animation is purely decorative).
    const target = getFlightTarget();
    if (!el || !target) return;
    const r = el.getBoundingClientRect();
    setFlight({
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      dx: target.sx - (r.left + r.width / 2),
      dy: target.sy - (r.top + r.height / 2),
      armed: false,
    });
    // Arm on the next frame so the transform transition actually runs.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setFlight((f) => (f ? { ...f, armed: true } : f)),
      ),
    );
    // Snap back once the ~400ms flight completes. Timer-driven so the return is
    // guaranteed even if the camera moved during the trip — the real character
    // always reappears at its resting spot in the sidebar.
    const t = setTimeout(() => setFlight(null), 440);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // Re-fire only on a new signal; the target is recomputed live above.
  }, [flightSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: 16,
      }}
    >
      {/* Flight clone — fixed to the viewport so it isn't clipped by the panel */}
      {flight &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: flight.x,
              top: flight.y,
              width: flight.w,
              height: flight.h,
              transform: flight.armed
                ? `translate(${flight.dx}px, ${flight.dy}px) scale(0.92)`
                : "none",
              transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "transform",
              pointerEvents: "none",
              zIndex: 600,
              // Faithful copy of the resting pedestal so the lift-off reads as
              // the whole companion leaving its stage.
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 42%, rgba(197,107,71,0.16), rgba(197,107,71,0.05) 58%, transparent 72%)",
            }}
          >
            <AiCharacter state={aiState} size={52} color="#2A2823" />
          </div>,
          document.body,
        )}

      {/* Assistant character */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "4px 16px 18px",
        }}
      >
        {/* Companion on a soft aura pedestal */}
        <span
          ref={charRef}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: "50%",
            // A warm radial halo so the companion sits on a little stage.
            background:
              "radial-gradient(circle at 50% 42%, rgba(197,107,71,0.16), rgba(197,107,71,0.05) 58%, transparent 72%)",
            // Hidden while its clone makes the trip; reappears (snaps back) when
            // the flight ends.
            opacity: flight ? 0 : 1,
            transition: "opacity 120ms ease-out",
          }}
        >
          <AiCharacter state={aiState} size={52} color="#2A2823" />
        </span>

        {/* Name */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "#2A2823",
            fontFamily: "var(--font-clash), system-ui, sans-serif",
            marginTop: 2,
          }}
        >
          {COMPANION_NAME}
        </span>

        {/* Mood line with a status dot */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "rgba(42,40,35,0.5)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: STATE_DOT[aiState],
              flexShrink: 0,
              transition: "background 0.3s ease",
            }}
          />
          {STATE_MOOD[aiState]}
        </span>
      </div>

      {/* Generate — primary AI entry point */}
      {hasKey && (
        <div style={{ padding: "0 16px 8px" }}>
          <button
            onClick={onGenerate}
            disabled={aiState === "thinking"}
            title="Generate a node graph with AI"
            style={{
              width: "100%",
              height: 36,
              borderRadius: 10,
              border: "none",
              background: ACCENT,
              color: "#FCFBF8",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: aiState === "thinking" ? "default" : "pointer",
              opacity: aiState === "thinking" ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Sparkles size={ICON.sm} {...ICON_PROPS} />
            Generate
          </button>
        </div>
      )}

      {/* Summarize — only when a key is set and the board has nodes */}
      {hasKey && nodeCount > 0 && (
        <div style={{ padding: "0 16px 4px" }}>
          <button
            onClick={onSummarize}
            disabled={aiState === "thinking"}
            title="Summarize the board into a text node"
            style={{
              width: "100%",
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(42,40,35,0.12)",
              background: "transparent",
              color:
                aiState === "thinking"
                  ? "rgba(42,40,35,0.4)"
                  : "rgba(42,40,35,0.85)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: aiState === "thinking" ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <FileText size={ICON.sm} {...ICON_PROPS} />
            {aiState === "thinking" ? "Summarizing…" : "Summarize board"}
          </button>
        </div>
      )}

      {/* AI workspace marker — assign / clear a spot for AI output */}
      {hasKey && (
        <div style={{ padding: "0 16px 4px" }}>
          <button
            onClick={
              placingWorkspace
                ? undefined
                : workspace
                  ? onClearWorkspace
                  : onAssignWorkspace
            }
            title={
              workspace
                ? "Remove the AI workspace marker"
                : "Pick a spot on the canvas for AI output"
            }
            style={{
              width: "100%",
              height: 36,
              borderRadius: 10,
              border: placingWorkspace
                ? `1px solid ${ACCENT}`
                : "1px solid rgba(42,40,35,0.12)",
              background: placingWorkspace
                ? "rgba(197,107,71,0.10)"
                : "transparent",
              color: placingWorkspace ? ACCENT : "rgba(42,40,35,0.85)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: placingWorkspace ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {workspace && !placingWorkspace ? (
              <X size={ICON.sm} {...ICON_PROPS} />
            ) : (
              <Crosshair size={ICON.sm} {...ICON_PROPS} />
            )}
            {placingWorkspace
              ? "Click on canvas…"
              : workspace
                ? "Clear workspace"
                : "Assign AI workspace"}
          </button>

          {/* Coordinate hint when a marker is set */}
          {workspace && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "rgba(42,40,35,0.5)",
                textAlign: "center",
              }}
            >
              x: {Math.round(workspace.x)}, y: {Math.round(workspace.y)}
            </div>
          )}
        </div>
      )}

      {/* Hint when no key — points to the Settings panel */}
      {!hasKey && (
        <div style={{ padding: "0 16px 4px" }}>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "rgba(42,40,35,0.55)",
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(42,40,35,0.04)",
              border: "1px solid rgba(42,40,35,0.08)",
            }}
          >
            Add your Anthropic API key in Settings to start using the assistant.
          </div>
        </div>
      )}

      {/* Feature overview */}
      <PanelSectionLabel>What AI can do</PanelSectionLabel>
      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {FEATURES.map(({ icon, title, desc }) => (
          <div
            key={title}
            style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: ACCENT,
                background: "rgba(197,107,71,0.10)",
                border: "1px solid rgba(197,107,71,0.18)",
              }}
            >
              {icon}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#2A2823",
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: "rgba(42,40,35,0.6)",
                }}
              >
                {desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

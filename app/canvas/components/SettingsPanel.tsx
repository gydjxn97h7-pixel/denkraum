"use client";
import { useState } from "react";
import { Check, AlertTriangle, X, Sparkles } from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";
import { PanelSectionLabel } from "./panel-ui";
import { useApiKey, validateKey } from "../lib/ai-key";
import type { CanvasBg } from "../lib/canvas-types";

const OLIVE = tokens.color.fern;
const OCHRE = tokens.color.driftwood;

const CANVAS_BG_OPTIONS: { v: CanvasBg; label: string; desc: string }[] = [
  { v: "blank", label: "Blank", desc: "Plain stone surface" },
  { v: "grid", label: "Grid", desc: "Dot grid (default)" },
  { v: "atmospheric", label: "Atmospheric", desc: "Soft blurred backdrop" },
];

type Feedback = { tone: "good" | "bad" | "warn"; text: string } | null;

// ── Settings (canvas background + Anthropic API key) ──
export function SettingsPanel({
  canvasBg,
  setCanvasBg,
}: {
  canvasBg: CanvasBg;
  setCanvasBg: (v: CanvasBg) => void;
}) {
  const { apiKey, hasKey, save, clear } = useApiKey();
  const [draft, setDraft] = useState(apiKey);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Keep the field in sync the first time the stored key hydrates (useApiKey
  // reads localStorage in an effect, so apiKey is "" on the very first render).
  const [hydratedFrom, setHydratedFrom] = useState("");
  if (apiKey && apiKey !== hydratedFrom && draft === "") {
    setHydratedFrom(apiKey);
    setDraft(apiKey);
  }

  const onSave = () => {
    save(draft);
    setFeedback({ tone: "good", text: "Saved on this device." });
  };

  const onValidate = async () => {
    setChecking(true);
    setFeedback(null);
    const r = await validateKey(draft);
    setChecking(false);
    setFeedback({
      tone: r.status === "valid" ? "good" : r.status === "invalid" ? "bad" : "warn",
      text: r.message,
    });
  };

  const onClear = () => {
    clear();
    setDraft("");
    setHydratedFrom("");
    setFeedback({ tone: "good", text: "Key removed from this device." });
  };

  const feedbackColor =
    feedback?.tone === "good"
      ? OLIVE
      : feedback?.tone === "bad"
        ? tokens.color.alert
        : OCHRE;

  const primaryBtn: React.CSSProperties = {
    flex: 1,
    height: 32,
    borderRadius: tokens.radius.xs,
    border: "none",
    background: tokens.color.ink,
    color: tokens.color.canvas,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
  const secondaryBtn = (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    height: 32,
    borderRadius: tokens.radius.xs,
    border: `0.5px solid ${tokens.color.border}`,
    background: "transparent",
    color: disabled ? "rgba(42,40,35,0.3)" : tokens.color.text,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: 16,
      }}
    >
      <PanelSectionLabel first>Canvas Background</PanelSectionLabel>
      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {CANVAS_BG_OPTIONS.map(({ v, label, desc }) => {
          const active = canvasBg === v;
          return (
            <button
              key={v}
              onClick={() => setCanvasBg(v)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                width: "100%",
                padding: "8px 10px",
                borderRadius: tokens.radius.xs,
                border: `0.5px solid ${active ? tokens.color.ink : tokens.color.border}`,
                background: active ? tokens.color.ink : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: active ? tokens.color.canvas : tokens.color.text,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: active
                    ? "rgba(248,246,241,0.7)"
                    : "rgba(42,40,35,0.45)",
                }}
              >
                {desc}
              </span>
            </button>
          );
        })}
      </div>

      <PanelSectionLabel>Anthropic API Key</PanelSectionLabel>

      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Privacy note */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "10px 12px",
            borderRadius: 10,
            background: tokens.color.sand,
            border: `0.5px solid ${tokens.color.border}`,
          }}
        >
          <Sparkles
            size={ICON.sm}
            {...ICON_PROPS}
            color={tokens.color.wood}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <span
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "rgba(42,40,35,0.7)",
            }}
          >
            Your API key is stored locally in your browser and never leaves your
            device.
          </span>
        </div>

        {/* Key input */}
        <input
          type="password"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          placeholder="sk-ant-…"
          onChange={(e) => {
            setDraft(e.target.value);
            setFeedback(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") onValidate();
          }}
          style={{
            height: 34,
            borderRadius: 8,
            border: `0.5px solid ${tokens.color.border}`,
            background: tokens.color.sand,
            padding: "0 10px",
            fontSize: 12,
            fontFamily: "inherit",
            color: "#2A2823",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSave} disabled={checking} style={primaryBtn}>
            Save
          </button>
          <button
            onClick={onValidate}
            disabled={checking || draft.trim() === ""}
            style={secondaryBtn(checking || draft.trim() === "")}
          >
            {checking ? "Checking…" : "Validate"}
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: feedbackColor,
            }}
          >
            {feedback.tone === "good" ? (
              <Check size={ICON.sm} {...ICON_PROPS} />
            ) : (
              <AlertTriangle size={ICON.sm} {...ICON_PROPS} />
            )}
            {feedback.text}
          </div>
        )}

        {/* Clear */}
        <button
          onClick={onClear}
          disabled={!hasKey && draft === ""}
          style={{
            height: 30,
            borderRadius: tokens.radius.xs,
            border: "none",
            background: "transparent",
            color: !hasKey && draft === "" ? "rgba(42,40,35,0.3)" : tokens.color.ink,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: !hasKey && draft === "" ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            alignSelf: "flex-start",
            padding: "0 4px",
          }}
        >
          <X size={ICON.sm} {...ICON_PROPS} />
          Clear key
        </button>

        {/* Status + help */}
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              color: hasKey ? OLIVE : "rgba(42,40,35,0.4)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {hasKey ? "Key saved on this device" : "No key set"}
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: "rgba(42,40,35,0.45)",
              textDecoration: "underline",
            }}
          >
            Get an API key →
          </a>
        </div>
      </div>
    </div>
  );
}

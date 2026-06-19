"use client";
import { useState } from "react";
import { Check, AlertTriangle, X, Sparkles } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";
import { ACCENT } from "../lib/canvas-types";
import { PanelSectionLabel } from "./panel-ui";
import { useApiKey, validateKey } from "../lib/ai-key";

const OLIVE = "#7C7A4E";
const OCHRE = "#D4A04A";

type Feedback = { tone: "good" | "bad" | "warn"; text: string } | null;

// ── Settings (Anthropic API key) — the only place the key is managed ──
export function SettingsPanel() {
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
        ? ACCENT
        : OCHRE;

  const primaryBtn: React.CSSProperties = {
    flex: 1,
    height: 32,
    borderRadius: 8,
    border: "none",
    background: ACCENT,
    color: "#FCFBF8",
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
    borderRadius: 8,
    border: "1px solid rgba(42,40,35,0.12)",
    background: "transparent",
    color: disabled ? "rgba(42,40,35,0.3)" : "rgba(42,40,35,0.85)",
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
      <PanelSectionLabel first>Anthropic API Key</PanelSectionLabel>

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
            background: "rgba(197,107,71,0.07)",
            border: "1px solid rgba(197,107,71,0.18)",
          }}
        >
          <Sparkles
            size={ICON.sm}
            {...ICON_PROPS}
            color={ACCENT}
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
            border: "1px solid rgba(42,40,35,0.14)",
            background: "rgba(42,40,35,0.04)",
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
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: !hasKey && draft === "" ? "rgba(42,40,35,0.3)" : ACCENT,
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

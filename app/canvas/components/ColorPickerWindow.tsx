"use client";
import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { ACCENT, PRESET_COLORS } from "../lib/canvas-types";
import type { ColorPicker } from "../lib/canvas-types";
import {
  hexToHsv,
  hsvToHex,
  hexToRgb,
  rgbToHex,
  isValidHex,
  parseColor,
  toRgbaString,
} from "../lib/color-helpers";

export function TrafficDot({
  color,
  title,
  onClick,
}: {
  color: string;
  title: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: color,
        cursor: "pointer",
        transition: "transform 0.1s, filter 0.1s",
        transform: hovered ? "scale(1.15)" : "scale(1)",
        filter: hovered ? "brightness(0.88)" : "brightness(1)",
      }}
    />
  );
}

const CHECKER =
  "linear-gradient(45deg,#808080 25%,transparent 25%)," +
  "linear-gradient(-45deg,#808080 25%,transparent 25%)," +
  "linear-gradient(45deg,transparent 75%,#808080 75%)," +
  "linear-gradient(-45deg,transparent 75%,#808080 75%)";

export function ColorPickerWindow({
  picker,
  onColorChange,
  onClose,
}: {
  picker: NonNullable<ColorPicker>;
  onColorChange: (id: number, color: string) => void;
  onClose: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: picker.x, y: picker.y });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const initParsed = parseColor(picker.color);
  const initHex = rgbToHex(initParsed.r, initParsed.g, initParsed.b);

  const [hsv, setHsv] = useState<[number, number, number]>(() =>
    hexToHsv(initHex),
  );
  const [hexInput, setHexInput] = useState(initHex);
  const [rgbInput, setRgbInput] = useState<[string, string, string]>([
    String(initParsed.r),
    String(initParsed.g),
    String(initParsed.b),
  ]);
  const [alpha, setAlpha] = useState(initParsed.a);
  const alphaRef = useRef(initParsed.a);

  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  const pureHueHex = hsvToHex(hsv[0], 100, 100);
  const [currentR, currentG, currentB] = hexToRgb(currentHex);

  useEffect(() => {
    const parsed = parseColor(picker.color);
    const hex = rgbToHex(parsed.r, parsed.g, parsed.b);
    setHsv(hexToHsv(hex));
    setHexInput(hex);
    setRgbInput([String(parsed.r), String(parsed.g), String(parsed.b)]);
    setAlpha(parsed.a);
    alphaRef.current = parsed.a;
  }, [picker.nodeId, picker.color]);

  useEffect(() => {
    alphaRef.current = alpha;
  }, [alpha]);

  const applyHex = useCallback(
    (hex: string) => {
      setHsv(hexToHsv(hex));
      setHexInput(hex);
      const [r, g, b] = hexToRgb(hex);
      setRgbInput([String(r), String(g), String(b)]);
      const a = alphaRef.current;
      onColorChange(picker.nodeId, a >= 1 ? hex : toRgbaString(r, g, b, a));
    },
    [picker.nodeId, onColorChange],
  );

  const applyPreset = useCallback(
    (hex: string) => {
      setAlpha(1);
      alphaRef.current = 1;
      setHsv(hexToHsv(hex));
      setHexInput(hex);
      const [r, g, b] = hexToRgb(hex);
      setRgbInput([String(r), String(g), String(b)]);
      onColorChange(picker.nodeId, hex);
    },
    [picker.nodeId, onColorChange],
  );

  const applyHsv = useCallback(
    (h: number, s: number, v: number) => {
      const hex = hsvToHex(h, s, v);
      setHsv([h, s, v]);
      setHexInput(hex);
      const [r, g, b] = hexToRgb(hex);
      setRgbInput([String(r), String(g), String(b)]);
      const a = alphaRef.current;
      onColorChange(picker.nodeId, a >= 1 ? hex : toRgbaString(r, g, b, a));
    },
    [picker.nodeId, onColorChange],
  );

  const pickerAreaRef = useRef<HTMLDivElement>(null);
  const isDraggingPicker = useRef(false);
  const isDraggingWindow = useRef<{ ox: number; oy: number } | null>(null);
  const hsvRef = useRef(hsv);
  const applyHsvRef = useRef(applyHsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);
  useEffect(() => {
    applyHsvRef.current = applyHsv;
  }, [applyHsv]);

  const updatePickerPos = useCallback((clientX: number, clientY: number) => {
    if (!pickerAreaRef.current) return;
    const rect = pickerAreaRef.current.getBoundingClientRect();
    const s = Math.round(
      Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    );
    const v = Math.round(
      Math.max(
        0,
        Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100),
      ),
    );
    applyHsvRef.current(hsvRef.current[0], s, v);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (isDraggingPicker.current) updatePickerPos(e.clientX, e.clientY);
      if (isDraggingWindow.current && divRef.current) {
        const x = e.clientX - isDraggingWindow.current.ox;
        const y = e.clientY - isDraggingWindow.current.oy;
        posRef.current = { x, y };
        divRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    const up = () => {
      isDraggingPicker.current = false;
      isDraggingWindow.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [updatePickerPos]);

  useLayoutEffect(() => {
    if (divRef.current) {
      divRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
  }, []);

  const W = isFullscreen ? 400 : 272;
  const pickerH = isFullscreen ? 210 : 160;

  return (
    <div
      ref={divRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: W,
        background: "rgba(22,24,28,0.97)",
        backdropFilter: "blur(28px)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        zIndex: 500,
        overflow: "hidden",
        userSelect: "none",
        transition: "width 0.2s ease",
      }}
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingWindow.current = {
            ox: e.clientX - posRef.current.x,
            oy: e.clientY - posRef.current.y,
          };
        }}
        style={{
          padding: "12px 16px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "grab",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#9CA3AF",
            letterSpacing: "-0.1px",
          }}
        >
          Color
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <TrafficDot color="#ff5f57" title="Close" onClick={onClose} />
          <TrafficDot
            color="#28c840"
            title={isFullscreen ? "Shrink" : "Fullscreen"}
            onClick={() => setIsFullscreen((f) => !f)}
          />
        </div>
      </div>

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Swatch — checkerboard reveals alpha */}
        <div
          style={{
            height: 44,
            borderRadius: 10,
            marginBottom: 12,
            border: "0.5px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            position: "relative",
            boxShadow: "inset 0 1px 4px rgba(0,0,0,0.07)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: CHECKER,
              backgroundSize: "10px 10px",
              backgroundPosition: "0 0,0 5px,5px -5px,-5px 0px",
              backgroundColor: "#b0b0b0",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                alpha < 1
                  ? toRgbaString(currentR, currentG, currentB, alpha)
                  : currentHex,
              transition: "background 0.05s",
            }}
          />
        </div>

        {/* HSV picker area */}
        <div
          ref={pickerAreaRef}
          onMouseDown={(e) => {
            e.preventDefault();
            isDraggingPicker.current = true;
            updatePickerPos(e.clientX, e.clientY);
          }}
          style={{
            position: "relative",
            width: "100%",
            height: pickerH,
            borderRadius: 10,
            background: pureHueHex,
            cursor: "crosshair",
            marginBottom: 10,
            border: "0.5px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            flexShrink: 0,
            transition: "height 0.2s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, #fff, transparent)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent, #000)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${hsv[1]}%`,
              top: `${100 - hsv[2]}%`,
              transform: "translate(-50%, -50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid #fff",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Hue slider */}
        <div style={{ position: "relative", height: 18, marginBottom: 14 }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 12,
              transform: "translateY(-50%)",
              borderRadius: 6,
              background:
                "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${(hsv[0] / 360) * 100}% - 8px)`,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: pureHueHex,
              border: "2px solid #fff",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.22)",
              pointerEvents: "none",
            }}
          />
          <input
            type="range"
            min={0}
            max={360}
            value={hsv[0]}
            onChange={(e) => applyHsv(+e.target.value, hsv[1], hsv[2])}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              margin: 0,
            }}
          />
        </div>

        {/* Hex row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "6px 9px",
            border: "0.5px solid rgba(255,255,255,0.08)",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: currentHex,
              border: "0.5px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}
          />
          <input
            value={hexInput}
            onChange={(e) => {
              setHexInput(e.target.value);
              if (isValidHex(e.target.value)) applyHex(e.target.value);
            }}
            onBlur={() => {
              if (!isValidHex(hexInput)) setHexInput(currentHex);
            }}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 11,
              fontFamily: "monospace",
              color: "#E8E6E1",
              outline: "none",
              minWidth: 0,
              letterSpacing: "0.3px",
            }}
          />
        </div>

        {/* Opacity slider */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#6B7280",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Opacity
            </span>
            <span
              style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}
            >
              {Math.round(alpha * 100)}%
            </span>
          </div>
          <div style={{ position: "relative", height: 18 }}>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 12,
                transform: "translateY(-50%)",
                borderRadius: 6,
                overflow: "hidden",
                border: "0.5px solid rgba(255,255,255,0.08)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: CHECKER,
                  backgroundSize: "10px 10px",
                  backgroundPosition: "0 0,0 5px,5px -5px,-5px 0px",
                  backgroundColor: "#b0b0b0",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to right,rgba(${currentR},${currentG},${currentB},0),${currentHex})`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: `calc(${alpha * 100}% - 8px)`,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: currentHex,
                border: "2px solid #fff",
                boxShadow:
                  "0 0 0 1px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.22)",
                pointerEvents: "none",
              }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={alpha}
              onChange={(e) => {
                const a = parseFloat(e.target.value);
                setAlpha(a);
                alphaRef.current = a;
                const color =
                  a >= 1
                    ? currentHex
                    : toRgbaString(currentR, currentG, currentB, a);
                onColorChange(picker.nodeId, color);
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                margin: 0,
              }}
            />
          </div>
        </div>

        {/* RGB row */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
            alignItems: "flex-start",
          }}
        >
          {(["R", "G", "B"] as const).map((label, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <input
                value={rgbInput[i]}
                onChange={(e) => {
                  const next = [...rgbInput] as [string, string, string];
                  next[i] = e.target.value;
                  setRgbInput(next);
                  const n = parseInt(e.target.value);
                  if (!isNaN(n) && n >= 0 && n <= 255) {
                    const rgb: [number, number, number] = [
                      parseInt(rgbInput[0]) || 0,
                      parseInt(rgbInput[1]) || 0,
                      parseInt(rgbInput[2]) || 0,
                    ];
                    rgb[i] = n;
                    applyHex(rgbToHex(...rgb));
                  }
                }}
                onBlur={(e) => {
                  const n = parseInt(e.target.value);
                  if (isNaN(n) || n < 0 || n > 255) {
                    const [r, g, b] = hexToRgb(currentHex);
                    setRgbInput([String(r), String(g), String(b)]);
                  }
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 7,
                  padding: "5px 4px",
                  fontSize: 11,
                  color: "#E8E6E1",
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: "#6B7280",
                  letterSpacing: "0.4px",
                  fontWeight: 500,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              color: "#6B7280",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: 7,
            }}
          >
            Quick Picks
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 5,
            }}
          >
            {PRESET_COLORS.map((c) => {
              const active = currentHex.toLowerCase() === c.toLowerCase();
              return (
                <div
                  key={c}
                  onClick={() => applyPreset(c)}
                  style={{
                    height: 24,
                    borderRadius: 6,
                    background: c,
                    border: active
                      ? `2px solid ${ACCENT}`
                      : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    transition: "transform 0.1s",
                    boxShadow: active ? `0 0 0 3px ${ACCENT}30` : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "scale(1)";
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useRef, useState, useCallback, useEffect } from "react";

const ACCENT = "#C8A847";

type NodeType = "block" | "text" | "circle" | "diamond" | "rounded" | "image";

type CanvasNode = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body: string;
  type: NodeType;
  color: string;
  fontSize?: number;
  imageUrl?: string;
};

type Connection = { from: number; to: number };

// Active drag-to-connect state (canvas coordinates)
type ConnectDrag = { fromId: number; x: number; y: number } | null;

type ContextMenu =
  | { kind: "canvas"; x: number; y: number; cx: number; cy: number }
  | { kind: "node"; x: number; y: number; id: number }
  | null;

type ColorPicker = {
  nodeId: number;
  x: number;
  y: number;
  color: string;
} | null;

const PRESET_COLORS = [
  "#ffffff",
  "#f5f4f0",
  "#F0EDE8",
  "#FFF3CD",
  "#D4EDDA",
  "#D1ECF1",
  "#F8D7DA",
  "#E2D9F3",
  "#FCE4D6",
  "#C8A847",
  "#6c757d",
  "#343a40",
  "#2C3E50",
  "#1A1A2E",
  "#0a0a0a",
];

const FONT_SIZES = [11, 13, 15, 18, 22, 28, 36];

const LS_NODES = "denkraum_nodes";
const LS_CONNECTIONS = "denkraum_connections";

const DEFAULT_NODES: CanvasNode[] = [
  {
    id: 0,
    x: 200,
    y: 180,
    w: 200,
    h: 90,
    title: "Project Idea",
    body: "Capture your thoughts here",
    type: "block",
    color: "#ffffff",
    fontSize: 13,
  },
  {
    id: 1,
    x: 500,
    y: 150,
    w: 200,
    h: 90,
    title: "Concept",
    body: "Connect your ideas",
    type: "block",
    color: "#ffffff",
    fontSize: 13,
  },
  {
    id: 2,
    x: 420,
    y: 320,
    w: 200,
    h: 70,
    title: "Next Steps",
    body: "",
    type: "block",
    color: "#ffffff",
    fontSize: 13,
  },
];
const DEFAULT_CONNECTIONS: Connection[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
];

let idCounter = 3;

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToHsv(hex: string): [number, number, number] {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const v = max;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

function hexToRgb(hex: string): [number, number, number] {
  if (hex.length === 7) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  return [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isValidHex(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

// ── Color Picker ──────────────────────────────────────────────────────────────
function ColorPickerWindow({
  picker,
  onColorChange,
  onClose,
}: {
  picker: NonNullable<ColorPicker>;
  onColorChange: (id: number, color: string) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ x: picker.x, y: picker.y });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>(() =>
    hexToHsv(picker.color),
  );
  const [hexInput, setHexInput] = useState(picker.color);
  const [rgbInput, setRgbInput] = useState<[string, string, string]>(() => {
    const [r, g, b] = hexToRgb(picker.color);
    return [String(r), String(g), String(b)];
  });

  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  const pureHueHex = hsvToHex(hsv[0], 100, 100);

  useEffect(() => {
    setHsv(hexToHsv(picker.color));
    setHexInput(picker.color);
    const [r, g, b] = hexToRgb(picker.color);
    setRgbInput([String(r), String(g), String(b)]);
  }, [picker.nodeId, picker.color]);

  const applyHex = useCallback(
    (hex: string) => {
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
      onColorChange(picker.nodeId, hex);
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
      if (isDraggingWindow.current) {
        setPos({
          x: e.clientX - isDraggingWindow.current.ox,
          y: e.clientY - isDraggingWindow.current.oy,
        });
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

  const W = isFullscreen ? 400 : 272;
  const pickerH = isFullscreen ? 210 : 160;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: Math.max(8, Math.min(pos.x, window.innerWidth - W - 8)),
        top: Math.max(
          8,
          Math.min(pos.y, window.innerHeight - pickerH - 340 - 8),
        ),
        width: W,
        background: "rgba(252,251,249,0.97)",
        backdropFilter: "blur(28px)",
        border: "0.5px solid rgba(0,0,0,0.1)",
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
            ox: e.clientX - pos.x,
            oy: e.clientY - pos.y,
          };
        }}
        style={{
          padding: "12px 16px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "grab",
          borderBottom: "0.5px solid rgba(0,0,0,0.07)",
          background: "rgba(255,255,255,0.6)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#555",
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
        <div
          style={{
            height: 44,
            borderRadius: 10,
            background: currentHex,
            border: "0.5px solid rgba(0,0,0,0.1)",
            marginBottom: 12,
            boxShadow: "inset 0 1px 4px rgba(0,0,0,0.07)",
            transition: "background 0.05s",
          }}
        />

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
            border: "0.5px solid rgba(0,0,0,0.08)",
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
              border: "0.5px solid rgba(0,0,0,0.08)",
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

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: 2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,0.04)",
              borderRadius: 8,
              padding: "6px 9px",
              border: "0.5px solid rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: currentHex,
                border: "0.5px solid rgba(0,0,0,0.12)",
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
                color: "#333",
                outline: "none",
                minWidth: 0,
                letterSpacing: "0.3px",
              }}
            />
          </div>
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
                  textAlign: "center",
                  border: "0.5px solid rgba(0,0,0,0.1)",
                  background: "rgba(0,0,0,0.03)",
                  borderRadius: 7,
                  padding: "5px 2px",
                  fontSize: 11,
                  color: "#333",
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: "#bbb",
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
              color: "#bbb",
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
                  onClick={() => applyHex(c)}
                  style={{
                    height: 24,
                    borderRadius: 6,
                    background: c,
                    border: active
                      ? `2px solid ${ACCENT}`
                      : "1px solid rgba(0,0,0,0.1)",
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

function TrafficDot({
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

// ── Bring-to-front helper ─────────────────────────────────────────────────────
function bringToFront(prev: CanvasNode[], id: number): CanvasNode[] {
  const idx = prev.findIndex((n) => n.id === id);
  if (idx === -1 || idx === prev.length - 1) return prev;
  const next = [...prev];
  next.push(next.splice(idx, 1)[0]);
  return next;
}

// ── Main Canvas ───────────────────────────────────────────────────────────────
export default function Canvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>(DEFAULT_NODES);
  const [connections, setConnections] =
    useState<Connection[]>(DEFAULT_CONNECTIONS);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [connectDrag, setConnectDrag] = useState<ConnectDrag>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [colorPicker, setColorPicker] = useState<ColorPicker>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const dragging = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const resizing = useRef<{
    id: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePos = useRef<{ cx: number; cy: number } | null>(null);
  // Ref so onMouseUp can read latest hoveredId without stale closure
  const hoveredIdRef = useRef<number | null>(null);
  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  // ── rAF-based interaction refs ────────────────────────────────────────────────
  // Mirror latest state into refs so mouse handlers never capture stale closures
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const connectDragRef = useRef(connectDrag);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { connectDragRef.current = connectDrag; }, [connectDrag]);

  // Pending values accumulated during a mousemove burst; applied once per frame
  const rafRef = useRef<number | null>(null);
  const pendingPanDelta = useRef({ x: 0, y: 0 });
  const pendingDragPos = useRef<{ id: number; x: number; y: number } | null>(null);
  const pendingResizeSize = useRef<{ id: number; w: number; h: number } | null>(null);
  const pendingConnectPos = useRef<{ fromId: number; x: number; y: number } | null>(null);

  const toCanvas = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  const addNode = useCallback(
    (cx: number, cy: number, type: NodeType) => {
      const isText = type === "text";
      const isCircle = type === "circle";
      const isDiamond = type === "diamond";
      const w = isText ? 160 : isCircle ? 100 : isDiamond ? 130 : 200;
      const h = isText ? 40 : isCircle ? 100 : isDiamond ? 100 : 80;
      const maxId = nodes.reduce((m, n) => Math.max(m, n.id), -1);
      if (idCounter <= maxId) idCounter = maxId + 1;
      const newNode: CanvasNode = {
        id: idCounter++,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        title: isText
          ? ""
          : type === "circle"
            ? "Circle"
            : type === "diamond"
              ? "Diamond"
              : type === "rounded"
                ? "Area"
                : "New Block",
        body: "",
        type,
        color: isText ? "transparent" : "#ffffff",
        fontSize: isText ? 15 : 13,
      };
      setNodes((prev) => [...prev, newNode]);
      setSelected(newNode.id);
      setContextMenu(null);
    },
    [nodes],
  );

  const handleImageInsert = useCallback((cx: number, cy: number) => {
    pendingImagePos.current = { cx, cy };
    setContextMenu(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  const onImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const pos = pendingImagePos.current;
      if (!file || !pos) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imageUrl = ev.target?.result as string;
        if (!imageUrl) return;
        setNodes((prev) => {
          const maxId = prev.reduce((m, n) => Math.max(m, n.id), -1);
          if (idCounter <= maxId) idCounter = maxId + 1;
          return [
            ...prev,
            {
              id: idCounter++,
              x: pos.cx - 150,
              y: pos.cy - 100,
              w: 300,
              h: 200,
              title: "Image",
              body: "",
              type: "image",
              color: "#ffffff",
              imageUrl,
            },
          ];
        });
        pendingImagePos.current = null;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const openColorPicker = useCallback(
    (
      nodeId: number,
      currentColor: string,
      screenX: number,
      screenY: number,
    ) => {
      setColorPicker({
        nodeId,
        x: screenX - 280,
        y: screenY - 20,
        color: currentColor,
      });
      setContextMenu(null);
    },
    [],
  );

  const onPickerColorChange = useCallback((nodeId: number, color: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, color } : n)),
    );
    setColorPicker((prev) => (prev ? { ...prev, color } : null));
  }, []);

  // ── localStorage ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const rawNodes = localStorage.getItem(LS_NODES);
      if (rawNodes) {
        const loaded = JSON.parse(rawNodes) as CanvasNode[];
        const maxId = loaded.reduce((m, n) => Math.max(m, n.id), -1);
        if (maxId >= idCounter) idCounter = maxId + 1;
        setNodes(loaded);
      }
      const rawConns = localStorage.getItem(LS_CONNECTIONS);
      if (rawConns) setConnections(JSON.parse(rawConns) as Connection[]);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_NODES, JSON.stringify(nodes));
    } catch {}
  }, [nodes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_CONNECTIONS, JSON.stringify(connections));
    } catch {}
  }, [connections, hydrated]);

  // ── Wheel ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = -e.deltaY * 0.005;
        setZoom((prev) => {
          const next = Math.min(3, Math.max(0.2, prev + delta * prev));
          setPan((p) => ({
            x: mx - (mx - p.x) * (next / prev),
            y: my - (my - p.y) * (next / prev),
          }));
          return next;
        });
      } else {
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Context menus ─────────────────────────────────────────────────────────────
  const onCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t !== canvasRef.current && !t.dataset.bg) return;
      e.preventDefault();
      const r = canvasRef.current!.getBoundingClientRect();
      const pos = toCanvas(e.clientX - r.left, e.clientY - r.top);
      setContextMenu({
        kind: "canvas",
        x: e.clientX,
        y: e.clientY,
        cx: pos.x,
        cy: pos.y,
      });
    },
    [toCanvas],
  );

  const onNodeContextMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    setContextMenu({ kind: "node", x: e.clientX, y: e.clientY, id });
    setNodes((prev) => bringToFront(prev, id));
  }, []);

  // ── Mouse down handlers ───────────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      const t = e.target as HTMLElement;
      if (t !== canvasRef.current && !t.dataset.bg) return;
      if (e.button !== 0) return;
      // Cancel any in-progress connect drag
      if (connectDrag) {
        setConnectDrag(null);
        return;
      }
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setSelected(null);
    },
    [contextMenu, connectDrag],
  );

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable) return;
      if (t.dataset.role === "connect-dot") return;
      if (t.dataset.role === "resize-handle") return;
      e.stopPropagation();
      setContextMenu(null);
      setSelected(id);
      setNodes((prev) => bringToFront(prev, id));
      const n = nodes.find((x) => x.id === id);
      if (!n || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - r.left - pan.x) / zoom;
      const my = (e.clientY - r.top - pan.y) / zoom;
      dragging.current = { id, ox: mx - n.x, oy: my - n.y };
      e.preventDefault();
    },
    [nodes, pan, zoom],
  );

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      e.preventDefault();
      setNodes((prev) => bringToFront(prev, id));
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      resizing.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startW: n.w,
        startH: n.h,
      };
    },
    [nodes],
  );

  // ── Connect: drag-to-connect ──────────────────────────────────────────────────
  const onDotMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (!canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - r.left - pan.x) / zoom;
      const my = (e.clientY - r.top - pan.y) / zoom;
      setConnectDrag({ fromId: id, x: mx, y: my });
    },
    [pan, zoom],
  );

  // ── Global mouse move + up ────────────────────────────────────────────────────

  // Apply all pending updates in a single React render (called from rAF or mouseup)
  const flushPending = useCallback(() => {
    rafRef.current = null;

    const panDelta = pendingPanDelta.current;
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      const { x, y } = panDelta;
      pendingPanDelta.current = { x: 0, y: 0 };
      setPan((prev) => ({ x: prev.x + x, y: prev.y + y }));
    }

    const drag = pendingDragPos.current;
    if (drag) {
      pendingDragPos.current = null;
      setNodes((prev) =>
        prev.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)),
      );
    }

    const resize = pendingResizeSize.current;
    if (resize) {
      pendingResizeSize.current = null;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === resize.id ? { ...n, w: resize.w, h: resize.h } : n,
        ),
      );
    }

    const cd = pendingConnectPos.current;
    if (cd) {
      pendingConnectPos.current = null;
      setConnectDrag(cd);
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const pan = panRef.current;
      const zoom = zoomRef.current;
      let dirty = false;

      if (isPanning.current) {
        const dx = e.clientX - lastPan.current.x;
        const dy = e.clientY - lastPan.current.y;
        lastPan.current = { x: e.clientX, y: e.clientY };
        pendingPanDelta.current.x += dx;
        pendingPanDelta.current.y += dy;
        dirty = true;
      }

      if (dragging.current && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        const { id, ox, oy } = dragging.current;
        pendingDragPos.current = { id, x: mx - ox, y: my - oy };
        dirty = true;
      }

      if (resizing.current) {
        const dx = (e.clientX - resizing.current.startX) / zoom;
        const dy = (e.clientY - resizing.current.startY) / zoom;
        const { id, startW, startH } = resizing.current;
        pendingResizeSize.current = {
          id,
          w: Math.max(80, startW + dx),
          h: Math.max(50, startH + dy),
        };
        dirty = true;
      }

      const cd = connectDragRef.current;
      if (cd && canvasRef.current) {
        const r = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - r.left - pan.x) / zoom;
        const my = (e.clientY - r.top - pan.y) / zoom;
        pendingConnectPos.current = { fromId: cd.fromId, x: mx, y: my };
        dirty = true;
      }

      if (dirty && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPending);
      }
    },
    [flushPending],
  );

  const onMouseUp = useCallback(() => {
    // Cancel any pending frame and commit the final position immediately
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Clear pending connect pos — connect finalization is handled below
    pendingConnectPos.current = null;
    // Flush pending drag / resize / pan
    flushPending();

    // Finalize connect drag using the ref (avoids stale closure)
    const cd = connectDragRef.current;
    if (cd) {
      const targetId = hoveredIdRef.current;
      if (targetId !== null && targetId !== cd.fromId) {
        setConnections((prev) => {
          const dup = prev.some(
            (c) => c.from === cd.fromId && c.to === targetId,
          );
          return dup ? prev : [...prev, { from: cd.fromId, to: targetId }];
        });
      }
      setConnectDrag(null);
    }

    dragging.current = null;
    resizing.current = null;
    isPanning.current = false;
  }, [flushPending]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (selected === null) return;
    setNodes((prev) => prev.filter((n) => n.id !== selected));
    setConnections((prev) =>
      prev.filter((c) => c.from !== selected && c.to !== selected),
    );
    setSelected(null);
  }, [selected]);

  const updateNodeField = useCallback(
    (id: number, field: "title" | "body", value: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
      );
    },
    [],
  );

  const updateFontSize = useCallback((id: number, size: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fontSize: size } : n)),
    );
    setContextMenu(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !t.isContentEditable &&
        selected !== null
      )
        deleteSelected();
      if (e.key === "Escape") {
        setConnectDrag(null);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, deleteSelected]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const menuItem = (danger = false): React.CSSProperties => ({
    padding: "9px 14px",
    cursor: "pointer",
    fontSize: 13.5,
    color: danger ? "#c0392b" : "#222",
    display: "flex",
    alignItems: "center",
    gap: 10,
  });

  const hoverMenu = (e: React.MouseEvent, on: boolean, danger = false) => {
    (e.currentTarget as HTMLElement).style.background = on
      ? danger
        ? "rgba(192,57,43,0.07)"
        : "rgba(0,0,0,0.04)"
      : "transparent";
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#f5f4f0",
        overflow: "hidden",
        position: "relative",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
      onClick={() => setContextMenu(null)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={onImageFileChange}
      />

      {/* ── Toolbar ── */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(20px)",
          border: "0.5px solid rgba(0,0,0,0.1)",
          borderRadius: 16,
          padding: "8px 14px",
          display: "flex",
          gap: 4,
          alignItems: "center",
          boxShadow: "0 2px 24px rgba(0,0,0,0.08)",
          zIndex: 200,
        }}
      >
        <button
          onClick={deleteSelected}
          style={{
            padding: "6px 13px",
            borderRadius: 8,
            border: "none",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: "pointer",
            background: "transparent",
            color: "#c0392b",
          }}
        >
          Delete
        </button>
        <div
          style={{
            width: "0.5px",
            height: 20,
            background: "rgba(0,0,0,0.12)",
            margin: "0 4px",
          }}
        />
        <div style={{ fontSize: 11, color: "#ccc" }}>
          Right-click → Shapes & Options
        </div>
        {/* Live indicator while connecting */}
        {connectDrag && (
          <>
            <div
              style={{
                width: "0.5px",
                height: 20,
                background: "rgba(0,0,0,0.12)",
                margin: "0 4px",
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: ACCENT,
                fontWeight: 500,
                letterSpacing: "-0.1px",
              }}
            >
              Connecting… drop on a shape
            </div>
            <div
              onClick={() => setConnectDrag(null)}
              style={{
                fontSize: 11,
                color: "#aaa",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 5,
                marginLeft: 2,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,0,0,0.06)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              ✕ Cancel
            </div>
          </>
        )}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        data-bg="true"
        onMouseDown={onCanvasMouseDown}
        onContextMenu={onCanvasContextMenu}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          cursor: connectDrag ? "crosshair" : "grab",
          overflow: "hidden",
        }}
      >
        {/* Dot grid */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern
              id="dots"
              x={pan.x % (20 * zoom)}
              y={pan.y % (20 * zoom)}
              width={20 * zoom}
              height={20 * zoom}
              patternUnits="userSpaceOnUse"
            >
              <circle cx={1} cy={1} r={0.8} fill="#d0cec8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* World */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0,
            height: 0,
          }}
        >
          {/* Connections SVG */}
          <svg
            style={{
              position: "absolute",
              left: -5000,
              top: -5000,
              width: 10000,
              height: 10000,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            {/* Existing connections */}
            {connections.map((c) => {
              const fn = nodes.find((x) => x.id === c.from);
              const tn = nodes.find((x) => x.id === c.to);
              if (!fn || !tn) return null;
              const x1 = fn.x + fn.w,
                y1 = fn.y + fn.h / 2;
              const x2 = tn.x,
                y2 = tn.y + tn.h / 2;
              const cxm = (x1 + x2) / 2;
              return (
                <path
                  key={`${c.from}-${c.to}`}
                  d={`M ${x1} ${y1} C ${cxm} ${y1}, ${cxm} ${y2}, ${x2} ${y2}`}
                  stroke="#c8c6c0"
                  strokeWidth={1.5 / zoom}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Live preview line while dragging to connect */}
            {connectDrag &&
              (() => {
                const fn = nodes.find((x) => x.id === connectDrag.fromId);
                if (!fn) return null;
                const x1 = fn.x + fn.w,
                  y1 = fn.y + fn.h / 2;
                const x2 = connectDrag.x,
                  y2 = connectDrag.y;
                const cxm = (x1 + x2) / 2;
                return (
                  <path
                    d={`M ${x1} ${y1} C ${cxm} ${y1}, ${cxm} ${y2}, ${x2} ${y2}`}
                    stroke={ACCENT}
                    strokeWidth={2 / zoom}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                    opacity={0.75}
                  />
                );
              })()}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const isSel = selected === n.id;
            const isText = n.type === "text";
            const isCircle = n.type === "circle";
            const isDiamond = n.type === "diamond";
            const isRounded = n.type === "rounded";
            const isImage = n.type === "image";
            const isDark = [
              "#343a40",
              "#6c757d",
              "#2C3E50",
              "#1A1A2E",
              "#0a0a0a",
            ].includes(n.color);
            const fs = n.fontSize ?? 13;

            // Highlight potential connection target
            const isConnectTarget =
              connectDrag !== null &&
              hoveredId === n.id &&
              n.id !== connectDrag.fromId &&
              !isText;

            const hostBg = isDiamond || isText ? "transparent" : n.color;
            const hostBorder =
              isDiamond || isText
                ? "none"
                : isConnectTarget
                  ? `2px solid ${ACCENT}`
                  : isSel
                    ? "1px solid rgba(0,0,0,0.18)"
                    : "0.5px solid rgba(0,0,0,0.1)";
            const hostShadow =
              isDiamond || isText
                ? "none"
                : isConnectTarget
                  ? `0 0 0 3px ${ACCENT}35, 0 4px 20px rgba(0,0,0,0.1)`
                  : isSel
                    ? "0 4px 20px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)"
                    : "0 1px 8px rgba(0,0,0,0.06)";
            const hostRadius = isCircle ? "50%" : isRounded ? 24 : 12;

            const showResize =
              (hoveredId === n.id || isSel) &&
              !isText &&
              !isCircle &&
              !isDiamond;
            // Show connect dot on hover (or when it's the active source)
            const showDot =
              !isText && (hoveredId === n.id || connectDrag?.fromId === n.id);

            return (
              <div
                key={n.id}
                onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                onContextMenu={(e) => onNodeContextMenu(e, n.id)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() =>
                  setHoveredId((prev) => (prev === n.id ? null : prev))
                }
                style={{
                  position: "absolute",
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: isText ? "auto" : n.h,
                  background: hostBg,
                  border: hostBorder,
                  borderRadius: hostRadius,
                  boxShadow: hostShadow,
                  padding: isText
                    ? "2px 0"
                    : isCircle
                      ? 0
                      : isDiamond
                        ? 0
                        : "14px 18px",
                  cursor: connectDrag ? "crosshair" : "grab",
                  userSelect: "none",
                  transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: isCircle ? "center" : "flex-start",
                  alignItems: isCircle ? "center" : "flex-start",
                  overflow: isImage ? "hidden" : "visible",
                  isolation: "isolate",
                }}
              >
                {/* Diamond */}
                {isDiamond && (
                  <>
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                      viewBox={`0 0 ${n.w} ${n.h}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <filter
                          id={`ds-${n.id}`}
                          x="-20%"
                          y="-20%"
                          width="140%"
                          height="140%"
                        >
                          <feDropShadow
                            dx="0"
                            dy="1"
                            stdDeviation={isSel ? 5 : 3}
                            floodColor={
                              isSel ? "rgba(0,0,0,0.13)" : "rgba(0,0,0,0.08)"
                            }
                          />
                        </filter>
                      </defs>
                      <polygon
                        points={`${n.w / 2},2 ${n.w - 2},${n.h / 2} ${n.w / 2},${n.h - 2} 2,${n.h / 2}`}
                        fill={n.color}
                        stroke={
                          isConnectTarget
                            ? ACCENT
                            : isSel
                              ? "rgba(0,0,0,0.2)"
                              : "rgba(0,0,0,0.13)"
                        }
                        strokeWidth={isConnectTarget || isSel ? 1.5 : 0.8}
                        filter={`url(#ds-${n.id})`}
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                        padding: "0 28px",
                      }}
                    >
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={(e) =>
                          updateNodeField(
                            n.id,
                            "title",
                            (e.target as HTMLElement).innerText,
                          )
                        }
                        style={{
                          fontSize: fs,
                          fontWeight: 500,
                          color: isDark ? "#fff" : "#111",
                          outline: "none",
                          textAlign: "center",
                          letterSpacing: "-0.2px",
                          width: "100%",
                        }}
                        dangerouslySetInnerHTML={{ __html: n.title }}
                      />
                      {n.body && (
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onMouseDown={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            updateNodeField(
                              n.id,
                              "body",
                              (e.target as HTMLElement).innerText,
                            )
                          }
                          style={{
                            fontSize: Math.max(11, fs - 2),
                            color: isDark ? "rgba(255,255,255,0.7)" : "#888",
                            outline: "none",
                            textAlign: "center",
                            marginTop: 3,
                            width: "100%",
                          }}
                          dangerouslySetInnerHTML={{ __html: n.body }}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Image */}
                {isImage && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                    }}
                  >
                    {n.imageUrl ? (
                      <img
                        src={n.imageUrl}
                        alt=""
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          borderRadius: 12,
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ccc",
                          fontSize: 13,
                        }}
                      >
                        No Image
                      </div>
                    )}
                    {isSel && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 12,
                          border: "1.5px solid rgba(0,0,0,0.2)",
                          pointerEvents: "none",
                          zIndex: 5,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Block / Rounded / Circle */}
                {!isText && !isDiamond && !isImage && (
                  <>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) =>
                        updateNodeField(
                          n.id,
                          "title",
                          (e.target as HTMLElement).innerText,
                        )
                      }
                      style={{
                        fontSize: fs,
                        fontWeight: 500,
                        color: isDark ? "#fff" : "#111",
                        outline: "none",
                        letterSpacing: "-0.2px",
                        textAlign: isCircle ? "center" : "left",
                        zIndex: 1,
                        background: "transparent",
                        minWidth: 40,
                      }}
                      dangerouslySetInnerHTML={{ __html: n.title }}
                    />
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) =>
                        updateNodeField(
                          n.id,
                          "body",
                          (e.target as HTMLElement).innerText,
                        )
                      }
                      style={{
                        fontSize: Math.max(11, fs - 2),
                        color: isDark ? "rgba(255,255,255,0.7)" : "#888",
                        marginTop: 5,
                        outline: "none",
                        lineHeight: 1.55,
                        minHeight: 16,
                        zIndex: 1,
                        background: "transparent",
                        width: "100%",
                        textAlign: isCircle ? "center" : "left",
                      }}
                      dangerouslySetInnerHTML={{ __html: n.body }}
                    />
                  </>
                )}

                {/* Free text */}
                {isText && (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={(e) =>
                      updateNodeField(
                        n.id,
                        "title",
                        (e.target as HTMLElement).innerText,
                      )
                    }
                    style={{
                      fontSize: fs,
                      color: "#1a1a1a",
                      outline: "none",
                      lineHeight: 1.55,
                      minHeight: 22,
                      letterSpacing: "-0.2px",
                      background: "transparent",
                      width: "100%",
                    }}
                    dangerouslySetInnerHTML={{ __html: n.title }}
                  />
                )}

                {/* Connect dot — appears on hover, drag to connect */}
                {showDot && (
                  <div
                    data-role="connect-dot"
                    onMouseDown={(e) => onDotMouseDown(e, n.id)}
                    title="Drag to connect"
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      background:
                        connectDrag?.fromId === n.id ? ACCENT : "#fff",
                      border: `2px solid ${ACCENT}`,
                      position: "absolute",
                      right: isCircle ? -9 : isDiamond ? -8 : -7,
                      top: "50%",
                      transform: "translateY(-50%)",
                      cursor: "crosshair",
                      zIndex: 10,
                      boxShadow: "0 1px 5px rgba(0,0,0,0.2)",
                      transition: "background 0.12s, transform 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-50%) scale(1.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-50%) scale(1)";
                    }}
                  />
                )}

                {/* Resize handle — appears on hover */}
                {showResize && (
                  <div
                    data-role="resize-handle"
                    onMouseDown={(e) => onResizeMouseDown(e, n.id)}
                    style={{
                      position: "absolute",
                      right: 5,
                      bottom: 5,
                      width: 18,
                      height: 18,
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(0,0,0,0.13)",
                      borderRadius: 5,
                      cursor: "nwse-resize",
                      zIndex: 10,
                      boxShadow: "0 1px 5px rgba(0,0,0,0.14)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: hoveredId === n.id || isSel ? 1 : 0,
                      transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.22)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 1px 5px rgba(0,0,0,0.14)";
                    }}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 9 9"
                      fill="none"
                      style={{ pointerEvents: "none", display: "block" }}
                    >
                      <line
                        x1="1.5"
                        y1="8"
                        x2="8"
                        y2="1.5"
                        stroke="rgba(0,0,0,0.32)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1="5"
                        y1="8"
                        x2="8"
                        y2="5"
                        stroke="rgba(0,0,0,0.32)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Canvas Context Menu ── */}
      {contextMenu?.kind === "canvas" && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "rgba(252,251,249,0.97)",
            backdropFilter: "blur(24px)",
            border: "0.5px solid rgba(0,0,0,0.1)",
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
            zIndex: 300,
            minWidth: 210,
            padding: "6px 0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#bbb",
              padding: "6px 14px 4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Insert Shape
          </div>
          {(
            [
              { type: "block" as NodeType, label: "Block", icon: "▭" },
              {
                type: "rounded" as NodeType,
                label: "Area (rounded)",
                icon: "▢",
              },
              { type: "circle" as NodeType, label: "Circle", icon: "○" },
              { type: "diamond" as NodeType, label: "Diamond", icon: "◇" },
              { type: "text" as NodeType, label: "Free Text", icon: "T" },
            ] as { type: NodeType; label: string; icon: string }[]
          ).map(({ type, label, icon }) => (
            <div
              key={type}
              onClick={() => addNode(contextMenu.cx, contextMenu.cy, type)}
              onMouseEnter={(e) => hoverMenu(e, true)}
              onMouseLeave={(e) => hoverMenu(e, false)}
              style={menuItem()}
            >
              <span
                style={{
                  fontSize: 15,
                  color: "#aaa",
                  width: 22,
                  textAlign: "center",
                }}
              >
                {icon}
              </span>
              {label}
            </div>
          ))}
          <div
            style={{
              height: "0.5px",
              background: "rgba(0,0,0,0.07)",
              margin: "4px 0",
            }}
          />
          <div
            onClick={() => handleImageInsert(contextMenu.cx, contextMenu.cy)}
            onMouseEnter={(e) => hoverMenu(e, true)}
            onMouseLeave={(e) => hoverMenu(e, false)}
            style={menuItem()}
          >
            <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>
              🖼
            </span>
            Insert Image
          </div>
        </div>
      )}

      {/* ── Node Context Menu ── */}
      {contextMenu?.kind === "node" &&
        (() => {
          const n = nodes.find((x) => x.id === contextMenu.id);
          if (!n) return null;
          const canColor = n.type !== "text" && n.type !== "image";
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: contextMenu.x,
                top: contextMenu.y,
                background: "rgba(252,251,249,0.97)",
                backdropFilter: "blur(24px)",
                border: "0.5px solid rgba(0,0,0,0.1)",
                borderRadius: 14,
                boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
                zIndex: 300,
                minWidth: 240,
                padding: "6px 0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#bbb",
                  padding: "6px 14px 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Font Size
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  padding: "4px 14px 10px",
                }}
              >
                {FONT_SIZES.map((size) => (
                  <div
                    key={size}
                    onClick={() => updateFontSize(contextMenu.id, size)}
                    style={{
                      width: 34,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 7,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                      background:
                        n.fontSize === size ? "#222" : "rgba(0,0,0,0.05)",
                      color: n.fontSize === size ? "#fff" : "#444",
                      transition: "all 0.12s",
                    }}
                  >
                    {size}
                  </div>
                ))}
              </div>

              {canColor && (
                <>
                  <div
                    style={{
                      height: "0.5px",
                      background: "rgba(0,0,0,0.07)",
                      margin: "2px 0",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "#bbb",
                      padding: "6px 14px 4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Color
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 14px 10px",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: n.color,
                        border: "1px solid rgba(0,0,0,0.12)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: "#aaa",
                        fontFamily: "monospace",
                        flex: 1,
                      }}
                    >
                      {n.color}
                    </span>
                    <div
                      onClick={() =>
                        openColorPicker(
                          contextMenu.id,
                          n.color,
                          contextMenu.x,
                          contextMenu.y,
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.05)",
                        border: "0.5px solid rgba(0,0,0,0.1)",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#555",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(0,0,0,0.09)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "rgba(0,0,0,0.05)")
                      }
                    >
                      ···
                    </div>
                  </div>
                </>
              )}

              <div
                style={{
                  height: "0.5px",
                  background: "rgba(0,0,0,0.07)",
                  margin: "2px 0",
                }}
              />
              <div
                onClick={() => {
                  deleteSelected();
                  setContextMenu(null);
                }}
                onMouseEnter={(e) => hoverMenu(e, true, true)}
                onMouseLeave={(e) => hoverMenu(e, false, true)}
                style={menuItem(true)}
              >
                <span style={{ width: 22, textAlign: "center", fontSize: 14 }}>
                  ✕
                </span>
                Delete
              </div>
            </div>
          );
        })()}

      {/* ── Color Picker ── */}
      {colorPicker && (
        <ColorPickerWindow
          picker={colorPicker}
          onColorChange={onPickerColorChange}
          onClose={() => setColorPicker(null)}
        />
      )}

      {/* ── Zoom controls ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: "6px 10px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          zIndex: 100,
        }}
      >
        <button
          onClick={() =>
            setZoom((z) => Math.max(0.2, parseFloat((z - 0.1).toFixed(2))))
          }
          style={{
            border: "none",
            background: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#555",
            lineHeight: 1,
          }}
        >
          −
        </button>
        <span
          style={{
            fontSize: 11,
            color: "#999",
            minWidth: 38,
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setZoom((z) => Math.min(3, parseFloat((z + 0.1).toFixed(2))))
          }
          style={{
            border: "none",
            background: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#555",
            lineHeight: 1,
          }}
        >
          +
        </button>
        <div
          style={{ width: "0.5px", height: 16, background: "rgba(0,0,0,0.1)" }}
        />
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={{
            border: "none",
            background: "none",
            fontSize: 11,
            cursor: "pointer",
            color: "#aaa",
          }}
        >
          Reset
        </button>
      </div>

      {/* ── Hint ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          borderRadius: 10,
          padding: "7px 16px",
          fontSize: 11.5,
          color: "#aaa",
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          zIndex: 100,
        }}
      >
        Right-click → Shapes & Images · Hover edge → drag to connect · Pinch /
        Ctrl+Scroll = Zoom
      </div>
    </div>
  );
}

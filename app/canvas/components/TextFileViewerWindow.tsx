"use client";
import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { TrafficDot } from "./ColorPickerWindow";

export function TextFileViewerWindow({
  viewer,
  onClose,
}: {
  viewer: {
    nodeId: number;
    x: number;
    y: number;
    fileName: string;
    content: string;
  };
  onClose: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: viewer.x, y: viewer.y });
  const [isMaximized, setIsMaximized] = useState(false);
  const isDraggingWindow = useRef<{ ox: number; oy: number } | null>(null);

  const W = isMaximized ? Math.round(window.innerWidth * 0.9) : 480;
  const H = isMaximized ? Math.round(window.innerHeight * 0.9) : 340;

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (isDraggingWindow.current && divRef.current) {
        const x = e.clientX - isDraggingWindow.current.ox;
        const y = e.clientY - isDraggingWindow.current.oy;
        posRef.current = { x, y };
        divRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    const up = () => {
      isDraggingWindow.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  useLayoutEffect(() => {
    if (!divRef.current) return;
    if (isMaximized) {
      divRef.current.style.transform = "none";
    } else {
      divRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }
  }, [isMaximized]);

  return (
    <div
      ref={divRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: isMaximized ? "5%" : 0,
        top: isMaximized ? "5%" : 0,
        width: W,
        height: H,
        background: "rgba(18,20,22,0.97)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
        transition: "width 0.2s ease, height 0.2s ease",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={(e) => {
          if (isMaximized) return;
          e.preventDefault();
          isDraggingWindow.current = {
            ox: e.clientX - posRef.current.x,
            oy: e.clientY - posRef.current.y,
          };
        }}
        style={{
          padding: "11px 14px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: isMaximized ? "default" : "grab",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          flexShrink: 0,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#9CA3AF",
              letterSpacing: "-0.1px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {viewer.fileName}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
            marginLeft: 10,
          }}
        >
          <TrafficDot color="#ff5f57" title="Close" onClick={onClose} />
          <TrafficDot
            color="#28c840"
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={() => setIsMaximized((m) => !m)}
          />
        </div>
      </div>

      {/* Content */}
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: "14px 16px",
          overflowY: "auto",
          overflowX: "auto",
          fontSize: 12,
          lineHeight: 1.65,
          fontFamily:
            "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
          color: "rgba(255,255,255,0.82)",
          background: "transparent",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          userSelect: "text",
        }}
      >
        {viewer.content}
      </pre>
    </div>
  );
}

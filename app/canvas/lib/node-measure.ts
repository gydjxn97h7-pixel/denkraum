"use client";
// ── Content-fit height for generated card nodes ──────────────────────────────
// AI-assigned node sizes encode importance, not text volume, so a node's text
// can be taller than its box — and card nodes clip overflow (NodeView renders the
// title/body with `overflow: hidden` inside a fixed `n.h`). We measure the real
// rendered height of the title + body offscreen and grow the node to fit, so
// nothing is ever clipped. This mirrors NodeView's card layout (block/rounded):
// host padding 12px 16px, Clash title at fontSize, mono body at max(11, fs-2)
// with line-height 1.55 + a 4px gap, and a body div that's always present
// (reserving min-height 16) so empty-body cards measure the same as the real one.

import type { GenNode } from "./ai-generate";

const FONT_CLASH = "var(--font-clash), system-ui, sans-serif";
// Cap so a runaway block of text can't produce an absurdly tall node.
const MAX_FIT_HEIGHT = 320;

let host: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let bodyEl: HTMLDivElement | null = null;

// Lazily build a single reusable offscreen measuring element.
function ensure(): boolean {
  if (typeof document === "undefined") return false;
  if (host) return true;
  host = document.createElement("div");
  Object.assign(host.style, {
    position: "absolute",
    left: "-99999px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: "border-box",
    padding: "12px 16px",
    display: "block",
  } as Partial<CSSStyleDeclaration>);

  titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontWeight: "500",
    fontFamily: FONT_CLASH,
    letterSpacing: "-0.2px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    textAlign: "left",
  } as Partial<CSSStyleDeclaration>);

  bodyEl = document.createElement("div");
  Object.assign(bodyEl.style, {
    fontWeight: "400",
    lineHeight: "1.55",
    marginTop: "4px",
    minHeight: "16px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    textAlign: "left",
  } as Partial<CSSStyleDeclaration>);

  host.appendChild(titleEl);
  host.appendChild(bodyEl);
  document.body.appendChild(host);
  return true;
}

// The height a card node needs to show its content, never below its assigned
// (importance-driven) height, capped at MAX_FIT_HEIGHT.
function fitCardHeight(node: GenNode): number {
  if (!ensure() || !host || !titleEl || !bodyEl) return node.height;
  host.style.width = `${node.width}px`;
  titleEl.style.fontSize = `${node.fontSize}px`;
  titleEl.textContent = node.title || "";
  bodyEl.style.fontSize = `${Math.max(11, node.fontSize - 2)}px`;
  bodyEl.textContent = node.body || "";
  const needed = host.offsetHeight; // includes vertical padding (border-box)
  return Math.min(MAX_FIT_HEIGHT, Math.max(node.height, Math.ceil(needed)));
}

// Grow the rectangular card types in place to fit their text. Other types
// (circle/oval/sticky stay shape-constrained, text auto-sizes, diamond keeps its
// size) are left at their importance-driven size. No-op outside the browser.
export function fitGeneratedHeights(nodes: GenNode[]): void {
  if (typeof document === "undefined") return;
  for (const n of nodes) {
    if (n.type === "block" || n.type === "rounded") {
      n.height = fitCardHeight(n);
    }
  }
}

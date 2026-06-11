import type { CanvasNode, Connection } from "./canvas-types";

// ── Markdown export ───────────────────────────────────────────────────────────
// Interprets the directed connection graph as an outline: nodes with no
// incoming connection are roots, children nest beneath their parent as
// bullets. A node reachable from several parents is rendered in full once
// and referenced (↪) afterwards, which also keeps cycles from recursing.

// Display text mirrors what the canvas shows most prominently: the title,
// falling back to the sidebar label.
function nodeText(n: CanvasNode): string {
  return (n.title ?? "").trim() || (n.label ?? "").trim() || "Untitled";
}

// Non-text payloads can't be embedded in Markdown — annotate them instead.
function nodeAnnotation(n: CanvasNode): string {
  if (n.type === "image") return " *(image)*";
  if (n.type === "textfile")
    return n.textFileName ? ` *(file: ${n.textFileName})*` : " *(file)*";
  return "";
}

export function buildBoardMarkdown(
  nodes: CanvasNode[],
  connections: Connection[],
  presentationOrder: number[],
  boardName: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${boardName.trim() || "Untitled Board"}`);
  lines.push("");
  const date = new Date().toISOString().slice(0, 10);
  lines.push(
    `> Exported from DNKRM on ${date} · ${nodes.length} node${
      nodes.length === 1 ? "" : "s"
    }, ${connections.length} connection${connections.length === 1 ? "" : "s"}`,
  );

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const validConns = connections.filter(
    (c) => nodeMap.has(c.from) && nodeMap.has(c.to),
  );

  // Children in connection-creation order; indegree decides who is a root.
  const childrenOf = new Map<number, number[]>();
  const indegree = new Map<number, number>();
  const connected = new Set<number>();
  for (const c of validConns) {
    const kids = childrenOf.get(c.from);
    if (kids) kids.push(c.to);
    else childrenOf.set(c.from, [c.to]);
    indegree.set(c.to, (indegree.get(c.to) ?? 0) + 1);
    connected.add(c.from);
    connected.add(c.to);
  }

  const visited = new Set<number>();
  const renderSubtree = (id: number, depth: number) => {
    const n = nodeMap.get(id);
    if (!n) return;
    const indent = "  ".repeat(depth);
    if (visited.has(id)) {
      // Already rendered under another parent (or a cycle) — reference it.
      lines.push(`${indent}- ↪ *${nodeText(n)}*`);
      return;
    }
    visited.add(id);
    const body = (n.body ?? "").trim();
    const bodyLines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    let bullet = `${indent}- **${nodeText(n)}**${nodeAnnotation(n)}`;
    if (bodyLines.length === 1) bullet += ` — ${bodyLines[0]}`;
    lines.push(bullet);
    if (bodyLines.length > 1) {
      for (const bl of bodyLines) lines.push(`${indent}  ${bl}`);
    }
    for (const child of childrenOf.get(id) ?? []) {
      renderSubtree(child, depth + 1);
    }
  };

  if (connected.size > 0) {
    lines.push("", "## Outline", "");
    // Roots in node-array (creation/z) order.
    for (const n of nodes) {
      if (connected.has(n.id) && !(indegree.get(n.id) ?? 0)) {
        renderSubtree(n.id, 0);
      }
    }
    // Pure cycles have no indegree-0 entry point — start them at the first
    // unvisited member.
    for (const n of nodes) {
      if (connected.has(n.id) && !visited.has(n.id)) renderSubtree(n.id, 0);
    }
  }

  const standalone = nodes.filter((n) => !connected.has(n.id));
  if (standalone.length > 0) {
    lines.push("", "## Standalone Nodes", "");
    for (const n of standalone) renderSubtree(n.id, 0);
  }

  // The curated presentation sequence, excluding hidden nodes — mirrors what
  // presentation mode would actually walk through.
  const storyPath = presentationOrder
    .map((id) => nodeMap.get(id))
    .filter((n): n is CanvasNode => !!n && !n.excludeFromPresentation);
  if (storyPath.length > 0) {
    lines.push("", "## Story Path", "");
    storyPath.forEach((n, i) => {
      lines.push(`${i + 1}. ${nodeText(n)}`);
    });
  }

  return lines.join("\n") + "\n";
}

export function exportBoardMarkdown(
  nodes: CanvasNode[],
  connections: Connection[],
  presentationOrder: number[],
  boardName: string,
): void {
  if (nodes.length === 0) return;
  const md = buildBoardMarkdown(nodes, connections, presentationOrder, boardName);
  const safeName = boardName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "board";
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.md`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

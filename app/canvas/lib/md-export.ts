import type { CanvasNode, Connection, RichLine } from "./canvas-types";
import { lineRuns, lineMeta } from "./rich-text";
import { domainOf } from "./link-preview";

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

// Maps one line of styled runs to inline Markdown. Bold → **…**, italic →
// *…*, underline → <u>…</u> (Markdown has no underline; inline HTML is the
// convention). Font sizes have no Markdown equivalent and are dropped.
// Titles stay plain — outline bullets already wrap them in **, and nested
// markers would break the emphasis.
function lineToMd(line: RichLine): string {
  const runs = lineRuns(line);
  const meta = lineMeta(line);
  // List lines get a Markdown marker; alignment has no Markdown equivalent and
  // is dropped. (Repeated "1." still renders 1, 2, 3… in standard Markdown.)
  const prefix =
    meta.list === "bullet" ? "- " : meta.list === "number" ? "1. " : "";
  // Image runs occupy their own line and have no Markdown equivalent worth
  // inlining (data URLs) — emit a placeholder. Run colors are dropped.
  if (runs.some((r) => r.img)) return prefix + "*(image)*";
  // Group consecutive runs that differ only in font size so markers don't
  // butt against each other (`**a****b**` would not render as bold).
  const groups: { b: boolean; i: boolean; u: boolean; t: string }[] = [];
  for (const r of runs) {
    const prev = groups[groups.length - 1];
    if (prev && prev.b === !!r.b && prev.i === !!r.i && prev.u === !!r.u) {
      prev.t += r.t;
    } else {
      groups.push({ b: !!r.b, i: !!r.i, u: !!r.u, t: r.t });
    }
  }
  return prefix + groups
    .map((g) => {
      if (!g.b && !g.i && !g.u) return g.t;
      // Emphasis markers don't tolerate adjacent whitespace — keep it outside.
      const m = g.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const lead = m?.[1] ?? "";
      const core = m?.[2] ?? g.t;
      const trail = m?.[3] ?? "";
      if (core === "") return g.t;
      let t = core;
      if (g.u) t = `<u>${t}</u>`;
      if (g.i) t = `*${t}*`;
      if (g.b) t = `**${t}**`;
      return lead + t + trail;
    })
    .join("");
}

// Non-text payloads can't be embedded in Markdown — annotate them instead.
// Documents export their full content (see renderSubtree), so the annotation
// only marks what kind of node the text came from.
function nodeAnnotation(n: CanvasNode): string {
  if (n.type === "image") return " *(image)*";
  if (n.type === "textfile")
    return n.textFileName ? ` *(file: ${n.textFileName})*` : " *(document)*";
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
    // Link nodes export as a real Markdown link, labelled by title or domain.
    if (n.type === "link" && n.linkUrl) {
      const label = (n.title ?? "").trim() || domainOf(n.linkUrl);
      lines.push(`${indent}- [${label}](${n.linkUrl})`);
      for (const child of childrenOf.get(id) ?? []) {
        renderSubtree(child, depth + 1);
      }
      return;
    }
    // Checklists export as nested GitHub task-list items; documents contribute
    // their full content; other nodes their body field.
    const isChecklistNode = n.type === "checklist";
    const rawLines = isChecklistNode
      ? (n.checklistItems ?? [])
          .filter((it) => it.text.trim() !== "")
          .map((it) => `- [${it.checked ? "x" : " "}] ${it.text.trim()}`)
      : n.type === "textfile"
        ? n.docRich
          ? n.docRich.map(lineToMd)
          : (n.textFileContent ?? "").trim().split("\n")
        : n.bodyRich
          ? n.bodyRich.map(lineToMd)
          : (n.body ?? "").trim().split("\n");
    const bodyLines = rawLines.map((l) => l.trim()).filter((l) => l !== "");
    let bullet = `${indent}- **${nodeText(n)}**${nodeAnnotation(n)}`;
    // Checklist rows always render as their own nested lines (never inlined).
    if (!isChecklistNode && bodyLines.length === 1)
      bullet += ` — ${bodyLines[0]}`;
    lines.push(bullet);
    if (isChecklistNode ? bodyLines.length >= 1 : bodyLines.length > 1) {
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

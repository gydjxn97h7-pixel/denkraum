"use client";
import { Fragment, memo } from "react";
import type { CanvasNode, PanelSection } from "../lib/canvas-types";
import type { PresentationStep } from "../lib/presentation";
import { SidebarNodeItem } from "./SidebarNodeItem";
import { PresentationPanel } from "./PresentationPanel";
import { AiSettingsPanel } from "./AiSettingsPanel";
import type { AiCharacterState } from "./AiCharacter";
import { PanelSectionLabel, StatusRow } from "./panel-ui";
import { LayoutDashboard, Save, FolderOpen, X } from "lucide-react";
import { ICON, ICON_PROPS } from "../lib/design-tokens";

interface SidebarPanelProps {
  activePanel: PanelSection | null;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelSection | null>>;
  isPresenting: boolean;
  // Board section
  boardName: string;
  setBoardName: React.Dispatch<React.SetStateAction<string>>;
  editingBoardName: boolean;
  setEditingBoardName: React.Dispatch<React.SetStateAction<boolean>>;
  // Nodes section
  nodes: CanvasNode[];
  connectionCount: number;
  saveState: "saved" | "saving";
  selected: number | null;
  editingSidebarNodeId: number | null;
  setEditingSidebarNodeId: React.Dispatch<React.SetStateAction<number | null>>;
  focusNode: (id: number) => void;
  updateNodeLabel: (id: number, label: string) => void;
  // Presentation section
  presentSteps: PresentationStep[];
  nodeMap: Map<number, CanvasNode>;
  presentActiveSeqLength: number;
  toggleExcludeFromPresentation: (id: number, toExclude: boolean) => void;
  movePresentationStep: (stepIndex: number, dir: -1 | 1) => void;
  moveGroupMember: (groupId: string, memberId: number, dir: -1 | 1) => void;
  groupNodes: (ids: number[]) => void;
  addNodeToGroup: (nodeId: number, groupId: string) => void;
  removeNodeFromGroup: (nodeId: number) => void;
  dissolveGroup: (groupId: string) => void;
  onPresent: () => void;
  // Save / Load section
  saveBoard: () => void;
  onLoadBoardClick: () => void;
  // AI section
  aiState: AiCharacterState;
}

// ── Sidebar Panel (220px, shown when panel open) ──
function SidebarPanelImpl({
  activePanel,
  setActivePanel,
  isPresenting,
  boardName,
  setBoardName,
  editingBoardName,
  setEditingBoardName,
  nodes,
  connectionCount,
  saveState,
  selected,
  editingSidebarNodeId,
  setEditingSidebarNodeId,
  focusNode,
  updateNodeLabel,
  presentSteps,
  nodeMap,
  presentActiveSeqLength,
  toggleExcludeFromPresentation,
  movePresentationStep,
  moveGroupMember,
  groupNodes,
  addNodeToGroup,
  removeNodeFromGroup,
  dissolveGroup,
  onPresent,
  saveBoard,
  onLoadBoardClick,
  aiState,
}: SidebarPanelProps) {
  const panelOpen = activePanel !== null;
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 76,
        height: "calc(100vh - 24px)",
        width: 340,
        background:
          "linear-gradient(180deg, rgba(216,201,168,0.04) 0%, rgba(216,201,168,0) 100%), rgba(252,251,248,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 16,
        boxShadow:
          "0 4px 12px rgba(58,48,38,0.10), 0 16px 44px rgba(58,48,38,0.20)",
        zIndex: 149,
        display: panelOpen && !isPresenting ? "flex" : "none",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      {/* ── Panel Header (dynamic title) ── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          background: "rgba(0,0,0,0.15)",
          borderBottom: "1px solid rgba(42,40,35,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 0 16px",
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: 1,
            color: "#2A2823",
            fontFamily: "var(--font-clash), system-ui, sans-serif",
          }}
        >
          {activePanel === "board" && "BOARD"}
          {activePanel === "nodes" && "NODES"}
          {activePanel === "presentation" && "PRESENT"}
          {activePanel === "saveload" && "BOARD FILES"}
          {activePanel === "shortcuts" && "SHORTCUTS"}
          {activePanel === "ai" && "AI"}
        </span>
        <button
          onClick={() => setActivePanel(null)}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(42,40,35,0.7)",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 8px",
            lineHeight: 1,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(42,40,35,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(42,40,35,0.7)";
          }}
        >
          <X size={ICON.md} {...ICON_PROPS} />
        </button>
      </div>

      {/* Icon gradient defs — always in DOM for SidebarNodeItem icons */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        <defs>
          {(
            [
              "iconGradBlock",
              "iconGradRounded",
              "iconGradCircle",
              "iconGradOval",
              "iconGradDiamond",
              "iconGradText",
              "iconGradImage",
              "iconGradTextfile",
            ] as string[]
          ).map((id) => (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FCFBF8" />
              <stop offset="100%" stopColor="#E8DEC8" />
            </linearGradient>
          ))}
        </defs>
      </svg>

      {/* ── BOARD section ── */}
      {activePanel === "board" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingTop: 16,
          }}
        >
          <PanelSectionLabel first>Details</PanelSectionLabel>
          {/* Board row */}
          <div
            onDoubleClick={() => setEditingBoardName(true)}
            style={{
              position: "relative",
              height: 40,
              display: "flex",
              alignItems: "center",
              cursor: "text",
              background:
                "linear-gradient(to right, rgba(197,107,71,0.07), transparent)",
              justifyContent: "flex-start",
            }}
          >
            {/* Left accent bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 2.5,
                height: 40,
                background: "#C56B47",
                borderRadius: "0 1px 1px 0",
              }}
            />

            {/* Board icon */}
            <div
              style={{
                paddingLeft: 20,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <LayoutDashboard
                size={ICON.sm}
                {...ICON_PROPS}
                color="rgba(42,40,35,0.6)"
              />
            </div>

            {editingBoardName ? (
              <input
                autoFocus
                defaultValue={boardName}
                maxLength={60}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const val = e.target.value.trim() || "Untitled Board";
                  setBoardName(val);
                  setEditingBoardName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val =
                      (e.target as HTMLInputElement).value.trim() ||
                      "Untitled Board";
                    setBoardName(val);
                    setEditingBoardName(false);
                  }
                  if (e.key === "Escape") setEditingBoardName(false);
                  e.stopPropagation();
                }}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  marginRight: 12,
                  fontSize: 12,
                  fontFamily: "inherit",
                  background: "rgba(42,40,35,0.07)",
                  border: "none",
                  outline: "1px solid rgba(197,107,71,0.4)",
                  borderRadius: 8,
                  padding: "0 4px",
                  color: "#2A2823",
                  minWidth: 0,
                }}
              />
            ) : (
              <>
                <span
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#2A2823",
                    fontFamily: "var(--font-clash), system-ui, sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {boardName}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  style={{ marginRight: 20, flexShrink: 0 }}
                >
                  <circle cx="8" cy="8" r="6" fill="rgba(197,107,71,0.12)" />
                  <circle cx="8" cy="8" r="3.5" fill="#C56B47" />
                </svg>
              </>
            )}
          </div>

          {/* Status group — label left, value/state right */}
          <PanelSectionLabel>Status</PanelSectionLabel>
          <StatusRow label="Nodes" value={nodes.length} />
          <StatusRow label="Connections" value={connectionCount} />
          <StatusRow
            label="Autosave"
            value={saveState === "saving" ? "Saving…" : "Saved"}
            dotColor={saveState === "saving" ? "#D4A04A" : "#7C7A4E"}
          />
        </div>
      )}

      {/* ── NODES section ── */}
      {activePanel === "nodes" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingTop: 16,
          }}
        >
          <PanelSectionLabel first>
            All Nodes · {nodes.length}
          </PanelSectionLabel>
          {nodes.length === 0 ? (
            <div
              style={{
                padding: "8px 20px",
                fontSize: 12,
                color: "rgba(42,40,35,0.4)",
              }}
            >
              No nodes yet
            </div>
          ) : (
            nodes.map((n) => (
              <SidebarNodeItem
                key={n.id}
                id={n.id}
                type={n.type}
                label={
                  (n.label ?? n.title).replace(/<[^>]*>/g, "").trim() ||
                  "Untitled"
                }
                defaultLabelValue={n.label ?? n.title}
                isActive={selected === n.id}
                isEditingSidebar={editingSidebarNodeId === n.id}
                focusNode={focusNode}
                updateNodeLabel={updateNodeLabel}
                setEditingSidebarNodeId={setEditingSidebarNodeId}
              />
            ))
          )}
        </div>
      )}

      {/* ── PRESENTATION section ── */}
      {activePanel === "presentation" && (
        <PresentationPanel
          presentSteps={presentSteps}
          nodeMap={nodeMap}
          presentActiveSeqLength={presentActiveSeqLength}
          toggleExcludeFromPresentation={toggleExcludeFromPresentation}
          movePresentationStep={movePresentationStep}
          moveGroupMember={moveGroupMember}
          groupNodes={groupNodes}
          addNodeToGroup={addNodeToGroup}
          removeNodeFromGroup={removeNodeFromGroup}
          dissolveGroup={dissolveGroup}
          onPresent={onPresent}
        />
      )}

      {/* ── SAVELOAD section ── */}
      {activePanel === "saveload" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingTop: 16,
          }}
        >
          <PanelSectionLabel first>Files</PanelSectionLabel>
          {/* Save row */}
          <button
            title="Save board"
            onClick={() => saveBoard()}
            style={{
              height: 44,
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "flex-start",
              paddingLeft: 16,
              paddingRight: 16,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(42,40,35,0.03)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Save
              size={ICON.sm}
              {...ICON_PROPS}
              color="rgba(42,40,35,0.75)"
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                flex: 1,
                textAlign: "left",
                fontSize: 12,
                color: "rgba(42,40,35,0.85)",
              }}
            >
              Save board
            </span>
            <kbd
              style={{
                fontSize: 11,
                color: "rgba(42,40,35,0.55)",
                background: "rgba(42,40,35,0.04)",
                border: "1px solid rgba(42,40,35,0.07)",
                borderRadius: 8,
                padding: "4px 8px",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              ⌘S
            </kbd>
          </button>

          {/* Load row */}
          <button
            title="Load board"
            onClick={onLoadBoardClick}
            style={{
              height: 44,
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "flex-start",
              paddingLeft: 16,
              paddingRight: 16,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(42,40,35,0.03)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <FolderOpen
              size={ICON.sm}
              {...ICON_PROPS}
              color="rgba(42,40,35,0.6)"
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                flex: 1,
                textAlign: "left",
                fontSize: 12,
                color: "rgba(42,40,35,0.55)",
              }}
            >
              Load board
            </span>
          </button>
        </div>
      )}

      {/* ── SHORTCUTS section ── */}
      {activePanel === "shortcuts" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingTop: 16,
          }}
        >
          <PanelSectionLabel first>Keyboard</PanelSectionLabel>
          {/* Two-column grid: fixed badge column + flexible description column.
              gridAutoRows minmax(28px, auto) keeps the row rhythm but lets a row
              grow when its description wraps, so text never bleeds downward. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr",
              columnGap: 10,
              rowGap: 6,
              gridAutoRows: "minmax(28px, auto)",
              alignItems: "center",
              padding: "4px 14px 12px",
            }}
          >
            {(
              [
                { kbd: "⌫  Delete", desc: "Delete selected" },
                { kbd: "⌘ C", desc: "Copy node" },
                { kbd: "⌘ V", desc: "Paste node" },
                { kbd: "⌘ S", desc: "Save board" },
                { kbd: "Tab", desc: "Add child node" },
                { kbd: "Enter", desc: "Add sibling node" },
                { kbd: "Double-click", desc: "Edit node text" },
                { kbd: "F", desc: "Toggle filter" },
                { kbd: "↓ / ↑", desc: "Cycle filter results" },
                { kbd: "Esc", desc: "Cancel / close" },
                { kbd: "⌃ Scroll", desc: "Zoom in / out" },
                { kbd: "Right-click", desc: "Insert shape" },
                { kbd: "Click dot →", desc: "Connect nodes" },
                { kbd: "Drag → Group", desc: "Add node to group (Story Path)" },
                { kbd: "Drag out", desc: "Remove node from group" },
                { kbd: "→ / Space", desc: "Next slide" },
                { kbd: "←", desc: "Prev slide" },
              ] as { kbd: string; desc: string }[]
            ).map(({ kbd, desc }) => (
              <Fragment key={kbd}>
                <kbd
                  style={{
                    fontSize: 11,
                    color: "rgba(42,40,35,0.7)",
                    background: "rgba(42,40,35,0.04)",
                    border: "1px solid rgba(42,40,35,0.07)",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontFamily: "inherit",
                    justifySelf: "start",
                    whiteSpace: "nowrap",
                  }}
                >
                  {kbd}
                </kbd>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(42,40,35,0.4)",
                    lineHeight: 1.4,
                  }}
                >
                  {desc}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── AI section ── */}
      {activePanel === "ai" && <AiSettingsPanel aiState={aiState} />}
    </div>
  );
}

export const SidebarPanel = memo(SidebarPanelImpl);

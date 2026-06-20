"use client";
import { Fragment, memo, useCallback, useRef } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useClickOutside } from "../lib/use-click-outside";
import type { CanvasNode, PanelSection } from "../lib/canvas-types";
import type { PresentationStep } from "../lib/presentation";
import { SidebarNodeItem } from "./SidebarNodeItem";
import { PresentationPanel } from "./PresentationPanel";
import { AiPanel } from "./AiPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { AiCharacterState } from "./AiCharacter";
import { StatusRow } from "./panel-ui";
import {
  Workflow,
  Waypoints,
  Play,
  FolderOpen,
  ListChecks,
  Sparkles,
  Settings,
  Save,
  FolderOpen as FolderOpenRow,
  X,
} from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";

// ── Two-layer floating sidebar ──────────────────────────────────────────────
// A single floating unit that hovers over the canvas with a margin on every
// side (never touches the browser edge). Layer 1 is a slim always-visible icon
// strip; Layer 2 is the expanded panel that slides out to its right when an icon
// is clicked. Both layers share one frosted container — a light stone tint over
// a backdrop blur, so the canvas bleeds through. Panel content sits on small
// opaque surface cards so it stays readable over the frost.

const STRIP_W = 56;
const PANEL_W = 304;
const MARGIN = 12;

// Spring used for the panel expand / collapse (Motion Primitives foundation).
const SPRING = { type: "spring", bounce: 0.1, duration: 0.25 } as const;

// Frosted glass: a very light stone tint (surface) at low opacity over a strong
// backdrop blur, so the canvas clearly bleeds through the sidebar.
const FROST_BG = "rgba(240,237,229,0.35)";
const FROST_BLUR = "blur(24px)";
// Hairline that separates the strip from the panel and frames the frost.
const HAIRLINE = "rgba(42,40,35,0.10)";

// The six primary nav icons (top→bottom), then Settings is pinned to the
// bottom below a hard divider. The icon labels are the product nav; a couple
// point at existing panels whose content is broader than the label (Connections
// → board details/counts, Checklist → keyboard reference).
const NAV: { section: PanelSection; title: string; icon: React.ReactNode }[] = [
  { section: "nodes", title: "Nodes", icon: <Workflow size={ICON.lg} {...ICON_PROPS} /> },
  { section: "board", title: "Connections", icon: <Waypoints size={ICON.lg} {...ICON_PROPS} /> },
  { section: "presentation", title: "Present", icon: <Play size={ICON.lg} {...ICON_PROPS} /> },
  { section: "saveload", title: "Files", icon: <FolderOpen size={ICON.lg} {...ICON_PROPS} /> },
  { section: "shortcuts", title: "Checklist", icon: <ListChecks size={ICON.lg} {...ICON_PROPS} /> },
  { section: "ai", title: "AI", icon: <Sparkles size={ICON.lg} {...ICON_PROPS} /> },
];

// Panel header label per section (matches the nav icon's label).
const PANEL_TITLE: Record<PanelSection, string> = {
  nodes: "Nodes",
  board: "Connections",
  presentation: "Present",
  saveload: "Files",
  shortcuts: "Checklist",
  ai: "AI",
  settings: "Settings",
};

interface FloatingSidebarProps {
  activePanel: PanelSection | null;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelSection | null>>;
  isPresenting: boolean;
  // Connections (board) section
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
  // Files (saveload) section
  saveBoard: () => void;
  onLoadBoardClick: () => void;
  // AI section
  aiState: AiCharacterState;
  onSummarize: () => void;
  onGenerate: () => void;
  aiWorkspace: { x: number; y: number } | null;
  placingWorkspace: boolean;
  onAssignWorkspace: () => void;
  onClearWorkspace: () => void;
}

// Single icon-strip button (primary nav + Settings).
function NavButton({
  title,
  icon,
  isActive,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        // Active gets a subtle opaque surface indicator; rest are bare.
        background: isActive ? tokens.color.surface : "transparent",
        color: isActive ? tokens.color.ink : "rgba(42,40,35,0.7)",
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.35)";
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

// Small opaque surface card the panel's readable content sits on.
function Card({
  children,
  pad = 8,
  style,
}: {
  children: React.ReactNode;
  pad?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: tokens.color.surface,
        borderRadius: 10,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Section heading inside the panel — small uppercase, calm.
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(42,40,35,0.5)",
        fontFamily: "var(--font-clash), system-ui, sans-serif",
        padding: "0 2px",
        margin: "0 0 6px",
      }}
    >
      {children}
    </div>
  );
}

function FloatingSidebarImpl({
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
  onSummarize,
  onGenerate,
  aiWorkspace,
  placingWorkspace,
  onAssignWorkspace,
  onClearWorkspace,
}: FloatingSidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Click-outside collapses the panel (Motion Primitives behaviour).
  const collapse = useCallback(
    () => setActivePanel(null),
    [setActivePanel],
  );
  useClickOutside(containerRef, collapse);

  if (isPresenting) return null;
  const open = activePanel !== null;

  const toggle = (section: PanelSection) =>
    setActivePanel((prev) => (prev === section ? null : section));

  return (
    <MotionConfig transition={SPRING}>
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: MARGIN,
        left: MARGIN,
        bottom: MARGIN,
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        borderRadius: 18,
        overflow: "hidden",
        background: FROST_BG,
        backdropFilter: FROST_BLUR,
        WebkitBackdropFilter: FROST_BLUR,
        boxShadow: "0 6px 22px rgba(58,48,38,0.16)",
        zIndex: 150,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      {/* ── Layer 1 — icon strip ── */}
      <div
        style={{
          width: STRIP_W,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0",
          gap: 6,
        }}
      >
        {NAV.map((item) => (
          <NavButton
            key={item.section}
            title={item.title}
            icon={item.icon}
            isActive={activePanel === item.section}
            onClick={() => toggle(item.section)}
          />
        ))}

        {/* push Settings to the bottom */}
        <div style={{ flex: 1 }} />

        {/* hard divider above Settings */}
        <div
          style={{
            width: 24,
            height: 1,
            background: HAIRLINE,
            margin: "4px 0 10px",
            flexShrink: 0,
          }}
        />
        <NavButton
          title="Settings"
          icon={<Settings size={ICON.lg} {...ICON_PROPS} />}
          isActive={activePanel === "settings"}
          onClick={() => toggle("settings")}
        />
      </div>

      {/* ── Layer 2 — expanded panel ── */}
      {/* Slides + fades open/closed via Motion (width + opacity spring). The
          inner card is fixed-width so content never reflows mid-animation; the
          motion wrapper clips it with overflow:hidden. */}
      <AnimatePresence initial={false}>
        {open && activePanel && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_W, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            style={{
              flexShrink: 0,
              alignSelf: "stretch",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                width: PANEL_W,
                height: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                borderLeft: `1px solid ${HAIRLINE}`,
              }}
            >
              {/* Panel header — title + collapse */}
          <div
            style={{
              flexShrink: 0,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
              borderBottom: `1px solid ${HAIRLINE}`,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: tokens.color.ink,
                fontFamily: "var(--font-clash), system-ui, sans-serif",
              }}
            >
              {PANEL_TITLE[activePanel]}
            </span>
            <button
              title="Collapse"
              aria-label="Collapse panel"
              onClick={() => setActivePanel(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(42,40,35,0.6)",
                cursor: "pointer",
                padding: 4,
                borderRadius: tokens.radius.xs,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "rgba(42,40,35,0.9)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "rgba(42,40,35,0.6)")
              }
            >
              <X size={ICON.md} {...ICON_PROPS} />
            </button>
          </div>

          {/* Icon gradient defs — needed by SidebarNodeItem glyphs */}
          <svg
            width="0"
            height="0"
            style={{ position: "absolute", pointerEvents: "none" }}
          >
            <defs>
              {[
                "iconGradBlock",
                "iconGradRounded",
                "iconGradCircle",
                "iconGradOval",
                "iconGradDiamond",
                "iconGradText",
                "iconGradImage",
                "iconGradTextfile",
              ].map((id) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FCFBF8" />
                  <stop offset="100%" stopColor="#E8DEC8" />
                </linearGradient>
              ))}
            </defs>
          </svg>

          {/* Sub-panels (AI / Settings / Present) own their scroll + layout, so
              they fill an opaque surface card directly. */}
          {activePanel === "ai" && (
            <SubPanelCard>
              <AiPanel
                aiState={aiState}
                nodeCount={nodes.length}
                onSummarize={onSummarize}
                onGenerate={onGenerate}
                workspace={aiWorkspace}
                placingWorkspace={placingWorkspace}
                onAssignWorkspace={onAssignWorkspace}
                onClearWorkspace={onClearWorkspace}
              />
            </SubPanelCard>
          )}
          {activePanel === "settings" && (
            <SubPanelCard>
              <SettingsPanel />
            </SubPanelCard>
          )}
          {activePanel === "presentation" && (
            <SubPanelCard>
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
            </SubPanelCard>
          )}

          {/* Simple sections scroll within a padded column of cards. */}
          {(activePanel === "board" ||
            activePanel === "nodes" ||
            activePanel === "saveload" ||
            activePanel === "shortcuts") && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* ── Connections (board details + counts) ── */}
              {activePanel === "board" && (
                <>
                  <section>
                    <Heading>Board</Heading>
                    <Card pad={0}>
                      <div
                        onDoubleClick={() => setEditingBoardName(true)}
                        style={{
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                          cursor: "text",
                        }}
                      >
                        {editingBoardName ? (
                          <input
                            autoFocus
                            defaultValue={boardName}
                            maxLength={60}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              setBoardName(
                                e.target.value.trim() || "Untitled Board",
                              );
                              setEditingBoardName(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setBoardName(
                                  (e.target as HTMLInputElement).value.trim() ||
                                    "Untitled Board",
                                );
                                setEditingBoardName(false);
                              }
                              if (e.key === "Escape") setEditingBoardName(false);
                              e.stopPropagation();
                            }}
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontFamily: "inherit",
                              background: "rgba(42,40,35,0.06)",
                              border: "none",
                              outline: `1px solid ${tokens.color.ink}`,
                              borderRadius: tokens.radius.xs,
                              padding: "4px 6px",
                              color: "#2A2823",
                              minWidth: 0,
                            }}
                          />
                        ) : (
                          <span
                            title="Double-click to rename"
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#2A2823",
                              fontFamily:
                                "var(--font-clash), system-ui, sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            {boardName}
                          </span>
                        )}
                      </div>
                    </Card>
                  </section>

                  <section>
                    <Heading>Status</Heading>
                    <Card pad="6px 4px">
                      <StatusRow label="Nodes" value={nodes.length} />
                      <StatusRow label="Connections" value={connectionCount} />
                      <StatusRow
                        label="Autosave"
                        value={saveState === "saving" ? "Saving…" : "Saved"}
                        dotColor={
                          saveState === "saving"
                            ? tokens.color.driftwood
                            : tokens.color.fern
                        }
                      />
                    </Card>
                  </section>
                </>
              )}

              {/* ── Nodes ── */}
              {activePanel === "nodes" && (
                <section
                  style={{ display: "flex", flexDirection: "column", flex: 1 }}
                >
                  <Heading>All nodes · {nodes.length}</Heading>
                  <Card pad={nodes.length === 0 ? 12 : "6px 0"}>
                    {nodes.length === 0 ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(42,40,35,0.4)",
                        }}
                      >
                        No nodes yet
                      </span>
                    ) : (
                      nodes.map((n) => (
                        <SidebarNodeItem
                          key={n.id}
                          id={n.id}
                          type={n.type}
                          label={
                            (n.label ?? n.title)
                              .replace(/<[^>]*>/g, "")
                              .trim() || "Untitled"
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
                  </Card>
                </section>
              )}

              {/* ── Files (save / load) ── */}
              {activePanel === "saveload" && (
                <section>
                  <Heading>Board files</Heading>
                  <Card pad={0}>
                    <button
                      title="Save board"
                      onClick={() => saveBoard()}
                      style={fileRowStyle}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "rgba(42,40,35,0.04)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "transparent")
                      }
                    >
                      <Save
                        size={ICON.sm}
                        {...ICON_PROPS}
                        color="rgba(42,40,35,0.75)"
                        style={{ flexShrink: 0 }}
                      />
                      <span style={fileRowLabel}>Save board</span>
                      <kbd style={kbdStyle}>⌘S</kbd>
                    </button>
                    <div style={{ height: 1, background: HAIRLINE }} />
                    <button
                      title="Load board"
                      onClick={onLoadBoardClick}
                      style={fileRowStyle}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "rgba(42,40,35,0.04)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "transparent")
                      }
                    >
                      <FolderOpenRow
                        size={ICON.sm}
                        {...ICON_PROPS}
                        color="rgba(42,40,35,0.6)"
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ ...fileRowLabel, color: "rgba(42,40,35,0.65)" }}>
                        Load board
                      </span>
                    </button>
                  </Card>
                </section>
              )}

              {/* ── Checklist (keyboard reference) ── */}
              {activePanel === "shortcuts" && (
                <section>
                  <Heading>Keyboard</Heading>
                  <Card pad="10px 12px">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "104px 1fr",
                        columnGap: 10,
                        rowGap: 7,
                        gridAutoRows: "minmax(24px, auto)",
                        alignItems: "center",
                      }}
                    >
                      {SHORTCUTS.map(({ kbd, desc }) => (
                        <Fragment key={kbd}>
                          <kbd style={{ ...kbdStyle, justifySelf: "start" }}>
                            {kbd}
                          </kbd>
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(42,40,35,0.5)",
                              lineHeight: 1.4,
                            }}
                          >
                            {desc}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </Card>
                </section>
              )}
            </div>
          )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

// Surface card that fills the panel body for a self-laying-out sub-panel.
function SubPanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        margin: 12,
        background: tokens.color.surface,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

const fileRowStyle: React.CSSProperties = {
  height: 42,
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "inherit",
};
const fileRowLabel: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  fontSize: 12,
  color: "rgba(42,40,35,0.85)",
};
const kbdStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(42,40,35,0.7)",
  background: "rgba(42,40,35,0.05)",
  border: `1px solid ${HAIRLINE}`,
  borderRadius: tokens.radius.xs,
  padding: "3px 7px",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const SHORTCUTS: { kbd: string; desc: string }[] = [
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
];

export const FloatingSidebar = memo(FloatingSidebarImpl);

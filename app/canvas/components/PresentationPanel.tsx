"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import type { CanvasNode } from "../lib/canvas-types";
import type { PresentationStep } from "../lib/presentation";
import {
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Play,
  Layers,
  Group,
  Ungroup,
  CheckSquare,
  Square,
} from "lucide-react";
import { ICON, ICON_PROPS, tokens } from "../lib/design-tokens";
import { PanelSectionLabel } from "./panel-ui";

interface PresentationPanelProps {
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
}

// dataTransfer MIME for an ungrouped node dragged from the Story Path list onto
// a group. A custom type (vs text/plain) keeps unrelated drags from matching.
const NODE_DND_TYPE = "application/x-dnkrm-node";

const nodeLabel = (n: CanvasNode) =>
  (n.label ?? n.title).replace(/<[^>]*>/g, "").trim() || "Untitled";

// Small 22×22 transparent icon button with the panel's hover wash.
function PanelIconButton({
  onClick,
  disabled,
  title,
  children,
  color = "rgba(42,40,35,0.55)",
  hoverColor = "rgba(42,40,35,0.8)",
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
  color?: string;
  hoverColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 22,
        height: 22,
        border: "none",
        borderRadius: tokens.radius.xs,
        background: "transparent",
        color: disabled ? "rgba(42,40,35,0.15)" : color,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background =
          "rgba(42,40,35,0.06)";
        (e.currentTarget as HTMLElement).style.color = hoverColor;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = disabled
          ? "rgba(42,40,35,0.15)"
          : color;
      }}
    >
      {children}
    </button>
  );
}

// Sequence-number chip shared by node rows and group headers.
function SeqNum({ value, excluded }: { value: string; excluded: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: excluded ? "rgba(42,40,35,0.4)" : "rgba(42,40,35,0.3)",
        flexShrink: 0,
        width: 16,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

// Eye toggle for including / excluding a node from the presentation.
function ExcludeToggle({
  excluded,
  onClick,
}: {
  excluded: boolean;
  onClick: () => void;
}) {
  return (
    <PanelIconButton
      onClick={onClick}
      title={excluded ? "Include in presentation" : "Exclude from presentation"}
      color={excluded ? "rgba(42,40,35,0.4)" : "rgba(216,201,168,0.85)"}
      hoverColor={excluded ? "rgba(42,40,35,0.75)" : "#7C7A4E"}
    >
      {excluded ? (
        <EyeOff size={ICON.sm} {...ICON_PROPS} />
      ) : (
        <Eye size={ICON.sm} {...ICON_PROPS} />
      )}
    </PanelIconButton>
  );
}

// ── PRESENTATION section ── (Story Path: node + group steps, group controls)
export function PresentationPanel({
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
}: PresentationPanelProps) {
  // Checked ungrouped nodes awaiting a "Group" action.
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Drag & drop state:
  //  draggingNodeId      — the node row currently being dragged (any row)
  //  draggingFromGroupId — its group id if it's a grouped member, else null;
  //                        drives the "remove from group" drop zone
  //  dragOverGroupId     — the group currently hovered as an add/move target
  //  overRemoveZone      — the remove drop zone is currently hovered
  const [draggingNodeId, setDraggingNodeId] = useState<number | null>(null);
  const [draggingFromGroupId, setDraggingFromGroupId] = useState<string | null>(
    null,
  );
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [overRemoveZone, setOverRemoveZone] = useState(false);
  const endDrag = () => {
    setDraggingNodeId(null);
    setDraggingFromGroupId(null);
    setDragOverGroupId(null);
    setOverRemoveZone(false);
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Only ungrouped (node-step) ids are selectable; drop stale ids that have
  // since been grouped or deleted.
  const selectableIds = new Set<number>(
    presentSteps.filter((s) => s.kind === "node").map((s) => s.id),
  );
  const validSelected = [...selected].filter((id) => selectableIds.has(id));

  // Per-step display number ("–" for steps whose every member is excluded).
  let pos = 0;
  const stepNumbers = presentSteps.map((s) => {
    const active =
      s.kind === "node"
        ? !nodeMap.get(s.id)?.excludeFromPresentation
        : s.memberIds.some((id) => !nodeMap.get(id)?.excludeFromPresentation);
    if (active) {
      pos += 1;
      return String(pos);
    }
    return "–";
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 16 }}>
        <PanelSectionLabel first>Story Path</PanelSectionLabel>

        {/* Group action bar — appears once any node is checked. */}
        {validSelected.length > 0 && (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "0 8px 4px",
              padding: "6px 8px",
              borderRadius: 10,
              background: tokens.color.sand,
              border: `0.5px solid ${tokens.color.border}`,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: "rgba(42,40,35,0.7)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {validSelected.length} selected
            </span>
            <button
              onClick={() => {
                groupNodes(validSelected);
                setSelected(new Set());
              }}
              disabled={validSelected.length < 2}
              title={
                validSelected.length < 2
                  ? "Select at least two nodes"
                  : "Group selected nodes into one step"
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 26,
                padding: "0 10px",
                borderRadius: tokens.radius.xs,
                border: "none",
                background:
                  validSelected.length < 2
                    ? "rgba(29,28,26,0.35)"
                    : tokens.color.ink,
                color: tokens.color.canvas,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: validSelected.length < 2 ? "default" : "pointer",
              }}
            >
              <Group size={ICON.sm} {...ICON_PROPS} />
              Group
            </button>
            <PanelIconButton
              onClick={() => setSelected(new Set())}
              title="Clear selection"
            >
              <Square size={ICON.sm} {...ICON_PROPS} />
            </PanelIconButton>
          </div>
        )}

        {/* Remove-from-group drop zone — only while a grouped member is being
            dragged. Dropping here clears the node's group (and dissolves the
            group if that leaves it with a single member). */}
        {draggingFromGroupId !== null && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setOverRemoveZone(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setOverRemoveZone(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData(NODE_DND_TYPE);
              const id = Number(raw);
              if (raw !== "" && Number.isFinite(id)) removeNodeFromGroup(id);
              endDrag();
            }}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              margin: "0 8px 6px",
              padding: "8px 10px",
              borderRadius: 10,
              border: overRemoveZone
                ? `1px solid ${tokens.color.ink}`
                : `1px dashed ${tokens.color.border}`,
              background: tokens.color.sand,
              boxShadow: overRemoveZone
                ? "0 0 0 3px rgba(29,28,26,0.12)"
                : undefined,
              color: tokens.color.ink,
              fontSize: 11,
              fontWeight: 600,
              transition:
                "background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease",
            }}
          >
            <Ungroup size={ICON.sm} {...ICON_PROPS} />
            Drop here to remove from group
          </div>
        )}

        {presentSteps.length === 0 ? (
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
          presentSteps.map((step, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === presentSteps.length - 1;

            // ── Node step ──
            if (step.kind === "node") {
              const n = nodeMap.get(step.id);
              if (!n) return null;
              const excluded = !!n.excludeFromPresentation;
              const checked = selected.has(step.id);
              const isDragging = draggingNodeId === step.id;
              return (
                <div
                  key={step.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(NODE_DND_TYPE, String(step.id));
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingNodeId(step.id);
                    setDraggingFromGroupId(null);
                  }}
                  onDragEnd={endDrag}
                  title="Drag onto a group to add this node to it"
                  style={{
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px 0 10px",
                    gap: 8,
                    opacity: isDragging ? 0.4 : excluded ? 0.45 : 1,
                    cursor: "grab",
                  }}
                >
                  <PanelIconButton
                    onClick={() => toggleSelect(step.id)}
                    title={checked ? "Deselect" : "Select for grouping"}
                    color={checked ? tokens.color.ink : "rgba(42,40,35,0.35)"}
                    hoverColor={checked ? tokens.color.ink : "rgba(42,40,35,0.6)"}
                  >
                    {checked ? (
                      <CheckSquare size={ICON.sm} {...ICON_PROPS} />
                    ) : (
                      <Square size={ICON.sm} {...ICON_PROPS} />
                    )}
                  </PanelIconButton>
                  <SeqNum value={stepNumbers[idx]} excluded={excluded} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: excluded
                        ? "rgba(42,40,35,0.5)"
                        : "rgba(42,40,35,0.8)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      textDecoration: excluded ? "line-through" : "none",
                    }}
                  >
                    {nodeLabel(n)}
                  </span>
                  <ExcludeToggle
                    excluded={excluded}
                    onClick={() =>
                      toggleExcludeFromPresentation(step.id, !excluded)
                    }
                  />
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <PanelIconButton
                      onClick={() => movePresentationStep(idx, -1)}
                      disabled={isFirst}
                      title="Move up"
                    >
                      <ChevronUp size={ICON.sm} {...ICON_PROPS} />
                    </PanelIconButton>
                    <PanelIconButton
                      onClick={() => movePresentationStep(idx, 1)}
                      disabled={isLast}
                      title="Move down"
                    >
                      <ChevronDown size={ICON.sm} {...ICON_PROPS} />
                    </PanelIconButton>
                  </div>
                </div>
              );
            }

            // ── Group step ──
            const stepExcluded = step.memberIds.every(
              (id) => nodeMap.get(id)?.excludeFromPresentation,
            );
            // Drop-target state: a node row is being dragged that this group can
            // accept — i.e. any dragged node except a member of this same group
            // (dropping a member back on its own group would be a no-op, so it
            // shouldn't light up as a target).
            const canAccept =
              draggingNodeId !== null && draggingFromGroupId !== step.groupId;
            const isDropTarget = canAccept && dragOverGroupId === step.groupId;
            return (
              <div
                key={step.groupId}
                onDragOver={(e) => {
                  if (!canAccept) return;
                  // preventDefault marks this as a valid drop target.
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={(e) => {
                  if (!canAccept) return;
                  e.preventDefault();
                  setDragOverGroupId(step.groupId);
                }}
                onDragLeave={(e) => {
                  // Ignore leaves into descendant rows — only clear when the
                  // cursor actually exits the group container.
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverGroupId((g) =>
                    g === step.groupId ? null : g,
                  );
                }}
                onDrop={(e) => {
                  if (!canAccept) return;
                  e.preventDefault();
                  const raw = e.dataTransfer.getData(NODE_DND_TYPE);
                  const id = Number(raw);
                  if (raw !== "" && Number.isFinite(id))
                    addNodeToGroup(id, step.groupId);
                  endDrag();
                }}
                style={{
                  margin: "2px 8px 6px",
                  border: isDropTarget
                    ? `1px solid ${tokens.color.ink}`
                    : canAccept
                      ? `1px dashed ${tokens.color.border}`
                      : "1px solid rgba(42,40,35,0.1)",
                  borderRadius: 10,
                  background: isDropTarget
                    ? tokens.color.sand
                    : "rgba(216,201,168,0.12)",
                  boxShadow: isDropTarget
                    ? "0 0 0 3px rgba(29,28,26,0.12)"
                    : undefined,
                  overflow: "hidden",
                  opacity: stepExcluded ? 0.5 : 1,
                  transition:
                    "background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease",
                }}
              >
                {/* Group header */}
                <div
                  style={{
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 6px 0 8px",
                    gap: 8,
                  }}
                >
                  <SeqNum value={stepNumbers[idx]} excluded={stepExcluded} />
                  <Layers
                    size={ICON.sm}
                    {...ICON_PROPS}
                    color="rgba(42,40,35,0.55)"
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(42,40,35,0.75)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    Group{" "}
                    <span
                      style={{
                        fontWeight: 400,
                        color: "rgba(42,40,35,0.45)",
                      }}
                    >
                      ({step.memberIds.length})
                    </span>
                  </span>
                  <PanelIconButton
                    onClick={() => dissolveGroup(step.groupId)}
                    title="Dissolve group into individual steps"
                  >
                    <Ungroup size={ICON.sm} {...ICON_PROPS} />
                  </PanelIconButton>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <PanelIconButton
                      onClick={() => movePresentationStep(idx, -1)}
                      disabled={isFirst}
                      title="Move group up"
                    >
                      <ChevronUp size={ICON.sm} {...ICON_PROPS} />
                    </PanelIconButton>
                    <PanelIconButton
                      onClick={() => movePresentationStep(idx, 1)}
                      disabled={isLast}
                      title="Move group down"
                    >
                      <ChevronDown size={ICON.sm} {...ICON_PROPS} />
                    </PanelIconButton>
                  </div>
                </div>

                {/* Group members */}
                {step.memberIds.map((mid, mIdx) => {
                  const n = nodeMap.get(mid);
                  if (!n) return null;
                  const excluded = !!n.excludeFromPresentation;
                  const mFirst = mIdx === 0;
                  const mLast = mIdx === step.memberIds.length - 1;
                  const mDragging = draggingNodeId === mid;
                  return (
                    <div
                      key={mid}
                      draggable
                      onDragStart={(e) => {
                        // dataTransfer is only writable during dragstart, so set
                        // it synchronously here.
                        e.dataTransfer.setData(NODE_DND_TYPE, String(mid));
                        e.dataTransfer.effectAllowed = "move";
                        // Defer the state flip to the next frame: it inserts the
                        // remove-from-group drop zone into the DOM, and mutating
                        // the DOM *synchronously* inside dragstart makes Chrome
                        // abort the drag immediately (dragend fires at once and
                        // no drop ever lands). Letting the drag fully initiate
                        // first avoids that.
                        const gid = step.groupId;
                        requestAnimationFrame(() => {
                          setDraggingNodeId(mid);
                          setDraggingFromGroupId(gid);
                        });
                      }}
                      onDragEnd={endDrag}
                      title="Drag out of the group to make it a standalone slide"
                      style={{
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 6px 0 14px",
                        marginLeft: 10,
                        borderLeft: "2px solid rgba(42,40,35,0.08)",
                        gap: 8,
                        opacity: mDragging ? 0.4 : excluded ? 0.55 : 1,
                        cursor: "grab",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: excluded
                            ? "rgba(42,40,35,0.5)"
                            : "rgba(42,40,35,0.75)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          textDecoration: excluded ? "line-through" : "none",
                        }}
                      >
                        {nodeLabel(n)}
                      </span>
                      <ExcludeToggle
                        excluded={excluded}
                        onClick={() =>
                          toggleExcludeFromPresentation(mid, !excluded)
                        }
                      />
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <PanelIconButton
                          onClick={() =>
                            moveGroupMember(step.groupId, mid, -1)
                          }
                          disabled={mFirst}
                          title="Move up within group"
                        >
                          <ChevronUp size={ICON.sm} {...ICON_PROPS} />
                        </PanelIconButton>
                        <PanelIconButton
                          onClick={() => moveGroupMember(step.groupId, mid, 1)}
                          disabled={mLast}
                          title="Move down within group"
                        >
                          <ChevronDown size={ICON.sm} {...ICON_PROPS} />
                        </PanelIconButton>
                      </div>
                    </div>
                  );
                })}

                {/* Drop hint — only while a node is being dragged over it. */}
                {isDropTarget && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "2px 8px 8px 24px",
                      padding: "5px 8px",
                      borderRadius: tokens.radius.xs,
                      border: `1px dashed ${tokens.color.border}`,
                      background: tokens.color.sand,
                      fontSize: 11,
                      fontWeight: 600,
                      color: tokens.color.ink,
                    }}
                  >
                    <Group size={ICON.sm} {...ICON_PROPS} />
                    Drop to add to group
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Present button */}
      <div
        style={{
          padding: "12px 16px",
          flexShrink: 0,
          borderTop: "1px solid rgba(42,40,35,0.06)",
        }}
      >
        <button
          disabled={presentActiveSeqLength === 0}
          onClick={onPresent}
          style={{
            width: "100%",
            height: 38,
            borderRadius: tokens.radius.xs,
            border: "none",
            background:
              presentActiveSeqLength === 0
                ? "rgba(29,28,26,0.35)"
                : tokens.color.ink,
            color: tokens.color.canvas,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: presentActiveSeqLength === 0 ? "default" : "pointer",
            letterSpacing: "-0.1px",
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (presentActiveSeqLength > 0)
              (e.currentTarget as HTMLElement).style.opacity = "0.88";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          <Play size={ICON.md} {...ICON_PROPS} />
          Present
        </button>
      </div>
    </div>
  );
}

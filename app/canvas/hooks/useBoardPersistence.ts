"use client";
import { useEffect, useRef, useState } from "react";
import {
  LS_NODES,
  LS_CONNECTIONS,
  LS_BOARD_NAME,
  LS_PRESENTATION_ORDER,
  LS_CAMERA,
} from "../lib/canvas-types";
import type {
  CanvasNode,
  Connection,
  AssetRecord,
} from "../lib/canvas-types";
import { stripHtml } from "../lib/color-helpers";
import { richHasMarks, richToPlain, sanitizeRichText } from "../lib/rich-text";
import { setAsset, deleteAsset, getAllAssets } from "../lib/idb";

interface BoardPersistenceArgs {
  nodes: CanvasNode[];
  connections: Connection[];
  boardName: string;
  presentationOrder: number[];
  pan: { x: number; y: number };
  zoom: number;
  idCounterRef: React.RefObject<number>;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setBoardName: React.Dispatch<React.SetStateAction<string>>;
  setPresentationOrder: React.Dispatch<React.SetStateAction<number[]>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

// Hydrates the board from localStorage + IndexedDB on mount, then debounce-saves
// board data and camera back as they change. Returns the `hydrated` flag.
export function useBoardPersistence({
  nodes,
  connections,
  boardName,
  presentationOrder,
  pan,
  zoom,
  idCounterRef,
  setNodes,
  setConnections,
  setBoardName,
  setPresentationOrder,
  setPan,
  setZoom,
}: BoardPersistenceArgs): { hydrated: boolean; saveState: "saved" | "saving" } {
  const [hydrated, setHydrated] = useState(false);
  // Reflects the debounce-autosave: "saving" while a write is pending, "saved"
  // once board data has been flushed to localStorage / IndexedDB.
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which node IDs currently have an entry in IndexedDB so we can
  // delete stale records when a node is removed or loses its asset fields.
  const prevAssetNodeIdsRef = useRef(new Set<number>());
  // Last-written asset content by reference — node content is immutable by
  // convention, so reference equality tells us a record is unchanged and the
  // 500ms board save can skip rewriting it (matters once documents are
  // large: a node drag shouldn't re-serialize a 50k-char document to IDB).
  const prevAssetRecordsRef = useRef(new Map<number, AssetRecord>());

  // ── localStorage ─────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        // ① localStorage (synchronous)
        const savedBoardName = localStorage.getItem(LS_BOARD_NAME);
        if (savedBoardName) setBoardName(savedBoardName);

        const rawConns = localStorage.getItem(LS_CONNECTIONS);
        if (rawConns) {
          const seen = new Set<string>();
          const deduped = (JSON.parse(rawConns) as Connection[]).filter((c) => {
            const key = `${c.from}→${c.to}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setConnections(deduped);
        }

        const rawNodes = localStorage.getItem(LS_NODES);
        if (rawNodes) {
          let loadedNodes: CanvasNode[] = (
            JSON.parse(rawNodes) as CanvasNode[]
          ).map((n) => {
            // Rich fields are structurally validated and become the source of
            // truth for the plain mirrors; without them, mirrors get the
            // legacy stripHtml treatment.
            const titleRich = sanitizeRichText(n.titleRich);
            const bodyRich = sanitizeRichText(n.bodyRich);
            const node: CanvasNode = {
              ...n,
              title: titleRich ? richToPlain(titleRich) : stripHtml(n.title),
              body: bodyRich ? richToPlain(bodyRich) : stripHtml(n.body),
              ...(n.label != null && { label: stripHtml(n.label) }),
              ...(n.textFileName != null && {
                textFileName: stripHtml(n.textFileName),
              }),
            };
            if (titleRich && richHasMarks(titleRich)) node.titleRich = titleRich;
            else delete node.titleRich;
            if (bodyRich && richHasMarks(bodyRich)) node.bodyRich = bodyRich;
            else delete node.bodyRich;
            // Document content never lives in localStorage — the IndexedDB
            // merge below is its only trusted source.
            delete node.docRich;
            return node;
          });
          const maxId = loadedNodes.reduce((m, n) => Math.max(m, n.id), -1);
          if (maxId >= idCounterRef.current) idCounterRef.current = maxId + 1;

          // ② IndexedDB (async) — merge textFileContent / imageUrl / docRich
          try {
            const allAssets = await getAllAssets();
            if (allAssets.size > 0) {
              loadedNodes = loadedNodes.map((n) => {
                const a = allAssets.get(n.id);
                if (!a) return n;
                // Document runs are validated structurally; when present they
                // are the source of truth and the plain mirror is re-derived.
                const docRich = sanitizeRichText(a.docRich);
                return {
                  ...n,
                  ...(a.textFileContent != null && {
                    textFileContent: a.textFileContent,
                  }),
                  ...(a.imageUrl != null && { imageUrl: a.imageUrl }),
                  ...(docRich &&
                    richHasMarks(docRich) && {
                      docRich,
                      textFileContent: richToPlain(docRich),
                    }),
                };
              });
              // Orphan cleanup: IDB keys with no matching node
              const nodeIdSet = new Set(loadedNodes.map((n) => n.id));
              for (const id of allAssets.keys()) {
                if (!nodeIdSet.has(id)) deleteAsset(id).catch(() => {});
              }
            }
          } catch {
            // IDB unavailable (e.g. private-browsing) — proceed without assets
          }

          // ③ Initialise prevAssetNodeIdsRef before setHydrated triggers the
          //    save effect, so the first save doesn't delete any IDB entries.
          prevAssetNodeIdsRef.current = new Set(
            loadedNodes
              .filter((n) => n.textFileContent != null || n.imageUrl != null)
              .map((n) => n.id),
          );
          setNodes(loadedNodes);

          // ④ presentationOrder — load from localStorage, migrate if needed
          const rawOrder = localStorage.getItem(LS_PRESENTATION_ORDER);
          const loadedIdSet = new Set(loadedNodes.map((n) => n.id));
          if (rawOrder) {
            try {
              const parsed: number[] = JSON.parse(rawOrder);
              const parsedSet = new Set(parsed);
              const missing = loadedNodes
                .filter((n) => !parsedSet.has(n.id))
                .sort((a, b) => a.id - b.id)
                .map((n) => n.id);
              setPresentationOrder([
                ...parsed.filter((id) => loadedIdSet.has(id)),
                ...missing,
              ]);
            } catch {
              setPresentationOrder(
                [...loadedNodes].sort((a, b) => a.id - b.id).map((n) => n.id),
              );
            }
          } else {
            setPresentationOrder(
              [...loadedNodes].sort((a, b) => a.id - b.id).map((n) => n.id),
            );
          }
        }
      } catch {
        // JSON parse error — keep DEFAULT_NODES
      } finally {
        const rawCamera = localStorage.getItem(LS_CAMERA);
        if (rawCamera) {
          try {
            const cam = JSON.parse(rawCamera) as { pan?: { x: number; y: number }; zoom?: number };
            if (cam.pan && typeof cam.pan.x === "number" && typeof cam.pan.y === "number") {
              setPan(cam.pan);
            }
            if (typeof cam.zoom === "number" && isFinite(cam.zoom)) {
              setZoom(cam.zoom);
            }
          } catch {
            // malformed — use defaults
          }
        }
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // ── localStorage: strip large asset fields ──────────────────────────────
      try {
        const nodesToSave = nodes.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ textFileContent: _tc, imageUrl: _iu, docRich: _dr, ...rest }) =>
            rest,
        );
        localStorage.setItem(LS_NODES, JSON.stringify(nodesToSave));
        localStorage.setItem(LS_CONNECTIONS, JSON.stringify(connections));
        localStorage.setItem(LS_BOARD_NAME, boardName);
        localStorage.setItem(
          LS_PRESENTATION_ORDER,
          JSON.stringify(presentationOrder),
        );
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "QuotaExceededError" ||
            err.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ) {
          console.warn(
            "[dnkrm] localStorage quota exceeded — canvas not saved.",
          );
        }
      }

      // ── IndexedDB: write assets / delete stale entries ──────────────────────
      const currentAssetIds = new Set<number>();
      const currentRecords = new Map<number, AssetRecord>();
      for (const n of nodes) {
        const record: AssetRecord = {};
        if (n.textFileContent != null)
          record.textFileContent = n.textFileContent;
        if (n.imageUrl != null) record.imageUrl = n.imageUrl;
        if (n.docRich != null) record.docRich = n.docRich;
        if (Object.keys(record).length > 0) {
          currentAssetIds.add(n.id);
          currentRecords.set(n.id, record);
          // Content is immutable by convention, so identical references mean
          // the stored record is already current — skip the write.
          const prev = prevAssetRecordsRef.current.get(n.id);
          if (
            !prev ||
            prev.textFileContent !== record.textFileContent ||
            prev.imageUrl !== record.imageUrl ||
            prev.docRich !== record.docRich
          ) {
            setAsset(n.id, record).catch(() => {});
          }
        }
      }
      // Delete entries whose node was removed or lost all asset fields
      for (const id of prevAssetNodeIdsRef.current) {
        if (!currentAssetIds.has(id)) deleteAsset(id).catch(() => {});
      }
      prevAssetNodeIdsRef.current = currentAssetIds;
      prevAssetRecordsRef.current = currentRecords;
      setSaveState("saved");
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, connections, boardName, presentationOrder, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
    cameraTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_CAMERA, JSON.stringify({ pan, zoom }));
      } catch {
        // quota exceeded — non-critical
      }
    }, 500);
    return () => {
      if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
    };
  }, [pan, zoom, hydrated]);

  return { hydrated, saveState };
}

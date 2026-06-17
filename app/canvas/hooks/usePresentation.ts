"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { easeInOutCubic } from "../lib/canvas-helpers";
import type { CanvasNode } from "../lib/canvas-types";
import {
  DEBUG_CAMERA,
  perfStart,
  perfFrame,
  perfEnd,
} from "../lib/camera-perf";

interface PresentationArgs {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodeMapRef: React.RefObject<Map<number, CanvasNode>>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomRef: React.RefObject<number>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

// Presentation mode state plus the animated camera that centers each slide.
export function usePresentation({
  canvasRef,
  nodeMapRef,
  panRef,
  zoomRef,
  setPan,
  setZoom,
}: PresentationArgs) {
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [showPresentOverlay, setShowPresentOverlay] = useState(false);
  // True only while the camera is gliding between steps. The expensive
  // full-screen backdrop blur is dropped during the glide (it would re-blur the
  // whole viewport every frame as the world moves under it) and restored once
  // the camera settles.
  const [cameraAnimating, setCameraAnimating] = useState(false);

  // Mirror latest state into refs so event handlers never capture stale closures
  const isPresentingRef = useRef(isPresenting);
  const presentationIndexRef = useRef(presentationIndex);
  isPresentingRef.current = isPresenting;
  presentationIndexRef.current = presentationIndex;

  // Camera to restore when presentation mode exits
  const prePresentStateRef = useRef<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);

  // Presentation camera animation
  const animRafRef = useRef<number | null>(null);
  const animCurrentRef = useRef<{
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);

  // Cancel any in-flight rAF loop when the component unmounts so we don't
  // call setState after unmount (wasted work; React 18 silences the warning
  // but the computation still runs).
  useEffect(() => {
    return () => {
      if (animRafRef.current !== null) cancelAnimationFrame(animRafRef.current);
    };
  }, []);

  // Show entry overlay once each time presentation mode is entered
  useEffect(() => {
    if (!isPresenting) return;
    setShowPresentOverlay(true);
    const t = setTimeout(() => setShowPresentOverlay(false), 2000);
    return () => clearTimeout(t);
  }, [isPresenting]);

  // Animate the camera to fit one or more nodes at once. A single id is the
  // 1-node case (identical framing to before); a group passes all its member
  // ids and the camera fits their union bounding box.
  const centerNodesForPresentation = useCallback((ids: number[]) => {
    if (ids.length === 0 || !canvasRef.current) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    for (const id of ids) {
      const n = nodeMapRef.current.get(id);
      if (!n) continue;
      found = true;
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.w > maxX) maxX = n.x + n.w;
      if (n.y + n.h > maxY) maxY = n.y + n.h;
    }
    if (!found) return;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const r = canvasRef.current.getBoundingClientRect();
    const toZoom = Math.min(
      1.5,
      Math.max(0.1, Math.min((r.width * 0.8) / bw, (r.height * 0.8) / bh)),
    );
    const toPan = {
      x: r.width / 2 - cx * toZoom,
      y: r.height / 2 - cy * toZoom,
    };

    // Cancel in-flight animation; start from the last interpolated position
    // so a mid-animation interrupt never jumps to a stale state.
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    const fromPan = animCurrentRef.current?.pan ?? panRef.current;
    const fromZoom = animCurrentRef.current?.zoom ?? zoomRef.current;
    animCurrentRef.current = { pan: fromPan, zoom: fromZoom };

    const DURATION = 600;
    const startTime = performance.now();
    let lastFrame = startTime;
    if (DEBUG_CAMERA)
      perfStart(
        `${ids.length === 1 ? "node" : `group×${ids.length}`} zoom ${fromZoom.toFixed(2)}→${toZoom.toFixed(2)} bbox ${Math.round(bw)}×${Math.round(bh)}`,
      );
    setCameraAnimating(true);

    function tick() {
      // Use performance.now() (not the rAF timestamp) so both the inter-frame
      // delta and the callback duration are measured against the same clock.
      const frameStart = performance.now();
      const dFrame = frameStart - lastFrame;
      lastFrame = frameStart;
      const raw = Math.min((frameStart - startTime) / DURATION, 1);
      const t = easeInOutCubic(raw);
      const curZoom = fromZoom + (toZoom - fromZoom) * t;
      const curPan = {
        x: fromPan.x + (toPan.x - fromPan.x) * t,
        y: fromPan.y + (toPan.y - fromPan.y) * t,
      };
      animCurrentRef.current = { pan: curPan, zoom: curZoom };
      setZoom(curZoom);
      setPan(curPan);
      if (DEBUG_CAMERA)
        perfFrame(frameStart, dFrame, performance.now() - frameStart);
      if (raw < 1) {
        animRafRef.current = requestAnimationFrame(tick);
      } else {
        animRafRef.current = null;
        animCurrentRef.current = null;
        setCameraAnimating(false);
        if (DEBUG_CAMERA) perfEnd();
      }
    }

    animRafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If presentation exits mid-glide (Esc cancels the rAF directly), make sure
  // the animating flag doesn't stay stuck on, and flush any open perf capture.
  useEffect(() => {
    if (!isPresenting) {
      setCameraAnimating(false);
      if (DEBUG_CAMERA) perfEnd();
    }
  }, [isPresenting]);

  return {
    isPresenting,
    setIsPresenting,
    presentationIndex,
    setPresentationIndex,
    showPresentOverlay,
    cameraAnimating,
    isPresentingRef,
    presentationIndexRef,
    prePresentStateRef,
    animRafRef,
    animCurrentRef,
    centerNodesForPresentation,
  };
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { easeInOutCubic } from "../lib/canvas-helpers";
import type { CanvasNode } from "../lib/canvas-types";

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

  const centerNodeForPresentation = useCallback((id: number) => {
    const n = nodeMapRef.current.get(id);
    if (!n || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const toZoom = Math.min(
      1.5,
      Math.max(0.1, Math.min((r.width * 0.8) / n.w, (r.height * 0.8) / n.h)),
    );
    const toPan = {
      x: r.width / 2 - (n.x + n.w / 2) * toZoom,
      y: r.height / 2 - (n.y + n.h / 2) * toZoom,
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

    function tick(now: number) {
      const raw = Math.min((now - startTime) / DURATION, 1);
      const t = easeInOutCubic(raw);
      const curZoom = fromZoom + (toZoom - fromZoom) * t;
      const curPan = {
        x: fromPan.x + (toPan.x - fromPan.x) * t,
        y: fromPan.y + (toPan.y - fromPan.y) * t,
      };
      animCurrentRef.current = { pan: curPan, zoom: curZoom };
      setZoom(curZoom);
      setPan(curPan);
      if (raw < 1) {
        animRafRef.current = requestAnimationFrame(tick);
      } else {
        animRafRef.current = null;
        animCurrentRef.current = null;
      }
    }

    animRafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isPresenting,
    setIsPresenting,
    presentationIndex,
    setPresentationIndex,
    showPresentOverlay,
    isPresentingRef,
    presentationIndexRef,
    prePresentStateRef,
    animRafRef,
    animCurrentRef,
    centerNodeForPresentation,
  };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { ICON } from "../lib/design-tokens";

// ── AI companion ───────────────────────────────────────────────────────────────
// Not a face — an abstract presence. A soft, warm orb that quietly breathes while
// a light drifts across its surface, rendered in real 3D (Three.js, lazy-loaded
// so it never touches the initial bundle). State only changes its mood:
//   idle      terracotta, calm slow breath, gentle light drift
//   thinking  ochre, quicker breath, the light races around it
//   done      olive, a soft upward pop
//   error     deep clay, a brief wobble
//
// A CSS radial-gradient orb renders instantly as the base layer — it's the
// reduced-motion fallback and what shows if WebGL/three is unavailable; the 3D
// canvas fades in over it once ready. Same {state,size,color} API as before
// (color is now ignored — the orb colours itself by mood).

export type AiCharacterState = "idle" | "thinking" | "done" | "error";

// Mood → orb hue, from the warm DNKRM palette (matches the panel's status dots).
const STATE_HEX: Record<AiCharacterState, string> = {
  idle: "#C56B47", // terracotta
  thinking: "#D4A04A", // ochre
  done: "#7C7A4E", // olive
  error: "#A8553A", // deep clay
};

// Per-mood motion. drift = how fast the highlight orbits; breathe = scale pulse.
const MOOD = {
  idle: { breatheSpeed: 1.05, breatheAmp: 0.03, drift: 0.4 },
  thinking: { breatheSpeed: 2.5, breatheAmp: 0.055, drift: 1.5 },
  done: { breatheSpeed: 1.3, breatheAmp: 0.04, drift: 0.6 },
  error: { breatheSpeed: 1.7, breatheAmp: 0.035, drift: 0.7 },
} as const;

export function AiCharacter({
  state = "idle",
  size = ICON.md,
}: {
  state?: AiCharacterState;
  size?: number;
  /** Kept for API compatibility; the orb colours itself by mood. */
  color?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Latest state read inside the animation loop without re-running the effect.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        return; // keep the CSS fallback orb
      }
      if (disposed || !mount) return;

      const dpr = Math.min(
        typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1,
        2,
      );
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(size, size, false);
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.style.display = "block";
      mount.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.z = 3.8;

      const geometry = new THREE.SphereGeometry(1, 64, 64);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(STATE_HEX[stateRef.current]),
        roughness: 0.46,
        metalness: 0.0,
      });
      const orb = new THREE.Mesh(geometry, material);
      scene.add(orb);

      // Soft ambient base so the dark side never goes flat-black.
      scene.add(new THREE.AmbientLight(0xfff3e6, 0.7));
      // Drifting key light — its highlight sweeping the surface is the "life".
      const key = new THREE.PointLight(0xfff6ec, 22, 0, 2);
      key.position.set(1.6, 1.1, 2.2);
      scene.add(key);
      // Static warm terracotta fill from below-left for dimensional warmth.
      const fill = new THREE.PointLight(0xc56b47, 9, 0, 2);
      fill.position.set(-1.8, -1.4, 1.4);
      scene.add(fill);

      const target = new THREE.Color();
      let prev = stateRef.current;
      let popT0 = -1; // done pop start (seconds)
      let errT0 = -1; // error wobble start (seconds)
      const start =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      const render = (now: number) => {
        const t = (now - start) / 1000;
        const s = stateRef.current;
        if (s !== prev) {
          if (s === "done") popT0 = t;
          if (s === "error") errT0 = t;
          prev = s;
        }
        const m = MOOD[s];

        // Ease the orb colour toward the mood hue.
        target.set(STATE_HEX[s]);
        material.color.lerp(target, 0.07);

        // Breathe + transient pop, applied as uniform scale.
        let scale = 1 + Math.sin(t * m.breatheSpeed) * m.breatheAmp;
        if (popT0 >= 0) {
          const e = t - popT0;
          if (e < 0.6) scale += Math.sin((e / 0.6) * Math.PI) * 0.13;
          else popT0 = -1;
        }
        orb.scale.setScalar(scale);

        // Error wobble — a brief side-to-side nudge.
        let wob = 0;
        if (errT0 >= 0) {
          const e = t - errT0;
          if (e < 0.5) wob = (1 - e / 0.5) * Math.sin(e * 42) * 0.09;
          else errT0 = -1;
        }
        orb.position.x = wob;

        // Drift the key light around the front hemisphere.
        const a = t * m.drift;
        key.position.set(
          Math.cos(a) * 1.7,
          0.9 + Math.sin(a * 0.7) * 0.6,
          2.1 + Math.sin(a) * 0.7,
        );

        renderer.render(scene, camera);
        if (!prefersReduced) raf = requestAnimationFrame(render);
      };

      setReady(true);
      raf = requestAnimationFrame(render);

      cleanup = () => {
        cancelAnimationFrame(raf);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [size]);

  const hex = STATE_HEX[state];
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* Instant CSS orb — base layer / reduced-motion / no-WebGL fallback */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 36% 30%, #FCEFE2 0%, ${hex} 62%, #7a3f2a 100%)`,
          boxShadow: `inset 0 ${size * 0.06}px ${size * 0.12}px rgba(255,247,238,0.5), inset 0 -${size * 0.08}px ${size * 0.14}px rgba(58,30,18,0.35)`,
          opacity: ready ? 0 : 1,
          transition: "opacity 0.4s ease, background 0.4s ease",
        }}
      />
      {/* 3D canvas mounts here once three loads */}
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          opacity: ready ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />
    </div>
  );
}

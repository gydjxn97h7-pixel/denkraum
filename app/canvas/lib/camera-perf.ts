// ── Presentation camera profiling ─────────────────────────────────────────────
// Instrumentation to locate the step-switch stutter. Per-frame samples are
// buffered during a transition (console.log per frame is itself slow enough to
// cause the jank it's meant to measure) and dumped as one table + verdict when
// the camera settles.
//
// For each rAF frame we record:
//   Δframe — interval since the previous frame began (the real frame budget;
//            >~20ms means a dropped frame at 60Hz)
//   js     — time spent inside the rAF callback itself (our animation math +
//            setState calls)
//   react  — React render+commit time attributed to that frame, captured from a
//            <Profiler> around the canvas (dev builds only)
// Δframe ≈ js + react + (browser layout/paint/composite). So if Δframe is large
// while js and react are small, the bottleneck is browser paint — e.g. the
// backdrop blur or re-rasterising the scaled world — not our code or React.

export const DEBUG_CAMERA = false;

interface FrameSample {
  frame: number;
  tMs: number; // ms since transition start, at frame begin
  dFrame: number; // ms since previous frame began
  js: number; // ms inside the rAF callback
  react: number; // ms of React commit attributed to this frame
}

let active = false;
let label = "";
let t0 = 0;
let samples: FrameSample[] = [];
let pendingReact = 0; // React commit time since the last recorded frame

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

export function perfStart(lbl: string) {
  if (!DEBUG_CAMERA) return;
  if (active) perfEnd(); // flush a transition that was interrupted by a new one
  active = true;
  label = lbl;
  t0 = performance.now();
  samples = [];
  pendingReact = 0;
}

// Called from the <Profiler> onRender; accumulates until the next frame record.
export function perfCommit(actualDuration: number) {
  if (active) pendingReact += actualDuration;
}

export function perfFrame(now: number, dFrame: number, js: number) {
  if (!active) return;
  samples.push({
    frame: samples.length,
    tMs: fmt(now - t0),
    dFrame: fmt(dFrame),
    js: fmt(js),
    react: fmt(pendingReact),
  });
  pendingReact = 0;
}

export function perfEnd() {
  if (!active) return;
  active = false;
  if (samples.length === 0) return;

  const total = performance.now() - t0;
  const ds = samples.map((s) => s.dFrame);
  const jss = samples.map((s) => s.js);
  const rcs = samples.map((s) => s.react);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const mean = (a: number[]) => sum(a) / a.length;
  const max = (a: number[]) => Math.max(...a);
  const DROP = 20; // ms — slower than ~50fps
  const dropped = ds.filter((d) => d > DROP).length;

  const avgFrame = mean(ds);
  const avgJs = mean(jss);
  const avgReact = mean(rcs);
  const avgPaint = Math.max(0, avgFrame - avgJs - avgReact);

  /* eslint-disable no-console */
  console.group(
    `%c[camera] ${label} — ${samples.length} frames / ${fmt(total)}ms`,
    "color:#C56B47;font-weight:600",
  );
  console.table(samples);
  console.log(
    `Δframe: avg ${fmt(avgFrame)}ms (≈${Math.round(
      1000 / avgFrame,
    )}fps) · worst ${fmt(max(ds))}ms · dropped(>${DROP}ms) ${dropped}/${samples.length}`,
  );
  console.log(
    `per-frame breakdown: js ${fmt(avgJs)}ms · React commit ${fmt(
      avgReact,
    )}ms · paint/other ${fmt(avgPaint)}ms (worst React ${fmt(max(rcs))}ms)`,
  );
  const verdict =
    avgReact > avgPaint && avgReact > avgJs
      ? "React render/commit dominates → reconciliation cost"
      : avgPaint > avgReact && avgPaint > avgJs
        ? "Browser paint/composite dominates → likely the blur or re-rasterising the scaled world"
        : avgJs > 4
          ? "rAF callback JS dominates → animation math/setState"
          : "no single dominant cost — frames are within budget";
  console.log(`%cverdict: ${verdict}`, "color:#7C7A4E;font-weight:600");
  console.groupEnd();
  /* eslint-enable no-console */
}

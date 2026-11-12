// Rolling (autoregressive) forecasting, a JS port of the Python inference code of each method.
// `run(method, feeds)` executes the ONNX model and returns a Float32Array.
import { savgolDerivative } from "./signal.js";

const SEQ = 50, PRED = 20;

// KITE and TransKITE: global max-normalised [position, SG velocity] windows; the model predicts the next 20 steps of both.
async function rollGlobal(method, history, horizon, meta, run) {
  const { pos_max, vel_max } = meta[method];
  const vel = savgolDerivative(history, meta.dt);
  let win = history.map((p, i) => [...p.map(v => v / pos_max), ...vel[i].map(v => v / vel_max)]);
  const out = [];
  for (let b = 0; b < Math.ceil(horizon / PRED); b++) {
    const y = await run(method, { x: Float32Array.from(win.flat()) });
    const block = Array.from({ length: PRED }, (_, i) => Array.from(y.slice(i * 6, i * 6 + 6)));
    block.forEach(r => out.push(r.slice(0, 3).map(v => v * pos_max)));
    win = [...win.slice(PRED), ...block];
  }
  return out.slice(0, horizon);
}

// KC-S2O: window re-centred on its last point and scaled by its largest distance; initial velocity from the last two steps.
async function rollLocal(history, horizon, meta, run) {
  let hist = history.map(p => [...p]);
  const out = [];
  for (let b = 0; b < Math.ceil(horizon / PRED); b++) {
    const anchor = hist[hist.length - 1];
    const rel = hist.map(p => p.map((v, k) => v - anchor[k]));
    const scale = Math.max(Math.max(...rel.map(p => Math.hypot(...p))), 1e-3);
    const norm = rel.map(p => p.map(v => v / scale));
    const vInit = norm[SEQ - 1].map((v, k) => (v - norm[SEQ - 2][k]) / meta.dt);
    const y = await run("kcs2o", { x: Float32Array.from(norm.flat()), v_init: Float32Array.from(vInit) });
    const block = Array.from({ length: PRED }, (_, i) => [0, 1, 2].map(k => y[i * 3 + k] * scale + anchor[k]));
    out.push(...block);
    hist = [...hist, ...block].slice(-SEQ);
  }
  return out.slice(0, horizon);
}

export async function forecast(method, history, horizon, meta, run) {
  if (history.length !== SEQ) throw new Error(`The models observe exactly ${SEQ} steps.`);
  return method === "kcs2o" ? rollLocal(history, horizon, meta, run) : rollGlobal(method, history, horizon, meta, run);
}

export const OBSERVED_STEPS = SEQ;

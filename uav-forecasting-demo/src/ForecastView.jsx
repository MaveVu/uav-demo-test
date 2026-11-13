import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { statistics } from "./data";

const PLOT_H = 280;
const COLORS = { history: "#8a94a3", truth: "#2f6db5", prediction: "#c2562a" };
const AXIS = { gridcolor: "#e1e6ed", zerolinecolor: "#cbd3de", color: "#64748b" };
const BASE_LAYOUT = {
  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#334155", family: "Inter, ui-sans-serif, system-ui" },
  legend: { bgcolor: "rgba(255,255,255,.8)", font: { size: 10 } }
};
const CONFIG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"] };
const col = (a, k) => a.map(p => p[k]);
const line3d = (a, extra) => ({ type: "scatter3d", x: col(a, 0), y: col(a, 1), z: col(a, 2), ...extra });
const plot = f => f && <Plot data={f.data} layout={f.layout} config={CONFIG} style={{ width: "100%", height: f.layout.height }} useResizeHandler />;

// Playback + the four panels (3D trajectory, prediction error, per-axis, statistics).
// `truth` may be null (user trajectory without ground truth): then only the forecast itself is shown.
function ForecastView({ history, truth, pred, methodName, threshold, fps, dt }) {
  const [rawStep, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);

  const n = pred.length;
  const step = Math.min(rawStep, n - 1); // a new, shorter forecast renders once before the reset effect runs
  const stats = useMemo(() => (truth ? statistics(truth, pred, threshold) : null), [truth, pred, threshold]);

  useEffect(() => { setStep(0); setStarted(false); setPlaying(false); }, [history, truth, pred]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStep(s => {
      if (s >= n - 1) { setPlaying(false); return n - 1; }
      return s + 1;
    }), 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps, n]);

  const finished = started && !playing && step >= n - 1;
  const play = () => {
    if (!started || step >= n - 1) { setStep(0); setStarted(true); setPlaying(true); } else setPlaying(p => !p);
  };

  const vt = stats ? stats.validTime : n, hit = vt < n;
  const steps = pred.map((_, i) => i);
  const ref = truth ?? pred; // reference curve shown before playback
  const cube = { aspectmode: "cube", xaxis: { ...AXIS, showticklabels: false, title: "X" }, yaxis: { ...AXIS, showticklabels: false, title: "Y" }, zaxis: { ...AXIS, showticklabels: false, title: "Z" }, bgcolor: "rgba(0,0,0,0)" };

  const t3 = [line3d(history, { mode: "lines", name: "History", line: { color: COLORS.history, width: 4, dash: "dot" } })];
  if (truth) t3.push(line3d(truth, { mode: "lines", name: "Ground truth", opacity: started ? 0.3 : 1, showlegend: !started, line: { color: COLORS.truth, width: 4 } }));
  if (started) {
    t3.push(line3d(pred, { mode: "lines", name: "Prediction", opacity: 0.3, showlegend: false, line: { color: COLORS.prediction, width: 4, dash: "dot" } }));
    if (truth) t3.push(line3d([truth[step]], { mode: "markers", name: "Ground truth", marker: { size: 6, color: COLORS.truth } }));
    t3.push(line3d([pred[step]], { mode: "markers", name: `${methodName} prediction`, marker: { size: 6, color: COLORS.prediction } }));
    if (hit && vt <= step) t3.push(line3d([truth[vt]], { mode: "markers", name: "Threshold hit", marker: { size: 5, symbol: "diamond", color: "#111827" } }));
  }
  const fig3d = { data: t3, layout: { ...BASE_LAYOUT, height: PLOT_H, margin: { l: 0, r: 0, t: 0, b: 0 }, scene: cube, legend: { ...BASE_LAYOUT.legend, x: 0, y: 1 }, uirevision: "3d" } };

  let figErr = null;
  if (stats) {
    const e = stats.errors;
    figErr = {
      data: [
        ...(started ? [{ type: "scatter", mode: "lines", x: steps.slice(0, step + 1), y: e.slice(0, step + 1), line: { color: "#a67c1f", width: 3 }, name: "Error", showlegend: false }] : []),
        ...(started && hit && vt <= step ? [{ type: "scatter", mode: "markers", x: [vt], y: [e[vt]], marker: { size: 12, symbol: "diamond", color: COLORS.prediction }, name: "Valid time" }] : [])
      ],
      layout: {
        ...BASE_LAYOUT, height: PLOT_H, margin: { l: 50, r: 10, t: 20, b: 40 },
        xaxis: { ...AXIS, title: "Step", range: [0, n] }, yaxis: { ...AXIS, title: "Error (m)", range: [0, started ? Math.max(threshold * 1.2, Math.max(...e) * 1.05) : threshold * 1.2] },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: threshold, y1: threshold, line: { color: COLORS.prediction, dash: "dash", width: 1.5 } }],
        annotations: [{ xref: "paper", x: 0.01, y: threshold, yanchor: "bottom", showarrow: false, text: "Threshold", font: { size: 10, color: COLORS.prediction } }]
      }
    };
  }

  const range = k => { const v = started ? [...col(ref, k), ...col(pred, k)] : col(ref, k); const m = (Math.max(...v) - Math.min(...v)) * 0.05; return [Math.min(...v) - m, Math.max(...v) + m]; };
  const doms = [[0.72, 1], [0.38, 0.66], [0, 0.28]];
  const traces = [], layout = { ...BASE_LAYOUT, height: PLOT_H, margin: { l: 50, r: 10, t: 10, b: 40 }, legend: { ...BASE_LAYOUT.legend, orientation: "h", x: 0, y: 1.08 }, shapes: [] };
  ["tx", "ty", "tz"].forEach((name, k) => {
    const s = k + 1, xa = `x${s === 1 ? "" : s}`, ya = `y${s === 1 ? "" : s}`;
    if (truth) traces.push({ type: "scatter", mode: "lines", x: steps, y: col(truth, k), xaxis: xa, yaxis: ya, name: "Ground truth", legendgroup: "t", showlegend: k === 0, line: { color: COLORS.truth, width: 3 } });
    if (started) traces.push({ type: "scatter", mode: "lines", x: steps.slice(0, step + 1), y: col(pred, k).slice(0, step + 1), xaxis: xa, yaxis: ya, name: "Prediction", legendgroup: "p", showlegend: k === 0, line: { color: COLORS.prediction, width: 3, dash: "dash" } });
    layout[`xaxis${s === 1 ? "" : s}`] = { ...AXIS, domain: [0, 1], anchor: ya, range: [0, n], showticklabels: k === 2, title: k === 2 ? "Step" : undefined };
    layout[`yaxis${s === 1 ? "" : s}`] = { ...AXIS, domain: doms[k], anchor: xa, title: name, range: range(k) };
    if (started && hit && vt <= step) layout.shapes.push({ type: "line", xref: xa, yref: "paper", x0: vt, x1: vt, y0: doms[k][0], y1: doms[k][1], line: { color: "#111827", dash: "dash", width: 2 } });
  });
  const figAxis = { data: traces, layout };

  return <>
    <div className="plot-grid">
      <div><div className="plot-title">3D Trajectory</div>{plot(fig3d)}</div>
      <div><div className="plot-title">Prediction Error</div>{figErr ? plot(figErr) : <div className="stats-box"><p className="stats-note">No ground truth for this trajectory, so there is no error to plot. Add more than 50 samples to compare against.</p></div>}</div>
      <div><div className="plot-title">Per-Axis Trajectory</div>{plot(figAxis)}</div>
      <div>
        <div className="plot-title">Statistics</div>
        <div className="stats-box">
          {!stats ? <p className="stats-note">Statistics need a ground-truth future to compare with.</p>
            : !finished ? <p className="stats-note">Press play to run the forecast. Statistics appear when playback finishes.</p> : <>
              <p><b>ADE</b><span>{stats.ADE.toFixed(4)} m</span></p>
              <p><b>RMSE</b><span>{stats.RMSE.toFixed(4)} m</span></p>
              <p><b>FDE</b><span>{stats.FDE.toFixed(4)} m</span></p>
              <p><b>Valid time</b><span>{stats.validTime} steps ({(stats.validTime * dt).toFixed(1)} s)</span></p>
              <p className="stats-note">Forecast horizon: {n} steps from {history.length}-step history. Valid time = first step with error ≥ threshold.</p></>}
        </div>
      </div>
    </div>
    <div className="timeline">
      <div className="timeline-controls">
        <button className="play-button" onClick={play} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
        <span>{playing ? "PLAYING" : "PLAYBACK"}</span>
        <button className="reset-button" onClick={() => { setStep(0); setStarted(false); setPlaying(false); }}>RESET</button>
        <span className="frame-counter" style={{ marginLeft: "auto" }}>STEP <b>{step + 1}</b><span> / {n}</span></span>
      </div>
      <input aria-label="Trajectory time" className="time-slider" type="range" min="0" max={n - 1} value={step} onChange={e => { setStep(Number(e.target.value)); setStarted(true); setPlaying(false); }} />
      <div className="time-labels"><span>0.0 s</span><span>{(n * dt / 2).toFixed(1)} s</span><span>{(n * dt).toFixed(1)} s</span></div>
    </div>
  </>;
}

export default ForecastView;

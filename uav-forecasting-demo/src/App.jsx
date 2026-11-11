import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { methods, loadIndex, loadTrajectory, statistics } from "./data";

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

function App() {
  const [index, setIndex] = useState(null);
  const [trajId, setTrajId] = useState(null);
  const [data, setData] = useState(null);
  const [method, setMethod] = useState("transkite");
  const [threshold, setThreshold] = useState(2.0);
  const [fps, setFps] = useState(20);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    loadIndex().then(idx => { setIndex(idx); setTrajId(idx.trajectories[20]?.id ?? idx.trajectories[0].id); });
  }, []);
  useEffect(() => {
    if (!trajId) return;
    setData(null);
    loadTrajectory(trajId).then(d => { setData(d); setStep(0); setStarted(false); setPlaying(false); });
  }, [trajId]);

  const selectedMethod = methods.find(m => m.id === method);
  const truth = data?.truth;
  const pred = data?.methods[method].pred;
  const stats = useMemo(() => (data ? statistics(truth, pred, threshold) : null), [data, method, threshold]);
  const n = truth?.length ?? 0;

  useEffect(() => { if (data) { setStep(0); setStarted(false); setPlaying(false); } }, [method]);
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
  const idx = trajId ? index.trajectories.findIndex(t => t.id === trajId) : 0;

  // ----- figures -----
  let fig3d = null, figErr = null, figAxis = null;
  if (data) {
    const vt = stats.validTime, hit = vt < n;
    const cube = { aspectmode: "cube", xaxis: { ...AXIS, showticklabels: false, title: "X" }, yaxis: { ...AXIS, showticklabels: false, title: "Y" }, zaxis: { ...AXIS, showticklabels: false, title: "Z" }, bgcolor: "rgba(0,0,0,0)" };
    const t3 = [
      line3d(data.history, { mode: "lines", name: "History", line: { color: COLORS.history, width: 4, dash: "dot" } }),
      line3d(truth, { mode: "lines", name: "Ground truth", opacity: started ? 0.3 : 1, showlegend: !started, line: { color: COLORS.truth, width: 4 } })
    ];
    if (started) t3.push(
      line3d(pred, { mode: "lines", name: "Prediction", opacity: 0.3, showlegend: false, line: { color: COLORS.prediction, width: 4, dash: "dot" } }),
      line3d([truth[step]], { mode: "markers", name: "Ground truth", marker: { size: 6, color: COLORS.truth } }),
      line3d([pred[step]], { mode: "markers", name: `${selectedMethod.name} prediction`, marker: { size: 6, color: COLORS.prediction } })
    );
    if (started && hit && vt <= step) t3.push(line3d([truth[vt]], { mode: "markers", name: "Threshold hit", marker: { size: 5, symbol: "diamond", color: "#111827" } }));
    fig3d = { data: t3, layout: { ...BASE_LAYOUT, height: PLOT_H, margin: { l: 0, r: 0, t: 0, b: 0 }, scene: cube, legend: { ...BASE_LAYOUT.legend, x: 0, y: 1 }, uirevision: trajId } };

    const e = stats.errors;
    const steps = e.map((_, i) => i);
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

    const range = k => { const v = started ? [...col(truth, k), ...col(pred, k)] : col(truth, k); const m = (Math.max(...v) - Math.min(...v)) * 0.05; return [Math.min(...v) - m, Math.max(...v) + m]; };
    const doms = [[0.72, 1], [0.38, 0.66], [0, 0.28]];
    const traces = [], layout = { ...BASE_LAYOUT, height: PLOT_H, margin: { l: 50, r: 10, t: 10, b: 40 }, legend: { ...BASE_LAYOUT.legend, orientation: "h", x: 0, y: 1.08 }, shapes: [] };
    ["tx", "ty", "tz"].forEach((name, k) => {
      const s = k + 1, xa = `x${s === 1 ? "" : s}`, ya = `y${s === 1 ? "" : s}`;
      traces.push({ type: "scatter", mode: "lines", x: steps, y: col(truth, k), xaxis: xa, yaxis: ya, name: "Ground truth", legendgroup: "t", showlegend: k === 0, line: { color: COLORS.truth, width: 3 } });
      if (started) traces.push({ type: "scatter", mode: "lines", x: steps.slice(0, step + 1), y: col(pred, k).slice(0, step + 1), xaxis: xa, yaxis: ya, name: "Prediction", legendgroup: "p", showlegend: k === 0, line: { color: COLORS.prediction, width: 3, dash: "dash" } });
      layout[`xaxis${s === 1 ? "" : s}`] = { ...AXIS, domain: [0, 1], anchor: ya, range: [0, n], showticklabels: k === 2, title: k === 2 ? "Step" : undefined };
      layout[`yaxis${s === 1 ? "" : s}`] = { ...AXIS, domain: doms[k], anchor: xa, title: name, range: range(k) };
      if (started && hit && vt <= step) layout.shapes.push({ type: "line", xref: xa, yref: "paper", x0: vt, x1: vt, y0: doms[k][0], y1: doms[k][1], line: { color: "#111827", dash: "dash", width: 2 } });
    });
    figAxis = { data: traces, layout };
  }
  const plot = f => f && <Plot data={f.data} layout={f.layout} config={CONFIG} style={{ width: "100%", height: f.layout.height }} useResizeHandler />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">✳</span><span>UAV <span className="brand-muted">FORECASTING</span></span></a>
        <nav><a className="active" href="#demo">Interactive demo</a><a href="#methods">Methods</a></nav>
      </header>

      <main>
        <section className="hero">
          <h1>Forecast the trajectory<br /><em>of a UAV.</em></h1>
          <p className="hero-copy">Explore three trajectory forecasting methods on held-out UAV flights. Pick a trajectory, switch the model, and watch the prediction unfold against the ground truth.</p>
        </section>

        <section id="demo" className="demo-section">
          <div className="section-heading">
            <div><h2>Interactive Demo</h2></div>
            <div className="scenario-count"><b>{String(index?.trajectories.length ?? 0)}</b><span>TEST<br />TRAJECTORIES</span></div>
          </div>

          <div className="workspace">
            <aside className="control-panel">
              <div className="panel-label">CONFIGURATION</div>
              <label className="field-label" htmlFor="traj">Select a trajectory</label>
              <select id="traj" value={trajId ?? ""} onChange={e => setTrajId(e.target.value)}>
                {index?.trajectories.map((t, i) => <option key={t.id} value={t.id}>{i}</option>)}
              </select>
              <div className="step-row">
                <button onClick={() => setTrajId(index.trajectories[Math.max(0, idx - 1)].id)}>← Prev</button>
                <button onClick={() => setTrajId(index.trajectories[Math.min(index.trajectories.length - 1, idx + 1)].id)}>Next →</button>
              </div>
              <div className="field-divider" />
              <label className="field-label" htmlFor="method">Forecasting method</label>
              <select id="method" value={method} onChange={e => setMethod(e.target.value)}>
                {methods.filter(m => !m.comingSoon).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="method-note">
                <span className={`status ${selectedMethod.status === "PUBLISHED" ? "published" : ""}`}>{selectedMethod.status}</span>
                <p>{selectedMethod.description}</p>
              </div>
              <div className="field-divider" />
              <label className="field-label" htmlFor="thr">Safety threshold (m)</label>
              <input id="thr" className="num-input" type="number" min="0.1" max="10" step="0.1" value={threshold} onChange={e => setThreshold(Math.max(0.1, Number(e.target.value) || 0.1))} />
              <label className="field-label" htmlFor="fps" style={{ marginTop: 14 }}>Playback FPS</label>
              <input id="fps" className="num-input" type="number" min="5" max="60" step="1" value={fps} onChange={e => setFps(Math.min(60, Math.max(5, Number(e.target.value) || 5)))} />
              <div className="panel-foot"><span className="mini-icon">↗</span><span>Drag to rotate · Scroll to zoom<br />Double-click to reset camera</span></div>
            </aside>

            <div className="visual-panel">
              {!data ? <p className="loading">Loading…</p> : <>
                <div className="plot-grid">
                  <div><div className="plot-title">3D Trajectory</div>{plot(fig3d)}</div>
                  <div><div className="plot-title">Prediction Error</div>{plot(figErr)}</div>
                  <div><div className="plot-title">Per-Axis Trajectory</div>{plot(figAxis)}</div>
                  <div>
                    <div className="plot-title">Statistics</div>
                    <div className="stats-box">
                      {!finished ? <p className="stats-note">Press play to run the forecast. Statistics appear when playback finishes.</p> : <>
                      <p><b>ADE</b><span>{stats.ADE.toFixed(4)} m</span></p>
                      <p><b>RMSE</b><span>{stats.RMSE.toFixed(4)} m</span></p>
                      <p><b>FDE</b><span>{stats.FDE.toFixed(4)} m</span></p>
                      <p><b>Valid time</b><span>{stats.validTime} steps ({(stats.validTime * index.dt).toFixed(1)} s)</span></p>
                      <p className="stats-note">Forecast horizon: {n} steps from {data.history.length}-step history. Valid time = first step with error ≥ threshold.</p></>}
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
                  <div className="time-labels"><span>0.0 s</span><span>{(n * index.dt / 2).toFixed(1)} s</span><span>{(n * index.dt).toFixed(1)} s</span></div>
                </div>
              </>}
            </div>
          </div>

          {index && <div className="metrics-row">
            <div className="metrics-intro"><span className="eyebrow">MODEL PERFORMANCE</span><h3>Average over {index.trajectories.length} test trajectories</h3><p>Rolling forecast, valid-time threshold {index.threshold} m.</p></div>
            {methods.filter(m => !m.comingSoon).map(m => { const a = m.reported ?? index.averages[m.id]; return <div className="metric-card" key={m.id}><span>{m.name}</span><strong>{a.ADE.toFixed(3)}<small> m ADE</small></strong><i>FDE {a.FDE.toFixed(2)} m · VT {a.validTime.toFixed(1)} steps</i></div>; })}
          </div>}
        </section>

        <section id="methods" className="methods-section">
          <h2>Methods</h2>
          <div className="method-grid">
            {methods.map((m, i) => (
              <article className="method-card" key={m.id}>
                <div className="method-number">0{i + 1}</div>
                <span className={`status ${m.status === "PUBLISHED" ? "published" : ""}`}>{m.comingSoon ? "COMING SOON" : m.status}</span>
                <h3>{m.name}</h3>{m.venue && <div className="venue">{m.venue}</div>}<p>{m.description}</p>
                <div className="method-links">
                  <a className="link-btn" href={m.github} target="_blank" rel="noreferrer">Github <span>↗</span></a>
                  {m.paper
                    ? <a className="link-btn" href={m.paper} target="_blank" rel="noreferrer">Paper <span>↗</span></a>
                    : <button className="link-btn disabled" disabled title="Paper link coming soon">Paper <span>soon</span></button>}
                </div>
              </article>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;

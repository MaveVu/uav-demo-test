import React, { useState } from "react";
import ForecastView from "./ForecastView";
import { methods } from "./data";
import { compileExpression } from "./lib/expr";
import { forecast, OBSERVED_STEPS } from "./lib/forecast";
import { loadMeta, run } from "./lib/onnx";

const PRESETS = {
  helix: { name: "Climbing helix", x: "15*cos(0.5*t)", y: "15*sin(0.5*t)", z: "2 + 0.8*t" },
  eight: { name: "Figure eight", x: "20*sin(0.3*t)", y: "10*sin(0.6*t)", z: "10 + 2*sin(0.15*t)" },
  lissajous: { name: "Lissajous curve", x: "18*sin(0.4*t)", y: "18*sin(0.6*t + 1)", z: "10 + 4*sin(0.2*t)" }
};
const DT = 0.1;

// Accepts files with a header (tx,ty,tz or x,y,z; extra columns such as a timestamp are ignored) or plain numeric rows.
function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(l => l.split(/[,;\t]/).map(c => c.trim()));
  const head = rows[0].map(c => c.toLowerCase());
  const named = ["tx", "ty", "tz"].map(c => head.indexOf(c));
  const alt = ["x", "y", "z"].map(c => head.indexOf(c));
  let cols = named.every(i => i >= 0) ? named : alt.every(i => i >= 0) ? alt : null;
  const hasHeader = rows[0].some(c => c !== "" && Number.isNaN(Number(c)));
  if (!cols) cols = rows[0].length >= 4 ? [1, 2, 3] : [0, 1, 2]; // 4+ columns: assume a leading timestamp
  const pts = rows.slice(hasHeader ? 1 : 0).map(r => cols.map(i => Number(r[i])));
  if (pts.some(p => p.some(v => !Number.isFinite(v)))) throw new Error("The file contains non-numeric values in the x, y, z columns.");
  return pts;
}

function TryYourOwn() {
  const [mode, setMode] = useState("equation");
  const [eq, setEq] = useState({ x: PRESETS.helix.x, y: PRESETS.helix.y, z: PRESETS.helix.z });
  const [duration, setDuration] = useState("20");
  const [csv, setCsv] = useState(null); // { name, pts }
  const [horizon, setHorizon] = useState("100");
  const [method, setMethod] = useState("transkite");
  const [threshold, setThreshold] = useState(2.0);
  const [fps, setFps] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const selectedMethod = methods.find(m => m.id === method);

  const onFile = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { setCsv({ name: f.name, pts: parseCsv(await f.text()) }); setError(null); }
    catch (err) { setCsv(null); setError(err.message); }
  };

  const runForecast = async () => {
    setError(null); setBusy(true);
    try {
      let pts;
      if (mode === "equation") {
        const fns = ["x", "y", "z"].map(k => compileExpression(eq[k]));
        const n = Math.round(Number(duration) / DT);
        if (!Number.isFinite(n)) throw new Error("Enter a duration in seconds.");
        if (n <= OBSERVED_STEPS) throw new Error(`Duration must exceed ${(OBSERVED_STEPS * DT).toFixed(0)} s: the first ${OBSERVED_STEPS} steps are observed, the rest is ground truth.`);
        pts = Array.from({ length: n }, (_, i) => fns.map(f => f(i * DT)));
        if (pts.some(p => p.some(v => !Number.isFinite(v)))) throw new Error("An equation gave a non-finite value (check divisions, logs and square roots).");
      } else {
        if (!csv) throw new Error("Choose a CSV file first.");
        pts = csv.pts;
        if (pts.length < OBSERVED_STEPS) throw new Error(`The file needs at least ${OBSERVED_STEPS} rows (${(OBSERVED_STEPS * DT).toFixed(0)} s at 10 Hz); it has ${pts.length}.`);
      }
      const history = pts.slice(0, OBSERVED_STEPS), future = pts.slice(OBSERVED_STEPS);
      const steps = future.length > 0 ? future.length : Math.max(1, Math.round(Number(horizon)) || 100);
      const meta = await loadMeta();
      const pred = await forecast(method, history, steps, meta, run);
      const reach = Math.max(...pts.flat().map(Math.abs)), limit = meta.kite?.pos_max ?? meta.transkite?.pos_max ?? 61;
      setResult({
        history, pred, truth: future.length ? future : null, methodName: selectedMethod.name,
        warning: reach > limit ? `Coordinates reach ${reach.toFixed(0)} m; the models were trained on flights within about ±${limit.toFixed(0)} m (KC-S2O is scale-relative, so this is only a rough guide), so forecasts may be unreliable.` : null
      });
    } catch (err) { setResult(null); setError(err.message); }
    setBusy(false);
  };

  const usePreset = id => setEq({ x: PRESETS[id].x, y: PRESETS[id].y, z: PRESETS[id].z });
  const noTruth = mode === "csv" ? csv && csv.pts.length === OBSERVED_STEPS : false;

  return (
    <section id="try" className="demo-section">
      <div className="section-heading"><div><h2>Try Your Own</h2></div></div>
      <div className="workspace">
        <aside className="control-panel">
          <div className="panel-label">YOUR TRAJECTORY</div>
          <div className="step-row" style={{ marginTop: 0 }}>
            <button className={mode === "equation" ? "on" : ""} onClick={() => setMode("equation")}>Equation</button>
            <button className={mode === "csv" ? "on" : ""} onClick={() => setMode("csv")}>Upload CSV</button>
          </div>

          {mode === "equation" ? <>
            <label className="field-label" htmlFor="preset" style={{ marginTop: 14 }}>Example</label>
            <select id="preset" defaultValue="" onChange={e => e.target.value && usePreset(e.target.value)}>
              <option value="">Choose a preset…</option>
              {Object.entries(PRESETS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
            </select>
            {["x", "y", "z"].map(k => <React.Fragment key={k}>
              <label className="field-label" htmlFor={`eq-${k}`} style={{ marginTop: 10 }}>{k}(t)  ·  metres</label>
              <input id={`eq-${k}`} className="num-input mono" value={eq[k]} onChange={e => setEq({ ...eq, [k]: e.target.value })} spellCheck="false" />
            </React.Fragment>)}
            <label className="field-label" htmlFor="dur" style={{ marginTop: 10 }}>Duration (s)</label>
            <input id="dur" className="num-input" type="number" min="5.2" max="120" step="1" value={duration} onChange={e => setDuration(e.target.value)} />
            <p className="help">t is in seconds, sampled at 10 Hz. Functions: sin, cos, tan, exp, log, sqrt, abs, min, max, pow; constants pi, e; operators + − * / ^. The first 5 s are observed; the rest is the ground truth to forecast.</p>
          </> : <>
            <label className="field-label" htmlFor="file" style={{ marginTop: 14 }}>CSV file</label>
            <input id="file" className="num-input" type="file" accept=".csv,.txt" onChange={onFile} />
            {csv && <p className="help">{csv.name}: {csv.pts.length} rows</p>}
            <p className="help">Columns tx, ty, tz (or x, y, z) in metres, 10 Hz. Other columns such as a timestamp are ignored. The first 50 rows are observed; any further rows are used as ground truth.</p>
            {noTruth && <>
              <label className="field-label" htmlFor="hor">Forecast horizon (steps)</label>
              <input id="hor" className="num-input" type="number" min="1" max="600" value={horizon} onChange={e => setHorizon(e.target.value)} />
            </>}
          </>}

          <div className="field-divider" />
          <label className="field-label" htmlFor="try-method">Forecasting method</label>
          <select id="try-method" value={method} onChange={e => setMethod(e.target.value)}>
            {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="field-label" htmlFor="try-thr" style={{ marginTop: 14 }}>Safety threshold (m)</label>
          <input id="try-thr" className="num-input" type="number" min="0.1" max="10" step="0.1" value={threshold} onChange={e => setThreshold(Math.max(0.1, Number(e.target.value) || 0.1))} />
          <label className="field-label" htmlFor="try-fps" style={{ marginTop: 14 }}>Playback FPS</label>
          <input id="try-fps" className="num-input" type="number" min="5" max="60" step="1" value={fps} onChange={e => setFps(Math.min(60, Math.max(5, Number(e.target.value) || 5)))} />
          <button className="run-btn" onClick={runForecast} disabled={busy}>{busy ? "Running model…" : "Finish setup"}</button>
          {error && <p className="msg err">{error}</p>}
        </aside>

        <div className="visual-panel">
          {result ? <>
            {result.warning && <p className="msg warn">{result.warning}</p>}
            <ForecastView history={result.history} truth={result.truth} pred={result.pred} methodName={result.methodName} threshold={threshold} fps={fps} dt={DT} />
          </> : <p className="loading">{busy ? "Loading the model in your browser (the first run downloads about 15 MB)…" : "Define a trajectory and press “Finish setup”, then play. The model runs entirely in your browser; nothing is uploaded."}</p>}
        </div>
      </div>
    </section>
  );
}

export default TryYourOwn;

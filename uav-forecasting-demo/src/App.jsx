import React, { useEffect, useState } from "react";
import ForecastView from "./ForecastView";
import TryYourOwn from "./TryYourOwn";
import { methods, loadIndex, loadTrajectory } from "./data";

function App() {
  const [index, setIndex] = useState(null);
  const [trajId, setTrajId] = useState(null);
  const [data, setData] = useState(null);
  const [method, setMethod] = useState("transkite");
  const [threshold, setThreshold] = useState(2.0);
  const [fps, setFps] = useState(20);
  useEffect(() => {
    loadIndex().then(idx => { setIndex(idx); setTrajId(idx.trajectories[20]?.id ?? idx.trajectories[0].id); });
  }, []);
  useEffect(() => {
    if (!trajId) return;
    setData(null);
    loadTrajectory(trajId).then(setData);
  }, [trajId]);

  const selectedMethod = methods.find(m => m.id === method);
  const idx = trajId ? index.trajectories.findIndex(t => t.id === trajId) : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">✳</span><span>UAV <span className="brand-muted">FORECASTING</span></span></a>
        <nav><a className="active" href="#demo">Interactive demo</a><a href="#try">Try your own</a><a href="#methods">Methods</a></nav>
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
              {!data ? <p className="loading">Loading…</p>
                : <ForecastView history={data.history} truth={data.truth} pred={data.methods[method].pred} methodName={selectedMethod.name} threshold={threshold} fps={fps} dt={index.dt} />}
            </div>
          </div>

          {index && <div className="metrics-row">
            <div className="metrics-intro"><span className="eyebrow">MODEL PERFORMANCE</span><h3>Average over {index.trajectories.length} test trajectories</h3><p>Rolling forecast, valid-time threshold {index.threshold} m.</p></div>
            {methods.filter(m => !m.comingSoon).map(m => { const a = m.reported ?? index.averages[m.id]; return <div className="metric-card" key={m.id}><span>{m.name}</span><strong>{a.ADE.toFixed(3)}<small> m ADE</small></strong><i>FDE {a.FDE.toFixed(2)} m · VT {a.validTime.toFixed(1)} steps</i></div>; })}
          </div>}
        </section>

        <TryYourOwn />

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

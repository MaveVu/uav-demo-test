// Method metadata. Predictions are precomputed by ../export_predictions.py into public/data/.
const BASE = import.meta.env.BASE_URL;
const GITHUB_URL = "https://github.com/funzi-son/NeuroSciDyn";

const methods = [
  { id: "kite", name: "KITE", status: "FOUNDATIONAL", description: "A lightweight kinematics-informed GRU that augments positions with Savitzky–Golay-filtered velocities and is trained with physics-guided kinematic consistency constraints.", github: GITHUB_URL, paper: `${BASE}papers/KITE.pdf` },
  { id: "transkite", name: "TransKITE", status: "PUBLISHED", description: "A hybrid Transformer-encoder and zero-input GRU-decoder forecaster, trained with physics-informed kinematic constraints to reduce error accumulation over long horizons.", github: GITHUB_URL, paper: `${BASE}papers/TransKITE.pdf`, venue: "Machine Learning (Q1) · ACML 2026 Journal Track" },
  { id: "kcs2o", name: "KC-S2O", status: "PUBLISHED", description: "Kinematics-conditioned sequence-to-ODE forecaster that integrates a learned latent dynamics model from the observed history.", github: GITHUB_URL, paper: "https://link.springer.com/chapter/10.1007/978-3-032-37676-3_21", venue: "ECML-PKDD 2026 (CORE A)",
    // Reported averages, shown instead of the ones computed from the exported predictions.
    reported: { ADE: 1.5206, FDE: 2.2915, validTime: 84.51 } }
];
// Paper PDFs live in public/papers/. paper: null shows a disabled "soon" button.

const loadIndex = () => fetch(`${BASE}data/index.json`).then(r => r.json());
const loadTrajectory = id => fetch(`${BASE}data/traj/${id}.json`).then(r => r.json());

function errors(truth, pred) {
  return truth.map((t, i) => Math.hypot(t[0] - pred[i][0], t[1] - pred[i][1], t[2] - pred[i][2]));
}

function statistics(truth, pred, threshold) {
  const e = errors(truth, pred);
  const hit = e.findIndex(v => v >= threshold);
  return {
    errors: e,
    ADE: e.reduce((a, b) => a + b, 0) / e.length,
    RMSE: Math.sqrt(e.reduce((a, b) => a + b * b, 0) / e.length),
    FDE: e[e.length - 1],
    validTime: hit === -1 ? e.length : hit
  };
}

export { methods, loadIndex, loadTrajectory, statistics };

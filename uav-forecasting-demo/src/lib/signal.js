// Savitzky-Golay first derivative, identical to scipy.signal.savgol_filter(..., deriv=1, mode="interp").
// Every point uses the derivative of a polynomial fitted to the nearest full window of `w` samples.

function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]; x[i] = s / M[i][i]; }
  return x;
}

// weights[c][j]: derivative at window position c as a linear combination of the w samples.
function derivativeWeights(w, order) {
  const weights = [];
  for (let c = 0; c < w; c++) {
    const V = Array.from({ length: w }, (_, j) => Array.from({ length: order + 1 }, (_, k) => (j - c) ** k));
    const AtA = Array.from({ length: order + 1 }, (_, a) => Array.from({ length: order + 1 }, (_, b) => V.reduce((s, r) => s + r[a] * r[b], 0)));
    // row 1 of (V^T V)^-1 V^T = derivative coefficient; solve (V^T V) u = e1, then weights = V u
    const u = solve(AtA, Array.from({ length: order + 1 }, (_, k) => (k === 1 ? 1 : 0)));
    weights.push(V.map(r => r.reduce((s, v, k) => s + v * u[k], 0)));
  }
  return weights;
}

const cache = {};
export function savgolDerivative(P, dt, w = 11, order = 3) {
  const n = P.length, half = (w - 1) / 2, key = `${w}-${order}`;
  if (n < w) throw new Error(`Need at least ${w} points for the velocity filter.`);
  const W = (cache[key] ??= derivativeWeights(w, order));
  return P.map((_, i) => {
    const s = Math.min(Math.max(i - half, 0), n - w), c = i - s;
    return [0, 1, 2].map(k => { let a = 0; for (let j = 0; j < w; j++) a += W[c][j] * P[s + j][k]; return a / dt; });
  });
}

# UAV Trajectory Forecasting Demo

A React + Vite + Plotly prototype for a research demo website.

## Run locally

Requirements: Node.js 20+ (18+ may also work).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

## Important: sample data only

The current trajectories are generated in `src/data.js` purely to demonstrate the interface. The metrics are illustrative placeholders, **not experimental results**. Replace them with your actual exported predictions before publishing.

## Connect your Python/PyTorch outputs

A sensible next step is to export one JSON file per scenario/method, with:
- observed history
- ground-truth future
- predicted future
- metric values
- coordinate units, sampling interval, and forecast horizon

Then update `src/data.js` to load those JSON files (or place them under `public/data/`). Keep model checkpoints and inference code off the public static website: visitors only need the precomputed results.

## Build

```bash
npm run build
npm run preview
```

The project is configured with a relative Vite base path, which is convenient for GitHub Pages project sites.

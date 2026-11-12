import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import mjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";

const BASE = import.meta.env.BASE_URL;
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
ort.env.wasm.numThreads = 1; // GitHub Pages has no cross-origin isolation, so no threads

const sessions = {};
let metaPromise;

export const loadMeta = () => (metaPromise ??= fetch(`${BASE}models/meta.json`).then(r => r.json()));

const session = method => (sessions[method] ??= ort.InferenceSession.create(`${BASE}models/${method}.onnx`));

// feeds: { inputName: Float32Array }; shapes are fixed by the export (50 observed steps).
export async function run(method, feeds) {
  const s = await session(method);
  const dims = { x: [1, 50, method === "kcs2o" ? 3 : 6], v_init: [1, 3] };
  const input = Object.fromEntries(Object.entries(feeds).map(([k, v]) => [k, new ort.Tensor("float32", v, dims[k])]));
  const out = await s.run(input);
  return out.y.data;
}

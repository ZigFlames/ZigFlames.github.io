/* T-Shirt Studio AI Upscale worker (hotfix v20261110c2).
   Runs ESRGAN-slim (UpscalerJS's free "rdn" model, TensorFlow.js) OFF the main thread so the page never freezes.
   Backend: WebGL (via OffscreenCanvas inside this worker) when available, otherwise WASM, otherwise CPU.
   Works tile by tile and yields between tiles, so Cancel is handled right away and the page gets progress after every tile.
   Messages in : {cmd:"run", w, h, buf (RGBA ArrayBuffer), factor, patch, pad}  ·  {cmd:"cancel"}
   Messages out: {type:"backend"} {type:"model"} {type:"est"} {type:"progress"} {type:"done"} {type:"error"} */
var TF = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js";
var WASM = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.11.0/dist/";
var MODEL = "https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/models/x{F}/model.json";
var cancelled = false;
function post(m, t) { self.postMessage(m, t || []); }
function yieldNow() { return new Promise(function (r) { setTimeout(r, 0); }); }
async function pickBackend() {
  importScripts(TF);
  var tf = self.tf, tried = [];
  if (typeof OffscreenCanvas !== "undefined") {
    try { if (await tf.setBackend("webgl")) { await tf.ready(); var gl = tf.backend().gpgpu && tf.backend().gpgpu.gl, r = ""; try { var ext = gl && gl.getExtension("WEBGL_debug_renderer_info"); r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ""; } catch (e) {} return { name: "webgl", gpu: !/swiftshader|llvmpipe|software|basic render/i.test(r), renderer: r }; } } catch (e) { tried.push("webgl: " + e.message); }
  }
  try { importScripts(WASM + "tf-backend-wasm.min.js"); tf.wasm.setWasmPaths(WASM); if (await tf.setBackend("wasm")) { await tf.ready(); return { name: "wasm", gpu: false }; } } catch (e) { tried.push("wasm: " + e.message); }
  await tf.setBackend("cpu"); await tf.ready(); return { name: "cpu", gpu: false, tried: tried };
}
self.onmessage = async function (ev) {
  var m = ev.data || {};
  if (m.cmd === "cancel") { cancelled = true; return; }
  if (m.cmd !== "run") return;
  cancelled = false;
  try {
    var be = await pickBackend(); post({ type: "backend", backend: be });
    var tf = self.tf, F = m.factor === 4 ? 4 : 2;
    var model = await tf.loadLayersModel(MODEL.replace("{F}", F)); post({ type: "model" });
    var W = m.w, H = m.h, src = new Uint8ClampedArray(m.buf), P = m.patch || 128, PAD = m.pad || 8;
    var rgb = new Float32Array(W * H * 3); for (var i = 0, j = 0; i < src.length; i += 4) { rgb[j++] = src[i]; rgb[j++] = src[i + 1]; rgb[j++] = src[i + 2]; }
    var OW = W * F, OH = H * F, out = new Uint8ClampedArray(OW * OH * 4);
    var cols = Math.ceil(W / P), rows = Math.ceil(H / P), total = cols * rows, done = 0, t0 = Date.now(), tFirst = 0;
    var input = tf.tensor3d(rgb, [H, W, 3]); rgb = null;
    for (var ty = 0; ty < rows; ty++) for (var tx = 0; tx < cols; tx++) {
      if (cancelled) { input.dispose(); model.dispose(); post({ type: "error", cancelled: true, error: "cancelled" }); return; }
      var x0 = tx * P, y0 = ty * P, x1 = Math.min(W, x0 + P), y1 = Math.min(H, y0 + P);
      var px0 = Math.max(0, x0 - PAD), py0 = Math.max(0, y0 - PAD), px1 = Math.min(W, x1 + PAD), py1 = Math.min(H, y1 + PAD);
      var ts = Date.now();
      var res = tf.tidy(function () { return model.predict(input.slice([py0, px0, 0], [py1 - py0, px1 - px0, 3]).expandDims(0)).clipByValue(0, 255).squeeze(); });
      var d = await res.data(); res.dispose();
      var tw = (px1 - px0) * F, ox = (x0 - px0) * F, oy = (y0 - py0) * F, cw = (x1 - x0) * F, ch = (y1 - y0) * F;
      for (var yy = 0; yy < ch; yy++) { var si = ((oy + yy) * tw + ox) * 3, di = ((y0 * F + yy) * OW + x0 * F) * 4; for (var xx = 0; xx < cw; xx++, si += 3, di += 4) { out[di] = d[si]; out[di + 1] = d[si + 1]; out[di + 2] = d[si + 2]; out[di + 3] = 255; } }
      done++;
      var ms = Date.now() - ts; if (done === 1) { tFirst = ms; post({ type: "est", msPerTile: ms, total: total, sec: Math.round(ms * total / 1000) }); }
      var el = Date.now() - t0; post({ type: "progress", done: done, total: total, tileMs: ms, left: Math.round(el / done * (total - done) / 1000) });
      await yieldNow(); // let Cancel in, and keep progress flowing
    }
    input.dispose(); model.dispose();
    post({ type: "done", w: OW, h: OH, buf: out.buffer, secs: Math.round((Date.now() - t0) / 1000), backend: be.name }, [out.buffer]);
  } catch (e) { post({ type: "error", error: String(e && e.message || e) }); }
};

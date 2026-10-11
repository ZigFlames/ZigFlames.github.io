// AUTOMATICS capture tap: copies raw PCM blocks to the main thread (no codec, no processing).
class AutoCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length) this.port.postMessage(ch.map((c) => c.slice(0)));
    return true;
  }
}
registerProcessor('automatics-capture', AutoCapture);

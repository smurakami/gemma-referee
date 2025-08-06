class RecorderWorklet extends AudioWorkletProcessor {
  constructor(options){ super(); this.N = options.processorOptions?.frameSize ?? 4000; this.buf = new Float32Array(this.N); this.i = 0; }
  process(inputs){ const input = inputs[0][0]; if (!input) return true;
    let p = 0; while (p < input.length) {
      const c = Math.min(this.N - this.i, input.length - p);
      this.buf.set(input.subarray(p, p + c), this.i); this.i += c; p += c;
      if (this.i === this.N) { this.port.postMessage(this.buf.slice(0)); this.i = 0; }
    }
    return true;
  }
}
registerProcessor('recorder-worklet', RecorderWorklet);

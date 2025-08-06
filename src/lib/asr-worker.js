import { pipeline } from '@huggingface/transformers';

let asr;
async function load() {
  if (!asr) {
    const device = (self.navigator?.gpu) ? 'webgpu' : 'cpu';
    asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', { device });
  }
  return asr;
}

// 30秒のリングバッファ（16kHz）
let ring = new Float32Array(16000 * 30), w = 0;

let busy = false;
self.onmessage = async (e) => {
  const { type, pcm, sr } = e.data;
  if (type === 'push') { // Float32Array(16k mono)
    if (sr !== 16000) return; // 簡略: 16k前提
    if (w + pcm.length > ring.length) w = 0;
    ring.set(pcm, w); w += pcm.length;
  }
  if (type === 'decode') {
    if (busy) {
      return;
    }
    busy = true;

    try {
      const asr = await load();
      // const tailSec = 20; // 直近20秒を推論
      const tailSec = 10; // 直近20秒を推論
      const n = Math.min(tailSec * 16000, ring.length);
      const start = (w - n + ring.length) % ring.length;
      const chunk = new Float32Array(n);
      if (start + n <= ring.length) chunk.set(ring.subarray(start, start + n));
      else {
        const first = ring.length - start;
        chunk.set(ring.subarray(start));
        chunk.set(ring.subarray(0, n - first), first);
      }
      const out = await asr(chunk, {
        language: 'ja',
        task: 'transcribe',
        // リアルタイム用に分割＋オーバーラップ
        chunk_length_s: 20,
        stride_length_s: 5,
        return_timestamps: true,
      });
      self.postMessage(out);
    } catch (e) {
      console.error(e);
    } 

    busy = false;
  }
};

'use client';
import { useEffect, useRef, useState } from 'react';





export default function Page() {
  const workerRef = useRef<Worker|null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    const worker = new Worker(new URL('@/lib/asr-worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(stream);

      await ctx.audioWorklet.addModule('/recorder.worklet.js');
      const node = new AudioWorkletNode(ctx, 'recorder-worklet', { processorOptions: { frameSize: 4000 } }); // 250ms
      node.port.onmessage = (e) => {
        const f32 = e.data as Float32Array;
        worker.postMessage({ type: 'push', pcm: f32, sr: 16000 }, [f32.buffer]);
      };
      src.connect(node);
    })();

    const onMsg = (e: MessageEvent) => {
      // 返ってきたチャンクを、UI側で重複除去して追記
      // ここでは簡略化して毎回全文を表示
      setText(e.data.text ?? '');
    };
    worker.addEventListener('message', onMsg);

    // 1秒ごとに末尾をデコード
    const t = setInterval(() => worker.postMessage({ type: 'decode' }), 1000);

    return () => { clearInterval(t); worker.terminate(); };
  }, []);

  return <main><h1>Realtime Whisper (WebGPU)</h1><div>{text}</div></main>;
}

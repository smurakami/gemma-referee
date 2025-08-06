import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store';

export function useASR() {
  const workerRef = useRef<Worker|null>(null);
  const [text, setText] = useState('');
  const onTextRef = useRef<(text: string) => Promise<void> | null>(null)

  const appStore = useAppStore();
  const appStoreRef = useRef(appStore);
  appStoreRef.current = appStore;


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
        worker.postMessage({ type: 'push', pcm: f32, sr: 16000, }, [f32.buffer]);
      };
      src.connect(node);
    })();

    const onMsg = (e: MessageEvent) => {
      // 返ってきたチャンクを、UI側で重複除去して追記
      // ここでは簡略化して毎回全文を表示
      const text = e.data.text;
      setText(text);

      if (text && onTextRef.current) {
        onTextRef.current(text);
      }
    
    };
    worker.addEventListener('message', onMsg);

    // 1秒ごとに末尾をデコード
    const t = setInterval(() => {
      const lang = appStoreRef.current.lang;
      worker.postMessage({ type: 'decode', lang })
    }, 1000);

    return () => { clearInterval(t); worker.terminate(); };
  }, []);

  return {
    text,
    onTextRef
  }
}

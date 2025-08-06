import { useEffect, useRef, useState } from "react";


export function useRec() {
  const stateRef = useRef<{
    stream: MediaStream | null,
    recorder: MediaRecorder | null,
    running: boolean,
    loopPromise: Promise<void> | null,
    busy: boolean,
    onRec: ((blob: Blob) => void)|null,
  }>({
    stream: null,
    recorder: null,
    running: false,
    loopPromise: null,
    busy: false,
    onRec: null,
  });

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const b2dataURL = (blob: Blob) => new Promise(res => {
    const reader = new FileReader();
    reader.onloadend = e => res(e.target?.result);
    reader.readAsDataURL(blob);
  });


  async function getStream() {
    const state = stateRef.current;
    if (state.stream && state.stream.active) return state.stream;
    state.stream = await navigator.mediaDevices.getUserMedia({audio:true});
    return state.stream;
  }

  async function recordOnce(ms: number) {
    const state = stateRef.current;
    const stream = await getStream();
    const rec = new MediaRecorder(stream);
    state.recorder = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    const stopped = new Promise<Blob>(res => rec.onstop = () => res(new Blob(chunks)));
    rec.start();
    const timer = sleep(ms).then(() => { try { rec.stop(); } catch(e){} });
    const blob = await stopped;           // ← ここは stop() でも解放される
    // return b2dataURL(blob);
    return blob;
  }

  async function startLoop(periodMs: number, intervalMs: number) {
    const state = stateRef.current;
    if (state.running) return;
    state.running = true;

    state.loopPromise = (async () => {
      let counter = 0;
      while (state.running) {
        // console.log('rec');
        recordOnce(periodMs).then(async blob => {
        // wrecordOnce(Math.min(periodMs, (counter + 1) * 1000)).then(async blob => {
          if (!state.running) return;  // 停止後に余計な送信をしない
          if (state.busy) return; // 先客がまだいたらあきらめる
          state.busy = true;

          try {
            // console.log('send');
            await state.onRec?.(blob);
          } catch (e) {
            console.error(e);
          }

          state.busy = false;

        });
        await sleep(intervalMs);
        counter++;
      }
    })();

    return state.loopPromise;
  }

  function stop() {
    const state = stateRef.current;
    state.running = false;
    // 進行中のレコーダを止める
    try { if (state.recorder && state.recorder.state !== 'inactive') state.recorder.stop(); } catch(e){}
  }

  function close() {
    const state = stateRef.current;
    stop();
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
  }

  const rec = { startLoop, stop, close, stateRef };
  return rec
};


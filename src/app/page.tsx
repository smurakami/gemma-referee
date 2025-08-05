"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRunOnce, VSpacer } from "@/lib/utils";
import { Container } from "@mui/material";
import urlJoin from "url-join";

function useRec() {
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


export default function Page() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [status, setStatus] = useState("");
  const [json, setJson] = useState<any>(null);
  const [origUrl, setOrigUrl] = useState<string>("");
  const [procUrl, setProcUrl] = useState<string>("");

  const [resList, set_resList] = useState<string[]>([]);
  const [isWaiting, set_isWaiting] = useState(false);

  const params = useSearchParams();
  console.log(params.get("api_root"));

  // const apiRootUrl = "hogehoge";
  const apiRootUrl = params.get("api_root");

  const rec = useRec();

  useRunOnce(() => {
    if (apiRootUrl == null) {
      console.error("no api root url");
      return;
    }

    rec.stateRef.current.onRec = async blob => {
      console.log('rec');
      const fd = new FormData();
      fd.append("file", blob, "audio.webm");
      const res = await fetch(
        urlJoin( apiRootUrl, 'api/analyze'), {
        method: "POST",
        body: fd,
      });
      // console.log(res);
      if (!res.ok) throw new Error(`analyze ${res.status}`);

      // ストリームがない（古い環境）場合のフォールバック
      if (!res.body) {
        const text = await res.text();
        console.warn("No streaming body; full text:", text);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let resText = "";
      const resIndex = resList.length;
      resList.push(resText);
      set_resList([...resList]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 行区切りでパース
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.delta) {
              // ここで逐次表示
              // appendToUI(evt.delta);
              console.log(evt.delta);
              resText += evt.delta;
              resList[resIndex] = resText;
              
              set_resList([...resList]);
            } else if (evt.event === "start") {
              set_isWaiting(true);
              // startUI();
            } else if (evt.event === "end") {
              set_isWaiting(false);
              // finishUI();
            }
          } catch (e) {
            console.error("bad line", line, e);
          }
        }
      }
    }

    rec.startLoop(10_000, 1000);
  })


  return (
    <Container>
      <VSpacer size={60} />

      <div>出力結果</div>
      <div>status: {isWaiting ? "生成中" : "録音中"}</div>

      <VSpacer size={40} />

      { resList.map( (res, i) => 
        <div key={i} style={{marginBottom: 24}}>
          <div> 入力 {i} </div>
          <div> {res} </div>
        </div>)

      }
    </Container>
  );
}

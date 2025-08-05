"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [status, setStatus] = useState("");
  const [json, setJson] = useState<any>(null);
  const [origUrl, setOrigUrl] = useState<string>("");
  const [procUrl, setProcUrl] = useState<string>("");

  const params = useSearchParams();
  console.log(params.get("api_root"));
  const base = params.get("api_root");

  useEffect(() => {
    (async () => {
      console.log('hi');

      const res2 = await fetch(`${base}api/ping`, {
        method: "GET",
      });

      console.log(res2);
    })();

  }, [])




  // onst base = process.env.NEXT_PUBLIC_COLAB_BASE!; // e.g. https://...-colab.googleusercontent.com/
  // const base = "https://41029-m-s-s7lm2czmk0g6-a.asia-east1-1.prod.colab.dev/";

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setOrigUrl(URL.createObjectURL(blob));
      setStatus("送信中...");

      // 1) 解析
      const fd1 = new FormData();
      fd1.append("file", blob, "audio.webm");
      const res1 = await fetch(`${base}api/analyze`, {
        method: "POST",
        body: fd1,
        // credentials: "include",   // ★ GoogleログインCookieを送る
        // mode: "cors",
      });
      if (!res1.ok) throw new Error(`analyze ${res1.status}`);
      setJson(await res1.json());

      // 2) 加工音声の取得
      const fd2 = new FormData();
      fd2.append("file", blob, "audio.webm");
      const res2 = await fetch(`${base}api/process`, {
        method: "POST",
        body: fd2,
        // credentials: "include",
        // mode: "cors",
      });
      if (!res2.ok) throw new Error(`process ${res2.status}`);
      const outBlob = await res2.blob();
      setProcUrl(URL.createObjectURL(outBlob));
      setStatus("完了");
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setStatus("録音中…");
  }

  function stop() {
    mediaRecorderRef.current?.stop();
    setStatus("停止");
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>Mic → Next.js → Colab(Proxy)</h2>
      <button onClick={start}>録音開始</button>
      <button onClick={stop}>停止</button>
      <p>{status}</p>

      <h3>元音声</h3>
      {origUrl && <audio src={origUrl} controls />}

      <h3>処理結果</h3>
      {procUrl && <audio src={procUrl} controls />}

      <h3>JSON</h3>
      <pre>{json ? JSON.stringify(json, null, 2) : ""}</pre>
    </main>
  );
}

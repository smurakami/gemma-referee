"use client";

import { useEffect, useRef, useState } from "react";
import { useRunOnce, VSpacer } from "@/lib/utils";
import { Container } from "@mui/material";
import urlJoin from "url-join";
import { useASR } from "@/lib/use-asr";


export default function Page() {
  const [resList, set_resList] = useState<string[]>([]);
  const [isWaiting, set_isWaiting] = useState(false);

  const asr = useASR()

  useRunOnce(() => {
    const params = new URLSearchParams(window.location.search)
    const apiRootUrl = params.get("api_root");
    console.log(apiRootUrl)

    if (apiRootUrl == null) {
      console.error("no api root url");
      return;
    }

    let busy = false;
    asr.onTextRef.current = async text => {
      if (busy) {
        return;
      }

      console.log(text);

      busy = true;
      const res = await fetch(
        urlJoin( apiRootUrl, 'api/analyze_text'), {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({text,})
        });

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

      busy = false;
    }
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

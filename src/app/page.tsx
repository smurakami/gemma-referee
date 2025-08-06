"use client";
import { useEffect, useRef, useState } from "react";
import { useRunOnce, VSpacer } from "@/lib/utils";
import { Container } from "@mui/material";
import urlJoin from "url-join";
import { useASR } from "@/lib/use-asr";
import { fetchStream } from "@/lib/fetch-stream";


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

      busy = true;

      const stream = fetchStream(
        urlJoin( apiRootUrl, 'api/analyze_text'), 
        {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({text,})
      });

      let resText = "";
      const resTextIndex = resList.length;    
      resList.push(resText)
      for await (let delta of stream) {
        resText += delta;
        resList[resTextIndex] = resText;
      }

      busy = false;
    }
  })


  return (
    <Container>
      <VSpacer size={60} />

      <div>認識結果</div>
      <div style={{fontSize: 10, color: 'gray'}}>
        {asr.text}
      </div>

      <VSpacer size={40} />

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

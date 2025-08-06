"use client";
import { useEffect, useRef, useState } from "react";
import { sleep, useInterval, useRunOnce, VSpacer } from "@/lib/utils";
import { Container } from "@mui/material";
import urlJoin from "url-join";
import { useASR } from "@/lib/use-asr";
import { fetchStream } from "@/lib/fetch-stream";
import { DeviceModelHandle, DeviceModelScene } from "@/lib/components/DeviceModelScene";


export class SoundPlayer {
  private audio: HTMLAudioElement;

  constructor(src: string) {
    this.audio = new Audio(src);
    // ループ再生にするなら以下を有効化
    // this.audio.loop = true;
  }

  play() {
    // 再生位置を先頭に戻して再生
    this.audio.currentTime = 0;
    this.audio.play().catch(err => {
      console.error("再生エラー:", err);
    });
  }

  // 必要なら停止メソッドも
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}


export default function Page() {
  const [resList, set_resList] = useState<string[]>([]);
  const [isWaiting, set_isWaiting] = useState(false);
  const modelRef = useRef<DeviceModelHandle>(null);
  const redCardUntilRef = useRef(new Date);
  const yellowCardUntilRef = useRef(new Date);
  const [asrText, set_asrText] = useState("");

  const asr = useASR()

  useRunOnce(() => {
    const params = new URLSearchParams(window.location.search)
    const apiRootUrl = params.get("api_root");


    let busy = false;
    asr.onTextRef.current = async text => {
      console.log(text);
      set_asrText(text);
      if (busy) {
        return;
      }

      if (apiRootUrl == null) {
        console.log("no api root url");
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

  function showRedCard() {
      const d = new Date();       // 今の日時
      d.setTime(d.getTime() + 1000);  // 内部保持しているミリ秒値に 1000 を加算
      redCardUntilRef.current = d;

      const player = new SoundPlayer("/sounds/whistle-long.mp3");
      player.play();
  }

  function showYellowCard() {
      const d = new Date();       // 今の日時
      d.setTime(d.getTime() + 1000);  // 内部保持しているミリ秒値に 1000 を加算
      yellowCardUntilRef.current = d;

      const player = new SoundPlayer("/sounds/whistle.mp3");
      player.play();
  }

  useEffect(() => {
    // console.log(asrText);
    if (["ちんこ", "チンコ"].some(w => asrText.includes(w))) {
      showRedCard();
    }

    if (["うんこ", "ウンコ", "運行"].some(w => asrText.includes(w))) {
      showYellowCard();
    }
  }, [ asrText ])

  useInterval(33, function() {
    const model = modelRef.current;
    if (!model) return;

    const now = new Date();
    if (now < redCardUntilRef.current) {
      model.setLeftArm(0, 0, 0)
    } else {
      model.setLeftArm(Math.PI, 0, 0)
    }

    if (now < yellowCardUntilRef.current) {
      model.setRightArm(0, 0, 0)
    } else {
      model.setRightArm(Math.PI, 0, 0)
    }
  })

  return (
    <div>
      <DeviceModelScene ref={modelRef} />

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

    </div>
  );
}

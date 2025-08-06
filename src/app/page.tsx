"use client";
import { useEffect, useRef, useState } from "react";
import { HSpacer, HStack, sleep, SoundPlayer, useInterval, useRunOnce, VSpacer } from "@/lib/utils";
import { Button, ButtonGroup, Container } from "@mui/material";
import urlJoin from "url-join";
import { useASR } from "@/lib/use-asr";
import { fetchStream } from "@/lib/fetch-stream";
import { DeviceModelHandle, DeviceModelScene } from "@/lib/components/DeviceModelScene";
import { useAppStore } from "@/lib/store";


function parseGemmaResponse(text: string) {
  let score = 0;
  let word = "";

  for (let line of text.split("\n")) {
    let match = line.match(/^\s*score:\s*(\d+).*/);
    if (match) {
      score = Number(match[1]);
    }
    match = line.match(/^\s*word:\s*(.*)/);
    if (match) {
      word = match[1];
    }
  }

  return {
    score, word
  }
}

function stripBracketsAndParens(input: string): string {
  // \[.*?\]  → [...] を非貪欲マッチで
  // |\(.*?\) → (...) を非貪欲マッチで
  // g        → 全体からすべて置換
  return input.replace(/\[.*?\]|\(.*?\)/g, '');
}

export default function Page() {
  const [resList, set_resList] = useState<{text: string, score: number}[]>([]);
  const [isWaiting, set_isWaiting] = useState(false);
  const modelRef = useRef<DeviceModelHandle>(null);
  const redCardUntilRef = useRef(new Date);
  const yellowCardUntilRef = useRef(new Date);
  const [asrText, set_asrText] = useState("");

  const asr = useASR()

  const appStore = useAppStore()

  useRunOnce(() => {
    const params = new URLSearchParams(window.location.search)
    const apiRootUrl = params.get("api_root");


    let busy = false;
    asr.onTextRef.current = async text => {
      // console.log(text);
      text = stripBracketsAndParens(text);
      text = text.trim();
      // console.log(text);
      set_asrText(text);
      if (busy) {
        return;
      }

      if (apiRootUrl == null) {
        console.log("no api root url");
        return;
      }

      if (!text) {
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
      // const resTextIndex = resList.length;    
      // resList.push(resText)

      for await (let delta of stream) {
        resText += delta;
        // resList[resTextIndex] = resText;
      }


      const result = parseGemmaResponse(resText);
      console.log(result);

      resList.push({
        score: result.score,
        text: text,
      });

      set_resList([...resList])

      if (result.score >= 85) {
        showRedCard()
      } else if (result.score == 70) {
        showYellowCard()
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
      <div style={{position: 'absolute', width: '100%', zIndex: 1}}>

        <VSpacer size={40}></VSpacer>

        <HStack style={{justifyContent: 'end'}}>
          <ButtonGroup>
            <Button variant={appStore.lang === "en" ? "contained" : "outlined"}
              onClick={() => {
                if (appStore.lang != "en") {
                  appStore.setLang('en')
                }
              } }
              >EN</Button>
            <Button variant={appStore.lang === "ja" ? "contained" : "outlined"}
              onClick={() => {
                if (appStore.lang != "ja") {
                  appStore.setLang('ja')
                }

              } }
              >JA</Button>
          </ButtonGroup>

          <HSpacer size={40} />
        </HStack>

      </div>

      <DeviceModelScene ref={modelRef} />

      <Container>
        <VSpacer size={60} />

        <div>入力音声</div>
        <div style={{fontSize: 10, color: 'gray'}}>
          {asrText}
        </div>

        <VSpacer size={40} />

        {/* <div>出力結果</div>
        <div>status: {isWaiting ? "生成中" : "録音中"}</div> */}

        <VSpacer size={40} />

        { [...resList].reverse()
          .map( (res, i) => 
          <div key={i} style={{marginBottom: 24}}>
            <div> 
              {res.score}
            </div>
            <div>
               {res.text}
               </div>
          </div>
          )
        }
      </Container>

    </div>
  );
}

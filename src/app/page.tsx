"use client";
import { useEffect, useRef, useState } from "react";
import { HSpacer, HStack, sleep, SoundPlayer, useInterval, useRunOnce, useWindowSize, VSpacer } from "@/lib/utils";
import { Button, ButtonGroup, Card, CardContent, Container } from "@mui/material";
import urlJoin from "url-join";
import { useASR } from "@/lib/use-asr";
import { fetchStream } from "@/lib/fetch-stream";
import { DeviceModelHandle, DeviceModelScene } from "@/lib/components/DeviceModelScene";
import { useAppStore } from "@/lib/store";

import titleImage from "./title.svg";

const COLAB_NB_URL = "https://colab.research.google.com/drive/1tdpFzvbsQ0GsrAQ4y4fP0z9O5Fk2Y7_U";

function parseGemmaResponse(text: string) {
  let score = 0;
  // let word = "";

  for (let line of text.split("\n")) {
    let match = line.match(/^\s*score:\s*(\d+).*/);
    if (match) {
      score = Number(match[1]);
    }
    // match = line.match(/^\s*word:\s*(.*)/);
    // if (match) {
    //   word = match[1];
    // }
  }

  return {
    score,
  }
}

function stripBracketsAndParens(input: string): string {
  // \[.*?\]  → [...] を非貪欲マッチで
  // |\(.*?\) → (...) を非貪欲マッチで
  // g        → 全体からすべて置換
  return input.replace(/\[.*?\]|\(.*?\)/g, '');
}

export default function Page() {
  const [resList, set_resList] = useState<{text: string, score: number, card: "none"|"yellow"|"red"}[]>([]);
  const [isWaiting, set_isWaiting] = useState(false);
  const modelRef = useRef<DeviceModelHandle>(null);
  const [threeModelIsLoading, set_threeModelIsLoading] = useState(true);
  const [aiModelIsLoading, set_aiModelIsLoading] = useState(true);

  const redCardUntilRef = useRef(new Date);
  const yellowCardUntilRef = useRef(new Date);

  const prevWhistleRef = useRef(new Date);

  const [asrText, set_asrText] = useState("");

  const asr = useASR()
  const appStore = useAppStore()
  const appStoreRef = useRef(appStore);
  appStoreRef.current = appStore;

  const windowSize = useWindowSize();

  const [mode, setMode] = useState<"referee"|"comment">("referee");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [comment, setComment] = useState("");

  const [nbNotConnectedError, set_nbNotConnectedError] = useState(false);
  const [nbConnectionWarning, set_nbConnectionWarning] = useState(false);

  useRunOnce(() => {
    const params = new URLSearchParams(window.location.search)
    const apiRootUrl = params.get("api_root");

    if (!apiRootUrl) {
      set_nbNotConnectedError(true);
    }


    let busy = false;
    asr.onTextRef.current = async text => {
      set_aiModelIsLoading(false);
      // console.log(text);
      text = stripBracketsAndParens(text);
      text = text.trim();
      // console.log(text);
      set_asrText(text);
      if (busy) {
        return;
      }

      if (modeRef.current == "comment") {
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

      try {
        const lang = appStoreRef.current.lang;

        const stream = fetchStream(
          urlJoin( apiRootUrl, 'api/analyze_text'), 
          {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({text, lang})
        });

        let resText = "";
        // const resTextIndex = resList.length;    
        // resList.push(resText)

        for await (let delta of stream) {
          resText += delta;
          // resList[resTextIndex] = resText;
        }


        const result = parseGemmaResponse(resText);
        let card: "red"|"yellow"|"none" = "none"

        // 一定時間、前のホイッスルからあける
        if (new Date().getTime() - prevWhistleRef.current.getTime() > 7 * 1000) {
          if (result.score >= 85) {
            card = "red"
            showRedCard()
            prevWhistleRef.current = new Date();
          } else if (result.score == 70) {
            card = "yellow";
            showYellowCard()
            prevWhistleRef.current = new Date();
          }
        }


        resList.push({
          score: result.score,
          text, card,
        });

        set_resList([...resList])

        set_nbConnectionWarning(false);
      } catch (e) {

        console.error(e);
        set_nbConnectionWarning(true);
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
  
  // watch model info
  useInterval(33, function() {
    if (modelRef.current) {
      set_threeModelIsLoading(false);
    } else {
      set_threeModelIsLoading(true);
    }
  })

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

    if (mode === "referee") {
      model.setDeviceRoot(0, 0, 0);
    } else {
      model.setDeviceRoot(0, Math.PI, 0);
    }

  })

  async function beginComment(text: string) {
    const params = new URLSearchParams(window.location.search)
    const apiRootUrl = params.get("api_root");

    let comment = "";
    setComment(comment);
    setMode("comment")
    const lang = appStoreRef.current.lang;

    if (!apiRootUrl) {
      setMode("referee");
      return;
    }

    try {
      const stream = fetchStream(
        urlJoin( apiRootUrl, 'api/comment'), 
        {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({text, lang})
      });

      let resText = "";
      // const resTextIndex = resList.length;    
      // resList.push(resText)

      for await (let delta of stream) {
        resText += delta;
        setComment(resText);
        // resList[resTextIndex] = resText;
      }

      set_nbConnectionWarning(false);
    } catch(e) {

      console.error(e);
      set_nbConnectionWarning(true);
    }

  }

  return (
    <div style={{minHeight: windowSize.height}}>
      <div style={{position: 'absolute', width: '100%'}}>
        <VSpacer size={40}></VSpacer>

        <div style={{textAlign: "center", fontSize: 80}}>
          <img src={titleImage.src} style={{height: 120}} />
        </div>

        { threeModelIsLoading && 
          <div style={{
            color: "#e74c3c",
            fontWeight: "bold",
            fontSize: 32,
            textAlign: 'center',
          }}>
            3D model is loading...
          </div>
        }
      </div>

      {/* JA/EN */}
      <div style={{position: 'absolute', width: '100%', zIndex: 1}}>
        <VSpacer size={40}></VSpacer>

        <HStack style={{justifyContent: 'end'}}>
          <ButtonGroup color="error">
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

      {/* Error */}

      { (nbNotConnectedError || nbConnectionWarning) &&
        <div style={{position: 'absolute', width: '100%', zIndex: 2}}>
          <VSpacer size={40}></VSpacer>

          <HStack style={{justifyContent: 'begin'}}>
            <HSpacer size={40} />
            
            <Card style={{width: 320}}>
              <CardContent>

                { nbNotConnectedError ?
                  <div style={{
                    color: "#e74c3c",
                    fontWeight: 'bold',
                    }}>
                    <div>Error: Colab notebook is not connected</div>
                    <VSpacer size={4} />
                    <div style={{fontWeight: 'normal'}}>Please visit and run the notebook below:</div>
                    <VSpacer size={4} />
                    <div style={{wordBreak: 'break-all', textDecoration: 'underline'}}>
                      <a href={COLAB_NB_URL}>{COLAB_NB_URL}</a>
                    </div>
                  </div>
                :
                  <div style={{
                    color: "#e74c3c",
                    fontWeight: 'bold',
                    }}>
                    <div>Warning: Colab notebook connection may have some problem</div>
                    <VSpacer size={4} />
                    <div style={{fontWeight: 'normal'}}>Please visit and re-run from server setup:</div>
                    <VSpacer size={4} />
                    <div style={{wordBreak: 'break-all', textDecoration: 'underline'}}>
                      <a href={COLAB_NB_URL}>{COLAB_NB_URL}</a>
                    </div>
                  </div>
                }
              </CardContent>
            </Card>
          </HStack>
        </div>
      }


      {/* Three */}

      <DeviceModelScene style={{height: 500}} ref={modelRef} />

      { mode == "referee" &&
        <Container>
          <div style={{textAlign: 'center', width: '100%', position: 'relative', zIndex: 1, left: 0, marginTop: 10}}>
            <div>Input voice</div>
            <VSpacer size={12} />
            <div style={{fontSize: 10, height: 32}}>
              {asrText}
            </div>

            { aiModelIsLoading &&

              <div style={{
                color: "#e74c3c",
                fontWeight: "bold",
                fontSize: 32,
                textAlign: 'center',
              }}>
                Text2speech AI model is loading...
              </div>
              }

          </div>

          <VSpacer size={40} />

          { [...resList].reverse()
            .filter( res => res.card != "none")
            .map( (res, i) => 
            <div key={i} style={{
              marginBottom: 24,
              backgroundColor: 'white',
              padding: 16,
              borderRadius: 24,
              }}>
              <HStack style={{justifyContent: "start", alignItems: "center"}}>
              <div> 
                {res.card == "red" ? "🟥" : "🟨"}
              </div>
              <HSpacer size={10} />
              <div>
                {res.text}
              </div>

              <div style={{flexGrow: 1}}></div>

              <Button variant="contained" sx={{backgroundColor: res.card == "red" ? "#e74c3c" : "#f1c40f"}}
                onClick={() => beginComment(res.text)}
              >commentary</Button>

              </HStack>
            </div>
            )
          }
        </Container>
      }

      { mode == "comment" &&
        <Container>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 32
          }}>
            {comment}
          </div>

            <VSpacer size={16}></VSpacer>
          <HStack style={{justifyContent: 'end'}}>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                setMode("referee")
              }}
            >BACK</Button>
          </HStack>



        </Container>
      }


    </div>
  );
}

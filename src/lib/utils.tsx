"use client";
import React, { CSSProperties, useEffect, useState, ReactNode, useRef } from 'react'
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function hiraToKana(str: string) {
  return str.replace(/[\u3041-\u3096]/g, function(match) {
      let chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
  });
}

export function VSpacer(props: {size: number}) {
  return <div style={{width: '100%', height: props.size}}></div>
}

export function HSpacer(props: {size: number}) {
  return <div style={{height: '100%', width: props.size}}></div>
}

export function HStack(props: {style?: CSSProperties,children?: React.ReactNode}) {
  return <div style={{
    display: 'flex', 
    flexDirection: 'row',
    justifyContent: 'center',
    ...(props.style ?? {}),
  }}>{props.children}</div>
}

export function VStack(props: {style?: CSSProperties,children?: React.ReactNode}) {
  return <div style={{
    display: 'flex', 
    flexDirection: 'column',
    justifyContent: 'center',
    ...(props.style ?? {}),
  }}>{props.children}</div>
}

export function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    function onResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    }

  }, [])

  return size;
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function useRunOnce(callback: () => void) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      callback();
      // setHasRun(true);
      hasRun.current = true;
    }
  }, []);
}

export function formatAJ(text: string) {
  return text
    .replace(/味の素®/g, "味の素")
    .replace(/「味の素」/g, "<AJNMT>")
    .replace(/『味の素』/g, "<AJNMT>")
    .replace(/味の素/g, "<AJNMT>")
    .replace(/<AJNMT>/g, "「味の素®」");
}

export function LinkWithQuestionResponseType({href, children, style}: {href: string, children?: ReactNode, style?: CSSProperties}) {
  const params = useSearchParams();
  const questionResponseType = params.get("questionResponseType");
  return <Link href={{pathname: href, query: { questionResponseType }}} style={style}>{children}</Link>
}
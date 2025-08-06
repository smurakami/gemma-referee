'use client';
import { useASR } from '@/lib/use-asr';
import { useEffect, useRef, useState } from 'react';

export default function Page() {
  const asr = useASR();

  return <main><h1>Realtime Whisper (WebGPU)</h1><div>{asr.text}</div></main>;
}

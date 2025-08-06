"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { useInterval, useRunOnce } from "@/lib/utils";
import { DeviceModelHandle, DeviceModelScene } from "@/lib/components/DeviceModelScene";

export default function Page() {
  const modelRef = useRef<DeviceModelHandle>(null);

  useInterval(1000, () => {
    modelRef.current?.setLeftArm(Math.PI, 0, 0);
    modelRef.current?.setRightArm(Math.PI, 0, 0);
  })


  return (
    <DeviceModelScene ref={modelRef} />
  );
}

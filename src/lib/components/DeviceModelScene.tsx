"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { useInterval, useRunOnce } from "@/lib/utils";
import { CSSProperties } from "@mui/material";

export type DeviceModelHandle = {
  /** ラジアン指定。例: setLeftArm(Math.PI/3, 0, 0) */
  setLeftArm: (x?: number, y?: number, z?: number) => void;
  setRightArm: (x?: number, y?: number, z?: number) => void;
};

const modelPath = "/models/gemma-device.glb";

export const Model = forwardRef<DeviceModelHandle, {}>((props, ref) => {
  // glTFの読み込み（アニメ付きなら useAnimations も）
  const { scene } = useGLTF(modelPath);

  const leftArm = useMemo(
    () => scene.getObjectByName("left_arm") as THREE.Object3D | null,
    [scene]
  );

  const rightArm = useMemo(
    () => scene.getObjectByName("right_arm") as THREE.Object3D | null,
    [scene]
  );

  // 目標回転（クォータニオンで保持）
  const leftArmtargetQ = useRef(new THREE.Quaternion());
  const rightArmtargetQ = useRef(new THREE.Quaternion());

  // 外部から呼べるAPIを公開
  useImperativeHandle(
    ref,
    () => ({
      setLeftArm: (x = 0, y = 0, z = 0) => {
        leftArmtargetQ.current.setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
      },
      setRightArm: (x = 0, y = 0, z = 0) => {
        rightArmtargetQ.current.setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
      },
    }),
    []
  );

  // 影を有効化
  scene.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      // 金属/粗さのPBRが前提。sRGBテクスチャは自動で補正されます
    }
  });

  // 毎フレーム、現在の回転 → 目標回転へ“なめらかに”寄せる
  useFrame((_, dt) => {
    // 0.18 がダンピング係数（小さいほどゆっくり・大きいほどキビキビ）
    const dumping = 0.18
    if (leftArm) easing.dampQ(leftArm.quaternion, leftArmtargetQ.current, dumping, dt);
    if (rightArm) easing.dampQ(rightArm.quaternion, rightArmtargetQ.current, dumping, dt);
  });

  return <primitive object={scene} />;
})


export const DeviceModelScene = forwardRef<DeviceModelHandle, {style?: CSSProperties}>((props, modelRef) => {
  return <div style={props.style ?? { height: 600 }}>
    <Canvas
      shadows
      dpr={[1, 2]}                                  // 高解像度で綺麗に（上げすぎ注意）
      camera={{ fov: 45, position: [0, 1.5, 5] }}
      gl={{
        antialias: true,
        outputColorSpace: THREE.SRGBColorSpace,     // sRGB
        toneMapping: THREE.ACESFilmicToneMapping,   // ACES
        toneMappingExposure: 1.0,
        // physicallyCorrectLights: true,
      }}
      onCreated={({camera}) => {
        camera.lookAt(new THREE.Vector3(0, 1.5, 0));
        camera.updateProjectionMatrix();
      }}
      style={{ background: "transparent" }} // ← CSS側も透過

    >
      {/* 背景色を少し暗めに */}
      {/* <color attach="background" args={["#0e0e10"]} /> */}

      {/* IBL: HDRI を環境光＆反射に利用（最重要） */}
      <Environment files="/hdr/brown_photostudio_02_2k.hdr" background={false} environmentIntensity={0.5} />

      {/* 直射ライトは補助程度に（影あり）*/}
      <directionalLight
        position={[5, 5, 5]}
        intensity={2.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight intensity={0.15} groundColor={"#444"} color={"#fff"} />

      <Model ref={modelRef} />

      {/* 柔らかい接地影（見栄えが一気に上がる） */}
      <ContactShadows opacity={0.6} blur={2.5} far={8} resolution={1024} />

      {/* <OrbitControls makeDefault enableDamping target={[0, 1.1, 0]} /> */}
    </Canvas>
  </div>
});

// これがあるとGLBをプリロードできて見た目の体感が良い
// useGLTF.preload(modelPath);

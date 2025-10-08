"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function FloatingParticles() {
  const geometry = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 1.8 + Math.random() * 1.6;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const materialRef = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.size = 0.015 + Math.sin(t * 0.6) * 0.005;
    }
  });

  return (
    <points scale={[4, 2.2, 4]} rotation={[0, 0.4, 0]}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        ref={materialRef}
        size={0.02}
        transparent
        opacity={0.65}
        color="#63e6ff"
        depthWrite={false}
      />
    </points>
  );
}

function Ribbon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.TorusKnotGeometry(0.5, 0.12, 80, 12), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.6;
    meshRef.current.rotation.y = Math.cos(t * 0.3) * 0.6;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, -0.2, 0]}>
      <meshStandardMaterial
        color="#ff6a3d"
        metalness={0.25}
        roughness={0.3}
        emissive="#ff6a3d"
        emissiveIntensity={0.65}
      />
    </mesh>
  );
}

function GlowingOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      const scale = 1 + Math.sin(t * 0.8) * 0.06;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.3, -0.4]}>
      <sphereGeometry args={[0.6, 32, 32]} />
      <meshStandardMaterial emissive="#63e6ff" emissiveIntensity={1.2} color="#102030" transparent opacity={0.85} />
    </mesh>
  );
}

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }}>
        <color attach="background" args={["#050910"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 3, 4]} intensity={0.9} color="#63e6ff" />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#ff6a3d" />
        <Suspense fallback={null}>
          <Ribbon />
          <GlowingOrb />
          <FloatingParticles />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b0f1480] to-[#0b0f14]" />
    </div>
  );
}

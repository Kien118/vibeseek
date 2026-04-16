'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { DepthOfField, Bloom, EffectComposer } from '@react-three/postprocessing'
import { Float, Html } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import PrismModel from '@/components/3d/PrismModel'
import CrystalCluster from '@/components/3d/CrystalCluster'
import SceneLoader from '@/components/3d/SceneLoader'

type ScenePhase = 'landing' | 'transition'

interface LoginSceneCanvasProps {
  phase: ScenePhase
  onTransitionComplete: () => void
}

function SceneRig({ phase, onTransitionComplete }: LoginSceneCanvasProps) {
  const prismGroupRef = useRef<THREE.Group>(null)
  const crystalGroupRef = useRef<THREE.Group>(null)
  const floatingPrismRef = useRef<THREE.Group>(null)
  const lookAtTarget = useMemo(() => new THREE.Vector3(0, 0.35, 0), [])
  const hasAnimated = useRef(false)
  const { camera } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera

  useEffect(() => {
    perspectiveCamera.position.set(0, 0.6, 8)
    perspectiveCamera.fov = 42
    perspectiveCamera.updateProjectionMatrix()
  }, [perspectiveCamera])

  useEffect(() => {
    if (phase !== 'transition' || hasAnimated.current) return

    hasAnimated.current = true
    const prismGroup = prismGroupRef.current
    const crystalGroup = crystalGroupRef.current
    if (!prismGroup || !crystalGroup) return

    const timeline = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: onTransitionComplete,
    })

    timeline.to(
      crystalGroup.position,
      {
        z: -22,
        duration: 1.2,
      },
      0
    )

    timeline.to(
      lookAtTarget,
      {
        z: -8,
        y: 0.2,
        duration: 2.4,
      },
      0
    )

    timeline.to(
      perspectiveCamera.position,
      {
        z: 0.8,
        y: 0.25,
        duration: 1.6,
      },
      0.2
    )

    timeline.to(
      prismGroup.scale,
      {
        x: 1.4,
        y: 1.4,
        z: 1.4,
        duration: 1.4,
      },
      0.2
    )

    timeline.to(
      perspectiveCamera.position,
      {
        z: -7.8,
        duration: 1.35,
        ease: 'power4.in',
      },
      1.35
    )

    return () => {
      timeline.kill()
    }
  }, [phase, lookAtTarget, onTransitionComplete, perspectiveCamera])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    const prismGroup = prismGroupRef.current
    const floatingPrism = floatingPrismRef.current

    if (prismGroup) {
      prismGroup.rotation.y += 0.0025
      if (phase === 'landing') prismGroup.rotation.x = Math.sin(elapsed * 0.4) * 0.06
    }

    if (floatingPrism) {
      floatingPrism.position.y = 0.1 + Math.sin(elapsed * 0.8) * 0.08
    }

    perspectiveCamera.lookAt(lookAtTarget)
  })

  return (
    <>
      <color attach="background" args={['#040408']} />
      <fog attach="fog" args={['#040408', 7, 28]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.25} color="#ffffff" />
      <pointLight position={[0, 1.8, 2]} intensity={2.6} color="#a855f7" />
      <pointLight position={[-3, -1, -7]} intensity={1.1} color="#2dd4bf" />

      <group ref={crystalGroupRef} position={[0, -0.8, -14]}>
        <Float speed={0.7} rotationIntensity={0.12} floatIntensity={0.5}>
          <CrystalCluster burst={0.2} focus={0.5} reward={0} crystalZ={0} quizResult="idle" />
        </Float>
      </group>

      <group ref={prismGroupRef} position={[0, -0.8, 0]}>
        <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.45}>
          <group ref={floatingPrismRef}>
            <PrismModel scale={1.12} />
          </group>
        </Float>
      </group>

      <EffectComposer>
        <DepthOfField focusDistance={0.028} focalLength={0.018} bokehScale={2.2} height={620} />
        <Bloom intensity={0.55} mipmapBlur luminanceThreshold={0.12} />
      </EffectComposer>
    </>
  )
}

export default function LoginSceneCanvas({ phase, onTransitionComplete }: LoginSceneCanvasProps) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.6, 8], fov: 42 }}>
      <Suspense
        fallback={
          <Html center>
            <SceneLoader />
          </Html>
        }
      >
        <SceneRig phase={phase} onTransitionComplete={onTransitionComplete} />
      </Suspense>
    </Canvas>
  )
}

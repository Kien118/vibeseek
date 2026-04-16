'use client'

import { MutableRefObject, Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Loader, OrbitControls } from '@react-three/drei'
import { Group, PerspectiveCamera } from 'three'
import PrismModel from '@/components/3d/PrismModel'
import CrystalCluster from '@/components/3d/CrystalCluster'
import { QuizResult, ScrollRigState } from '@/components/3d/types'

interface VibeSceneCanvasProps {
  rigRef: MutableRefObject<ScrollRigState>
  quizResult: QuizResult
}

function SceneContent({ rigRef, quizResult }: VibeSceneCanvasProps) {
  const prismRef = useRef<Group | null>(null)
  const sourceRef = useRef<Group | null>(null)
  const { camera, size } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera

  useFrame((state) => {
    const rig = rigRef.current
    const prism = prismRef.current
    const source = sourceRef.current

    const isMobile = size.width < 768
    perspectiveCamera.fov = isMobile ? 58 : 43
    perspectiveCamera.position.z += (rig.cameraZ - perspectiveCamera.position.z) * 0.08
    perspectiveCamera.position.x += ((rig.focus > 0.6 ? 0.45 : 0) - perspectiveCamera.position.x) * 0.05
    perspectiveCamera.position.y += ((rig.focus > 0.6 ? 0.2 : 0) - perspectiveCamera.position.y) * 0.05
    perspectiveCamera.updateProjectionMatrix()

    if (prism) {
      const elapsed = state.clock.getElapsedTime()
      prism.rotation.y += 0.004 + rig.absorption * 0.013
      prism.rotation.x = Math.sin(elapsed * 0.6) * 0.1 + rig.shake * Math.sin(elapsed * 20) * 0.03
      prism.scale.setScalar(1 + rig.glow * 0.22)
    }

    if (source) {
      source.visible = rig.progress > 0.1 && rig.progress < 0.32
      source.position.y = 4 - rig.absorption * 5
      source.position.z = 0.6 - rig.absorption * 0.9
      source.rotation.z += 0.02
    }
  })

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 8, 24]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 2]} intensity={1.15} color="#ffffff" />
      <pointLight position={[0, 0, 2]} intensity={2 + rigRef.current.glow * 7} color="#a855f7" />
      <pointLight position={[-2, 1.5, 1]} intensity={1.4} color="#2dd4bf" />

      <group
        ref={(value) => {
          sourceRef.current = value
        }}
      >
        <mesh>
          <boxGeometry args={[0.55, 0.72, 0.04]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.45} />
        </mesh>
      </group>

      <group
        ref={(value) => {
          prismRef.current = value
        }}
        position={[0, 0, 0]}
      >
        <PrismModel />
      </group>

      <CrystalCluster
        burst={rigRef.current.burst}
        focus={rigRef.current.focus}
        reward={rigRef.current.reward}
        crystalZ={rigRef.current.crystalZ}
        quizResult={quizResult}
      />

      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </>
  )
}

export default function VibeSceneCanvas({ rigRef, quizResult }: VibeSceneCanvasProps) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6.2], fov: 43 }}>
      <Suspense
        fallback={
          <Html center>
            <Loader />
          </Html>
        }
      >
        <SceneContent rigRef={rigRef} quizResult={quizResult} />
      </Suspense>
    </Canvas>
  )
}

'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, ScrollControls } from '@react-three/drei'
import SceneLoader from '@/components/3d/SceneLoader'
import Experience from '@/components/3d/Experience'

export default function LandingSceneCanvas() {
  return (
    <div className="landing-scene-shell">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.18, 1.25, 1.95], fov: 40 }}>
        <Suspense
          fallback={
            <Html center>
              <SceneLoader />
            </Html>
          }
        >
          <ScrollControls pages={3} damping={0.18}>
            <Experience />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  )
}

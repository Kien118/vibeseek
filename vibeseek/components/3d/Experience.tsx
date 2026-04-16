'use client'

import { Scroll, useScroll, Environment } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { useRouter } from 'next/navigation'
import Model from '@/components/3d/Model'

export default function Experience() {
  const scroll = useScroll()
  const { camera, size } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera
  const router = useRouter()

  useFrame(() => {
    const isMobile = size.width < 768
    const progress = scroll.offset

    /**
     * Camera stays relatively stable – the robot GROUP handles
     * scale-down / shift-right / rotation via its own useFrame.
     * Camera only does a gentle pull-back and FOV breath.
     *
     * CLOSE (scroll=0): tight on upper body hero shot
     * FAR   (scroll=1): slight pull-back to give room as robot shrinks right
     */
    const closePosition = isMobile ? [0, 1.2, 2.4] : [0, 1.2, 2.0]
    const farPosition   = isMobile ? [0, 0.8, 3.2] : [0, 0.8, 2.8]
    const closeFov = isMobile ? 50 : 44
    const farFov   = isMobile ? 55 : 48

    // lookAt follows robot vertically: face level to chest level
    const closeLookY = 1.3
    const farLookY   = 0.8
    const lookY = MathUtils.lerp(closeLookY, farLookY, progress)

    const targetX   = MathUtils.lerp(closePosition[0], farPosition[0], progress)
    const targetY   = MathUtils.lerp(closePosition[1], farPosition[1], progress)
    const targetZ   = MathUtils.lerp(closePosition[2], farPosition[2], progress)
    const targetFov = MathUtils.lerp(closeFov, farFov, progress)

    perspectiveCamera.position.x = MathUtils.lerp(perspectiveCamera.position.x, targetX, 0.08)
    perspectiveCamera.position.y = MathUtils.lerp(perspectiveCamera.position.y, targetY, 0.08)
    perspectiveCamera.position.z = MathUtils.lerp(perspectiveCamera.position.z, targetZ, 0.08)
    perspectiveCamera.fov        = MathUtils.lerp(perspectiveCamera.fov, targetFov, 0.08)
    perspectiveCamera.lookAt(0, lookY, 0)
    perspectiveCamera.updateProjectionMatrix()
  })

  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.5} />

      <Scroll>
        <Model />
      </Scroll>

      <Scroll html>
        <div className="landing-overlay">
          <section className="landing-panel landing-hero">
            <p className="landing-kicker">VibeSeek</p>
            <h1>Learning with DOJO.</h1>
            <p>
              Scroll down to move from face focus into a full-body reveal. The Robot reacts subtly to your cursor for
              a cinematic landing experience.
            </p>
          </section>

          <section className="landing-panel landing-features">
            <div>
              <h2>Head Tracking</h2>
              <p>Mouse input maps from -1 to 1, then clamped and smoothed with `MathUtils.lerp`.</p>
            </div>
            <div>
              <h2>Scroll Camera</h2>
              <p>Top state is zoom-in near the face; scrolling transitions to zoom-out for full body framing.</p>
            </div>
            <div>
              <h2>Performance First</h2>
              <p>Use lightweight HDR environment and keep model asset below 5MB when possible.</p>
            </div>
          </section>

          <section className="landing-panel landing-cta">
            <p className="landing-kicker">Ready</p>
            <h2>Build immersive product stories with 3D.</h2>
            <button type="button" onClick={() => router.push('/dashboard')}>Start now</button>
          </section>
        </div>
      </Scroll>
    </>
  )
}

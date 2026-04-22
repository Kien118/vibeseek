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
    // P-513c: raised lookY at top (2.0 vs 1.8) to elevate head in viewport.
    // Pulled camera further back at bottom (z=6.5 vs 5.0) + lookY=-1.5 +
    // fov=70° wider so 1.6× larger bottom model (scale 2.88) still fits.
    const closePosition = isMobile ? [0, 1.8, 2.4] : [0, 1.8, 2.2]
    const farPosition   = isMobile ? [0, 0.2, 8.0] : [0, 0, 11.5]
    const closeFov = isMobile ? 48 : 42
    const farFov   = isMobile ? 72 : 50

    // P-513d: adjusted lookY for new scales (4.2 top / 3.6 bottom).
    // closeLookY 2.0 → 1.5 (head at scale 4.2 world ≈ 1.35, center view on head)
    // farLookY   -1.5 → -2.0 (model bigger, tilt down more to see full body)
    const closeLookY = 1.5
    const farLookY   = -0.5
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
              Ngày xưa có một đứa trẻ tên DOJO sinh ra trong thư viện. Nó đọc ngấu nghiến mọi tài liệu nhưng luôn hỏi lại người khác: "Vậy thì... nghĩa là gì?" Hôm nay, DOJO trở thành robot học trò của bạn — người giúp biến kiến thức thành feed, và biến bạn thành người thầy giỏi nhất của chính mình.
            </p>
          </section>

          <section className="landing-panel landing-features">
            <div>
              <h2>Feynman Reverse</h2>
              <p>Đảo vai giữa thầy và trò — bạn dạy lại cho Bé DOJO (AI 10 tuổi). Càng giải thích đơn giản, càng chứng minh bạn đã thực sự hiểu.</p>
            </div>
            <div>
              <h2>Vibefy Engine</h2>
              <p>Thả PDF 300 trang vào — nhận lại feed 45 giây/card kiểu TikTok. AI tự băm nhỏ, giữ lại tinh túy, bỏ đi nhàm chán.</p>
            </div>
            <div>
              <h2>Learn-to-Earnt</h2>
              <p>Mỗi bài học là một VibePoint thực. Streak 7 ngày đổi voucher, master 1 chương mở Badge. Học không còn là nghĩa vụ. Tri thức có giá.</p>
            </div>
          </section>

          <section className="landing-panel landing-cta">
            <p className="landing-kicker">Sẵn sàng học cùng DOJO chưa?</p>
            <h2>Upload PDF đầu tiên — feed học tập của bạn sẽ có trong 10 giây.</h2>
            <button type="button" onClick={() => router.push('/dashboard')}>Start now ✦</button>
          </section>
        </div>
      </Scroll>
    </>
  )
}

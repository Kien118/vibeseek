"use client";

/**
 * VibeSeek · ScrollBurst
 * ----------------------------------------------------------
 * Background animation lấp đầy CTA section ở cuối landing page.
 * Items stationery (pencil, book, sticky notes, ...) bắt đầu ẨN
 * ở đầu trang, và "bung ra" khi user scroll đến gần cuối.
 *
 * CÁCH DÙNG:
 * 1. Mount trong landing page layout:
 *    <ScrollBurst />
 *    {children}
 *
 * 2. Đảm bảo content có z-index cao hơn:
 *    <section className="relative z-10">...</section>
 *
 * 3. Tinh chỉnh burst timing qua props:
 *    <ScrollBurst burstStart={0.6} burstEnd={0.92} />
 *
 * PERFORMANCE:
 * - Dùng requestAnimationFrame + passive scroll listener
 * - will-change: transform, opacity
 * - Respect prefers-reduced-motion
 * - Mobile tự ẩn items phụ (clip, star, ruler)
 */

import { useEffect, useRef } from "react";

interface ScrollBurstProps {
  /** Scroll progress (0-1) khi bắt đầu burst. Default 0.6 */
  burstStart?: number;
  /** Scroll progress (0-1) khi burst hoàn tất. Default 0.92 */
  burstEnd?: number;
  /** Hiện meter debug ở góc (chỉ dùng lúc dev). Default false */
  showDebugMeter?: boolean;
}

export default function ScrollBurst({
  burstStart = 0.6,
  burstEnd = 0.92,
  showDebugMeter = false,
}: ScrollBurstProps) {
  const bgRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;

    const items = Array.from(bg.querySelectorAll<HTMLElement>(".float-item"));
    if (items.length === 0) return;

    // Check reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // Hiển thị items ở vị trí cuối luôn, không animate
      items.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    // Setup stagger data cho mỗi item
    const itemData = items.map((el, i) => ({
      el,
      staggerDelay: (i / items.length) * 0.3,
      initialRotation: Math.random() * 40 - 20,
      parallaxSpeed: 0.1 + Math.random() * 0.2,
      parallaxRot: (Math.random() - 0.5) * 0.05,
    }));

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let ticking = false;

    const updateBurst = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollY / docHeight, 1) : 0;

      // Burst factor: 0 (ẩn) → 1 (full)
      let burstFactor: number;
      if (progress < burstStart) {
        burstFactor = 0;
      } else if (progress > burstEnd) {
        burstFactor = 1;
      } else {
        burstFactor = (progress - burstStart) / (burstEnd - burstStart);
      }

      // Update debug meter
      if (meterRef.current && progressRef.current) {
        const pct = Math.round(burstFactor * 100);
        progressRef.current.textContent = `${pct}%`;
        meterRef.current.classList.toggle("active", burstFactor > 0);
      }

      // Toggle aurora ambient
      bg.classList.toggle("burst-active", burstFactor > 0.1);

      // Animate từng item với stagger
      itemData.forEach(({ el, staggerDelay, initialRotation, parallaxSpeed, parallaxRot }) => {
        let itemBurst = (burstFactor - staggerDelay) / (1 - staggerDelay);
        itemBurst = Math.max(0, Math.min(1, itemBurst));
        const eased = easeOutCubic(itemBurst);

        const scale = 0.3 + eased * 0.7;
        const opacity = eased;
        const rotation = initialRotation * (1 - eased);
        const offsetX = -80 * (1 - eased);
        const offsetY = 80 * (1 - eased);

        // Parallax drift sau khi burst
        const extraY = burstFactor >= 1 ? (scrollY - docHeight * burstEnd) * parallaxSpeed : 0;
        const extraRot = burstFactor >= 1 ? (scrollY - docHeight * burstEnd) * parallaxRot : 0;

        el.style.transform = `translate(${offsetX}px, ${offsetY - extraY}px) scale(${scale}) rotate(${
          rotation + extraRot
        }deg)`;
        el.style.opacity = String(opacity);
      });

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateBurst);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    updateBurst(); // initial

    return () => window.removeEventListener("scroll", onScroll);
  }, [burstStart, burstEnd]);

  return (
    <>
      <div ref={bgRef} className="scroll-burst-bg" aria-hidden="true">
        {/* PENCIL */}
        <svg className="float-item item-pencil" viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-25 100 250)">
            <rect x="80" y="60" width="40" height="360" fill="#F5B83E" stroke="#17140F" strokeWidth="2" />
            <rect x="80" y="60" width="40" height="30" fill="#D96C4F" />
            <rect x="80" y="90" width="40" height="8" fill="#17140F" />
            <rect x="80" y="105" width="40" height="8" fill="#F5EFE4" />
            <rect x="80" y="120" width="40" height="8" fill="#17140F" />
            <polygon points="80,420 120,420 100,460" fill="#F5EFE4" stroke="#17140F" strokeWidth="2" />
            <polygon points="85,445 115,445 100,462" fill="#17140F" />
            <rect x="78" y="50" width="44" height="12" fill="#9A928A" stroke="#17140F" strokeWidth="2" />
          </g>
        </svg>

        {/* BOOK */}
        <svg className="float-item item-book" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-8 100 75)">
            <path d="M 10 20 L 10 130 Q 50 115 95 120 L 95 20 Q 50 10 10 20 Z" fill="#F5EFE4" stroke="#17140F" strokeWidth="2" />
            <path d="M 105 20 Q 150 10 190 20 L 190 130 Q 150 115 105 120 Z" fill="#F5EFE4" stroke="#17140F" strokeWidth="2" />
            <line x1="100" y1="20" x2="100" y2="120" stroke="#17140F" strokeWidth="2" />
            <line x1="25" y1="40" x2="85" y2="42" stroke="#5B89B0" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="25" y1="55" x2="80" y2="56" stroke="#9A928A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="25" y1="70" x2="85" y2="71" stroke="#9A928A" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="22" y="50" width="60" height="9" fill="#F5B83E" opacity="0.4" />
            <line x1="115" y1="42" x2="175" y2="40" stroke="#9A928A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="115" y1="57" x2="180" y2="56" stroke="#9A928A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="115" y1="72" x2="170" y2="71" stroke="#9A928A" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>

        {/* ERASER */}
        <svg className="float-item item-eraser" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(15 50 40)">
            <rect x="10" y="15" width="80" height="50" rx="4" fill="#D96C4F" stroke="#17140F" strokeWidth="2" />
            <rect x="10" y="15" width="80" height="18" rx="4" fill="#E89478" stroke="#17140F" strokeWidth="2" />
            <text x="50" y="50" textAnchor="middle" fontFamily="monospace" fontSize="10" fontWeight="700" fill="#17140F">
              DOJO
            </text>
          </g>
        </svg>

        {/* STICKY 1 · Sunflower */}
        <svg className="float-item item-sticky-1" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-6 75 75)">
            <rect x="12" y="18" width="130" height="125" fill="#17140F" opacity="0.3" />
            <rect x="10" y="15" width="130" height="125" fill="#F5B83E" />
            <polygon points="115,125 140,140 140,125" fill="#C48920" />
            <text x="25" y="50" fontFamily="Patrick Hand, cursive" fontSize="20" fill="#17140F">Feynman</text>
            <text x="25" y="75" fontFamily="Patrick Hand, cursive" fontSize="20" fill="#17140F">= dạy lại</text>
            <text x="25" y="105" fontFamily="Patrick Hand, cursive" fontSize="20" fill="#17140F">để hiểu</text>
            <path d="M 25 112 Q 50 108 80 110" stroke="#D96C4F" strokeWidth="2" fill="none" />
          </g>
        </svg>

        {/* STICKY 2 · Sage */}
        <svg className="float-item item-sticky-2" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(8 65 65)">
            <rect x="12" y="18" width="110" height="105" fill="#17140F" opacity="0.3" />
            <rect x="10" y="15" width="110" height="105" fill="#7A9B7E" />
            <polygon points="98,105 120,120 120,105" fill="#5A7C5E" />
            <text x="22" y="45" fontFamily="Patrick Hand, cursive" fontSize="18" fill="#F5EFE4">+40 XP</text>
            <text x="22" y="75" fontFamily="Patrick Hand, cursive" fontSize="14" fill="#F5EFE4">streak 12 ✨</text>
            <path d="M 22 85 L 40 82 L 38 90 L 50 87" stroke="#F5EFE4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        </svg>

        {/* HIGHLIGHTER */}
        <svg className="float-item item-highlighter" viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-30 50 100)">
            <rect x="30" y="20" width="40" height="60" fill="#F5B83E" stroke="#17140F" strokeWidth="2" />
            <rect x="30" y="80" width="40" height="80" fill="#F5EFE4" stroke="#17140F" strokeWidth="2" />
            <polygon points="30,160 70,160 60,190 40,190" fill="#F5B83E" stroke="#17140F" strokeWidth="2" />
            <text x="50" y="55" textAnchor="middle" fontFamily="monospace" fontSize="10" fontWeight="700" fill="#17140F">HI!</text>
          </g>
        </svg>

        {/* CLIP 1 */}
        <svg className="float-item item-clip-1" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(25 30 40)">
            <path d="M 20 10 L 20 60 Q 20 70 30 70 Q 40 70 40 60 L 40 20 Q 40 12 32 12 Q 26 12 26 20 L 26 55"
              fill="none" stroke="#9A928A" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>

        {/* CLIP 2 */}
        <svg className="float-item item-clip-2" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-40 30 40)">
            <path d="M 20 10 L 20 60 Q 20 70 30 70 Q 40 70 40 60 L 40 20 Q 40 12 32 12 Q 26 12 26 20 L 26 55"
              fill="none" stroke="#5B89B0" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>

        {/* STARS */}
        <svg className="float-item item-star-1" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4 L24 16 L36 18 L27 26 L30 38 L20 31 L10 38 L13 26 L4 18 L16 16 Z" fill="#F5B83E" stroke="#17140F" strokeWidth="1.5" />
        </svg>
        <svg className="float-item item-star-2" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4 L24 16 L36 18 L27 26 L30 38 L20 31 L10 38 L13 26 L4 18 L16 16 Z" fill="#D96C4F" stroke="#17140F" strokeWidth="1.5" />
        </svg>
        <svg className="float-item item-star-3" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4 L24 16 L36 18 L27 26 L30 38 L20 31 L10 38 L13 26 L4 18 L16 16 Z" fill="#5B89B0" stroke="#17140F" strokeWidth="1.5" />
        </svg>

        {/* RULER */}
        <svg className="float-item item-ruler" viewBox="0 0 250 50" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(8 125 25)">
            <rect x="10" y="15" width="230" height="25" fill="#E8DFC9" stroke="#17140F" strokeWidth="2" />
            <g stroke="#17140F" strokeWidth="1.5">
              <line x1="25" y1="15" x2="25" y2="25" />
              <line x1="45" y1="15" x2="45" y2="22" />
              <line x1="65" y1="15" x2="65" y2="22" />
              <line x1="85" y1="15" x2="85" y2="22" />
              <line x1="105" y1="15" x2="105" y2="25" />
              <line x1="125" y1="15" x2="125" y2="22" />
              <line x1="145" y1="15" x2="145" y2="22" />
              <line x1="165" y1="15" x2="165" y2="22" />
              <line x1="185" y1="15" x2="185" y2="25" />
            </g>
            <text x="22" y="36" fontFamily="monospace" fontSize="8" fill="#17140F">0</text>
            <text x="102" y="36" fontFamily="monospace" fontSize="8" fill="#17140F">5</text>
            <text x="180" y="36" fontFamily="monospace" fontSize="8" fill="#17140F">10</text>
          </g>
        </svg>
      </div>

      {/* Debug meter — chỉ hiện khi showDebugMeter=true */}
      {showDebugMeter && (
        <div ref={meterRef} className="burst-meter">
          <span className="burst-meter-dot" />
          <span>
            BURST <span ref={progressRef} className="burst-meter-progress">0%</span>
          </span>
        </div>
      )}
    </>
  );
}

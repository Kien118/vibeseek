"use client";

/**
 * VibeSeek · Animated Cursor
 * ----------------------------------------------------------
 * Custom cursor bằng JS — hỗ trợ animation (nháy mắt, spin, v.v.)
 * mà SVG cursor thuần CSS không làm được.
 *
 * Auto-detect cursor type dựa vào element user hover:
 * - button, a              → pointer (Spark Star xoay)
 * - input, textarea        → text (Pencil nghiêng)
 * - .draggable             → grab (Hand open)
 * - .feynman-mode          → bevibe (Bé Vibe nháy mắt)
 * - .highlight-mode        → highlighter
 * - .zoomable              → zoom (Magnifier pulse)
 * - disabled               → disabled (Ghost)
 * - body.loading           → loading (Spinner)
 */

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

type CursorVariant =
  | "default"
  | "pointer"
  | "text"
  | "grab"
  | "grabbing"
  | "bevibe"
  | "highlight"
  | "zoom"
  | "disabled"
  | "loading";

export default function AnimatedCursor() {
  const [variant, setVariant] = useState<CursorVariant>("default");
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Motion values cho vị trí cursor — dùng spring để mượt
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const springX = useSpring(mouseX, { damping: 25, stiffness: 300, mass: 0.5 });
  const springY = useSpring(mouseY, { damping: 25, stiffness: 300, mass: 0.5 });

  // Detect touch device lần đầu mount
  useEffect(() => {
    const isTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(isTouch);
  }, []);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (isTouchDevice) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    // Ẩn native cursor
    document.body.style.cursor = "none";

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);

      // Detect variant dựa vào element dưới cursor
      const target = e.target as HTMLElement;
      if (!target) return;

      // Loading state — kiểm tra trước
      if (document.body.classList.contains("loading")) {
        setVariant("loading");
        return;
      }

      // Check context zones
      if (target.closest(".feynman-mode")) {
        setVariant("bevibe");
        return;
      }
      if (target.closest(".highlight-mode")) {
        setVariant("highlight");
        return;
      }

      // Check element type
      if (target.matches(":disabled, [aria-disabled='true'], .locked, .disabled")) {
        setVariant("disabled");
      } else if (target.matches("input, textarea, [contenteditable='true']") || target.closest("input, textarea, [contenteditable='true']")) {
        setVariant("text");
      } else if (target.matches(".zoomable, img.zoomable") || target.closest(".zoomable")) {
        setVariant("zoom");
      } else if (target.matches(".dragging") || target.closest(".dragging")) {
        setVariant("grabbing");
      } else if (target.matches(".draggable, .grab") || target.closest(".draggable, .grab")) {
        setVariant("grab");
      } else if (target.matches("button, a, [role='button']") || target.closest("button, a, [role='button']")) {
        setVariant("pointer");
      } else {
        setVariant("default");
      }
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseDown = () => {
      if (variant === "grab") setVariant("grabbing");
    };
    const handleMouseUp = () => {
      if (variant === "grabbing") setVariant("grab");
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    document.body.addEventListener("mouseenter", handleMouseEnter);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      document.body.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mouseX, mouseY, isVisible, variant, isTouchDevice]);

  // Don't render on touch devices
  if (isTouchDevice) return null;

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[9999]"
      style={{
        x: springX,
        y: springY,
        opacity: isVisible ? 1 : 0,
      }}
      transition={{ opacity: { duration: 0.2 } }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={variant}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <CursorShape variant={variant} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function CursorShape({ variant }: { variant: CursorVariant }) {
  switch (variant) {
    case "pointer":
      return (
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="16" cy="16" r="12" fill="#F5B83E" opacity="0.2" />
          <path
            d="M16 6 L17.8 13.2 L25 14 L17.8 15.8 L16 23 L14.2 15.8 L7 14 L14.2 13.2 Z"
            fill="#F5B83E"
            stroke="#17140F"
            strokeWidth="1"
          />
        </motion.svg>
      );

    case "text":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32">
          <g transform="rotate(-45 16 16)">
            <rect x="14" y="6" width="4" height="18" fill="#F5B83E" stroke="#17140F" strokeWidth="1" />
            <polygon points="14,24 18,24 16,28" fill="#17140F" />
            <rect x="14" y="6" width="4" height="3" fill="#D96C4F" />
            <motion.circle
              cx="16"
              cy="28"
              r="1.5"
              fill="#F5B83E"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </g>
        </svg>
      );

    case "grab":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32">
          <path
            d="M10 14 Q10 8 13 8 Q16 8 16 12 L16 10 Q16 6 19 6 Q22 6 22 10 L22 12 Q22 8 25 8 Q28 8 28 14 L28 22 Q28 28 22 28 L14 28 Q8 28 8 22 L8 18 Q8 15 10 15 Z"
            fill="#F5EFE4"
            stroke="#17140F"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "grabbing":
      return (
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          animate={{ scale: [1, 0.95, 1] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <path
            d="M8 18 Q8 12 14 12 L22 12 Q28 12 28 18 L28 22 Q28 28 22 28 L14 28 Q8 28 8 22 Z"
            fill="#F5B83E"
            stroke="#17140F"
            strokeWidth="1.5"
          />
          <line x1="12" y1="18" x2="24" y2="18" stroke="#17140F" strokeWidth="1" />
        </motion.svg>
      );

    case "bevibe":
      return (
        <motion.svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="18" cy="18" r="13" fill="#D96C4F" stroke="#17140F" strokeWidth="1.5" />
          <motion.ellipse
            cx="14"
            cy="16"
            rx="1.5"
            ry="1.5"
            fill="#17140F"
            animate={{ ry: [1.5, 0.2, 1.5] }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
          />
          <motion.ellipse
            cx="22"
            cy="16"
            rx="1.5"
            ry="1.5"
            fill="#17140F"
            animate={{ ry: [1.5, 0.2, 1.5] }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
          />
          <path
            d="M13 22 Q18 20 23 22"
            fill="none"
            stroke="#17140F"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </motion.svg>
      );

    case "highlight":
      return (
        <svg width="36" height="36" viewBox="0 0 36 36">
          <g transform="rotate(-30 18 18)">
            <rect x="10" y="6" width="16" height="8" fill="#F5B83E" stroke="#17140F" strokeWidth="1.2" />
            <rect x="10" y="14" width="16" height="10" fill="#E8DFC9" stroke="#17140F" strokeWidth="1.2" />
            <polygon points="10,24 26,24 22,30 14,30" fill="#F5B83E" stroke="#17140F" strokeWidth="1.2" />
          </g>
        </svg>
      );

    case "zoom":
      return (
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="13" cy="13" r="8" fill="none" stroke="#F5EFE4" strokeWidth="2.5" />
          <circle cx="13" cy="13" r="5" fill="#5B89B0" opacity="0.3" />
          <line x1="19" y1="19" x2="27" y2="27" stroke="#F5EFE4" strokeWidth="2.5" strokeLinecap="round" />
        </motion.svg>
      );

    case "disabled":
      return (
        <motion.svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          animate={{ rotate: [0, -3, 3, 0] }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <circle cx="14" cy="14" r="11" fill="none" stroke="#9A928A" strokeWidth="2" />
          <line x1="7" y1="7" x2="21" y2="21" stroke="#9A928A" strokeWidth="2" />
        </motion.svg>
      );

    case "loading":
      return (
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="16" cy="16" r="10" fill="none" stroke="#9A928A" strokeWidth="2" opacity="0.3" />
          <path
            d="M16 6 A10 10 0 0 1 26 16"
            fill="none"
            stroke="#F5B83E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </motion.svg>
      );

    case "default":
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" fill="#F5EFE4" stroke="#17140F" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.5" fill="#17140F" />
        </svg>
      );
  }
}

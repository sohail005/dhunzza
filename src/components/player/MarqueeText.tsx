"use client";

import { useEffect, useRef, useState } from "react";

const PIXELS_PER_SECOND = 40;
const GAP_PX = 48;

/**
 * Scrolls its text infinitely, left-to-right loop, only when the text is
 * wider than its container — short titles stay static like plain text.
 * Renders a second copy of the text offset by the measured width + gap so
 * the loop is seamless: once the animation has translated exactly that far,
 * the second copy sits where the first started.
 */
export default function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    function measure() {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const overflowing = textEl.scrollWidth > container.clientWidth;
      setIsOverflowing(overflowing);
      if (overflowing) {
        const travel = textEl.scrollWidth + GAP_PX;
        setDistance(travel);
        setDuration(travel / PIXELS_PER_SECOND);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div
        className={`flex w-max ${isOverflowing ? "animate-marquee" : ""}`}
        style={
          isOverflowing
            ? ({
                gap: `${GAP_PX}px`,
                animationDuration: `${duration}s`,
                "--marquee-distance": `-${distance}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <span ref={textRef} className="whitespace-nowrap">
          {text}
        </span>
        {isOverflowing && (
          <span className="whitespace-nowrap" aria-hidden="true">
            {text}
          </span>
        )}
      </div>
    </div>
  );
}

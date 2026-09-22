"use client";

import { useEffect, useState } from "react";

interface CrossfadeImageProps {
  /** Remote URL to fade in once loaded on >=sm viewports. `null` means "stay on desktopFallbackSrc". */
  desktopTargetSrc: string | null;
  /** Remote URL to fade in once loaded on <sm viewports. `null` means "stay on mobileFallbackSrc". */
  mobileTargetSrc: string | null;
  desktopFallbackSrc: string;
  mobileFallbackSrc: string;
  alt: string;
  className?: string;
}

function usePreloadedSrc(targetSrc: string | null, currentSrc: string) {
  const [src, setSrc] = useState(currentSrc);

  useEffect(() => {
    if (!targetSrc || targetSrc === src) return;
    let cancelled = false;
    const preload = new window.Image();
    preload.src = targetSrc;
    preload.onload = () => {
      if (!cancelled) setSrc(targetSrc);
    };
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target changes, not on every src swap
  }, [targetSrc]);

  return src;
}

/**
 * Renders a single responsive <picture> so only one background image is
 * fetched per breakpoint (a fixed pair of desktop/mobile <img>s would have
 * the browser download both, since `hidden`/`sm:hidden` only affects paint,
 * not the network request). Each variant fades in via a small preload once
 * its remote, dynamically-seeded target has loaded — avoids a flash of a
 * broken/half-loaded image.
 */
export default function CrossfadeImage({
  desktopTargetSrc,
  mobileTargetSrc,
  desktopFallbackSrc,
  mobileFallbackSrc,
  alt,
  className = "",
}: CrossfadeImageProps) {
  const desktopSrc = usePreloadedSrc(desktopTargetSrc, desktopFallbackSrc);
  const mobileSrc = usePreloadedSrc(mobileTargetSrc, mobileFallbackSrc);

  return (
    // key restarts the Ken Burns animation fresh whenever either variant swaps in.
    <picture key={`${desktopSrc}|${mobileSrc}`} className={`block ${className}`}>
      <source media="(min-width: 640px)" srcSet={desktopSrc} />
      {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-seeded URL; not a static/optimizable asset */}
      <img
        src={mobileSrc}
        alt={alt}
        className="animate-ken-burns h-full w-full object-cover transition-opacity duration-700"
      />
    </picture>
  );
}

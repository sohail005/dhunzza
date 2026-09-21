"use client";

import { useEffect, useState } from "react";

interface CrossfadeImageProps {
  /** Remote URL to fade in once loaded. `null` means "stay on fallbackSrc". */
  targetSrc: string | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
}

/**
 * Shows `fallbackSrc` until `targetSrc` has fully loaded in the background,
 * then swaps to it — avoids a flash of a broken/half-loaded image when
 * pulling backgrounds from a remote source.
 */
export default function CrossfadeImage({
  targetSrc,
  fallbackSrc,
  alt,
  className = "",
}: CrossfadeImageProps) {
  const [displaySrc, setDisplaySrc] = useState(fallbackSrc);

  useEffect(() => {
    if (!targetSrc || targetSrc === displaySrc) return;
    let cancelled = false;
    const preload = new window.Image();
    preload.src = targetSrc;
    preload.onload = () => {
      if (!cancelled) setDisplaySrc(targetSrc);
    };
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target changes, not on every displaySrc swap
  }, [targetSrc]);

  return (
    // key={displaySrc} restarts the Ken Burns animation fresh for every new image.
    // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-seeded URL; not a static/optimizable asset
    <img
      key={displaySrc}
      src={displaySrc}
      alt={alt}
      className={`animate-ken-burns transition-opacity duration-700 ${className}`}
    />
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useRadio } from "@/hooks/useRadio";
import { useEraBackground } from "@/hooks/useEraBackground";
import { useEraPhoto } from "@/hooks/useEraPhoto";

const SONG_CHANGE_DURATION_MS = 900;
const ERA_CHANGE_DURATION_MS = 1400;

// Fades the incoming layer in imperatively (no React state) — it's a pure
// DOM/CSS concern, and driving it through setState would trigger an extra
// render for every crossfade.
function FadeInLayer({
  layerKey,
  durationMs,
  className,
  style,
}: {
  layerKey: string;
  durationMs: number;
  className: string;
  style: React.CSSProperties;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.opacity = "0";
    const frame = requestAnimationFrame(() => {
      node.style.opacity = "1";
    });
    return () => cancelAnimationFrame(frame);
  }, [layerKey]);

  return (
    <div
      ref={nodeRef}
      className={className}
      style={{ ...style, transition: `opacity ${durationMs}ms ease` }}
    />
  );
}

/**
 * Site-wide, era-synced background: fixed behind everything, reacts to
 * both the selected era (major crossfade) and the currently playing song
 * within that era (subtle crossfade). A real photo (fetched from Pixabay
 * via /api/backgrounds, seeded per song) is the base layer; the era's
 * gradient rides on top as a multiply-blended tint so each era still reads
 * as visually distinct. Falls back to the gradient alone if photos haven't
 * loaded yet or are unavailable.
 */
export default function EraBackground() {
  const { currentEra, currentSong } = useRadio();
  const { activeVariant, previousVariant, isEraTransition } = useEraBackground(
    currentEra,
    currentSong
  );
  const duration = isEraTransition ? ERA_CHANGE_DURATION_MS : SONG_CHANGE_DURATION_MS;
  const photoUrl = useEraPhoto(activeVariant.era, currentSong?.id ?? null);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {photoUrl && (
        <div className="absolute inset-0 opacity-45">
          <FadeInLayer
            layerKey={photoUrl}
            durationMs={duration}
            className="animate-era-bg-drift absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${photoUrl})` }}
          />
        </div>
      )}
      {previousVariant && (
        <div className="absolute inset-0 mix-blend-overlay opacity-70">
          <div className="absolute inset-0" style={{ backgroundImage: previousVariant.gradient }} />
        </div>
      )}
      <div className="absolute inset-0 mix-blend-overlay opacity-70">
        <FadeInLayer
          layerKey={activeVariant.id}
          durationMs={duration}
          className="animate-era-bg-drift absolute inset-0"
          style={{ backgroundImage: activeVariant.gradient }}
        />
      </div>
      <div className="era-bg-grain absolute inset-0 opacity-[0.06]" />
      <div className="absolute inset-0 bg-[#0d0503]/55" />
    </div>
  );
}

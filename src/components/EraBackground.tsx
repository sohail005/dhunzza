"use client";

import { useEffect, useRef } from "react";
import { useRadio } from "@/hooks/useRadio";
import { useEraBackground } from "@/hooks/useEraBackground";
import type { BackgroundVariant } from "@/lib/eraBackgrounds";

const SONG_CHANGE_DURATION_MS = 900;
const ERA_CHANGE_DURATION_MS = 1400;

// Fades the incoming layer in imperatively (no React state) — it's a pure
// DOM/CSS concern, and driving it through setState would trigger an extra
// render for every crossfade.
function IncomingLayer({
  variant,
  durationMs,
}: {
  variant: BackgroundVariant;
  durationMs: number;
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
  }, [variant.id]);

  return (
    <div
      ref={nodeRef}
      className="animate-era-bg-drift absolute inset-0"
      style={{
        backgroundImage: variant.gradient,
        transition: `opacity ${durationMs}ms ease`,
      }}
    />
  );
}

/**
 * Site-wide, era-synced background: fixed behind everything, reacts to
 * both the selected era (major crossfade) and the currently playing song
 * within that era (subtle crossfade). Replaces the old static
 * AmbientBackground.
 */
export default function EraBackground() {
  const { currentEra, currentSong } = useRadio();
  const { activeVariant, previousVariant, isEraTransition } = useEraBackground(
    currentEra,
    currentSong
  );
  const duration = isEraTransition ? ERA_CHANGE_DURATION_MS : SONG_CHANGE_DURATION_MS;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {previousVariant && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: previousVariant.gradient }}
        />
      )}
      <IncomingLayer key={activeVariant.id} variant={activeVariant} durationMs={duration} />
      <div className="era-bg-grain absolute inset-0 opacity-[0.06]" />
      <div className="absolute inset-0 bg-[#0d0503]/45" />
    </div>
  );
}

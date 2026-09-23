"use client";

import { useEffect, useRef, useState } from "react";
import { useRadio } from "@/hooks/useRadio";
import { ERA_BY_ID } from "@/lib/eras";
import { pickBackground } from "@/lib/eraBackgrounds";

const SOUND_SRC = "/timetravelsound.mp3";
const SOUND_VOLUME = 0.2;
const VIDEO_SRC = "/timetravelview.mp4";

// Odometer-style roll from the era just left to the era arrived at — starts
// fast and eases down gradually (rather than settling quickly), continuing
// for most of the transition so it reads as decelerating alongside it
// instead of finishing early and just sitting there.
const YEAR_ROLL_DURATION_MS = 4000;
const YEAR_ROLL_TICK_MS = 40;

function eraYear(eraId: string): number {
  return parseInt(eraId, 10);
}

/**
 * Full-screen "traveling through time" portal, shown for the duration of
 * PlayerContext's travelToEra() transition. Purely presentational — the
 * actual era/queue swap is driven by PlayerContext on its own timer; this
 * just needs to stay mounted for roughly the same window.
 */
export default function TimeTravelOverlay() {
  const { isTraveling, travelingToEra, currentEra } = useRadio();
  const [mounted, setMounted] = useState(false);
  const [rollingYear, setRollingYear] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isTraveling) return;
    Promise.resolve().then(() => setMounted(true));

    // Stop any previous clip (rapid era switches) rather than layering
    // sounds, but otherwise let this one play out past the 6s visual
    // transition — it's ~8s and trailing off after the reveal is the point.
    audioRef.current?.pause();
    const audio = new Audio(SOUND_SRC);
    audio.volume = SOUND_VOLUME;
    audio.play().catch(() => {
      // Autoplay can be blocked before the user has interacted with the
      // page at all — the visual transition still runs fine without it.
    });
    audioRef.current = audio;
  }, [isTraveling]);

  useEffect(() => {
    if (!isTraveling || !travelingToEra) return;

    // Snapshot the era being left the moment the transition starts — this
    // must NOT react to `currentEra` changing later, since PlayerContext
    // only updates it right at the end of the transition (which would
    // otherwise yank the roll's start point out from under it mid-animation).
    const toYear = eraYear(travelingToEra);
    const fromYear = currentEra ? eraYear(currentEra) : toYear;
    const totalSteps = Math.max(1, Math.round(YEAR_ROLL_DURATION_MS / YEAR_ROLL_TICK_MS));
    let step = 0;

    Promise.resolve().then(() => setRollingYear(fromYear));

    const interval = window.setInterval(() => {
      step += 1;
      const progress = Math.min(step / totalSteps, 1);
      const eased = 1 - Math.pow(1 - progress, 2); // ease-out quad — gentler tail than cubic, keeps visibly ticking down/up most of the way instead of freezing early
      setRollingYear(Math.round(fromYear + (toYear - fromYear) * eased));
      if (progress >= 1) window.clearInterval(interval);
    }, YEAR_ROLL_TICK_MS);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes `currentEra`; see comment above
  }, [isTraveling, travelingToEra]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup; reading .current here (not capturing it earlier) is intentional and correct
      videoRef.current?.pause();
    };
  }, []);

  if (!mounted) return null;

  const era = travelingToEra ? ERA_BY_ID[travelingToEra] : null;
  const accent = travelingToEra ? pickBackground(travelingToEra, null, travelingToEra).accent : "#f1a603";
  const displayLabel = rollingYear !== null ? `${rollingYear}s` : era?.label;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black ${
        isTraveling ? "" : "animate-portal-fade-out"
      }`}
      aria-hidden="true"
      onAnimationEnd={() => {
        if (!isTraveling) setMounted(false);
      }}
    >
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="animate-light-streak absolute inset-0 opacity-50 mix-blend-screen" />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, ${accent}55 0%, transparent 65%)`,
        }}
      />
      <div className="animate-portal-pulse relative flex flex-col items-center gap-3 text-center">
        <span className="text-xs font-semibold tracking-[0.35em] text-white/70 uppercase">
          Traveling through time…
        </span>
        {displayLabel && (
          <span
            className="text-3xl font-bold tracking-wide uppercase tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-5xl"
            style={{ color: accent }}
          >
            → Entering {displayLabel} ←
          </span>
        )}
      </div>
    </div>
  );
}

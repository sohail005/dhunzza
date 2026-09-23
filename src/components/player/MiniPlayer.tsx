"use client";

import { useEffect, useState } from "react";
import { useRadio } from "@/hooks/useRadio";
import { useScrolledPastHero } from "@/hooks/useScrolledPastHero";
import PlayerControls from "@/components/player/PlayerControls";
import { ERA_BY_ID } from "@/lib/eras";

const TRANSITION_MS = 300;

/**
 * Compact "now playing" widget that takes over once the hero (and the full
 * RadioPlayer bar inside it) has scrolled out of view. Animates in/out
 * (fade + slide + scale) instead of snapping, which means it has to stay
 * mounted a beat after `shouldShow` goes false so the exit transition can
 * actually play before it's removed from the DOM.
 */
export default function MiniPlayer() {
  const { currentSong, currentEra, hasTunedIn, isLoading } = useRadio();
  const scrolledPastHero = useScrolledPastHero();

  const hasActivePlayer = hasTunedIn || !!currentSong;
  const shouldShow = hasActivePlayer && scrolledPastHero;

  const [shouldRender, setShouldRender] = useState(shouldShow);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    let raf = 0;
    let timeout = 0;
    Promise.resolve().then(() => {
      if (shouldShow) {
        setShouldRender(true);
        raf = requestAnimationFrame(() => setIsEntered(true));
      } else {
        setIsEntered(false);
        timeout = window.setTimeout(() => setShouldRender(false), TRANSITION_MS);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [shouldShow]);

  if (!shouldRender) return null;

  const title = currentSong?.title ?? "Nothing tuned in yet";

  return (
    // Fixed bottom-right on mobile (own corner, clear of the top toast) —
    // becomes a static item in RootChrome's shared top-right stack at sm+.
    <div
      className={`liquid-glass-card fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex max-w-[min(90vw,20rem)] items-center gap-2 self-start rounded-full py-1.5 pr-2 pl-4 shadow-lg transition-all duration-300 ease-out sm:static sm:bottom-auto sm:z-auto ${
        isEntered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-90 opacity-0"
      }`}
    >
      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white sm:text-sm">
        {currentEra && (
          <span className="mr-1.5 text-accent">{ERA_BY_ID[currentEra].label}</span>
        )}
        {isLoading ? "Tuning in…" : title}
      </p>
      <PlayerControls />
    </div>
  );
}

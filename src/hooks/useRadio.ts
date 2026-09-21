"use client";

import { useContext } from "react";
import { PlayerContext, type PlayerContextValue } from "@/context/PlayerContext";

/**
 * Access the global radio player state and controls. Must be used within
 * <PlayerProvider>, which wraps the app in src/app/layout.tsx.
 */
export function useRadio(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("useRadio must be used within a PlayerProvider");
  }
  return context;
}

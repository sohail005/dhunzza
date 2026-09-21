"use client";

import { useEffect, useState } from "react";

/**
 * True once the user has scrolled past the full-viewport-height hero
 * section. Used to swap the full "now playing" bar for a compact widget.
 */
export function useScrolledPastHero() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function checkScroll() {
      setScrolled(window.scrollY > window.innerHeight * 0.8);
    }
    checkScroll();
    window.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      window.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  return scrolled;
}

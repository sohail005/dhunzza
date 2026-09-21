"use client";

import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle, Heart, Info, Menu, X } from "lucide-react";
import { formatISTClock } from "@/lib/time";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { useRadio } from "@/hooks/useRadio";
import SupportModal from "@/components/SupportModal";
import InstallAppButton from "@/components/InstallAppButton";
import PlaylistSelector from "@/components/PlaylistSelector";
import RadioPlayer from "@/components/player/RadioPlayer";
import CrossfadeImage from "@/components/CrossfadeImage";
import MaskedHeading from "@/components/MaskedHeading";

const DEFAULT_OVERLAY = "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.8) 100%)";
const DEFAULT_DESKTOP_IMAGE = "/images/dhunzza3.webp";
const DEFAULT_MOBILE_IMAGE = "/images/heromobile.webp";

// Hidden below sm — for nav items tucked into the mobile hamburger menu
// instead of sitting in the always-visible top bar.
const GLASS_LINK_DESKTOP_ONLY =
  "liquid-glass hidden sm:inline-flex font-semibold items-center rounded-full px-4 py-1.5 text-white transition";

function useClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setTime(formatISTClock());
    }
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000 * 15);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  return time;
}

export default function Hero() {
  const time = useClock();
  const onlineCount = useOnlineCount();
  const { currentSong } = useRadio();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const bgSeed = currentSong?.id ?? null;
  const desktopBgTarget = bgSeed
    ? `https://picsum.photos/seed/${encodeURIComponent(bgSeed)}/1600/900`
    : null;
  const mobileBgTarget = bgSeed
    ? `https://picsum.photos/seed/${encodeURIComponent(bgSeed)}/900/1600`
    : null;

  return (
    <section className="relative flex min-h-screen w-full flex-col overflow-hidden">
      <CrossfadeImage
        targetSrc={desktopBgTarget}
        fallbackSrc={DEFAULT_DESKTOP_IMAGE}
        alt="Dhunzza — nostalgic Hindi radio"
        className="absolute inset-0 hidden h-full w-full object-cover opacity-60 sm:block"
      />
      <CrossfadeImage
        targetSrc={mobileBgTarget}
        fallbackSrc={DEFAULT_MOBILE_IMAGE}
        alt="Dhunzza — nostalgic Hindi radio"
        className="absolute inset-0 h-full w-full object-cover opacity-60 sm:hidden"
      />
      <div
        className="absolute inset-0"
        style={{ background: DEFAULT_OVERLAY }}
      />

      <div className="relative z-30 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
        <div className="liquid-glass col-start-1 flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1.5 text-xs text-white sm:px-3 sm:text-sm">
          <span className="flex items-center gap-1.5 pl-1.5 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--green)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            </span>
            <span className="tabular-nums">{onlineCount ?? "…"}</span> online
          </span>
        </div>

        <nav className="col-start-2 flex flex-nowrap items-center justify-center gap-1.5 justify-self-center text-xs sm:flex-wrap sm:gap-2 sm:text-sm">
          <a href="#about" className={`${GLASS_LINK_DESKTOP_ONLY} gap-1.5`}>
            <Info size={14} />
            About
          </a>
          <a href="#faq" className={`${GLASS_LINK_DESKTOP_ONLY} gap-1.5`}>
            <HelpCircle size={14} />
            FAQ
          </a>
          <InstallAppButton className={`${GLASS_LINK_DESKTOP_ONLY} gap-1.5`} />
          {/* <PlaylistSelector /> */}
          <button
            type="button"
            onClick={() => setIsSupportOpen(true)}
            className="liquid-glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold whitespace-nowrap text-white transition sm:px-4"
          >
            <Heart size={13} className="fill-current text-red-500" />
            Support us
          </button>
        </nav>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          className="liquid-glass col-start-3 flex h-9 w-9 items-center justify-center justify-self-end rounded-full text-white sm:hidden"
        >
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-20 sm:hidden"
          />
          <div className="liquid-glass absolute inset-x-4 top-20 z-30 flex flex-col gap-1 rounded-2xl p-2 text-sm sm:hidden">
            <a
              href="#about"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-xl px-4 py-2.5 font-semibold text-white transition hover:bg-white/10"
            >
              About
            </a>
            <a
              href="#faq"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-xl px-4 py-2.5 font-semibold text-white transition hover:bg-white/10"
            >
              FAQ
            </a>
            <InstallAppButton
              onInstall={() => setIsMenuOpen(false)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-left font-semibold text-white transition hover:bg-white/10"
            />
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-1 flex-col px-4 text-center sm:mt-30 sm:px-6">
        <div className="liquid-glass-card mx-auto flex flex-col rounded-2xl px-5 py-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none">
          <MaskedHeading
            text="Dhunzza"
            tag="h1"
            mediaType="image"
            src={DEFAULT_DESKTOP_IMAGE}
            reveal="rise"
            trigger="view"
            align="center"
            weight={700}
            lineHeight={1.5}
            brightness={1.8}
            saturation={1.2}
            textScale={0.3}
            className="font-devanagari drop-shadow-lg"
          />
          <p className="mt-4 text-xs tracking-wider text-white/80 sm:text-sm">
            Old songs · Pure desi vibes · Playing all day
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 px-4 pb-8 sm:pb-10">
        <span className="hidden flex-col items-center gap-1.5 text-xs tracking-[0.3em] text-white/90 uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:flex">
          Scroll
          <ChevronDown size={18} className="animate-bounce drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
        </span>
      </div>

      <RadioPlayer />

      {isSupportOpen && (
        <SupportModal onClose={() => setIsSupportOpen(false)} />
      )}
    </section>
  );
}

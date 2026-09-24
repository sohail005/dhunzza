"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle, Heart, Info, MessageCircle, Menu, X } from "lucide-react";
import { formatISTClock } from "@/lib/time";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { useLiveChatUnread } from "@/hooks/useLiveChatUnread";
import SupportModal from "@/components/SupportModal";
import InstallAppButton from "@/components/InstallAppButton";
import RadioPlayer from "@/components/player/RadioPlayer";
import Image from "next/image";
import RecentlyAddedNotification from "@/components/player/RecentlyAddedNotification";

// Pulls in motion/react + chat sub-components — sizable, and not needed
// until someone actually opens Live Chat, so it's kept out of the initial
// JS bundle every visitor otherwise pays for on page load.
const SongRequestChat = dynamic(() => import("@/components/song-request/SongRequestChat"));

const DEFAULT_OVERLAY = "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.8) 100%)";

// Tucked into the mobile hamburger menu instead of sitting in the
// always-visible top bar — below sm, and also whenever data-compact-chrome
// says the full nav wouldn't fit even though we're past sm (see
// header-link-full in globals.css and the compact-detection effect below).
const GLASS_LINK_DESKTOP_ONLY =
  "liquid-glass header-link-full font-semibold items-center rounded-full px-4 py-1.5 text-white transition";

// Mirrors GLASS_LINK_DESKTOP_ONLY's box model (padding/gap/text size) minus
// the responsive show/hide logic — used only inside the invisible
// measurement clone below, which must always render every item to find out
// whether the *full* nav would fit, regardless of what's currently shown.
const MEASURE_LINK = "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold whitespace-nowrap text-sm";

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
  const onlineCount = useOnlineCount();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSongRequestOpen, setIsSongRequestOpen] = useState(false);
  const unreadLiveChatCount = useLiveChatUnread(isSongRequestOpen);
  const headerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const navMeasureRef = useRef<HTMLDivElement>(null);

  // Publishes this header's live height as --header-height (for the fixed
  // "Recently Added"/mini-player stack, see RootChrome.tsx + globals.css)
  // and flags <html data-compact-chrome> whenever the *full* nav (all 5
  // items) wouldn't fit on one line — a tablet-width window, not just a
  // phone. Compact mode then tucks About/FAQ/Add-to-Home-Screen into the
  // same hamburger menu phones use (see header-link-full/header-menu-* in
  // globals.css) instead of letting them wrap onto a second row, and the
  // "Recently Added" toast falls back to the full-width in-flow layout
  // instead of a floating corner card fighting the header for space.
  //
  // The "would it fit" check needs the nav's *unwrapped* width — measuring
  // the real, already-responsive nav would create a feedback loop (hiding
  // items shrinks it, which un-triggers compact mode, which re-shows them,
  // which re-triggers it...). navMeasureRef is an invisible clone that
  // always renders every item on one line so it's immune to that loop.
  useEffect(() => {
    const header = headerRef.current;
    const badge = badgeRef.current;
    const actions = actionsRef.current;
    const measure = navMeasureRef.current;
    if (!header || !badge || !actions || !measure || typeof ResizeObserver === "undefined") return;

    function update() {
      document.documentElement.style.setProperty("--header-height", `${header!.offsetHeight}px`);

      const style = window.getComputedStyle(header!);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const columnGap = parseFloat(style.columnGap || "0");
      const available =
        header!.clientWidth - paddingX - badge!.offsetWidth - actions!.offsetWidth - columnGap * 2;
      const needed = measure!.scrollWidth;
      document.documentElement.dataset.compactChrome = needed > available ? "true" : "false";
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(badge);
    observer.observe(actions);
    observer.observe(measure);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-height");
      delete document.documentElement.dataset.compactChrome;
    };
  }, []);

  return (
    <section className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: DEFAULT_OVERLAY }}
      />

      <div
        ref={headerRef}
        className="relative z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6"
      >
        <div
          ref={badgeRef}
          className="liquid-glass col-start-1 flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1.5 text-xs text-white sm:px-3 sm:text-sm"
        >
          <span className="flex items-center gap-1.5 pl-1.5 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--green)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            </span>
            <span className="tabular-nums">{onlineCount ?? "…"}</span> online
          </span>
        </div>

        {/* Invisible clone of the nav, always laid out on one line — used
            only to measure whether the *real*, responsive nav (below)
            would fit unwrapped. See the compact-detection effect above for
            why this can't just measure the real nav. */}
        <div
          ref={navMeasureRef}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap items-center gap-4"
        >
          <span className={`${MEASURE_LINK} gap-1.5`}>
            <Info size={14} />
            About
          </span>
          <span className={`${MEASURE_LINK} gap-1.5`}>
            <HelpCircle size={14} />
            FAQ
          </span>
          <InstallAppButton className={`${MEASURE_LINK} gap-1.5`} />
          <span className={`${MEASURE_LINK} gap-1.5`}>
            <MessageCircle size={13} />
            Live Chat
          </span>
        </div>

        <nav className="col-start-2 flex flex-nowrap items-center justify-center gap-1.5 justify-self-center text-xs sm:flex-wrap sm:gap-2 sm:text-sm">
          <InstallAppButton className={`${GLASS_LINK_DESKTOP_ONLY} gap-1.5`} />
          <button
            type="button"
            onClick={() => setIsSongRequestOpen(true)}
            className="liquid-glass relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold whitespace-nowrap text-white transition sm:px-4"
          >
            <MessageCircle size={13} />
            Live Chat
            {unreadLiveChatCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadLiveChatCount > 9 ? "9+" : unreadLiveChatCount}
              </span>
            )}
          </button>
        </nav>

        <div
          ref={actionsRef}
          className="col-start-3 flex items-center gap-1.5 justify-self-end text-xs sm:gap-2 sm:text-sm"
        >
          <button
            type="button"
            onClick={() => setIsSupportOpen(true)}
            className="liquid-glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold whitespace-nowrap text-white transition sm:px-4"
          >
            <Heart size={13} className="fill-current text-red-500" />
            Support us
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="liquid-glass header-menu-trigger h-9 w-9 items-center justify-center rounded-full text-white"
          >
            {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
            className="header-menu-backdrop fixed inset-0 z-20"
          />
          <div className="liquid-glass header-menu-panel absolute inset-x-4 top-20 z-30 flex-col gap-1 rounded-2xl p-2 text-sm">
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
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsSongRequestOpen(true);
              }}
              className="relative flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-left font-semibold text-white transition hover:bg-white/10"
            >
              <MessageCircle size={14} className="text-accent" />
              Live Chat
              {unreadLiveChatCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadLiveChatCount > 9 ? "9+" : unreadLiveChatCount}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-1 flex-col px-4 text-center sm:mt-30 sm:px-6">
        <div className="mx-auto max-w-full flex flex-col rounded-2xl px-5 py-4 sm:px-0 sm:py-0">
          <h1 className="mx-auto">
            <Image
              src="/dhunzza.webp"
              alt="Dhunzza"
              width={1254}
              height={1254}
              priority
              sizes="(min-width: 640px) 224px, 160px"
              className="mx-auto h-auto w-40 drop-shadow-lg sm:w-56"
            />
          </h1>
          <p className="mt-4 text-xs tracking-wider text-white/80 sm:text-sm">
            Step Into an Era. Stay for the Music.
          </p>
          <div className="notification-mobile-slot mx-auto mt-4 w-full">
            <RecentlyAddedNotification portalOverlay />
          </div>
        </div>
      </div>

      <RadioPlayer />

      {isSupportOpen && (
        <SupportModal onClose={() => setIsSupportOpen(false)} />
      )}

      {/* Always mounted (visibility toggled via isOpen) so the in-progress
          conversation survives closing and reopening the chat. */}
      <SongRequestChat isOpen={isSongRequestOpen} onClose={() => setIsSongRequestOpen(false)} />
    </section>
  );
}

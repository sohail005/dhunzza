"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EraId, Song } from "@/types/music";
import { subscribeToNewSongs } from "@/lib/firebase/songs";
import { getSongsOnce, upsertSongInCache } from "@/lib/firebase/songsCache";
import { getCachedSongAudio, getCachedSongThumbnail } from "@/lib/firebase/mediaCache";
import { debugLog } from "@/lib/firebase/debugLog";
import NativeAudioPlayer, {
  type NativeAudioPlayerHandle,
} from "@/components/player/NativeAudioPlayer";

const STORAGE_KEYS = {
  song: "dhunzza.current-song",
  queue: "dhunzza.queue",
  era: "dhunzza.current-era",
  volume: "dhunzza.volume",
  tunedIn: "dhunzza.has-tuned-in",
  lastSeenSongAt: "dhunzza.last-seen-song-at",
} as const;

const DEFAULT_VOLUME = 80;
// First-ever visit has no "last seen" bookmark yet, so it falls back to
// surfacing whatever was uploaded within this window instead of the site's
// entire upload history.
const RECENTLY_ADDED_FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

// How long the "traveling through time" portal overlay plays before the
// new era's queue/background actually take over — keep in sync with the
// overlay's own CSS animation duration and timetravelsound.mp3's length
// (~8s) in TimeTravelOverlay.tsx.
const ERA_TRAVEL_DURATION_MS = 4000;

// Guards against getSongsOnce() hanging forever instead of rejecting —
// e.g. a homescreen/PWA webapp getting backgrounded mid-request can suspend
// the network connection without the underlying promise ever settling,
// which would otherwise leave isTraveling stuck true (portal overlay stuck
// on screen) until the page is reloaded.
const ERA_FETCH_TIMEOUT_MS = 10000;

// Once passive auto-advance (song-ended, not a manual skip) has pulled this
// many not-yet-played songs from Realtime Database this "queue session,"
// further auto-advances loop back over the already-played (and thus already
// cached, see mediaCache.ts) subset instead of continuing into fresh,
// never-downloaded songs — bounds worst-case RTDB egress from someone
// leaving the radio running unattended. Manual next()/previous() clicks are
// never capped — an actively engaged listener can still reach the full
// catalog.
const FRESH_AUTOPLAY_LIMIT = 5;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Timed out")), ms);
    }),
  ]);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface PlayerContextValue {
  currentSong: Song | null;
  currentEra: EraId | null;
  isTraveling: boolean;
  travelingToEra: EraId | null;
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  hasTunedIn: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Song[];
  playbackUnavailable: boolean;
  recentlyAdded: Song[];
  newSongNotification: Song[];

  tuneIn: () => void;
  playQueue: (songs: Song[], era?: EraId | null, startIndex?: number) => void;
  travelToEra: (era: EraId) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  playRecentlyAddedSong: (song: Song) => void;
  dismissNewSongNotification: () => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioHandleRef = useRef<NativeAudioPlayerHandle>(null);
  const loadedSongIdRef = useRef<string | null>(null);
  const skipAttemptsRef = useRef(0);
  // Count of passive auto-advances since the current queue was set, and the
  // set of queue indices actually played so far — both reset on every fresh
  // playQueue() call. See FRESH_AUTOPLAY_LIMIT.
  const freshAutoplayCountRef = useRef(0);
  const playedIndicesRef = useRef<Set<number>>(new Set());
  const hasRestoredRef = useRef(false);
  const tabIdRef = useRef<string | null>(null);
  const playbackChannelRef = useRef<BroadcastChannel | null>(null);
  if (tabIdRef.current === null && typeof crypto !== "undefined") {
    tabIdRef.current = crypto.randomUUID();
  }

  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentEra, setCurrentEra] = useState<EraId | null>(null);
  const [isTraveling, setIsTraveling] = useState(false);
  const [travelingToEra, setTravelingToEra] = useState<EraId | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // No async SDK to wait for with a plain <audio> element (unlike the old
  // YouTube IFrame API), so this is true from the start.
  const [isReady] = useState(true);
  const [hasTunedIn, setHasTunedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackUnavailable, setPlaybackUnavailable] = useState(false);
  // Full history of songs uploaded during this session (newest last) — kept
  // around so already-surfaced songs aren't lost once the toast is cleared.
  const [recentlyAdded, setRecentlyAdded] = useState<Song[]>([]);
  // Subset of `recentlyAdded` not yet acknowledged (played or dismissed) —
  // drives the sticky "Recently Added" toast. Newest is last.
  const [newSongNotification, setNewSongNotification] = useState<Song[]>([]);

  const goToIndex = useCallback(
    async (nextQueue: Song[], index: number, autoplay: boolean) => {
      if (nextQueue.length === 0) {
        setCurrentSong(null);
        setIsPlaying(false);
        setPlaybackUnavailable(true);
        return;
      }

      const normalizedIndex = ((index % nextQueue.length) + nextQueue.length) % nextQueue.length;
      const song = nextQueue[normalizedIndex];
      playedIndicesRef.current.add(normalizedIndex);

      // Cut the outgoing song immediately (fading, not a hard stop) —
      // without this, the <audio> element keeps playing its old src for as
      // long as fetchSongAudio() below takes, even though the UI already
      // shows the new song loading.
      audioHandleRef.current?.fadeOutAndPause();

      setCurrentTime(0);
      setDuration(0);
      setPlaybackUnavailable(false);
      setQueueIndex(normalizedIndex);
      setCurrentSong(song);
      loadedSongIdRef.current = song.id;
      setIsPlaying(autoplay);
      setIsLoading(true);

      try {
        const audioSrc = await getCachedSongAudio(song.audioPath);
        // If the user jumped to a different song while this was in
        // flight, don't clobber whatever loaded after it.
        if (loadedSongIdRef.current !== song.id) return;
        audioHandleRef.current?.load(audioSrc, autoplay);
        if (!autoplay) setIsLoading(false);
      } catch {
        if (loadedSongIdRef.current !== song.id) return;
        setIsLoading(false);
        setIsPlaying(false);
        setPlaybackUnavailable(true);
      }
    },
    []
  );

  const playQueue = useCallback(
    (songs: Song[], era: EraId | null = null, startIndex = 0) => {
      freshAutoplayCountRef.current = 0;
      playedIndicesRef.current = new Set();
      setQueue(songs);
      setCurrentEra(era ?? songs[0]?.era ?? null);
      goToIndex(songs, startIndex, true);
    },
    [goToIndex]
  );

  const tuneIn = useCallback(async () => {
    setHasTunedIn(true);
    try {
      const songs = await getSongsOnce();
      if (songs.length === 0) {
        setPlaybackUnavailable(true);
        return;
      }
      playQueue(shuffle(songs));
    } catch {
      setPlaybackUnavailable(true);
    }
  }, [playQueue]);

  // Single choke point for era-switching: plays the portal transition for
  // ERA_TRAVEL_DURATION_MS, then swaps in a shuffled queue of that era's
  // songs so the "arrival" lines up with the overlay fading out.
  const travelToEra = useCallback(
    (era: EraId) => {
      setIsTraveling(true);
      setTravelingToEra(era);
      // Cut playback the instant the portal starts (fading, not a hard
      // stop) — the old era's song shouldn't keep playing under the transition.
      audioHandleRef.current?.fadeOutAndPause();
      setIsPlaying(false);
      (async () => {
        try {
          // Derived from the shared songs cache (already loaded/reused by
          // tune-in, admin, and browse-all) rather than a separate
          // where("era", "==", era) Firestore query — repeat era switches,
          // including re-visiting an era already seen this session, cost
          // zero additional reads once the cache is warm.
          const allSongs = await withTimeout(getSongsOnce(), ERA_FETCH_TIMEOUT_MS);
          const songs = allSongs.filter((song) => song.era === era);
          await new Promise((resolve) => window.setTimeout(resolve, ERA_TRAVEL_DURATION_MS));
          if (songs.length === 0) {
            setCurrentEra(era);
            setPlaybackUnavailable(true);
            return;
          }
          playQueue(shuffle(songs), era);
        } catch {
          setPlaybackUnavailable(true);
        } finally {
          setIsTraveling(false);
          setTravelingToEra(null);
        }
      })();
    },
    [playQueue]
  );

  const play = useCallback(() => {
    if (!currentSong) return;
    if (loadedSongIdRef.current === currentSong.id && !playbackUnavailable) {
      audioHandleRef.current?.play();
      setIsPlaying(true);
    } else {
      goToIndex(queue, queueIndex, true);
    }
  }, [currentSong, playbackUnavailable, goToIndex, queue, queueIndex]);

  const pause = useCallback(() => {
    audioHandleRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    goToIndex(queue, queueIndex + 1, true);
  }, [queue, queueIndex, goToIndex]);

  const previous = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 5) {
      audioHandleRef.current?.seekTo(0);
      setCurrentTime(0);
      return;
    }
    goToIndex(queue, queueIndex - 1, true);
  }, [queue, queueIndex, currentTime, goToIndex]);

  const seek = useCallback((seconds: number) => {
    audioHandleRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(nextVolume)));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    audioHandleRef.current?.setVolume(clamped);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      audioHandleRef.current?.setVolume(nextMuted ? 0 : volume || DEFAULT_VOLUME);
      return nextMuted;
    });
  }, [volume]);

  // Plays a song surfaced by the "Recently Added" toast the same way any
  // other song-select flow does (playQueue -> goToIndex), without losing
  // the current queue: the song is moved to the front, autoplay replaces
  // whatever was playing (this only runs from an explicit Play click).
  const playRecentlyAddedSong = useCallback(
    (song: Song) => {
      setNewSongNotification((prev) => prev.filter((s) => s.id !== song.id));
      const nextQueue = [song, ...queue.filter((s) => s.id !== song.id)];
      playQueue(nextQueue, currentEra, 0);
    },
    [queue, currentEra, playQueue]
  );

  const dismissNewSongNotification = useCallback(() => {
    setNewSongNotification([]);
  }, []);

  // Restore playback preferences (but never auto-start audio). Restoring
  // the previous song is instant (from localStorage); falling back to a
  // fresh tune-in requires a Firestore round trip, so this effect is async.
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (typeof window === "undefined") return;

    (async () => {
      const savedVolume = window.localStorage.getItem(STORAGE_KEYS.volume);
      if (savedVolume) setVolumeState(Number(savedVolume));

      const savedTunedIn = window.localStorage.getItem(STORAGE_KEYS.tunedIn) === "true";
      setHasTunedIn(savedTunedIn);

      try {
        const savedSongJson = window.localStorage.getItem(STORAGE_KEYS.song);
        const savedQueueJson = window.localStorage.getItem(STORAGE_KEYS.queue);

        if (savedSongJson && savedQueueJson) {
          const song: Song = JSON.parse(savedSongJson);
          const restoredQueue: Song[] = JSON.parse(savedQueueJson);
          const savedEraJson = window.localStorage.getItem(STORAGE_KEYS.era);
          const era: EraId | null = savedEraJson ? JSON.parse(savedEraJson) : song.era ?? null;
          const idx = restoredQueue.findIndex((s) => s.id === song.id);

          setQueue(restoredQueue);
          setCurrentEra(era);
          goToIndex(restoredQueue, idx === -1 ? 0 : idx, false);

          // The cached queue can go stale — songs get deleted server-side
          // after this was written to localStorage. Reconcile against what
          // actually still exists so deleted songs don't linger forever.
          try {
            const liveSongs = await getSongsOnce();
            const liveIds = new Set(liveSongs.map((s) => s.id));
            const stillValid = restoredQueue.filter((s) => liveIds.has(s.id));
            if (stillValid.length !== restoredQueue.length) {
              if (stillValid.length === 0) {
                setQueue([]);
                setCurrentSong(null);
                setCurrentEra(null);
                setPlaybackUnavailable(true);
              } else {
                const newIdx = stillValid.findIndex((s) => s.id === song.id);
                setQueue(stillValid);
                goToIndex(stillValid, newIdx === -1 ? 0 : newIdx, false);
              }
            }
          } catch {
            // Offline or fetch failed — keep the cached queue rather than
            // clearing a perfectly good session over a transient error.
          }
          return;
        }
      } catch {
        // Corrupt/incompatible saved state — fall through to a fresh tune-in.
      }

      // Nothing usable saved (first-ever visit) — cue up all songs shuffled
      // so the player bar shows up ready to go instead of a bare "tune in"
      // prompt. Cueing doesn't need a user gesture; only play() does, which
      // the visible Play button provides.
      try {
        const songs = await getSongsOnce();
        if (songs.length > 0) {
          const shuffled = shuffle(songs);
          setQueue(shuffled);
          setCurrentEra(shuffled[0]?.era ?? null);
          goToIndex(shuffled, 0, false);
        }
      } catch {
        // Network error on first load — leave the "Tap to Tune In" prompt
        // as-is; tuneIn() will retry and surface playbackUnavailable.
      }
    })();
  }, [goToIndex]);

  // Live-watch for songs uploaded since the user's last visit, surfacing
  // them via the "Recently Added" toast — this fires both for anything
  // already newer than the bookmark at load time and for songs uploaded
  // while browsing. Never auto-plays — only updates state. The bookmark
  // (newest createdAt seen) is persisted so the *next* session only shows
  // what's new since then, instead of everything all over again.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = Number(window.localStorage.getItem(STORAGE_KEYS.lastSeenSongAt));
    const sinceEpochMs = stored > 0 ? stored : Date.now() - RECENTLY_ADDED_FALLBACK_WINDOW_MS;

    const unsubscribe = subscribeToNewSongs(sinceEpochMs, (song) => {
      upsertSongInCache(song);
      setRecentlyAdded((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song]));
      setNewSongNotification((prev) =>
        prev.some((s) => s.id === song.id) ? prev : [...prev, song]
      );
      const prevSeen = Number(window.localStorage.getItem(STORAGE_KEYS.lastSeenSongAt)) || 0;
      if (song.createdAt > prevSeen) {
        window.localStorage.setItem(STORAGE_KEYS.lastSeenSongAt, String(song.createdAt));
      }
    });
    return unsubscribe;
  }, []);

  // Only one browser tab should play audio at a time. When this tab starts
  // playing, tell other tabs of the same site to pause — but don't pause
  // ourselves just because the tab is backgrounded/unfocused.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("dhunzza-player");
    playbackChannelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type === "playing" && event.data.tabId !== tabIdRef.current) {
        pause();
      }
    };

    return () => {
      channel.close();
      playbackChannelRef.current = null;
    };
  }, [pause]);

  // Mobile browsers/OSes can silently suspend backgrounded audio even with
  // the mitigations in NativeAudioPlayer. Remember whether we were supposed
  // to be playing, and resume automatically the moment the tab becomes
  // visible again instead of leaving playback stuck paused.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && wasPlayingRef.current) {
        play();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [play]);

  // Persist preferences.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.volume, String(volume));
  }, [volume]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.tunedIn, String(hasTunedIn));
  }, [hasTunedIn]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentSong) return;
    window.localStorage.setItem(STORAGE_KEYS.song, JSON.stringify(currentSong));
    window.localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue));
    if (currentEra) {
      window.localStorage.setItem(STORAGE_KEYS.era, JSON.stringify(currentEra));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.era);
    }
  }, [currentSong, queue, currentEra]);

  // Poll playback progress while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      const handle = audioHandleRef.current;
      if (!handle) return;
      setCurrentTime(handle.getCurrentTime());
      const d = handle.getDuration();
      if (d > 0) setDuration(d);
    }, 750);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  // Space toggles play/pause, arrow keys seek — unless a form control has focus.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isFormControl =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if (isFormControl) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.code === "ArrowRight") {
        seek(Math.min(duration, currentTime + 5));
      } else if (event.code === "ArrowLeft") {
        seek(Math.max(0, currentTime - 5));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seek, currentTime, duration]);

  // Media Session: lock-screen / notification "Now Playing" controls. Also
  // signals to the OS that this tab is actively playing media, which is
  // what lets Android/iOS keep same-origin <audio> playback going when the
  // app is backgrounded. Without an explicit `artwork` entry, Android/iOS
  // show no icon at all on the lock screen — a bare title/artist isn't enough.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !currentSong) return;
    let cancelled = false;

    function setMetadata(artworkSrc: string, artworkType?: string) {
      if (cancelled || !currentSong) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist ?? "Dhunzza",
        album: "Dhunzza",
        artwork: [96, 192, 512].map((size) => ({
          src: artworkSrc,
          sizes: `${size}x${size}`,
          type: artworkType,
        })),
      });
    }

    // Sensible default immediately; swapped for the song's own cover art
    // (if any) once fetched, so the lock screen never shows a blank icon.
    setMetadata(`${window.location.origin}/dhunzza.webp`, "image/webp");

    if (currentSong.thumbnailPath) {
      // blob: URLs carry no inspectable MIME type from the string alone —
      // `type` is optional on MediaImage, and browsers render fine without it.
      getCachedSongThumbnail(currentSong.thumbnailPath)
        .then((blobUrl) => {
          if (!blobUrl) return;
          setMetadata(blobUrl);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [currentSong]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    session.setActionHandler("play", play);
    session.setActionHandler("pause", pause);
    session.setActionHandler("previoustrack", previous);
    session.setActionHandler("nexttrack", next);

    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("previoustrack", null);
      session.setActionHandler("nexttrack", null);
    };
  }, [play, pause, previous, next]);

  useEffect(() => {
    audioHandleRef.current?.setVolume(volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlaying = useCallback(() => {
    setIsPlaying(true);
    setIsLoading(false);
    setPlaybackUnavailable(false);
    skipAttemptsRef.current = 0;
    playbackChannelRef.current?.postMessage({ type: "playing", tabId: tabIdRef.current });
  }, []);

  const handlePaused = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    skipAttemptsRef.current = 0;
    if (freshAutoplayCountRef.current >= FRESH_AUTOPLAY_LIMIT && playedIndicesRef.current.size > 0) {
      // Passive auto-advance budget spent for this queue session — replay
      // from the already-played (already-cached) subset instead of pulling
      // further never-downloaded songs from Realtime Database.
      const played = Array.from(playedIndicesRef.current);
      const replayIndex = played[Math.floor(Math.random() * played.length)];
      debugLog("player", `fresh-autoplay limit reached — replaying from ${played.length} cached songs`);
      goToIndex(queue, replayIndex, true);
      return;
    }
    freshAutoplayCountRef.current += 1;
    goToIndex(queue, queueIndex + 1, true);
  }, [queue, queueIndex, goToIndex]);

  const handleError = useCallback(() => {
    skipAttemptsRef.current += 1;
    setIsLoading(false);
    if (skipAttemptsRef.current > Math.max(queue.length, 1)) {
      setIsPlaying(false);
      setPlaybackUnavailable(true);
      return;
    }
    goToIndex(queue, queueIndex + 1, true);
  }, [queue, queueIndex, goToIndex]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentSong,
      currentEra,
      isTraveling,
      travelingToEra,
      isPlaying,
      isLoading,
      isReady,
      hasTunedIn,
      currentTime,
      duration,
      volume,
      isMuted,
      queue,
      playbackUnavailable,
      recentlyAdded,
      newSongNotification,
      tuneIn,
      playQueue,
      travelToEra,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      playRecentlyAddedSong,
      dismissNewSongNotification,
    }),
    [
      currentSong,
      currentEra,
      isTraveling,
      travelingToEra,
      isPlaying,
      isLoading,
      isReady,
      hasTunedIn,
      currentTime,
      duration,
      volume,
      isMuted,
      queue,
      playbackUnavailable,
      recentlyAdded,
      newSongNotification,
      tuneIn,
      playQueue,
      travelToEra,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      playRecentlyAddedSong,
      dismissNewSongNotification,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <NativeAudioPlayer
        ref={audioHandleRef}
        onPlaying={handlePlaying}
        onPaused={handlePaused}
        onEnded={handleEnded}
        onError={handleError}
      />
    </PlayerContext.Provider>
  );
}

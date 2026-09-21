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
import type { Song } from "@/types/music";
import { fetchAllSongsOnce, fetchSongAudio } from "@/lib/firebase/songs";
import NativeAudioPlayer, {
  type NativeAudioPlayerHandle,
} from "@/components/player/NativeAudioPlayer";

const STORAGE_KEYS = {
  song: "dhunzza.current-song",
  queue: "dhunzza.queue",
  category: "dhunzza.current-category",
  volume: "dhunzza.volume",
  tunedIn: "dhunzza.has-tuned-in",
} as const;

const DEFAULT_VOLUME = 80;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface CurrentCategory {
  id: string;
  name: string;
}

export interface PlayerContextValue {
  currentSong: Song | null;
  currentCategory: CurrentCategory | null;
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

  tuneIn: () => void;
  playQueue: (songs: Song[], category: CurrentCategory | null, startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioHandleRef = useRef<NativeAudioPlayerHandle>(null);
  const loadedSongIdRef = useRef<string | null>(null);
  const skipAttemptsRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const tabIdRef = useRef<string | null>(null);
  const playbackChannelRef = useRef<BroadcastChannel | null>(null);
  if (tabIdRef.current === null && typeof crypto !== "undefined") {
    tabIdRef.current = crypto.randomUUID();
  }

  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentCategory, setCurrentCategory] = useState<CurrentCategory | null>(null);
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

      setCurrentTime(0);
      setDuration(0);
      setPlaybackUnavailable(false);
      setQueueIndex(normalizedIndex);
      setCurrentSong(song);
      loadedSongIdRef.current = song.id;
      setIsPlaying(autoplay);
      setIsLoading(true);

      try {
        const audioSrc = await fetchSongAudio(song.audioPath);
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
    (songs: Song[], category: CurrentCategory | null, startIndex = 0) => {
      setQueue(songs);
      setCurrentCategory(category);
      goToIndex(songs, startIndex, true);
    },
    [goToIndex]
  );

  const tuneIn = useCallback(async () => {
    setHasTunedIn(true);
    try {
      const songs = await fetchAllSongsOnce();
      if (songs.length === 0) {
        setPlaybackUnavailable(true);
        return;
      }
      playQueue(shuffle(songs), null);
    } catch {
      setPlaybackUnavailable(true);
    }
  }, [playQueue]);

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
          const savedCategoryJson = window.localStorage.getItem(STORAGE_KEYS.category);
          const category: CurrentCategory | null = savedCategoryJson
            ? JSON.parse(savedCategoryJson)
            : null;
          const idx = restoredQueue.findIndex((s) => s.id === song.id);

          setQueue(restoredQueue);
          setCurrentCategory(category);
          goToIndex(restoredQueue, idx === -1 ? 0 : idx, false);
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
        const songs = await fetchAllSongsOnce();
        if (songs.length > 0) {
          const shuffled = shuffle(songs);
          setQueue(shuffled);
          setCurrentCategory(null);
          goToIndex(shuffled, 0, false);
        }
      } catch {
        // Network error on first load — leave the "Tap to Tune In" prompt
        // as-is; tuneIn() will retry and surface playbackUnavailable.
      }
    })();
  }, [goToIndex]);

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
    if (currentCategory) {
      window.localStorage.setItem(STORAGE_KEYS.category, JSON.stringify(currentCategory));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.category);
    }
  }, [currentSong, queue, currentCategory]);

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
  // app is backgrounded.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !currentSong) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist ?? "Dhunzza",
      album: currentSong.categoryName || "Dhunzza",
    });
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
      currentCategory,
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
      tuneIn,
      playQueue,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
    }),
    [
      currentSong,
      currentCategory,
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
      tuneIn,
      playQueue,
      play,
      pause,
      togglePlay,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
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

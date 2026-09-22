"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export interface NativeAudioPlayerHandle {
  load(src: string, autoplay: boolean): void;
  play(): void;
  pause(): void;
  /** Ramps volume down to 0 over `durationMs` then pauses — used when a song is cut short by a skip/switch, instead of a hard stop. */
  fadeOutAndPause(durationMs?: number): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}

const FADE_OUT_DURATION_MS = 350;
const FADE_OUT_STEPS = 12;

interface NativeAudioPlayerProps {
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

/**
 * Plays same-origin/CDN-hosted audio files (e.g. Firebase Storage URLs)
 * through a real <audio> element instead of the YouTube iframe. Unlike a
 * cross-origin iframe, this keeps playing on iOS Safari when the app is
 * backgrounded — used automatically for any song with an `audioSrc`, while
 * everything else still plays through YouTubePlayer as before.
 */
const NativeAudioPlayer = forwardRef<NativeAudioPlayerHandle, NativeAudioPlayerProps>(
  function NativeAudioPlayer({ onPlaying, onPaused, onEnded, onError }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    // The user-configured volume (0-1), distinct from audio.volume while a
    // fade-out is in progress — restored once the fade finishes so the next
    // song starts at the right level instead of at 0.
    const targetVolumeRef = useRef(1);
    const fadeIntervalRef = useRef<number | null>(null);

    function cancelFade() {
      if (fadeIntervalRef.current === null) return;
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    useImperativeHandle(ref, () => ({
      load(src, autoplay) {
        const audio = audioRef.current;
        if (!audio) return;
        cancelFade();
        audio.volume = targetVolumeRef.current;
        audio.src = src;
        audio.load();
        if (autoplay) {
          audio.play().catch((error) => {
            // A newer load()/pause() call interrupting this one rejects
            // the play() promise with AbortError — expected noise when
            // switching songs quickly, not a real playback failure.
            if (error instanceof DOMException && error.name === "AbortError") return;
            onError?.();
          });
        }
      },
      play() {
        audioRef.current?.play().catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          onError?.();
        });
      },
      pause() {
        cancelFade();
        const audio = audioRef.current;
        if (audio) audio.volume = targetVolumeRef.current;
        audio?.pause();
      },
      fadeOutAndPause(durationMs = FADE_OUT_DURATION_MS) {
        const audio = audioRef.current;
        if (!audio || audio.paused) return;
        cancelFade();

        const startVolume = audio.volume;
        const stepMs = durationMs / FADE_OUT_STEPS;
        let step = 0;
        fadeIntervalRef.current = window.setInterval(() => {
          step += 1;
          audio.volume = Math.max(0, startVolume * (1 - step / FADE_OUT_STEPS));
          if (step >= FADE_OUT_STEPS) {
            cancelFade();
            audio.pause();
            audio.volume = targetVolumeRef.current;
          }
        }, stepMs);
      },
      seekTo(seconds) {
        if (audioRef.current) audioRef.current.currentTime = seconds;
      },
      setVolume(volume) {
        const clamped = Math.min(100, Math.max(0, volume)) / 100;
        targetVolumeRef.current = clamped;
        if (audioRef.current) audioRef.current.volume = clamped;
      },
      getCurrentTime() {
        return audioRef.current?.currentTime ?? 0;
      },
      getDuration() {
        return audioRef.current?.duration || 0;
      },
    }));

    return (
      <audio
        ref={audioRef}
        preload="auto"
        onPlaying={() => onPlaying?.()}
        onPause={() => onPaused?.()}
        onEnded={() => onEnded?.()}
        onError={(event) => {
          // A newer load() interrupting an in-flight fetch for the
          // previous song reports MEDIA_ERR_ABORTED here — expected noise
          // when switching songs quickly, not a real playback failure.
          const error = event.currentTarget.error;
          if (error?.code === MediaError.MEDIA_ERR_ABORTED) return;
          onError?.();
        }}
        className="hidden"
      />
    );
  }
);

export default NativeAudioPlayer;

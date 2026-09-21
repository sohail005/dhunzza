"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export interface NativeAudioPlayerHandle {
  load(src: string, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}

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

    useImperativeHandle(ref, () => ({
      load(src, autoplay) {
        const audio = audioRef.current;
        if (!audio) return;
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
        audioRef.current?.pause();
      },
      seekTo(seconds) {
        if (audioRef.current) audioRef.current.currentTime = seconds;
      },
      setVolume(volume) {
        if (audioRef.current) {
          audioRef.current.volume = Math.min(100, Math.max(0, volume)) / 100;
        }
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

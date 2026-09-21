"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudRain, Zap } from "lucide-react";

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
  wind: number;
  alpha: number;
  thickness: number;
}

interface Splash {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  radius: number;
}

function makeDrop(width: number, height: number, randomY: boolean): Drop {
  const z = Math.random() * 0.8 + 0.2;
  return {
    x: Math.random() * (width + 200) - 100,
    y: randomY ? Math.random() * height : -20 - Math.random() * 50,
    z,
    speed: (18 + Math.random() * 10) * z,
    len: (15 + Math.random() * 15) * z,
    wind: -2.5 * z,
    alpha: 0.2 + z * 0.45,
    thickness: 0.8 + z * 1.1,
  };
}

function makeSplash(x: number, y: number, z: number): Splash {
  return {
    x,
    y,
    z,
    vx: (Math.random() - 0.5) * 4 * z,
    vy: -(1.5 + Math.random() * 3) * z,
    life: 1,
    decay: 0.08 + Math.random() * 0.06,
    radius: (1.2 + Math.random() * 1.5) * z,
  };
}

/**
 * Ambient rain, lightning and thunder overlay. Visuals are a canvas
 * particle sim; audio is procedurally generated with the Web Audio API
 * (filtered noise for rain, a swept oscillator + noise burst for thunder)
 * so no external sound files are needed.
 */
export default function RainEffect() {
  const [isActive, setIsActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dropsRef = useRef<Drop[]>([]);
  const splashesRef = useRef<Splash[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lightningTimeoutRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      sizeRef.current = { width: window.innerWidth, height: window.innerHeight };
      canvas.width = sizeRef.current.width;
      canvas.height = sizeRef.current.height;
    }
    resize();
    window.addEventListener("resize", resize);

    function drawLightningBolt(startX: number, startY: number, endX: number, endY: number) {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = "rgba(240, 248, 255, 0.95)";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "rgba(147, 197, 253, 1)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const steps = 14 + Math.floor(Math.random() * 8);
      for (let i = 0; i < steps; i++) {
        const t = (i + 1) / steps;
        const targetX = startX + (endX - startX) * t + (Math.random() - 0.5) * 70;
        const targetY = startY + (endY - startY) * t;
        ctx.lineTo(targetX, targetY);
        if (Math.random() < 0.4 && i < steps - 2) {
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(targetX + (Math.random() - 0.5) * 90, targetY + 30 + Math.random() * 40);
          ctx.moveTo(targetX, targetY);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    function playThunderSound() {
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;
      try {
        if (audioCtx.state === "suspended") audioCtx.resume();
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 2.5);

        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(160, now);
        filter.frequency.linearRampToValueAtTime(60, now + 2.5);

        oscGain.gain.setValueAtTime(0.01, now);
        oscGain.gain.linearRampToValueAtTime(0.9, now + 0.1);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 3.2);

        const crackBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2.2, audioCtx.sampleRate);
        const data = crackBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.6));
        }
        const crackSource = audioCtx.createBufferSource();
        crackSource.buffer = crackBuffer;

        const crackFilter = audioCtx.createBiquadFilter();
        crackFilter.type = "bandpass";
        crackFilter.frequency.setValueAtTime(320, now);
        crackFilter.Q.value = 1.8;

        const crackGain = audioCtx.createGain();
        crackGain.gain.setValueAtTime(0.85, now);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        crackSource.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(audioCtx.destination);
        crackSource.start(now + 0.05);
      } catch {
        // Web Audio can throw in restrictive/private-browsing contexts —
        // the rain visuals still work fine without thunder audio.
      }
    }

    function triggerLightning() {
      if (!isActiveRef.current) return;
      const flash = flashRef.current;
      const { width, height } = sizeRef.current;

      const flashIntensity = 0.65 + Math.random() * 0.35;
      if (flash) flash.style.opacity = String(flashIntensity);

      const boltStartX = Math.random() * width * 0.8 + width * 0.1;
      const boltEndX = boltStartX + (Math.random() - 0.5) * 200;
      drawLightningBolt(boltStartX, 0, boltEndX, height * 0.7);

      setTimeout(() => {
        if (!isActiveRef.current || !flash) return;
        flash.style.opacity = "0.15";
        setTimeout(() => {
          if (!isActiveRef.current) return;
          flash.style.opacity = String(flashIntensity * 0.8);
          setTimeout(() => {
            if (flash) flash.style.opacity = "0";
          }, 60);
        }, 45);
      }, 50);

      playThunderSound();
    }

    function animate() {
      if (!isActiveRef.current || !ctx) return;
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      for (const drop of dropsRef.current) {
        drop.x += drop.wind;
        drop.y += drop.speed;
        if (drop.y > height - 30) {
          if (Math.random() < 0.35 && splashesRef.current.length < 120) {
            splashesRef.current.push(makeSplash(drop.x, height - 10, drop.z));
          }
          Object.assign(drop, makeDrop(width, height, false));
        }
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.wind * 1.5, drop.y + drop.len);
        ctx.strokeStyle = `rgba(180, 215, 255, ${drop.alpha})`;
        ctx.lineWidth = drop.thickness;
        ctx.stroke();
      }

      for (let i = splashesRef.current.length - 1; i >= 0; i--) {
        const splash = splashesRef.current[i];
        splash.x += splash.vx;
        splash.y += splash.vy;
        splash.vy += 0.25;
        splash.life -= splash.decay;
        if (splash.life <= 0) {
          splashesRef.current.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(195, 225, 255, ${splash.life * 0.5})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    function initAudio() {
      if (audioCtxRef.current) return;
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        const audioCtx = new AudioContextCtor();
        audioCtxRef.current = audioCtx;

        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 2.8;
        }

        const rainNoiseSource = audioCtx.createBufferSource();
        rainNoiseSource.buffer = noiseBuffer;
        rainNoiseSource.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1000;

        const rainGain = audioCtx.createGain();
        rainGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        rainGainRef.current = rainGain;

        rainNoiseSource.connect(filter);
        filter.connect(rainGain);
        rainGain.connect(audioCtx.destination);
        rainNoiseSource.start(0);
      } catch {
        // Rain visuals still work without ambient audio.
      }
    }

    function startRain() {
      initAudio();
      const audioCtx = audioCtxRef.current;
      const rainGain = rainGainRef.current;
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      if (audioCtx && rainGain) {
        rainGain.gain.cancelScheduledValues(audioCtx.currentTime);
        rainGain.gain.setValueAtTime(rainGain.gain.value, audioCtx.currentTime);
        rainGain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 1.2);
      }

      const { width, height } = sizeRef.current;
      const dropCount = Math.min(300, Math.floor(width * 0.25));
      dropsRef.current = Array.from({ length: dropCount }, () => makeDrop(width, height, true));

      animate();
      if (lightningTimeoutRef.current) window.clearTimeout(lightningTimeoutRef.current);
      lightningTimeoutRef.current = window.setTimeout(triggerLightning, 800);
    }

    function stopRain() {
      const audioCtx = audioCtxRef.current;
      const rainGain = rainGainRef.current;
      if (audioCtx && rainGain) {
        rainGain.gain.cancelScheduledValues(audioCtx.currentTime);
        rainGain.gain.setValueAtTime(rainGain.gain.value, audioCtx.currentTime);
        rainGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (lightningTimeoutRef.current) window.clearTimeout(lightningTimeoutRef.current);
      if (flashRef.current) flashRef.current.style.opacity = "0";
      ctx?.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    }

    if (isActive) startRain();
    else stopRain();

    return () => {
      window.removeEventListener("resize", resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (lightningTimeoutRef.current) window.clearTimeout(lightningTimeoutRef.current);
    };
  }, [isActive]);

  // Tear down the AudioContext entirely on unmount.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <>
      {isMounted &&
        createPortal(
          <>
            <canvas
              ref={canvasRef}
              className="pointer-events-none fixed inset-0 z-15 transition-opacity duration-700"
              style={{ opacity: isActive ? 1 : 0 }}
              aria-hidden="true"
            />
            <div
              ref={flashRef}
              className="pointer-events-none fixed inset-0 z-18 opacity-0 mix-blend-screen transition-opacity duration-75"
              style={{ background: "rgba(230, 242, 255, 0.92)" }}
              aria-hidden="true"
            />
          </>,
          document.body,
        )}
      <button
        type="button"
        onClick={() => setIsActive((prev) => !prev)}
        aria-pressed={isActive}
        className={`liquid-glass inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-semibold text-white transition ${
          isActive ? "border-blue-400/70 text-blue-200" : ""
        }`}
      >
        {isActive ? (
          <Zap size={14} className="animate-bounce text-blue-300" />
        ) : (
          <CloudRain size={14} className="transition-transform group-hover:scale-125" />
        )}
        {isActive ? "Sirf Gaane" : "Baarish?"}
      </button>
    </>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

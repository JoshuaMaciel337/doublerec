"use client";

import { useEffect, useRef } from "react";

interface AudioMeterProps {
  stream: MediaStream | null;
}

/** VU meter simples baseado no RMS do sinal do microfone. */
export default function AudioMeter({ stream }: AudioMeterProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let rafId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      // escala perceptual: fala normal fica em torno de 40–80%
      const level = Math.min(1, rms * 4);
      if (barRef.current) {
        barRef.current.style.width = `${Math.round(level * 100)}%`;
      }
      rafId = requestAnimationFrame(tick);
    };

    const resume = () => {
      ctx.resume().catch(() => {});
    };
    resume();
    window.addEventListener("pointerdown", resume, { once: true });

    tick();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointerdown", resume);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className="flex items-center gap-1.5" title="Nível do microfone">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
        <path d="M12 18v4" />
      </svg>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/15">
        <div
          ref={barRef}
          className="h-full w-0 rounded-full bg-emerald-400 transition-[width] duration-75"
        />
      </div>
    </div>
  );
}

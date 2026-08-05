"use client";

import { PointerEvent, useRef } from "react";

// altura da faixa 16:9 relativa ao frame 9:16: (9/16) / (16/9)
const BOX_FRACTION = 81 / 256;

interface CropOverlayProps {
  /** posição normalizada 0..1 (0 = topo, 1 = base) */
  cropY: number;
  onChange: (value: number) => void;
}

/**
 * Faixa 16:9 arrastável sobre o preview vertical (9:16 primário). Indica
 * qual parte do enquadramento vertical vira o vídeo horizontal derivado.
 */
export default function CropOverlay({ cropY, onChange }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromPointer = (clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const boxHeight = rect.height * BOX_FRACTION;
    const y = clientY - rect.top - boxHeight / 2;
    const range = rect.height - boxHeight;
    if (range <= 0) return;
    onChange(Math.min(1, Math.max(0, y / range)));
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientY);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) updateFromPointer(e.clientY);
  };

  const handlePointerEnd = () => {
    draggingRef.current = false;
  };

  const topPercent = cropY * (1 - BOX_FRACTION) * 100;
  const boxPercent = BOX_FRACTION * 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-black/50"
        style={{ height: `${topPercent}%` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50"
        style={{ height: `${100 - topPercent - boxPercent}%` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 rounded-md border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ top: `${topPercent}%`, height: `${boxPercent}%` }}
      >
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
          16:9
        </span>
        <span className="absolute bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

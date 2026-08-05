"use client";

import { PointerEvent, useRef } from "react";

// largura da janela 9:16 relativa ao frame 16:9: (9/16) / (16/9)
const BOX_FRACTION = 81 / 256;

interface CropOverlayProps {
  /** posição normalizada 0..1 (0 = encostado à esquerda, 1 = à direita) */
  cropX: number;
  onChange: (value: number) => void;
}

/**
 * Janela 9:16 arrastável sobre o preview horizontal. O usuário toca/clica em
 * qualquer ponto e a janela segue o dedo/cursor.
 */
export default function CropOverlay({ cropX, onChange }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromPointer = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const boxWidth = rect.width * BOX_FRACTION;
    const x = clientX - rect.left - boxWidth / 2;
    const range = rect.width - boxWidth;
    if (range <= 0) return;
    onChange(Math.min(1, Math.max(0, x / range)));
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) updateFromPointer(e.clientX);
  };

  const handlePointerEnd = () => {
    draggingRef.current = false;
  };

  const leftPercent = cropX * (1 - BOX_FRACTION) * 100;
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
      {/* sombras nas áreas fora do recorte vertical */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-black/50"
        style={{ width: `${leftPercent}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 bg-black/50"
        style={{ width: `${100 - leftPercent - boxPercent}%` }}
      />
      {/* janela 9:16 */}
      <div
        className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${leftPercent}%`, width: `${boxPercent}%` }}
      >
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
          9:16
        </span>
        <span className="absolute bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

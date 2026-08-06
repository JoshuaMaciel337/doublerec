"use client";

import { PointerEvent, useRef } from "react";

// proporção do formato derivado dentro do principal: (9/16) / (16/9)
const BOX_FRACTION = 81 / 256;

interface CropOverlayProps {
  /** eixo em que o recorte desliza: "y" em retrato, "x" em paisagem */
  axis: "x" | "y";
  /** posição normalizada 0..1 */
  value: number;
  label: string;
  onChange: (value: number) => void;
  onConfirm: () => void;
}

/**
 * Recorte arrastável do formato derivado sobre o preview principal. Só aparece
 * enquanto o enquadramento está sendo ajustado — confirmado, some da tela.
 */
export default function CropOverlay({
  axis,
  value,
  label,
  onChange,
  onConfirm,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const total = axis === "y" ? rect.height : rect.width;
    const boxSize = total * BOX_FRACTION;
    const pointer =
      axis === "y" ? clientY - rect.top : clientX - rect.left;
    const range = total - boxSize;
    if (range <= 0) return;
    onChange(Math.min(1, Math.max(0, (pointer - boxSize / 2) / range)));
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerEnd = () => {
    draggingRef.current = false;
  };

  const startPercent = value * (1 - BOX_FRACTION) * 100;
  const boxPercent = BOX_FRACTION * 100;
  const endPercent = 100 - startPercent - boxPercent;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {axis === "y" ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bg-black/50"
            style={{ height: `${startPercent}%` }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50"
            style={{ height: `${endPercent}%` }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 rounded-md border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ top: `${startPercent}%`, height: `${boxPercent}%` }}
          >
            <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
              {label}
            </span>
            <span className="absolute bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/80" />
          </div>
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-black/50"
            style={{ width: `${startPercent}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-black/50"
            style={{ width: `${endPercent}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ left: `${startPercent}%`, width: `${boxPercent}%` }}
          >
            <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
              {label}
            </span>
            <span className="absolute bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/80" />
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
        <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white/80">
          Arraste para escolher o recorte {label}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onConfirm}
          className="pointer-events-auto rounded-full bg-white px-6 py-2 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-zinc-200"
        >
          OK
        </button>
      </div>
    </div>
  );
}

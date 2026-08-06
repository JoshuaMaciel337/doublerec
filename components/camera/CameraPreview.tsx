"use client";

import { ReactNode, RefObject } from "react";
import { GridMode, Rotation } from "@/lib/media/capabilities";

interface CameraPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** aspecto do arquivo que este canvas gera */
  aspect: "horizontal" | "vertical";
  /** giro aplicado no buffer para salvar deitado; o preview desfaz */
  canvasRotation?: Rotation;
  grid: GridMode;
  className?: string;
  children?: ReactNode;
}

function GridOverlay({ mode }: { mode: GridMode }) {
  if (mode === "none") return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {mode === "3x3" && (
        <>
          <div className="absolute left-1/3 top-0 h-full w-px bg-white/25" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white/25" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-white/25" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-white/25" />
        </>
      )}
      {mode === "cross" && (
        <>
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/30" />
        </>
      )}
      {mode === "safe" && (
        <>
          <div className="absolute inset-[6%] rounded-md border border-dashed border-white/40" />
          <div className="absolute inset-[14%] rounded-md border border-white/20" />
        </>
      )}
    </div>
  );
}

export default function CameraPreview({
  canvasRef,
  aspect,
  canvasRotation = 0,
  grid,
  className = "",
  children,
}: CameraPreviewProps) {
  // o buffer girado é o arquivo, não o que se vê: na tela desfazemos o giro
  // para a imagem continuar na posição em que a câmera entrega, e por isso a
  // caixa aparece com o aspecto trocado
  const turned = canvasRotation !== 0;
  const tall = turned ? aspect === "horizontal" : aspect === "vertical";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 ${
        tall ? "aspect-[9/16]" : "aspect-video"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={
          turned ? "absolute left-1/2 top-1/2" : "absolute inset-0 h-full w-full"
        }
        style={
          turned
            ? {
                // lados trocados em relação à caixa: 100% de cada eixo é a
                // medida do outro depois do giro
                width: tall ? "calc(100% * 16 / 9)" : "calc(100% * 9 / 16)",
                height: tall ? "calc(100% * 9 / 16)" : "calc(100% * 16 / 9)",
                transform: `translate(-50%, -50%) rotate(${-canvasRotation}deg)`,
              }
            : undefined
        }
      />
      <GridOverlay mode={grid} />
      {children}
    </div>
  );
}

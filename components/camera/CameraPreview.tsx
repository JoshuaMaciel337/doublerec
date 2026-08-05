"use client";

import { ReactNode, RefObject } from "react";
import { GridMode } from "@/lib/media/capabilities";

interface CameraPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  aspect: "horizontal" | "vertical";
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
  grid,
  className = "",
  children,
}: CameraPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 ${
        aspect === "horizontal" ? "aspect-video" : "aspect-[9/16]"
      } ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <GridOverlay mode={grid} />
      {children}
    </div>
  );
}

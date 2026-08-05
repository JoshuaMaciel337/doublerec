"use client";

import { RefObject, useEffect, useRef } from "react";
import { RESOLUTIONS, Resolution } from "@/lib/media/capabilities";

interface DualCanvasRendererProps {
  stream: MediaStream | null;
  resolution: Resolution;
  /** posição normalizada (0..1) da janela 9:16 dentro do frame 16:9, lida a cada frame */
  cropXRef: RefObject<number>;
  canvasHRef: RefObject<HTMLCanvasElement | null>;
  canvasVRef: RefObject<HTMLCanvasElement | null>;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * Coração do pipeline: um único <video> oculto alimenta dois canvases —
 * um com crop 16:9 (cover) e outro com a janela 9:16 posicionável.
 */
export default function DualCanvasRenderer({
  stream,
  resolution,
  cropXRef,
  canvasHRef,
  canvasVRef,
}: DualCanvasRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvasH = canvasHRef.current;
    const canvasV = canvasVRef.current;
    if (!video || !canvasH || !canvasV) return;

    const res = RESOLUTIONS[resolution];
    canvasH.width = res.width;
    canvasH.height = res.height;
    canvasV.width = res.height;
    canvasV.height = res.width;

    const ctxH = canvasH.getContext("2d", { alpha: false });
    const ctxV = canvasV.getContext("2d", { alpha: false });
    if (!ctxH || !ctxV) return;

    ctxH.fillStyle = "#000";
    ctxH.fillRect(0, 0, canvasH.width, canvasH.height);
    ctxV.fillStyle = "#000";
    ctxV.fillRect(0, 0, canvasV.width, canvasV.height);

    if (!stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      // autoplay pode falhar até o primeiro gesto; o loop segue tentando desenhar
    });

    let stopped = false;
    let rafId = 0;
    const supportsFrameCallback =
      typeof (video as VideoWithFrameCallback).requestVideoFrameCallback ===
      "function";

    const schedule = () => {
      if (stopped) return;
      if (supportsFrameCallback) {
        (video as VideoWithFrameCallback).requestVideoFrameCallback!(draw);
      } else {
        rafId = requestAnimationFrame(draw);
      }
    };

    const draw = () => {
      if (stopped) return;
      const sw = video.videoWidth;
      const sh = video.videoHeight;
      if (sw > 0 && sh > 0) {
        // região 16:9 "cover" do frame de origem (fonte pode não ser 16:9)
        let hw = sw;
        let hh = (sw * 9) / 16;
        if (hh > sh) {
          hh = sh;
          hw = (sh * 16) / 9;
        }
        const hx = (sw - hw) / 2;
        const hy = (sh - hh) / 2;
        ctxH.drawImage(video, hx, hy, hw, hh, 0, 0, canvasH.width, canvasH.height);

        // janela 9:16 dentro da mesma região 16:9, deslocada pelo crop arrastável
        const vw = (hh * 9) / 16;
        const crop = Math.min(1, Math.max(0, cropXRef.current ?? 0.5));
        const vx = hx + crop * (hw - vw);
        ctxV.drawImage(video, vx, hy, vw, hh, 0, 0, canvasV.width, canvasV.height);
      }
      schedule();
    };

    schedule();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      video.srcObject = null;
    };
  }, [stream, resolution, cropXRef, canvasHRef, canvasVRef]);

  return <video ref={videoRef} muted playsInline className="hidden" />;
}

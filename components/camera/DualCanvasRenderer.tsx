"use client";

import { RefObject, useEffect, useRef } from "react";
import { RESOLUTIONS, Resolution } from "@/lib/media/capabilities";

interface DualCanvasRendererProps {
  stream: MediaStream | null;
  resolution: Resolution;
  /** posição normalizada (0..1) da faixa 16:9 derivada dentro do frame 9:16 */
  cropYRef: RefObject<number>;
  canvasHRef: RefObject<HTMLCanvasElement | null>;
  canvasVRef: RefObject<HTMLCanvasElement | null>;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * Pipeline vertical-first: 9:16 é o crop primário (cover) e 16:9 é derivado
 * recortando uma faixa horizontal de dentro da mesma região vertical.
 */
export default function DualCanvasRenderer({
  stream,
  resolution,
  cropYRef,
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
        // 9:16 cover — gravação primária
        let vw = sw;
        let vh = (sw * 16) / 9;
        if (vh > sh) {
          vh = sh;
          vw = (sh * 9) / 16;
        }
        const vx = (sw - vw) / 2;
        const vy = (sh - vh) / 2;
        ctxV.drawImage(video, vx, vy, vw, vh, 0, 0, canvasV.width, canvasV.height);

        // 16:9 derivado — mesma largura da vertical, recorte vertical interno
        const hw = vw;
        const hh = (vw * 9) / 16;
        const hx = vx;
        const crop = Math.min(1, Math.max(0, cropYRef.current ?? 0.5));
        const panRangeY = Math.max(0, vh - hh);
        const hy = vy + (panRangeY > 0 ? crop * panRangeY : (vh - hh) / 2);
        ctxH.drawImage(video, hx, hy, hw, hh, 0, 0, canvasH.width, canvasH.height);
      }
      schedule();
    };

    schedule();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      video.srcObject = null;
    };
  }, [stream, resolution, cropYRef, canvasHRef, canvasVRef]);

  return <video ref={videoRef} muted playsInline className="hidden" />;
}

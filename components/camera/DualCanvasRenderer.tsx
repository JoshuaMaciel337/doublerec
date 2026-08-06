"use client";

import { RefObject, useEffect, useRef } from "react";
import {
  CaptureMode,
  Resolution,
  canvasSizesForSource,
} from "@/lib/media/capabilities";
import { FilterTint } from "@/lib/media/filters";

export interface RenderSettings {
  /** valor pronto para ctx.filter ("none" quando não há tratamento) */
  filter: string;
  vignette: number;
  tint: FilterTint | null;
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  filter: "none",
  vignette: 0,
  tint: null,
};

interface DualCanvasRendererProps {
  stream: MediaStream | null;
  resolution: Resolution;
  /** orientação da gravação principal */
  mode: CaptureMode;
  /** posição normalizada (0..1) do formato derivado dentro do principal */
  cropRef: RefObject<number>;
  settingsRef: RefObject<RenderSettings>;
  canvasHRef: RefObject<HTMLCanvasElement | null>;
  canvasVRef: RefObject<HTMLCanvasElement | null>;
  /** reporta as dimensões reais dos arquivos (para a barra de status) */
  onOutputSize?: (info: {
    horizontal: { width: number; height: number };
    vertical: { width: number; height: number };
  }) => void;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * O formato principal recebe o maior recorte possível do frame da câmera
 * (cover) e o outro formato é derivado deslizando dentro dessa mesma região.
 * Os canvases são dimensionados pelos pixels reais do sensor — o recorte
 * derivado nunca é esticado além do que a câmera entregou.
 */
export default function DualCanvasRenderer({
  stream,
  resolution,
  mode,
  cropRef,
  settingsRef,
  canvasHRef,
  canvasVRef,
  onOutputSize,
}: DualCanvasRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onOutputSizeRef = useRef(onOutputSize);
  onOutputSizeRef.current = onOutputSize;

  useEffect(() => {
    const video = videoRef.current;
    const canvasH = canvasHRef.current;
    const canvasV = canvasVRef.current;
    if (!video || !canvasH || !canvasV) return;

    const ctxH = canvasH.getContext("2d", { alpha: false });
    const ctxV = canvasV.getContext("2d", { alpha: false });
    if (!ctxH || !ctxV) return;

    if (!stream) {
      ctxH.fillStyle = "#000";
      ctxH.fillRect(0, 0, canvasH.width || 1, canvasH.height || 1);
      ctxV.fillStyle = "#000";
      ctxV.fillRect(0, 0, canvasV.width || 1, canvasV.height || 1);
      return;
    }

    video.srcObject = stream;
    video.play().catch(() => {
      // autoplay pode falhar até o primeiro gesto; o loop segue tentando desenhar
    });

    let stopped = false;
    let rafId = 0;
    let sized = false;
    const supportsFrameCallback =
      typeof (video as VideoWithFrameCallback).requestVideoFrameCallback ===
      "function";

    // gradiente da vinheta é caro de recriar a cada frame
    const vignettes = new Map<
      CanvasRenderingContext2D,
      { strength: number; gradient: CanvasGradient }
    >();

    const vignetteFor = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      strength: number,
    ): CanvasGradient => {
      const cached = vignettes.get(ctx);
      if (cached && cached.strength === strength) return cached.gradient;
      const cx = width / 2;
      const cy = height / 2;
      const gradient = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(width, height) * 0.3,
        cx,
        cy,
        Math.max(width, height) * 0.72,
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
      vignettes.set(ctx, { strength, gradient });
      return gradient;
    };

    const ensureCanvasSize = (sourceW: number, sourceH: number) => {
      const sizes = canvasSizesForSource(resolution, mode, sourceW, sourceH);
      const changed =
        canvasH.width !== sizes.horizontal.width ||
        canvasH.height !== sizes.horizontal.height ||
        canvasV.width !== sizes.vertical.width ||
        canvasV.height !== sizes.vertical.height;
      if (changed) {
        canvasH.width = sizes.horizontal.width;
        canvasH.height = sizes.horizontal.height;
        canvasV.width = sizes.vertical.width;
        canvasV.height = sizes.vertical.height;
        vignettes.clear();
      }
      if (!sized || changed) {
        sized = true;
        onOutputSizeRef.current?.(sizes);
      }
    };

    const paint = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      settings: RenderSettings,
    ) => {
      ctx.filter = settings.filter;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";

      if (settings.tint) {
        ctx.globalCompositeOperation = settings.tint.mode;
        ctx.globalAlpha = settings.tint.alpha;
        ctx.fillStyle = settings.tint.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      if (settings.vignette > 0) {
        ctx.fillStyle = vignetteFor(
          ctx,
          canvas.width,
          canvas.height,
          settings.vignette,
        );
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

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
      const sourceW = video.videoWidth;
      const sourceH = video.videoHeight;
      if (sourceW > 0 && sourceH > 0) {
        ensureCanvasSize(sourceW, sourceH);

        const settings = settingsRef.current ?? DEFAULT_RENDER_SETTINGS;
        const crop = Math.min(1, Math.max(0, cropRef.current ?? 0.5));

        // cover do formato principal dentro do frame da câmera
        const primaryAspect = mode === "portrait" ? 9 / 16 : 16 / 9;
        let pw = sourceW;
        let ph = sourceW / primaryAspect;
        if (ph > sourceH) {
          ph = sourceH;
          pw = sourceH * primaryAspect;
        }
        const px = (sourceW - pw) / 2;
        const py = (sourceH - ph) / 2;

        // maior retângulo do formato derivado que cabe no principal
        const derivedAspect = mode === "portrait" ? 16 / 9 : 9 / 16;
        let dw = pw;
        let dh = pw / derivedAspect;
        if (dh > ph) {
          dh = ph;
          dw = ph * derivedAspect;
        }
        // só um dos eixos tem folga; no outro o range é zero e o crop não afeta
        const dx = px + crop * (pw - dw);
        const dy = py + crop * (ph - dh);

        if (mode === "portrait") {
          paint(ctxV, canvasV, px, py, pw, ph, settings);
          paint(ctxH, canvasH, dx, dy, dw, dh, settings);
        } else {
          paint(ctxH, canvasH, px, py, pw, ph, settings);
          paint(ctxV, canvasV, dx, dy, dw, dh, settings);
        }
      }
      schedule();
    };

    schedule();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      video.srcObject = null;
    };
  }, [stream, resolution, mode, cropRef, settingsRef, canvasHRef, canvasVRef]);

  return <video ref={videoRef} muted playsInline className="hidden" />;
}

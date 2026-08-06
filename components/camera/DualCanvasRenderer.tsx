"use client";

import { RefObject, useEffect, useRef } from "react";
import {
  CaptureMode,
  LANDSCAPE_ASPECT,
  PORTRAIT_ASPECT,
  Rect,
  Resolution,
  Rotation,
  canvasSizesForSource,
  coverRect,
  derivedFraction,
  unrotateRect,
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
  /** posição normalizada (0..1) do formato derivado dentro do principal */
  cropRef: RefObject<number>;
  /** giro manual do quadro, para gravar deitado com a tela travada */
  rotationRef: RefObject<Rotation>;
  settingsRef: RefObject<RenderSettings>;
  canvasHRef: RefObject<HTMLCanvasElement | null>;
  canvasVRef: RefObject<HTMLCanvasElement | null>;
  /** reporta as dimensões reais dos arquivos (para a barra de status) */
  onOutputSize?: (info: {
    horizontal: { width: number; height: number };
    vertical: { width: number; height: number };
    /** frame que a câmera está entregando */
    source: { width: number; height: number };
    /** formato principal de fato, deduzido da orientação do frame */
    mode: CaptureMode;
    /** tamanho do recorte derivado em relação ao principal (0..1) */
    fraction: number;
  }) => void;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * Cada formato recorta o frame da câmera por conta própria: os dois usam a
 * maior área possível do sensor para o seu aspecto, então nenhum deles é
 * recorte de recorte. Quem manda é a orientação do frame que chega — o formato
 * que combina com ela é o principal (abertura cheia) e o outro é o que desliza.
 */
export default function DualCanvasRenderer({
  stream,
  resolution,
  cropRef,
  rotationRef,
  settingsRef,
  canvasHRef,
  canvasVRef,
  onOutputSize,
}: DualCanvasRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onOutputSizeRef = useRef(onOutputSize);

  useEffect(() => {
    onOutputSizeRef.current = onOutputSize;
  }, [onOutputSize]);

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

    // dimensões do quadro depois do giro: é nelas que todo o recorte é pensado
    const ensureCanvasSize = (frameW: number, frameH: number) => {
      const sizes = canvasSizesForSource(resolution, frameW, frameH);
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
        const frameMode: CaptureMode =
          frameH >= frameW ? "portrait" : "landscape";
        onOutputSizeRef.current?.({
          ...sizes,
          source: { width: frameW, height: frameH },
          mode: frameMode,
          fraction: derivedFraction(frameMode, frameW, frameH),
        });
      }
    };

    const paint = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      rect: Rect,
      rotation: Rotation,
      settings: RenderSettings,
    ) => {
      ctx.filter = settings.filter;
      if (rotation === 0) {
        ctx.drawImage(
          video,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      } else {
        // giramos o contexto e desenhamos numa caixa com os lados trocados,
        // que depois do giro preenche o canvas inteiro
        const boxW = canvas.height;
        const boxH = canvas.width;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(
          video,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          -boxW / 2,
          -boxH / 2,
          boxW,
          boxH,
        );
        ctx.restore();
      }
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
        const rotation = rotationRef.current ?? 0;
        const turned = rotation !== 0;
        const frameW = turned ? sourceH : sourceW;
        const frameH = turned ? sourceW : sourceH;
        ensureCanvasSize(frameW, frameH);

        const settings = settingsRef.current ?? DEFAULT_RENDER_SETTINGS;
        const crop = Math.min(1, Math.max(0, cropRef.current ?? 0.5));
        // o formato que acompanha a orientação do quadro é o principal
        const portrait = frameH >= frameW;

        // o principal fica centralizado e o derivado desliza; só um dos eixos
        // tem folga, no outro o crop não muda nada
        const vertical = coverRect(
          frameW,
          frameH,
          PORTRAIT_ASPECT,
          portrait ? 0.5 : crop,
        );
        const horizontal = coverRect(
          frameW,
          frameH,
          LANDSCAPE_ASPECT,
          portrait ? crop : 0.5,
        );

        paint(
          ctxV,
          canvasV,
          unrotateRect(vertical, sourceW, sourceH, rotation),
          rotation,
          settings,
        );
        paint(
          ctxH,
          canvasH,
          unrotateRect(horizontal, sourceW, sourceH, rotation),
          rotation,
          settings,
        );
      }
      schedule();
    };

    schedule();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      video.srcObject = null;
    };
  }, [
    stream,
    resolution,
    cropRef,
    rotationRef,
    settingsRef,
    canvasHRef,
    canvasVRef,
  ]);

  return <video ref={videoRef} muted playsInline className="hidden" />;
}

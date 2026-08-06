"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CaptureMode,
  EMPTY_FEATURES,
  FacingMode,
  Fps,
  Resolution,
  Size,
  captureSize,
  TrackFeatures,
  getTrackFeatures,
} from "./capabilities";

export interface CameraStreamOptions {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  resolution: Resolution;
  fps: Fps;
  facing: FacingMode;
  captureMode: CaptureMode;
}

export interface DeviceLists {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
}

// os controles de imagem da câmera ainda não estão no lib.dom padrão
type AdvancedConstraint = MediaTrackConstraintSet & {
  zoom?: number;
  torch?: boolean;
  exposureMode?: string;
  exposureCompensation?: number;
  iso?: number;
};

type ExtendedCapabilities = MediaTrackCapabilities & {
  width?: { max?: number };
  height?: { max?: number };
};

/** Descobre o teto da câmera sem manter o stream aberto */
async function probeMaxSize(
  videoDeviceId: string | null,
  facing: FacingMode,
): Promise<Size | null> {
  try {
    const probe: MediaTrackConstraints = {
      width: { ideal: 8192 },
      height: { ideal: 8192 },
    };
    if (videoDeviceId) probe.deviceId = { exact: videoDeviceId };
    else probe.facingMode = { ideal: facing };

    const media = await navigator.mediaDevices.getUserMedia({
      video: probe,
      audio: false,
    });
    const track = media.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as ExtendedCapabilities | undefined;
    const fromCaps =
      typeof caps?.width?.max === "number" &&
      typeof caps?.height?.max === "number"
        ? { width: caps.width.max, height: caps.height.max }
        : null;
    const settings = track?.getSettings();
    const fromSettings =
      typeof settings?.width === "number" && typeof settings?.height === "number"
        ? { width: settings.width, height: settings.height }
        : null;
    media.getTracks().forEach((t) => t.stop());
    return fromCaps ?? fromSettings;
  } catch {
    return null;
  }
}

/**
 * Mede o frame como ele realmente chega em um <video>. `getSettings()` pode
 * devolver o modo do sensor, e não o quadro já girado que o navegador entrega —
 * é essa diferença que fazia o formato principal sair recortado.
 */
async function measureFrame(media: MediaStream): Promise<Size | null> {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = media;
  void video.play().catch(() => {
    // só precisamos dos metadados; reprodução pode ser bloqueada
  });
  try {
    return await new Promise<Size | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 1500);
      const finish = () => {
        if (!video.videoWidth || !video.videoHeight) return;
        window.clearTimeout(timer);
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onloadedmetadata = finish;
      video.onresize = finish;
      finish();
    });
  } finally {
    video.onloadedmetadata = null;
    video.onresize = null;
    video.pause();
    video.srcObject = null;
  }
}

export function useCameraStream(options: CameraStreamOptions) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [features, setFeatures] = useState<TrackFeatures>(EMPTY_FEATURES);
  const [devices, setDevices] = useState<DeviceLists>({
    cameras: [],
    microphones: [],
  });
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const maxSizeCacheRef = useRef<Size | null>(null);
  // alguns navegadores (Safari no iOS) devolvem o frame girado em relação ao
  // que pedimos; guardamos por câmera/modo qual formato de pedido funcionou
  const shapePrefRef = useRef<Map<string, boolean>>(new Map());
  const unfixableRef = useRef<Set<string>>(new Set());

  const { videoDeviceId, audioDeviceId, resolution, fps, facing, captureMode } =
    options;

  useEffect(() => {
    let cancelled = false;

    async function open() {
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);

      // em Nativa, primeiro perguntamos o teto do aparelho
      let maxSize = maxSizeCacheRef.current;
      if (resolution === "native" && !maxSize) {
        maxSize = await probeMaxSize(videoDeviceId, facing);
        if (cancelled) return;
        maxSizeCacheRef.current = maxSize;
      }

      const base = captureSize(resolution, captureMode, maxSize);
      const shapeKey = `${videoDeviceId ?? facing}|${captureMode}|${resolution}`;
      const known = shapePrefRef.current.get(shapeKey);
      // tentamos o pedido "honesto" e, se o frame vier girado, repetimos com
      // width/height invertidos — a não ser que já saibamos que nenhum resolve
      const attempts = unfixableRef.current.has(shapeKey)
        ? [known ?? false]
        : known === undefined
          ? [false, true]
          : [known, !known];

      const audio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
      };
      if (audioDeviceId) audio.deviceId = { exact: audioDeviceId };

      try {
        for (let i = 0; i < attempts.length; i += 1) {
          const swap = attempts[i];
          const size = swap
            ? { width: base.height, height: base.width }
            : base;
          // sem aspectRatio: no iOS ele faz o Safari escolher um modo girado
          const video: MediaTrackConstraints = {
            width: { ideal: size.width },
            height: { ideal: size.height },
            frameRate: { ideal: fps },
          };
          if (videoDeviceId) video.deviceId = { exact: videoDeviceId };
          else video.facingMode = { ideal: facing };

          const media = await navigator.mediaDevices.getUserMedia({
            video,
            audio,
          });
          if (cancelled) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }

          const track = media.getVideoTracks()[0] ?? null;
          const measured = await measureFrame(media);
          if (cancelled) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          const settings = track?.getSettings();
          const sw = measured?.width ?? settings?.width ?? 0;
          const sh = measured?.height ?? settings?.height ?? 0;
          const oriented =
            !sw || !sh || (captureMode === "portrait" ? sh >= sw : sw >= sh);

          if (!oriented && i < attempts.length - 1) {
            media.getTracks().forEach((t) => t.stop());
            continue;
          }
          if (oriented) shapePrefRef.current.set(shapeKey, swap);
          else unfixableRef.current.add(shapeKey);
          streamRef.current = media;
          const nextFeatures = getTrackFeatures(track);
          // se a track agora declara um teto maior, guardamos para a próxima abertura
          if (nextFeatures.maxSize) {
            maxSizeCacheRef.current = nextFeatures.maxSize;
          }
          setStream(media);
          setFeatures(nextFeatures);

          // labels só ficam disponíveis depois da permissão concedida
          const all = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setDevices({
              cameras: all.filter((d) => d.kind === "videoinput"),
              microphones: all.filter((d) => d.kind === "audioinput"),
            });
          }
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof DOMException && err.name === "NotAllowedError"
              ? "Permissão de câmera/microfone negada. Libere o acesso nas configurações do navegador."
              : err instanceof Error
                ? err.message
                : "Não foi possível acessar a câmera.",
          );
        }
      }
    }

    open();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [videoDeviceId, audioDeviceId, resolution, fps, facing, captureMode]);

  // ao trocar de câmera o teto pode mudar
  useEffect(() => {
    maxSizeCacheRef.current = null;
  }, [videoDeviceId, facing]);

  const applyAdvanced = useCallback(async (constraint: AdvancedConstraint) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      // recurso indisponível neste dispositivo — a câmera segue em automático
    }
  }, []);

  const applyZoom = useCallback(
    (zoom: number) => applyAdvanced({ zoom }),
    [applyAdvanced],
  );

  const setTorch = useCallback(
    (on: boolean) => applyAdvanced({ torch: on }),
    [applyAdvanced],
  );

  /** compensação de exposição: ajuste fino por cima do automático da câmera */
  const applyExposure = useCallback(
    (value: number) =>
      applyAdvanced({
        exposureMode: "continuous",
        exposureCompensation: value,
      }),
    [applyAdvanced],
  );

  /** ISO exige assumir a exposição manualmente */
  const applyIso = useCallback(
    (value: number) => applyAdvanced({ exposureMode: "manual", iso: value }),
    [applyAdvanced],
  );

  return {
    stream,
    features,
    devices,
    error,
    applyZoom,
    setTorch,
    applyExposure,
    applyIso,
  };
}

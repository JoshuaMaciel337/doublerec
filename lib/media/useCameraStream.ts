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

      const size = captureSize(resolution, captureMode, maxSize);
      const video: MediaTrackConstraints = {
        width: { ideal: size.width },
        height: { ideal: size.height },
        aspectRatio: { ideal: size.width / size.height },
        frameRate: { ideal: fps },
      };
      if (videoDeviceId) video.deviceId = { exact: videoDeviceId };
      else video.facingMode = { ideal: facing };

      const audio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
      };
      if (audioDeviceId) audio.deviceId = { exact: audioDeviceId };

      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video,
          audio,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = media;
        const track = media.getVideoTracks()[0] ?? null;
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

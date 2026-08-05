"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FacingMode,
  Fps,
  Resolution,
  portraitCapture,
  TrackFeatures,
  getTrackFeatures,
} from "./capabilities";

export interface CameraStreamOptions {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  resolution: Resolution;
  fps: Fps;
  facing: FacingMode;
}

export interface DeviceLists {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
}

export function useCameraStream(options: CameraStreamOptions) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [features, setFeatures] = useState<TrackFeatures>({
    zoom: null,
    torch: false,
  });
  const [devices, setDevices] = useState<DeviceLists>({
    cameras: [],
    microphones: [],
  });
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { videoDeviceId, audioDeviceId, resolution, fps, facing } = options;

  useEffect(() => {
    let cancelled = false;

    async function open() {
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);

      const portrait = portraitCapture(resolution);
      const video: MediaTrackConstraints = {
        width: { ideal: portrait.width },
        height: { ideal: portrait.height },
        aspectRatio: { ideal: portrait.width / portrait.height },
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
        setStream(media);
        setFeatures(getTrackFeatures(media.getVideoTracks()[0] ?? null));

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
  }, [videoDeviceId, audioDeviceId, resolution, fps, facing]);

  const applyZoom = useCallback(async (zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom } as MediaTrackConstraintSet],
      });
    } catch {
      // zoom indisponível neste dispositivo — segue em modo automático
    }
  }, []);

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    } catch {
      // flash indisponível neste dispositivo
    }
  }, []);

  return { stream, features, devices, error, applyZoom, setTorch };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIO_BITRATE,
  CaptureMode,
  RecorderFormat,
  pickRecorderFormat,
} from "./capabilities";

export type RecorderState = "idle" | "recording";

export interface RecordingResult {
  horizontalUrl: string;
  verticalUrl: string;
  extension: "mp4" | "webm";
  durationMs: number;
  /** formato principal veio direto da câmera (sem reencode do canvas) */
  directPrimary: boolean;
  codecLabel: string;
}

export interface DualRecorderStartOptions {
  canvasH: HTMLCanvasElement;
  canvasV: HTMLCanvasElement;
  cameraStream: MediaStream;
  captureMode: CaptureMode;
  /**
   * Sem filtro/ajuste: o formato principal grava o track da câmera (melhor
   * qualidade). Com tratamento de imagem, os dois saem do canvas.
   */
  directPrimary: boolean;
  fps: number;
  videoBitsPerSecond: number;
}

interface ActiveRecording {
  recorders: [MediaRecorder, MediaRecorder];
  chunks: [Blob[], Blob[]];
  /** streams/tracks que nós criamos e devemos parar no stop */
  ownedTracks: MediaStreamTrack[];
  format: RecorderFormat;
  startedAt: number;
  directPrimary: boolean;
}

const CHUNK_TIMESLICE_MS = 1000;

function attachAudio(
  stream: MediaStream,
  audioTrack: MediaStreamTrack | null,
  owned: MediaStreamTrack[],
  clone: boolean,
): void {
  if (!audioTrack) return;
  if (clone) {
    const cloned = audioTrack.clone();
    owned.push(cloned);
    stream.addTrack(cloned);
  } else {
    stream.addTrack(audioTrack);
  }
}

export function useDualRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCodec, setActiveCodec] = useState<string | null>(null);

  const activeRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<number | null>(null);
  const resultRef = useRef<RecordingResult | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const revokeResult = (r: RecordingResult | null) => {
    if (!r) return;
    URL.revokeObjectURL(r.horizontalUrl);
    URL.revokeObjectURL(r.verticalUrl);
  };

  const start = useCallback((options: DualRecorderStartOptions): boolean => {
    if (activeRef.current) return false;

    const format = pickRecorderFormat();
    if (!format) {
      setError("Este navegador não suporta gravação de vídeo (MediaRecorder).");
      return false;
    }
    setError(null);
    setActiveCodec(format.label);

    const {
      canvasH,
      canvasV,
      cameraStream,
      captureMode,
      directPrimary,
      fps,
      videoBitsPerSecond,
    } = options;

    const cameraVideo = cameraStream.getVideoTracks()[0] ?? null;
    const cameraAudio = cameraStream.getAudioTracks()[0] ?? null;
    const ownedTracks: MediaStreamTrack[] = [];

    let streamH: MediaStream;
    let streamV: MediaStream;

    if (directPrimary && cameraVideo) {
      // formato principal = clone do track da câmera (sem passar pelo canvas)
      const primaryVideo = cameraVideo.clone();
      ownedTracks.push(primaryVideo);
      const primaryStream = new MediaStream([primaryVideo]);
      // derivado continua saindo do canvas (recorte + eventual filtro futuro)
      if (captureMode === "portrait") {
        streamV = primaryStream;
        streamH = canvasH.captureStream(fps);
        streamH.getVideoTracks().forEach((t) => ownedTracks.push(t));
      } else {
        streamH = primaryStream;
        streamV = canvasV.captureStream(fps);
        streamV.getVideoTracks().forEach((t) => ownedTracks.push(t));
      }
      attachAudio(streamH, cameraAudio, ownedTracks, false);
      attachAudio(streamV, cameraAudio, ownedTracks, true);
    } else {
      // com filtro/ajuste: os dois canvases já têm o tratamento aplicado
      streamH = canvasH.captureStream(fps);
      streamV = canvasV.captureStream(fps);
      streamH.getVideoTracks().forEach((t) => ownedTracks.push(t));
      streamV.getVideoTracks().forEach((t) => ownedTracks.push(t));
      attachAudio(streamH, cameraAudio, ownedTracks, false);
      attachAudio(streamV, cameraAudio, ownedTracks, true);
    }

    const recorderOptions: MediaRecorderOptions = {
      mimeType: format.mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: AUDIO_BITRATE,
    };

    let recH: MediaRecorder;
    let recV: MediaRecorder;
    try {
      recH = new MediaRecorder(streamH, recorderOptions);
      recV = new MediaRecorder(streamV, recorderOptions);
    } catch {
      setError("Não foi possível iniciar a gravação neste navegador.");
      ownedTracks.forEach((t) => t.stop());
      return false;
    }

    const chunks: [Blob[], Blob[]] = [[], []];
    recH.ondataavailable = (e) => {
      if (e.data.size > 0) chunks[0].push(e.data);
    };
    recV.ondataavailable = (e) => {
      if (e.data.size > 0) chunks[1].push(e.data);
    };

    // iniciar os dois no mesmo tick para evitar drift entre os arquivos
    recH.start(CHUNK_TIMESLICE_MS);
    recV.start(CHUNK_TIMESLICE_MS);

    activeRef.current = {
      recorders: [recH, recV],
      chunks,
      ownedTracks,
      format,
      startedAt: Date.now(),
      directPrimary: Boolean(directPrimary && cameraVideo),
    };

    setResult((prev) => {
      revokeResult(prev);
      resultRef.current = null;
      return null;
    });
    setElapsedMs(0);
    setState("recording");

    clearTimer();
    timerRef.current = window.setInterval(() => {
      const active = activeRef.current;
      if (active) setElapsedMs(Date.now() - active.startedAt);
    }, 250);

    return true;
  }, []);

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    const active = activeRef.current;
    if (!active) return null;

    clearTimer();

    const stopped = active.recorders.map(
      (rec) =>
        new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.onerror = () => resolve();
        }),
    );

    // parar os dois no mesmo tick
    active.recorders.forEach((rec) => {
      if (rec.state !== "inactive") rec.stop();
    });
    await Promise.all(stopped);

    // só as tracks que clonamos / vieram do captureStream — a câmera segue viva
    active.ownedTracks.forEach((t) => {
      if (t.readyState !== "ended") t.stop();
    });

    const durationMs = Date.now() - active.startedAt;
    const blobH = new Blob(active.chunks[0], { type: active.format.mimeType });
    const blobV = new Blob(active.chunks[1], { type: active.format.mimeType });

    const newResult: RecordingResult = {
      horizontalUrl: URL.createObjectURL(blobH),
      verticalUrl: URL.createObjectURL(blobV),
      extension: active.format.extension,
      durationMs,
      directPrimary: active.directPrimary,
      codecLabel: active.format.label,
    };

    activeRef.current = null;
    resultRef.current = newResult;
    setResult(newResult);
    setState("idle");
    setElapsedMs(0);

    return newResult;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      const active = activeRef.current;
      if (active) {
        active.recorders.forEach((rec) => {
          if (rec.state !== "inactive") rec.stop();
        });
        active.ownedTracks.forEach((t) => {
          if (t.readyState !== "ended") t.stop();
        });
        activeRef.current = null;
      }
      revokeResult(resultRef.current);
    };
  }, []);

  return { state, elapsedMs, result, error, activeCodec, start, stop };
}

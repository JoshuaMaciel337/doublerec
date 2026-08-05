"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_BITRATE, RecorderFormat, pickRecorderFormat } from "./capabilities";

export type RecorderState = "idle" | "recording";

export interface RecordingResult {
  horizontalUrl: string;
  verticalUrl: string;
  extension: "mp4" | "webm";
  durationMs: number;
}

interface ActiveRecording {
  recorders: [MediaRecorder, MediaRecorder];
  chunks: [Blob[], Blob[]];
  captureStreams: [MediaStream, MediaStream];
  clonedAudioTrack: MediaStreamTrack | null;
  format: RecorderFormat;
  startedAt: number;
}

const CHUNK_TIMESLICE_MS = 1000;

export function useDualRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const start = useCallback(
    (
      canvasH: HTMLCanvasElement,
      canvasV: HTMLCanvasElement,
      audioTrack: MediaStreamTrack | null,
      fps: number,
      videoBitsPerSecond: number,
    ): boolean => {
      if (activeRef.current) return false;

      const format = pickRecorderFormat();
      if (!format) {
        setError("Este navegador não suporta gravação de vídeo (MediaRecorder).");
        return false;
      }
      setError(null);

      const streamH = canvasH.captureStream(fps);
      const streamV = canvasV.captureStream(fps);

      // áudio capturado uma única vez: track original em um stream, clone no outro
      let clonedAudioTrack: MediaStreamTrack | null = null;
      if (audioTrack) {
        streamH.addTrack(audioTrack);
        clonedAudioTrack = audioTrack.clone();
        streamV.addTrack(clonedAudioTrack);
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
        clonedAudioTrack?.stop();
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
        captureStreams: [streamH, streamV],
        clonedAudioTrack,
        format,
        startedAt: Date.now(),
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
    },
    [],
  );

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

    // encerrar apenas as tracks geradas pelos canvases e o clone de áudio —
    // a track de áudio original pertence ao stream da câmera e continua viva
    active.captureStreams.forEach((s) =>
      s.getVideoTracks().forEach((t) => t.stop()),
    );
    active.clonedAudioTrack?.stop();

    const durationMs = Date.now() - active.startedAt;
    const blobH = new Blob(active.chunks[0], { type: active.format.mimeType });
    const blobV = new Blob(active.chunks[1], { type: active.format.mimeType });

    const newResult: RecordingResult = {
      horizontalUrl: URL.createObjectURL(blobH),
      verticalUrl: URL.createObjectURL(blobV),
      extension: active.format.extension,
      durationMs,
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
        active.captureStreams.forEach((s) =>
          s.getVideoTracks().forEach((t) => t.stop()),
        );
        active.clonedAudioTrack?.stop();
        activeRef.current = null;
      }
      revokeResult(resultRef.current);
    };
  }, []);

  return { state, elapsedMs, result, error, start, stop };
}

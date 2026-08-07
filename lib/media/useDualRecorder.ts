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
  /** mesmos dados das URLs, para guardar na biblioteca sem reler */
  horizontalBlob: Blob;
  verticalBlob: Blob;
  mimeType: string;
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
  /** bitrate do formato principal */
  videoBitsPerSecond: number;
  /** bitrate do recorte — bem menor, já que ele sai em resolução menor */
  derivedBitsPerSecond?: number;
  /** fps do recorte; acima de 30 não compensa o custo de encode */
  derivedFps?: number;
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
      derivedBitsPerSecond,
      derivedFps,
    } = options;

    const cameraVideo = cameraStream.getVideoTracks()[0] ?? null;
    const cameraAudio = cameraStream.getAudioTracks()[0] ?? null;
    const ownedTracks: MediaStreamTrack[] = [];
    const cropFps = Math.min(derivedFps ?? fps, fps);
    const primaryPortrait = captureMode === "portrait";

    let streamH: MediaStream;
    let streamV: MediaStream;

    if (directPrimary && cameraVideo) {
      // formato principal = clone do track da câmera (sem passar pelo canvas)
      const primaryVideo = cameraVideo.clone();
      ownedTracks.push(primaryVideo);
      const primaryStream = new MediaStream([primaryVideo]);
      // derivado continua saindo do canvas (recorte + eventual filtro futuro)
      if (primaryPortrait) {
        streamV = primaryStream;
        streamH = canvasH.captureStream(cropFps);
        streamH.getVideoTracks().forEach((t) => ownedTracks.push(t));
      } else {
        streamH = primaryStream;
        streamV = canvasV.captureStream(cropFps);
        streamV.getVideoTracks().forEach((t) => ownedTracks.push(t));
      }
      attachAudio(streamH, cameraAudio, ownedTracks, false);
      attachAudio(streamV, cameraAudio, ownedTracks, true);
    } else {
      // com filtro/ajuste: os dois canvases já têm o tratamento aplicado
      streamH = canvasH.captureStream(primaryPortrait ? cropFps : fps);
      streamV = canvasV.captureStream(primaryPortrait ? fps : cropFps);
      streamH.getVideoTracks().forEach((t) => ownedTracks.push(t));
      streamV.getVideoTracks().forEach((t) => ownedTracks.push(t));
      attachAudio(streamH, cameraAudio, ownedTracks, false);
      attachAudio(streamV, cameraAudio, ownedTracks, true);
    }

    // cada saída tem o seu bitrate: cobrar do recorte o preço do 4K é o que
    // mais afoga o encoder em resolução alta
    const cropBits = derivedBitsPerSecond ?? videoBitsPerSecond;
    const optionsFor = (bits: number): MediaRecorderOptions => ({
      mimeType: format.mimeType,
      videoBitsPerSecond: bits,
      audioBitsPerSecond: AUDIO_BITRATE,
    });

    let recH: MediaRecorder;
    let recV: MediaRecorder;
    try {
      recH = new MediaRecorder(
        streamH,
        optionsFor(primaryPortrait ? cropBits : videoBitsPerSecond),
      );
      recV = new MediaRecorder(
        streamV,
        optionsFor(primaryPortrait ? videoBitsPerSecond : cropBits),
      );
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

    // pedir o último pedaço antes de encerrar: sem isso o trecho gravado desde
    // o timeslice anterior pode ficar de fora do arquivo
    active.recorders.forEach((rec) => {
      if (rec.state === "recording") {
        try {
          rec.requestData();
        } catch {
          // alguns navegadores recusam durante a parada; o stop já libera
        }
      }
    });

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

    activeRef.current = null;

    // um arquivo vazio significa que o encoder desistiu no meio: melhor dizer
    // isso do que entregar um take quebrado como se estivesse tudo certo
    if (blobH.size < 1024 || blobV.size < 1024) {
      setError(
        "Uma das versões saiu vazia — o aparelho não deu conta da resolução/FPS escolhidos. Reduza em Configurações e grave de novo.",
      );
      setState("idle");
      setElapsedMs(0);
      return null;
    }

    const newResult: RecordingResult = {
      horizontalUrl: URL.createObjectURL(blobH),
      verticalUrl: URL.createObjectURL(blobV),
      horizontalBlob: blobH,
      verticalBlob: blobV,
      mimeType: active.format.mimeType,
      extension: active.format.extension,
      durationMs,
      directPrimary: active.directPrimary,
      codecLabel: active.format.label,
    };

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

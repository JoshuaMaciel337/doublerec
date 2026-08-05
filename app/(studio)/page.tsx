"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraPreview from "@/components/camera/CameraPreview";
import CropOverlay from "@/components/camera/CropOverlay";
import DualCanvasRenderer from "@/components/camera/DualCanvasRenderer";
import AudioMeter from "@/components/controls/AudioMeter";
import CameraSettingsBar from "@/components/controls/CameraSettingsBar";
import SettingsSheet from "@/components/controls/SettingsSheet";
import ExportPanel from "@/components/export/ExportPanel";
import {
  AUDIO_BITRATE,
  FacingMode,
  Fps,
  GridMode,
  Resolution,
  StartTimer,
  VIDEO_BITRATES,
} from "@/lib/media/capabilities";
import { useCameraStream } from "@/lib/media/useCameraStream";
import { useDualRecorder } from "@/lib/media/useDualRecorder";
import { createClient } from "@/lib/supabase/client";

const GRID_CYCLE: GridMode[] = ["3x3", "cross", "safe", "none"];

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function GhostButton({
  label,
  onClick,
  disabled = false,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors disabled:opacity-35 ${
        active ? "bg-amber-400 text-black" : "text-zinc-200 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

export default function StudioPage() {
  // configurações de captura
  const [facing, setFacing] = useState<FacingMode>("user");
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(null);
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [fps, setFps] = useState<Fps>(30);
  const [startTimer, setStartTimer] = useState<StartTimer>(0);
  const [grid, setGrid] = useState<GridMode>("3x3");
  const [fileName, setFileName] = useState("video");

  // UI
  const [verticalFirst, setVerticalFirst] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // posição da faixa 16:9 derivada dentro do frame 9:16 primário
  const [cropY, setCropY] = useState(0.5);
  const cropYRef = useRef(0.5);

  const canvasHRef = useRef<HTMLCanvasElement | null>(null);
  const canvasVRef = useRef<HTMLCanvasElement | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const { stream, features, devices, error, applyZoom, setTorch } =
    useCameraStream({ videoDeviceId, audioDeviceId, resolution, fps, facing });

  const recorder = useDualRecorder();
  const recording = recorder.state === "recording";

  const handleCropChange = useCallback((value: number) => {
    cropYRef.current = value;
    setCropY(value);
  }, []);

  // zoom e flash voltam ao padrão quando o stream muda
  useEffect(() => {
    setZoomLevel(1);
    setTorchOn(false);
  }, [stream]);

  // estimativa de espaço/tempo restante
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (!navigator.storage?.estimate) return;
      try {
        const { quota, usage } = await navigator.storage.estimate();
        if (quota == null || cancelled) return;
        const free = Math.max(0, quota - (usage ?? 0));
        const bytesPerSecond =
          (VIDEO_BITRATES[resolution] * 2 + AUDIO_BITRATE * 2) / 8;
        setMinutesLeft(Math.floor(free / bytesPerSecond / 60));
      } catch {
        // estimativa indisponível
      }
    };
    update();
    const id = window.setInterval(update, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [resolution]);

  const beginRecording = useCallback(() => {
    const canvasH = canvasHRef.current;
    const canvasV = canvasVRef.current;
    if (!canvasH || !canvasV || !stream) return;
    const audioTrack = stream.getAudioTracks()[0] ?? null;
    recorder.start(canvasH, canvasV, audioTrack, fps, VIDEO_BITRATES[resolution]);
  }, [stream, fps, resolution, recorder]);

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  // quando a contagem chega a zero, dispara a gravação
  useEffect(() => {
    if (countdown === 0) {
      cancelCountdown();
      beginRecording();
    }
  }, [countdown, cancelCountdown, beginRecording]);

  useEffect(() => cancelCountdown, [cancelCountdown]);

  const handleRecordPress = useCallback(async () => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    if (recording) {
      const result = await recorder.stop();
      if (result) setExportOpen(true);
      return;
    }
    if (startTimer > 0) {
      setCountdown(startTimer);
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      }, 1000);
    } else {
      beginRecording();
    }
  }, [countdown, recording, startTimer, cancelCountdown, recorder, beginRecording]);

  const handleSwitchCamera = useCallback(() => {
    const cams = devices.cameras;
    if (cams.length > 1) {
      const currentId =
        stream?.getVideoTracks()[0]?.getSettings().deviceId ?? videoDeviceId;
      const idx = cams.findIndex((c) => c.deviceId === currentId);
      setVideoDeviceId(cams[(idx + 1) % cams.length].deviceId);
    } else {
      setVideoDeviceId(null);
      setFacing((f) => (f === "user" ? "environment" : "user"));
    }
  }, [devices.cameras, stream, videoDeviceId]);

  const handleCycleZoom = useCallback(() => {
    const cap = features.zoom;
    if (!cap) return;
    const presets = [1, 2, 3].filter((z) => z >= cap.min && z <= cap.max);
    if (presets.length === 0) return;
    const idx = presets.indexOf(zoomLevel);
    const next = presets[(idx + 1) % presets.length];
    setZoomLevel(next);
    applyZoom(next);
  }, [features.zoom, zoomLevel, applyZoom]);

  const handleToggleTorch = useCallback(() => {
    setTorchOn((on) => {
      setTorch(!on);
      return !on;
    });
  }, [setTorch]);

  const handleCycleGrid = useCallback(() => {
    setGrid((g) => GRID_CYCLE[(GRID_CYCLE.indexOf(g) + 1) % GRID_CYCLE.length]);
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black text-zinc-100">
      <DualCanvasRenderer
        stream={stream}
        resolution={resolution}
        cropYRef={cropYRef}
        canvasHRef={canvasHRef}
        canvasVRef={canvasVRef}
      />

      {/* barra superior */}
      <header className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-1">
          <GhostButton
            label="Reiniciar sessão"
            onClick={() => window.location.reload()}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </GhostButton>
          <GhostButton label="Sobre o DoubleRec" onClick={() => setInfoOpen(true)}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>
          </GhostButton>
          <GhostButton label="Sair da conta" onClick={handleLogout} disabled={recording}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
              <path d="m10 17 5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </GhostButton>
        </div>

        {recording ? (
          <span className="flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 font-mono text-sm font-semibold text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {formatElapsed(recorder.elapsedMs)}
          </span>
        ) : (
          <h1 className="text-sm font-semibold tracking-wide">
            DoubleRec Studio
          </h1>
        )}

        <div className="flex items-center gap-1">
          {features.torch && (
            <GhostButton
              label={torchOn ? "Desligar flash" : "Ligar flash"}
              onClick={handleToggleTorch}
              active={torchOn}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
              </svg>
            </GhostButton>
          )}
          <GhostButton
            label="Configurações"
            onClick={() => setSettingsOpen(true)}
            disabled={recording}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
              <circle cx="16" cy="8" r="2" />
              <circle cx="8" cy="16" r="2" />
            </svg>
          </GhostButton>
        </div>
      </header>

      {/* linha de status: resolução, tempo restante estimado e VU meter */}
      <div className="flex items-center justify-center gap-3 px-4 pt-1.5 text-[11px] text-zinc-400">
        <span>
          {resolution} · {fps} fps
        </span>
        {minutesLeft !== null && <span>· ~{minutesLeft} min restantes</span>}
        <AudioMeter stream={stream} />
      </div>

      {/* previews */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center gap-3 px-4 py-3 md:flex-row md:items-center md:justify-center md:gap-6">
        {error ? (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <p className="text-sm text-zinc-300">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              Tentar novamente
            </button>
          </div>
        ) : !stream ? (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm">Aguardando permissão da câmera…</p>
          </div>
        ) : (
          <>
            <div
              className={`flex min-h-0 w-full flex-1 items-center justify-center md:h-[30vw] md:w-auto md:flex-none lg:h-[26vw] ${
                verticalFirst ? "order-1" : "order-2"
              }`}
            >
              <CameraPreview
                canvasRef={canvasVRef}
                aspect="vertical"
                grid={grid}
                className="h-full"
              >
                <CropOverlay cropY={cropY} onChange={handleCropChange} />
              </CameraPreview>
            </div>
            <div
              className={`flex w-full items-center justify-center md:h-[30vw] md:w-auto lg:h-[26vw] ${
                verticalFirst ? "order-2" : "order-1"
              }`}
            >
              <CameraPreview
                canvasRef={canvasHRef}
                aspect="horizontal"
                grid={grid}
                className="w-full max-w-[560px] md:h-full md:w-auto md:max-w-none"
              />
            </div>
          </>
        )}

        {countdown !== null && countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/40">
            <span className="text-8xl font-bold tabular-nums text-white drop-shadow-lg">
              {countdown}
            </span>
          </div>
        )}
      </main>

      {recorder.error && (
        <p className="px-4 pb-1 text-center text-xs text-red-400">
          {recorder.error}
        </p>
      )}

      {/* barra inferior */}
      <CameraSettingsBar
        zoom={features.zoom}
        zoomLevel={zoomLevel}
        onCycleZoom={handleCycleZoom}
        onToggleLayout={() => setVerticalFirst((v) => !v)}
        gridMode={grid}
        onCycleGrid={handleCycleGrid}
        recording={recording}
        countdownActive={countdown !== null}
        recordDisabled={!stream}
        onRecordPress={handleRecordPress}
        hasResult={recorder.result !== null}
        onOpenGallery={() => setExportOpen(true)}
        onSwitchCamera={handleSwitchCamera}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        devices={devices}
        videoDeviceId={videoDeviceId}
        onVideoDeviceChange={setVideoDeviceId}
        audioDeviceId={audioDeviceId}
        onAudioDeviceChange={setAudioDeviceId}
        resolution={resolution}
        onResolutionChange={setResolution}
        fps={fps}
        onFpsChange={setFps}
        startTimer={startTimer}
        onStartTimerChange={setStartTimer}
        grid={grid}
        onGridChange={setGrid}
        fileName={fileName}
        onFileNameChange={setFileName}
      />

      {infoOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-zinc-900 p-6 ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-base font-semibold">DoubleRec Studio</h2>
            <p className="mb-3 text-sm leading-relaxed text-zinc-300">
              Grave uma vez. Publique em qualquer lugar. Uma única gravação
              gera dois vídeos simultâneos: vertical 9:16 (Reels, TikTok,
              Shorts) e horizontal 16:9 derivado (YouTube).
            </p>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Arraste a faixa 16:9 no preview vertical para escolher o
              enquadramento do vídeo horizontal derivado. O vertical 9:16 usa
              o enquadramento completo da câmera. Todo o processamento
              acontece no seu
              navegador — nada é enviado para servidores.
            </p>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/20"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {exportOpen && recorder.result && (
        <ExportPanel
          result={recorder.result}
          fileName={fileName}
          onFileNameChange={setFileName}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CameraPreview from "@/components/camera/CameraPreview";
import CropOverlay from "@/components/camera/CropOverlay";
import DualCanvasRenderer, {
  DEFAULT_RENDER_SETTINGS,
  RenderSettings,
} from "@/components/camera/DualCanvasRenderer";
import OrientationBadge from "@/components/camera/OrientationBadge";
import AdjustmentsPanel from "@/components/controls/AdjustmentsPanel";
import AudioMeter from "@/components/controls/AudioMeter";
import CameraSettingsBar from "@/components/controls/CameraSettingsBar";
import FilterStrip from "@/components/controls/FilterStrip";
import SettingsSheet from "@/components/controls/SettingsSheet";
import ExportPanel from "@/components/export/ExportPanel";
import SaveToast from "@/components/export/SaveToast";
import {
  AUDIO_BITRATE,
  CaptureKind,
  CaptureMode,
  FacingMode,
  Fps,
  GridMode,
  QUALITY_LABELS,
  QualityPreset,
  RESOLUTION_LABELS,
  Resolution,
  Rotation,
  StartTimer,
  aspectFor,
  videoBitrate,
} from "@/lib/media/capabilities";
import {
  buildTakeBase,
  canShareFiles,
  downloadUrls,
  shareCaptureFiles,
} from "@/lib/media/download";
import {
  FilterId,
  ImageAdjustments,
  NEUTRAL_ADJUSTMENTS,
  buildFilterString,
  getFilterPreset,
  isNeutral,
} from "@/lib/media/filters";
import { useCameraStream } from "@/lib/media/useCameraStream";
import { useDualRecorder } from "@/lib/media/useDualRecorder";
import { usePhotoCapture } from "@/lib/media/usePhotoCapture";
import { createClient } from "@/lib/supabase/client";

const GRID_CYCLE: GridMode[] = ["3x3", "cross", "safe", "none"];
const BADGE_DURATION_MS = 1700;
const FLASH_DURATION_MS = 180;
const TOAST_DURATION_MS = 6500;
const AUTO_SAVE_KEY = "doublerec.autoSave";

function readAutoSavePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AUTO_SAVE_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function readDeviceOrientation(): CaptureMode {
  if (typeof window === "undefined") return "portrait";
  return window.matchMedia("(orientation: landscape)").matches
    ? "landscape"
    : "portrait";
}

interface MediaPreview {
  kind: CaptureKind;
  horizontalUrl: string;
  verticalUrl: string;
  extension: string;
  durationMs?: number;
  directPrimary?: boolean;
  codecLabel?: string;
}

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
  const [quality, setQuality] = useState<QualityPreset>("high");
  const [fps, setFps] = useState<Fps>(30);
  const [startTimer, setStartTimer] = useState<StartTimer>(0);
  const [grid, setGrid] = useState<GridMode>("3x3");
  const [fileName, setFileName] = useState("video");
  const [autoSave, setAutoSave] = useState(readAutoSavePreference);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("video");
  const [deviceOrientation, setDeviceOrientation] =
    useState<CaptureMode>(readDeviceOrientation);

  // tratamento de imagem
  const [filterId, setFilterId] = useState<FilterId>("none");
  const [adjustments, setAdjustments] =
    useState<ImageAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [exposureOverride, setExposureOverride] = useState<number | null>(null);
  const [isoOverride, setIsoOverride] = useState<number | null>(null);

  // UI
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [cropEditing, setCropEditing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [media, setMedia] = useState<MediaPreview | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "ok" | "warn";
  } | null>(null);
  const [shareAvailable] = useState(() =>
    typeof window !== "undefined" ? canShareFiles() : false,
  );
  const [outputSize, setOutputSize] = useState<{
    horizontal: { width: number; height: number };
    vertical: { width: number; height: number };
    source: { width: number; height: number };
    mode: CaptureMode;
    fraction: number;
  } | null>(null);

  // posição do formato derivado dentro do principal
  const [crop, setCrop] = useState(0.5);
  const cropRef = useRef(0.5);

  // giro manual do quadro, para gravar deitado com a tela travada
  const [rotation, setRotation] = useState<Rotation>(0);
  const rotationRef = useRef<Rotation>(0);

  const canvasHRef = useRef<HTMLCanvasElement | null>(null);
  const canvasVRef = useRef<HTMLCanvasElement | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownValueRef = useRef<number | null>(null);
  const triggerCaptureRef = useRef<() => void>(() => {});
  const toastTimerRef = useRef<number | null>(null);
  const settingsRef = useRef<RenderSettings>(DEFAULT_RENDER_SETTINGS);
  const recordingRef = useRef(false);
  const modeChangedRef = useRef(false);
  const lastOrientationRef = useRef<CaptureMode | null>(null);
  const autoSaveRef = useRef(true);
  const fileNameRef = useRef(fileName);

  const {
    stream,
    features,
    devices,
    error,
    applyZoom,
    setTorch,
    applyExposure,
    applyIso,
  } = useCameraStream({
    videoDeviceId,
    audioDeviceId,
    resolution,
    fps,
    facing,
    deviceOrientation,
  });

  const recorder = useDualRecorder();
  const { capture: capturePhoto, error: photoError } = usePhotoCapture();
  const recording = recorder.state === "recording";

  const preset = getFilterPreset(filterId);
  // quem define o principal é a orientação do frame que a câmera entrega, que
  // por sua vez segue a posição do aparelho: é esse formato que tem a abertura
  // cheia, então a tela inteira precisa seguir a realidade
  const frameMode: CaptureMode = outputSize?.mode ?? deviceOrientation;
  const portraitPrimary = frameMode === "portrait";
  const derivedLabel = portraitPrimary ? "16:9" : "9:16";
  const exposureValue = exposureOverride ?? features.exposure?.current ?? 0;
  const isoValue = isoOverride ?? features.iso?.current ?? 0;
  const primaryCanvas = portraitPrimary
    ? outputSize?.vertical
    : outputSize?.horizontal;
  // gravar a track da câmera direto só vale quando o frame já é exatamente o
  // formato principal; senão o arquivo sairia com o aspecto do sensor
  const sourceIsPrimary =
    !!outputSize &&
    !!primaryCanvas &&
    Math.abs(
      outputSize.source.width / outputSize.source.height -
        aspectFor(frameMode),
    ) < 0.03 &&
    Math.abs(primaryCanvas.width - outputSize.source.width) <= 4 &&
    Math.abs(primaryCanvas.height - outputSize.source.height) <= 4;
  // com giro manual o quadro precisa passar pelo canvas para sair em pé
  const directPrimary =
    filterId === "none" &&
    isNeutral(adjustments) &&
    sourceIsPrimary &&
    rotation === 0;

  const sourceLabel = outputSize?.source ?? features.activeSize ?? null;
  const outputsLabel = (() => {
    if (!outputSize) return null;
    const v = `9:16 ${outputSize.vertical.width}×${outputSize.vertical.height}`;
    const h = `16:9 ${outputSize.horizontal.width}×${outputSize.horizontal.height}`;
    return portraitPrimary ? `${v} · ${h}` : `${h} · ${v}`;
  })();

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    autoSaveRef.current = autoSave;
  }, [autoSave]);

  useEffect(() => {
    fileNameRef.current = fileName;
  }, [fileName]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleAutoSaveChange = useCallback((value: boolean) => {
    setAutoSave(value);
    try {
      window.localStorage.setItem(AUTO_SAVE_KEY, value ? "1" : "0");
    } catch {
      // storage indisponível (modo privado etc.)
    }
  }, []);

  const showToast = useCallback((message: string, tone: "ok" | "warn" = "ok") => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const finishCapture = useCallback(
    async (preview: MediaPreview) => {
      setMedia(preview);
      setExportOpen(false);

      if (!autoSaveRef.current) {
        setExportOpen(true);
        return;
      }

      const base = buildTakeBase(fileNameRef.current);
      const ext = preview.extension;
      try {
        await downloadUrls([
          {
            url: preview.horizontalUrl,
            filename: `${base}_youtube.${ext}`,
          },
          {
            url: preview.verticalUrl,
            filename: `${base}_reels.${ext}`,
          },
        ]);
        showToast(
          preview.kind === "photo"
            ? "2 fotos salvas em Downloads"
            : preview.directPrimary
              ? `2 vídeos salvos (${preview.codecLabel ?? "MP4"} · principal direto)`
              : `2 vídeos salvos (${preview.codecLabel ?? "canvas"})`,
        );
      } catch {
        showToast(
          "Não deu para baixar automaticamente — abra a prévia e salve manualmente.",
          "warn",
        );
        setExportOpen(true);
      }
    },
    [showToast],
  );

  const handleShareToGallery = useCallback(async () => {
    if (!media) return;
    const base = buildTakeBase(fileNameRef.current);
    const mime =
      media.kind === "photo"
        ? "image/jpeg"
        : media.extension === "mp4"
          ? "video/mp4"
          : "video/webm";
    const result = await shareCaptureFiles({
      horizontalUrl: media.horizontalUrl,
      verticalUrl: media.verticalUrl,
      horizontalName: `${base}_youtube.${media.extension}`,
      verticalName: `${base}_reels.${media.extension}`,
      mimeType: mime,
      title: "DoubleRec",
    });
    if (result === "shared") {
      showToast("Escolha Galeria/Fotos no compartilhar do celular");
    } else if (result === "unavailable") {
      showToast(
        "Este navegador não envia arquivos para a Galeria — use os arquivos em Downloads.",
        "warn",
      );
    }
  }, [media, showToast]);

  // o loop de render lê os ajustes por ref para não reiniciar a cada slider
  useEffect(() => {
    settingsRef.current = {
      filter: buildFilterString(preset, adjustments),
      vignette: preset.vignette ?? 0,
      tint: preset.tint ?? null,
    };
  }, [preset, adjustments]);

  const handleCropChange = useCallback((value: number) => {
    cropRef.current = value;
    setCrop(value);
  }, []);

  // aviso visual a cada troca de orientação, menos na montagem
  useEffect(() => {
    if (!modeChangedRef.current) {
      modeChangedRef.current = true;
      return;
    }
    // o eixo do recorte inverte junto com o principal: recomeça centralizado
    cropRef.current = 0.5;
    setCrop(0.5);
    setCropEditing(false);
    setBadgeVisible(true);
    const id = window.setTimeout(
      () => setBadgeVisible(false),
      BADGE_DURATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [frameMode]);

  // o navegador só orienta o quadro no momento em que a câmera é aberta: girar
  // o aparelho não mexe na track que já está rodando, então reabrimos
  useEffect(() => {
    // no desktop "orientação" é só o formato da janela: redimensionar não deve
    // reabrir a câmera
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const query = window.matchMedia("(orientation: landscape)");
    const sync = () => {
      if (recordingRef.current) return;
      const next: CaptureMode = query.matches ? "landscape" : "portrait";
      const previous = lastOrientationRef.current;
      lastOrientationRef.current = next;
      // se a tela girou de verdade, o quadro novo já vem na posição certa e o
      // giro manual deixa de fazer sentido
      if (previous !== null && previous !== next) {
        rotationRef.current = 0;
        setRotation(0);
      }
      setDeviceOrientation(next);
    };
    sync();

    const screenOrientation = window.screen?.orientation;
    query.addEventListener("change", sync);
    screenOrientation?.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      screenOrientation?.removeEventListener("change", sync);
    };
    // reexecuta ao parar de gravar para aplicar uma rotação feita durante a take
  }, [recording]);

  // cada troca de orientação ou de dispositivo reabre a câmera em automático:
  // este é o ponto único que empurra as escolhas do usuário para a track nova
  useEffect(() => {
    if (!stream) return;
    if (features.zoom) applyZoom(zoomLevel);
    if (features.torch) setTorch(torchOn);
    if (features.exposure && exposureOverride !== null) {
      applyExposure(exposureOverride);
    }
    if (features.iso && isoOverride !== null) applyIso(isoOverride);
  }, [
    stream,
    features,
    zoomLevel,
    torchOn,
    exposureOverride,
    isoOverride,
    applyZoom,
    setTorch,
    applyExposure,
    applyIso,
  ]);

  // estimativa de espaço/tempo restante
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (!navigator.storage?.estimate) return;
      try {
        const { quota, usage } = await navigator.storage.estimate();
        if (quota == null || cancelled) return;
        const free = Math.max(0, quota - (usage ?? 0));
        const pixels =
          (outputSize?.horizontal.width ?? 1920) *
            (outputSize?.horizontal.height ?? 1080) +
          (outputSize?.vertical.width ?? 1080) *
            (outputSize?.vertical.height ?? 1920);
        const bitsPerSecond =
          videoBitrate(resolution, pixels / 2, quality) * 2 +
          AUDIO_BITRATE * 2;
        setMinutesLeft(Math.floor(free / (bitsPerSecond / 8) / 60));
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
  }, [resolution, outputSize, quality]);

  const beginRecording = useCallback(() => {
    const canvasH = canvasHRef.current;
    const canvasV = canvasVRef.current;
    if (!canvasH || !canvasV || !stream) return;
    // o recorder revoga as URLs da gravação anterior ao iniciar outra
    setMedia(null);
    const pixels = canvasH.width * canvasH.height;
    recorder.start({
      canvasH,
      canvasV,
      cameraStream: stream,
      captureMode: frameMode,
      directPrimary,
      fps,
      videoBitsPerSecond: videoBitrate(resolution, pixels, quality),
    });
  }, [
    stream,
    fps,
    resolution,
    quality,
    frameMode,
    directPrimary,
    recorder,
  ]);

  const takePhoto = useCallback(async () => {
    const canvasH = canvasHRef.current;
    const canvasV = canvasVRef.current;
    if (!canvasH || !canvasV) return;
    const shot = await capturePhoto(canvasH, canvasV);
    if (!shot) return;
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    await finishCapture({
      kind: "photo",
      horizontalUrl: shot.horizontalUrl,
      verticalUrl: shot.verticalUrl,
      extension: "jpg",
    });
  }, [capturePhoto, finishCapture]);

  const triggerCapture = useCallback(() => {
    if (captureKind === "photo") void takePhoto();
    else beginRecording();
  }, [captureKind, takePhoto, beginRecording]);

  useEffect(() => {
    triggerCaptureRef.current = triggerCapture;
  }, [triggerCapture]);

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownValueRef.current = null;
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(
    (seconds: number) => {
      countdownValueRef.current = seconds;
      setCountdown(seconds);
      countdownIntervalRef.current = window.setInterval(() => {
        const next = (countdownValueRef.current ?? 1) - 1;
        if (next <= 0) {
          cancelCountdown();
          triggerCaptureRef.current();
          return;
        }
        countdownValueRef.current = next;
        setCountdown(next);
      }, 1000);
    },
    [cancelCountdown],
  );

  useEffect(() => cancelCountdown, [cancelCountdown]);

  const handleMainPress = useCallback(async () => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    if (recording) {
      const result = await recorder.stop();
      if (result) {
        await finishCapture({
          kind: "video",
          horizontalUrl: result.horizontalUrl,
          verticalUrl: result.verticalUrl,
          extension: result.extension,
          durationMs: result.durationMs,
          directPrimary: result.directPrimary,
          codecLabel: result.codecLabel,
        });
      }
      return;
    }
    setCropEditing(false);
    setFiltersOpen(false);
    if (startTimer > 0) startCountdown(startTimer);
    else triggerCapture();
  }, [
    countdown,
    recording,
    startTimer,
    cancelCountdown,
    startCountdown,
    recorder,
    triggerCapture,
    finishCapture,
  ]);

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
    setZoomLevel(presets[(idx + 1) % presets.length]);
  }, [features.zoom, zoomLevel]);

  const handleToggleTorch = useCallback(() => {
    setTorchOn((on) => !on);
  }, []);

  const handleCycleGrid = useCallback(() => {
    setGrid((g) => GRID_CYCLE[(GRID_CYCLE.indexOf(g) + 1) % GRID_CYCLE.length]);
  }, []);

  // com a tela travada o navegador entrega sempre o mesmo quadro: giramos nós.
  // são dois sentidos porque não dá para saber para que lado o celular virou
  const handleToggleCaptureMode = useCallback(() => {
    if (recordingRef.current) return;
    setRotation((current) => {
      const next: Rotation = current === 0 ? 90 : current === 90 ? 270 : 0;
      rotationRef.current = next;
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }, []);

  const cropTools = (primary: boolean) => {
    if (!primary || recording || countdown !== null) return null;
    if (cropEditing) {
      return (
        <CropOverlay
          axis={portraitPrimary ? "y" : "x"}
          value={crop}
          label={derivedLabel}
          fraction={outputSize?.fraction}
          onChange={handleCropChange}
          onConfirm={() => setCropEditing(false)}
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => setCropEditing(true)}
        title={`Escolher o recorte ${derivedLabel}`}
        aria-label={`Escolher o recorte ${derivedLabel}`}
        className="absolute right-2 top-2 z-30 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/80"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      </button>
    );
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black text-zinc-100">
      <DualCanvasRenderer
        stream={stream}
        resolution={resolution}
        cropRef={cropRef}
        rotationRef={rotationRef}
        settingsRef={settingsRef}
        canvasHRef={canvasHRef}
        canvasVRef={canvasVRef}
        onOutputSize={setOutputSize}
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
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 pt-1.5 text-[11px] text-zinc-400">
        <span>
          {RESOLUTION_LABELS[resolution]} · {QUALITY_LABELS[quality]}
          {sourceLabel
            ? ` · cam ${sourceLabel.width}×${sourceLabel.height}`
            : ""}
          {outputsLabel ? ` · ${outputsLabel}` : ""} · {fps} fps
          {directPrimary ? " · principal direto" : " · via canvas"}
          {recorder.activeCodec ? ` · ${recorder.activeCodec}` : ""}
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
              className={`flex min-h-0 items-center justify-center md:h-[30vw] md:w-auto md:flex-none lg:h-[26vw] ${
                portraitPrimary ? "order-1 w-full flex-1" : "order-2 shrink-0"
              }`}
            >
              <CameraPreview
                canvasRef={canvasVRef}
                aspect="vertical"
                grid={grid}
                className={
                  portraitPrimary
                    ? "h-full"
                    : "h-[18vh] max-h-full w-auto md:h-full"
                }
              >
                {cropTools(portraitPrimary)}
              </CameraPreview>
            </div>
            <div
              className={`flex items-center justify-center md:h-[30vw] md:w-auto lg:h-[26vw] ${
                portraitPrimary
                  ? "order-2 w-full"
                  : "order-1 min-h-0 w-full flex-1"
              }`}
            >
              <CameraPreview
                canvasRef={canvasHRef}
                aspect="horizontal"
                grid={grid}
                className={
                  portraitPrimary
                    ? "w-full max-w-[560px] md:h-full md:w-auto md:max-w-none"
                    : "h-full max-h-full w-auto max-w-full"
                }
              >
                {cropTools(!portraitPrimary)}
              </CameraPreview>
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

        <OrientationBadge mode={frameMode} visible={badgeVisible} />
      </main>

      {(recorder.error || photoError) && (
        <p className="px-4 pb-1 text-center text-xs text-red-400">
          {recorder.error ?? photoError}
        </p>
      )}

      <FilterStrip
        open={filtersOpen}
        value={filterId}
        onChange={setFilterId}
        onClose={() => setFiltersOpen(false)}
      />

      {/* barra inferior */}
      <CameraSettingsBar
        zoom={features.zoom}
        zoomLevel={zoomLevel}
        onCycleZoom={handleCycleZoom}
        captureMode={frameMode}
        rotation={rotation}
        onToggleCaptureMode={handleToggleCaptureMode}
        filterLabel={filterId === "none" ? "Filtro" : preset.label}
        filterActive={filtersOpen || filterId !== "none"}
        onOpenFilters={() => setFiltersOpen((v) => !v)}
        adjustmentsActive={
          !isNeutral(adjustments) || (exposureOverride ?? 0) !== 0
        }
        onOpenAdjustments={() => setAdjustmentsOpen(true)}
        captureKind={captureKind}
        onCaptureKindChange={setCaptureKind}
        gridMode={grid}
        onCycleGrid={handleCycleGrid}
        recording={recording}
        countdownActive={countdown !== null}
        recordDisabled={!stream}
        onRecordPress={handleMainPress}
        hasResult={media !== null}
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
        cameraMaxSize={features.maxSize}
        quality={quality}
        onQualityChange={setQuality}
        fps={fps}
        onFpsChange={setFps}
        startTimer={startTimer}
        onStartTimerChange={setStartTimer}
        grid={grid}
        onGridChange={setGrid}
        autoSave={autoSave}
        onAutoSaveChange={handleAutoSaveChange}
        fileName={fileName}
        onFileNameChange={setFileName}
      />

      <AdjustmentsPanel
        open={adjustmentsOpen}
        onClose={() => setAdjustmentsOpen(false)}
        adjustments={adjustments}
        onAdjustmentsChange={setAdjustments}
        exposure={features.exposure}
        exposureValue={exposureValue}
        onExposureChange={setExposureOverride}
        iso={features.iso}
        isoValue={isoValue}
        onIsoChange={setIsoOverride}
      />

      <SaveToast
        open={toast !== null}
        kind={media?.kind ?? captureKind}
        message={toast?.message ?? ""}
        tone={toast?.tone}
        canShare={shareAvailable && media !== null}
        onShare={() => void handleShareToGallery()}
        onOpenPanel={() => {
          setToast(null);
          setExportOpen(true);
        }}
        onDismiss={() => setToast(null)}
      />

      {flashing && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-white" />
      )}

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
              Grave uma vez. Publique em qualquer lugar. Cada captura — vídeo ou
              foto — gera os dois formatos ao mesmo tempo: vertical 9:16 (Reels,
              TikTok, Shorts) e horizontal 16:9 (YouTube).
            </p>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              O formato principal usa a abertura inteira da câmera e o outro é
              um recorte dele. Para gravar deitado, vire o celular e toque na
              pill de orientação — se a imagem ficar de cabeça para baixo, toque
              de novo. Com “Salvar na hora” (ligado por padrão), ao parar
              as duas versões já vão para Downloads — em evento você grava take
              atrás de take sem abrir a tela de download. No celular, o aviso
              também oferece a opção de mandar para a Galeria quando o navegador
              permitir.
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

      {exportOpen && media && (
        <ExportPanel
          kind={media.kind}
          horizontalUrl={media.horizontalUrl}
          verticalUrl={media.verticalUrl}
          extension={media.extension}
          durationMs={media.durationMs}
          fileName={fileName}
          onFileNameChange={setFileName}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

export type Resolution = "720p" | "1080p" | "2k" | "4k" | "native";
export type Fps = 24 | 30 | 60;
export type GridMode = "none" | "3x3" | "cross" | "safe";
export type FacingMode = "user" | "environment";
export type StartTimer = 0 | 3 | 5 | 10;
/** Orientação da gravação principal: a que sai em resolução cheia */
export type CaptureMode = "portrait" | "landscape";
export type CaptureKind = "video" | "photo";
/** Bitrate relativo — Ultra aproxima mais a câmera nativa, mas pesa mais */
export type QualityPreset = "low" | "medium" | "high" | "ultra";

export const RESOLUTION_OPTIONS: readonly Resolution[] = [
  "720p",
  "1080p",
  "2k",
  "4k",
  "native",
] as const;

export const QUALITY_OPTIONS: readonly QualityPreset[] = [
  "low",
  "medium",
  "high",
  "ultra",
] as const;

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  ultra: "Ultra",
};

/** Dimensões-alvo em paisagem (16:9). Em retrato invertimos width/height. */
export const RESOLUTIONS: Record<
  Exclude<Resolution, "native">,
  { width: number; height: number }
> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "2k": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  "720p": "720p",
  "1080p": "1080p",
  "2k": "2K",
  "4k": "4K",
  native: "Nativa",
};

/**
 * Resolução pedida à câmera. Em "native" pedimos o máximo que o aparelho
 * declarar (ou 8K ideal, se a API não expuser o teto).
 */
export function captureSize(
  resolution: Resolution,
  mode: CaptureMode,
  maxSize?: { width: number; height: number } | null,
) {
  if (resolution === "native") {
    const width = maxSize?.width ?? 8192;
    const height = maxSize?.height ?? 8192;
    // pedimos o maior eixo possível; o aspectRatio do modo guia o crop
    return mode === "portrait"
      ? { width: Math.min(width, height), height: Math.max(width, height) }
      : { width: Math.max(width, height), height: Math.min(width, height) };
  }
  const res = RESOLUTIONS[resolution];
  return mode === "portrait"
    ? { width: res.height, height: res.width }
    : { width: res.width, height: res.height };
}

const BASE_BITRATES: Record<Exclude<Resolution, "native">, number> = {
  "720p": 6_000_000,
  "1080p": 12_000_000,
  "2k": 20_000_000,
  "4k": 45_000_000,
};

const QUALITY_MULTIPLIER: Record<QualityPreset, number> = {
  low: 0.55,
  medium: 0.85,
  high: 1.2,
  ultra: 1.75,
};

/**
 * Bitrate do encoder. Em Nativa escala pelos pixels reais; o preset de
 * qualidade multiplica o valor (Ultra aproxima a câmera nativa).
 */
export function videoBitrate(
  resolution: Resolution,
  outputPixels?: number,
  quality: QualityPreset = "high",
): number {
  const base =
    resolution !== "native"
      ? BASE_BITRATES[resolution]
      : Math.round(
          ((outputPixels ?? 1920 * 1080) / (1920 * 1080)) * 12_000_000,
        );
  const scaled = Math.round(base * QUALITY_MULTIPLIER[quality]);
  return Math.min(Math.max(scaled, 4_000_000), 80_000_000);
}

/** @deprecated use videoBitrate — mantido só para imports antigos */
export const VIDEO_BITRATES: Record<Exclude<Resolution, "native">, number> =
  BASE_BITRATES;

export const AUDIO_BITRATE = 192_000;

export interface Size {
  width: number;
  height: number;
}

/**
 * Dimensiona os dois canvases a partir do frame real da câmera.
 * Nunca inventa pixels: o formato principal é o cover 9:16/16:9 do sensor,
 * e o derivado é o recorte interno em escala 1:1. Em presets nomeados,
 * reduzimos (nunca aumentamos) para caber no alvo.
 */
export function canvasSizesForSource(
  resolution: Resolution,
  mode: CaptureMode,
  sourceW: number,
  sourceH: number,
): { horizontal: Size; vertical: Size } {
  const primaryAspect = mode === "portrait" ? 9 / 16 : 16 / 9;
  let pw = sourceW;
  let ph = sourceW / primaryAspect;
  if (ph > sourceH) {
    ph = sourceH;
    pw = sourceH * primaryAspect;
  }

  if (resolution !== "native") {
    const target = RESOLUTIONS[resolution];
    const targetPrimary =
      mode === "portrait"
        ? { width: target.height, height: target.width }
        : { width: target.width, height: target.height };
    // só reduz se a câmera entregou mais que o preset; nunca estica
    const scale = Math.min(
      1,
      targetPrimary.width / pw,
      targetPrimary.height / ph,
    );
    pw *= scale;
    ph *= scale;
  }

  const derivedAspect = mode === "portrait" ? 16 / 9 : 9 / 16;
  let dw = pw;
  let dh = pw / derivedAspect;
  if (dh > ph) {
    dh = ph;
    dw = ph * derivedAspect;
  }

  const primary = { width: Math.round(pw), height: Math.round(ph) };
  const derived = { width: Math.round(dw), height: Math.round(dh) };

  return mode === "portrait"
    ? { vertical: primary, horizontal: derived }
    : { horizontal: primary, vertical: derived };
}

export function formatSize(size: Size): string {
  return `${size.width}×${size.height}`;
}

export interface RangeCapability {
  min: number;
  max: number;
  step: number;
  /** valor atual reportado pela track, quando disponível */
  current: number;
}

export type ZoomCapability = RangeCapability;

export interface TrackFeatures {
  zoom: ZoomCapability | null;
  torch: boolean;
  /** compensação de exposição em stops — ajuste fino sobre o modo automático */
  exposure: RangeCapability | null;
  /** ISO real do sensor; exige exposureMode manual, raro fora do Android */
  iso: RangeCapability | null;
  /** maior resolução que a track declara (quando a API expõe) */
  maxSize: Size | null;
  /** resolução efetiva que o navegador entregou */
  activeSize: Size | null;
}

export const EMPTY_FEATURES: TrackFeatures = {
  zoom: null,
  torch: false,
  exposure: null,
  iso: null,
  maxSize: null,
  activeSize: null,
};

// zoom, torch, exposição e ISO ainda não fazem parte do MediaTrackCapabilities padrão
type NumericRange = { min?: number; max?: number; step?: number };

type ExtendedCapabilities = MediaTrackCapabilities & {
  zoom?: NumericRange;
  torch?: boolean;
  exposureMode?: string[];
  exposureCompensation?: NumericRange;
  iso?: NumericRange;
  width?: NumericRange;
  height?: NumericRange;
};

type ExtendedSettings = MediaTrackSettings & {
  zoom?: number;
  exposureCompensation?: number;
  iso?: number;
};

function toRange(
  range: NumericRange | undefined,
  current: number | undefined,
  fallbackStep: number,
): RangeCapability | null {
  if (
    !range ||
    typeof range.min !== "number" ||
    typeof range.max !== "number" ||
    range.max <= range.min
  ) {
    return null;
  }
  const step = range.step && range.step > 0 ? range.step : fallbackStep;
  const mid = (range.min + range.max) / 2;
  return {
    min: range.min,
    max: range.max,
    step,
    current: typeof current === "number" ? current : mid,
  };
}

export function getTrackFeatures(track: MediaStreamTrack | null): TrackFeatures {
  if (!track || typeof track.getCapabilities !== "function") {
    return EMPTY_FEATURES;
  }
  const caps = track.getCapabilities() as ExtendedCapabilities;
  const settings = track.getSettings() as ExtendedSettings;

  const zoomRange = toRange(caps.zoom, settings.zoom, 0.1);
  const zoom = zoomRange && zoomRange.max > 1 ? zoomRange : null;

  // exposureCompensation só faz efeito quando a câmera aceita exposição contínua
  const supportsContinuous =
    !caps.exposureMode || caps.exposureMode.includes("continuous");
  const exposure = supportsContinuous
    ? toRange(caps.exposureCompensation, settings.exposureCompensation, 0.1)
    : null;

  // ISO manual depende de exposureMode "manual"
  const iso = caps.exposureMode?.includes("manual")
    ? toRange(caps.iso, settings.iso, 1)
    : null;

  const maxSize =
    typeof caps.width?.max === "number" && typeof caps.height?.max === "number"
      ? { width: caps.width.max, height: caps.height.max }
      : null;

  const activeSize =
    typeof settings.width === "number" && typeof settings.height === "number"
      ? { width: settings.width, height: settings.height }
      : null;

  return {
    zoom,
    torch: caps.torch === true,
    exposure,
    iso,
    maxSize,
    activeSize,
  };
}

export interface RecorderFormat {
  mimeType: string;
  extension: "mp4" | "webm";
  label: string;
}

/**
 * Preferimos H.264/MP4 (mais próximo da câmera nativa e aceito por Instagram/
 * WhatsApp). High Profile primeiro; Baseline por último entre os MP4.
 */
const MIME_CANDIDATES: RecorderFormat[] = [
  {
    mimeType: 'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    extension: "mp4",
    label: "H.264 High",
  },
  {
    mimeType: 'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
    extension: "mp4",
    label: "H.264 Main",
  },
  {
    mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    extension: "mp4",
    label: "H.264",
  },
  { mimeType: "video/mp4", extension: "mp4", label: "MP4" },
  {
    mimeType: "video/webm;codecs=vp9,opus",
    extension: "webm",
    label: "VP9",
  },
  {
    mimeType: "video/webm;codecs=vp8,opus",
    extension: "webm",
    label: "VP8",
  },
  { mimeType: "video/webm", extension: "webm", label: "WebM" },
];

export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate;
  }
  return null;
}

export type Resolution = "720p" | "1080p" | "2k" | "4k" | "native";
export type Fps = 24 | 30 | 60;
export type GridMode = "none" | "3x3" | "cross" | "safe";
export type FacingMode = "user" | "environment";
export type StartTimer = 0 | 3 | 5 | 10;
/** Orientação da gravação principal: a que sai em resolução cheia */
export type CaptureMode = "portrait" | "landscape";
/**
 * Giro aplicado ao quadro da câmera, em graus no sentido horário. Serve para
 * quem grava com a rotação da tela travada: o navegador entrega o quadro sempre
 * na mesma orientação, então giramos nós para o conteúdo sair em pé.
 */
export type Rotation = 0 | 90 | 270;
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
 * Resolução pedida à câmera, sempre na forma natural do sensor (lado maior na
 * largura). Pedir uma orientação específica faz o navegador recortar o quadro
 * em vez de girá-lo; quem decide a orientação é a posição do aparelho.
 * Em "native" pedimos o máximo que o aparelho declarar (ou 8K ideal).
 */
export function captureSize(
  resolution: Resolution,
  maxSize?: { width: number; height: number } | null,
) {
  if (resolution === "native") {
    const width = maxSize?.width ?? 8192;
    const height = maxSize?.height ?? 8192;
    return {
      width: Math.max(width, height),
      height: Math.min(width, height),
    };
  }
  const res = RESOLUTIONS[resolution];
  return { width: res.width, height: res.height };
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

const FULL_HD_PIXELS = 1920 * 1080;

/**
 * Bitrate calculado pelos pixels que a saída realmente tem. É o que impede o
 * recorte de ser codificado ao preço de um 4K só porque o principal é 4K —
 * dois encoders no teto ao mesmo tempo é o que trava a gravação no celular.
 */
export function bitrateForOutput(
  pixels: number,
  quality: QualityPreset = "high",
  fps = 30,
): number {
  const scale = Math.max(0.15, pixels / FULL_HD_PIXELS);
  const fpsFactor = fps > 30 ? 1.35 : 1;
  const raw = 12_000_000 * scale * QUALITY_MULTIPLIER[quality] * fpsFactor;
  return Math.min(Math.max(Math.round(raw), 2_500_000), 80_000_000);
}

/** @deprecated use videoBitrate — mantido só para imports antigos */
export const VIDEO_BITRATES: Record<Exclude<Resolution, "native">, number> =
  BASE_BITRATES;

export const AUDIO_BITRATE = 192_000;

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PORTRAIT_ASPECT = 9 / 16;
export const LANDSCAPE_ASPECT = 16 / 9;

export function aspectFor(mode: CaptureMode): number {
  return mode === "portrait" ? PORTRAIT_ASPECT : LANDSCAPE_ASPECT;
}

/**
 * Maior retângulo com o aspecto pedido que cabe no frame da câmera (cover),
 * deslizado por `pos` no eixo que sobrar. Cada formato recorta o sensor por
 * conta própria — nenhum deles é recorte de recorte.
 */
export function coverRect(
  sourceW: number,
  sourceH: number,
  aspect: number,
  pos = 0.5,
): Rect {
  let width = sourceW;
  let height = sourceW / aspect;
  if (height > sourceH) {
    height = sourceH;
    width = sourceH * aspect;
  }
  const clamped = Math.min(1, Math.max(0, pos));
  return {
    x: (sourceW - width) * clamped,
    y: (sourceH - height) * clamped,
    width,
    height,
  };
}

/**
 * Converte um recorte do quadro já girado de volta para coordenadas do quadro
 * original, que é o que o `drawImage` precisa receber.
 */
export function unrotateRect(
  rect: Rect,
  sourceW: number,
  sourceH: number,
  rotation: Rotation,
): Rect {
  if (rotation === 90) {
    return {
      x: rect.y,
      y: sourceH - rect.x - rect.width,
      width: rect.height,
      height: rect.width,
    };
  }
  if (rotation === 270) {
    return {
      x: sourceW - rect.y - rect.height,
      y: rect.x,
      width: rect.height,
      height: rect.width,
    };
  }
  return rect;
}

function fitToTarget(width: number, height: number, target: Size): Size {
  // só reduz se a câmera entregou mais que o preset; nunca estica
  const scale = Math.min(1, target.width / width, target.height / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Lado maior do recorte derivado quando o principal passa de 1080p */
const DERIVED_LONG_SIDE = 1920;
/** Lado maior dos canvases fora da gravação: eles só alimentam o preview */
const PREVIEW_LONG_SIDE = 1280;

function capLongSide(size: Size, longSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= longSide) return size;
  const scale = longSide / longest;
  return {
    // dimensão ímpar quebra encoder de hardware em alguns aparelhos
    width: Math.round((size.width * scale) / 2) * 2,
    height: Math.round((size.height * scale) / 2) * 2,
  };
}

export interface CanvasSizeOptions {
  /** orientação do formato principal — o outro é o recorte derivado */
  mode: CaptureMode;
  /**
   * Parado, os canvases só alimentam previews de poucos centímetros: manter
   * 4K rodando aí só esquenta o aparelho.
   */
  previewOnly?: boolean;
  /**
   * Gravando com o principal saindo direto da câmera, o canvas dele não entra
   * em nenhum arquivo — desenhar em 4K ali é trabalho jogado fora.
   */
  primaryPreviewOnly?: boolean;
}

/**
 * Dimensiona os dois canvases a partir do frame real da câmera. Cada formato
 * usa a maior área possível do sensor para o seu aspecto, então o 9:16 abre
 * toda a largura de um frame retrato e o 16:9 abre toda a largura também —
 * um não é recorte do outro. Acima de 1080p o derivado é limitado: nenhuma
 * rede social aceita vertical maior que isso e é o que mais pesa no encoder.
 */
export function canvasSizesForSource(
  resolution: Resolution,
  sourceW: number,
  sourceH: number,
  options?: CanvasSizeOptions,
): { horizontal: Size; vertical: Size } {
  const verticalRect = coverRect(sourceW, sourceH, PORTRAIT_ASPECT);
  const horizontalRect = coverRect(sourceW, sourceH, LANDSCAPE_ASPECT);

  let vertical: Size;
  let horizontal: Size;

  if (resolution === "native") {
    vertical = {
      width: Math.round(verticalRect.width),
      height: Math.round(verticalRect.height),
    };
    horizontal = {
      width: Math.round(horizontalRect.width),
      height: Math.round(horizontalRect.height),
    };
  } else {
    const target = RESOLUTIONS[resolution];
    vertical = fitToTarget(verticalRect.width, verticalRect.height, {
      width: target.height,
      height: target.width,
    });
    horizontal = fitToTarget(horizontalRect.width, horizontalRect.height, target);
  }

  if (options?.previewOnly) {
    return {
      vertical: capLongSide(vertical, PREVIEW_LONG_SIDE),
      horizontal: capLongSide(horizontal, PREVIEW_LONG_SIDE),
    };
  }

  const heavy =
    resolution === "2k" || resolution === "4k" || resolution === "native";
  const portraitPrimary = options?.mode === "portrait";

  if (heavy && options) {
    if (portraitPrimary) {
      horizontal = capLongSide(horizontal, DERIVED_LONG_SIDE);
    } else {
      vertical = capLongSide(vertical, DERIVED_LONG_SIDE);
    }
  }

  if (options?.primaryPreviewOnly) {
    if (portraitPrimary) {
      vertical = capLongSide(vertical, PREVIEW_LONG_SIDE);
    } else {
      horizontal = capLongSide(horizontal, PREVIEW_LONG_SIDE);
    }
  }

  return { vertical, horizontal };
}

/** Altura (ou largura) do recorte derivado em relação ao principal, 0..1 */
export function derivedFraction(
  mode: CaptureMode,
  sourceW: number,
  sourceH: number,
): number {
  const vertical = coverRect(sourceW, sourceH, PORTRAIT_ASPECT);
  const horizontal = coverRect(sourceW, sourceH, LANDSCAPE_ASPECT);
  const fraction =
    mode === "portrait"
      ? horizontal.height / vertical.height
      : vertical.width / horizontal.width;
  return Math.min(1, Math.max(0.05, fraction));
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

export type Resolution = "720p" | "1080p";
export type Fps = 24 | 30 | 60;
export type GridMode = "none" | "3x3" | "cross" | "safe";
export type FacingMode = "user" | "environment";
export type StartTimer = 0 | 3 | 5 | 10;

export const RESOLUTIONS: Record<Resolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

/** Resolução portrait pedida à câmera (9:16 primário) */
export function portraitCapture(resolution: Resolution) {
  const res = RESOLUTIONS[resolution];
  return { width: res.height, height: res.width };
}

export const VIDEO_BITRATES: Record<Resolution, number> = {
  "720p": 5_000_000,
  "1080p": 8_000_000,
};

export const AUDIO_BITRATE = 128_000;

export interface ZoomCapability {
  min: number;
  max: number;
  step: number;
}

export interface TrackFeatures {
  zoom: ZoomCapability | null;
  torch: boolean;
}

// zoom e torch ainda não fazem parte do tipo padrão MediaTrackCapabilities
type ExtendedCapabilities = MediaTrackCapabilities & {
  zoom?: { min?: number; max?: number; step?: number };
  torch?: boolean;
};

export function getTrackFeatures(track: MediaStreamTrack | null): TrackFeatures {
  if (!track || typeof track.getCapabilities !== "function") {
    return { zoom: null, torch: false };
  }
  const caps = track.getCapabilities() as ExtendedCapabilities;
  const zoom =
    caps.zoom && typeof caps.zoom.max === "number" && caps.zoom.max > 1
      ? {
          min: caps.zoom.min ?? 1,
          max: caps.zoom.max,
          step: caps.zoom.step ?? 0.1,
        }
      : null;
  return { zoom, torch: caps.torch === true };
}

export interface RecorderFormat {
  mimeType: string;
  extension: "mp4" | "webm";
}

const MIME_CANDIDATES: RecorderFormat[] = [
  { mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate;
  }
  return null;
}

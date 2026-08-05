"use client";

import { GridMode, ZoomCapability } from "@/lib/media/capabilities";
import RecordButton from "./RecordButton";

interface CameraSettingsBarProps {
  zoom: ZoomCapability | null;
  zoomLevel: number;
  onCycleZoom: () => void;
  onToggleLayout: () => void;
  gridMode: GridMode;
  onCycleGrid: () => void;
  recording: boolean;
  countdownActive: boolean;
  recordDisabled: boolean;
  onRecordPress: () => void;
  hasResult: boolean;
  onOpenGallery: () => void;
  onSwitchCamera: () => void;
}

const GRID_LABELS: Record<GridMode, string> = {
  none: "Sem grade",
  "3x3": "Grade 3x3",
  cross: "Cruz central",
  safe: "Área segura",
};

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-zinc-100 transition-colors hover:bg-white/20 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export default function CameraSettingsBar({
  zoom,
  zoomLevel,
  onCycleZoom,
  onToggleLayout,
  gridMode,
  onCycleGrid,
  recording,
  countdownActive,
  recordDisabled,
  onRecordPress,
  hasResult,
  onOpenGallery,
  onSwitchCamera,
}: CameraSettingsBarProps) {
  return (
    <div className="flex flex-col items-center gap-4 pb-6 pt-2">
      {/* pills, como na referência visual */}
      <div className="flex items-center gap-2">
        {zoom && (
          <button
            type="button"
            onClick={onCycleZoom}
            className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/20"
            title="Zoom"
          >
            {zoomLevel}x
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLayout}
          className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/20"
          title="Alternar ordem dos previews"
        >
          9:16 × 16:9
        </button>
        <button
          type="button"
          disabled
          className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-zinc-100 opacity-40"
          title="Filtros chegam na Fase 2"
        >
          Filtro
        </button>
      </div>

      {/* fileira principal: galeria, REC, grade, trocar câmera */}
      <div className="flex w-full max-w-sm items-center justify-between px-6">
        <IconButton
          label={hasResult ? "Abrir últimos vídeos" : "Nenhuma gravação ainda"}
          onClick={onOpenGallery}
          disabled={!hasResult}
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
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-4.5-4.5L7 20" />
          </svg>
        </IconButton>

        <RecordButton
          recording={recording}
          countdownActive={countdownActive}
          disabled={recordDisabled}
          onPress={onRecordPress}
        />

        <div className="flex items-center gap-2.5">
          <IconButton label={GRID_LABELS[gridMode]} onClick={onCycleGrid}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
            </svg>
          </IconButton>
          <IconButton
            label="Trocar câmera"
            onClick={onSwitchCamera}
            disabled={recording}
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
              <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
              <path d="M9.5 13.5a2.5 2.5 0 0 1 4.3-1.7" />
              <path d="M14.5 13.5a2.5 2.5 0 0 1-4.3 1.7" />
              <path d="M14 11.5v2h-2" />
              <path d="M10 15.5v-2h2" />
            </svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  CaptureKind,
  CaptureMode,
  GridMode,
  Rotation,
  ZoomCapability,
} from "@/lib/media/capabilities";
import RecordButton from "./RecordButton";

interface CameraSettingsBarProps {
  zoom: ZoomCapability | null;
  zoomLevel: number;
  onCycleZoom: () => void;
  captureMode: CaptureMode;
  rotation: Rotation;
  onToggleCaptureMode: () => void;
  filterLabel: string;
  filterActive: boolean;
  onOpenFilters: () => void;
  adjustmentsActive: boolean;
  onOpenAdjustments: () => void;
  captureKind: CaptureKind;
  onCaptureKindChange: (kind: CaptureKind) => void;
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

function Pill({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
  icon,
  trailing,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-35 ${
        active
          ? "bg-white text-black"
          : "bg-white/10 text-zinc-100 hover:bg-white/20"
      }`}
    >
      {icon}
      {label}
      {trailing}
    </button>
  );
}

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
  captureMode,
  rotation,
  onToggleCaptureMode,
  filterLabel,
  filterActive,
  onOpenFilters,
  adjustmentsActive,
  onOpenAdjustments,
  captureKind,
  onCaptureKindChange,
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
  const portrait = captureMode === "portrait";

  return (
    <div className="flex flex-col items-center gap-3 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* pills, como na referência visual */}
      <div className="flex w-full max-w-lg items-center justify-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {zoom && (
          <Pill label={`${zoomLevel}x`} title="Zoom" onClick={onCycleZoom} />
        )}
        <Pill
          label={portrait ? "9:16 principal" : "16:9 principal"}
          title={
            portrait
              ? "Vire o celular e toque para gravar deitado."
              : "Toque de novo se a imagem estiver de cabeça para baixo, ou mais uma vez para voltar a gravar em pé."
          }
          disabled={recording}
          onClick={onToggleCaptureMode}
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {portrait ? (
                <rect x="8" y="3" width="8" height="18" rx="1.5" />
              ) : (
                <rect x="3" y="8" width="18" height="8" rx="1.5" />
              )}
            </svg>
          }
          trailing={
            rotation !== 0 ? (
              <span className="text-[11px] leading-none opacity-70">
                {rotation === 90 ? "↻" : "↺"}
              </span>
            ) : null
          }
        />
        <Pill
          label={filterLabel}
          title="Filtros"
          active={filterActive}
          onClick={onOpenFilters}
        />
        <Pill
          label="Ajustes"
          title="Brilho, contraste, saturação e exposição"
          active={adjustmentsActive}
          onClick={onOpenAdjustments}
        />
      </div>

      {/* seletor de captura */}
      <div className="flex items-center gap-1 rounded-full bg-white/8 p-1 text-[11px] font-semibold uppercase tracking-wide">
        {(["photo", "video"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={recording || countdownActive}
            onClick={() => onCaptureKindChange(kind)}
            className={`rounded-full px-4 py-1 transition-colors disabled:opacity-40 ${
              captureKind === kind
                ? "bg-white text-black"
                : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            {kind === "photo" ? "Foto" : "Vídeo"}
          </button>
        ))}
      </div>

      {/* fileira principal: galeria, botão de captura, grade, trocar câmera */}
      <div className="flex w-full max-w-sm items-center justify-between px-6">
        <IconButton
          label={hasResult ? "Abrir última captura" : "Nenhuma captura ainda"}
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
          kind={captureKind}
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

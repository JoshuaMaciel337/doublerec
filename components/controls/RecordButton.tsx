"use client";

import { CaptureKind } from "@/lib/media/capabilities";

interface RecordButtonProps {
  kind: CaptureKind;
  recording: boolean;
  countdownActive: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function RecordButton({
  kind,
  recording,
  countdownActive,
  disabled = false,
  onPress,
}: RecordButtonProps) {
  const photo = kind === "photo";

  const label = countdownActive
    ? "Cancelar contagem"
    : recording
      ? "Parar gravação"
      : photo
        ? "Tirar foto"
        : "Iniciar gravação";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPress}
      className="group grid h-[72px] w-[72px] place-items-center rounded-full border-4 border-white/90 transition-transform active:scale-95 disabled:opacity-40"
    >
      {countdownActive ? (
        <span className="h-12 w-12 rounded-full bg-red-500/50 text-center text-xs font-semibold leading-[48px] text-white">
          ✕
        </span>
      ) : recording ? (
        <span className="h-7 w-7 rounded-md bg-red-500" />
      ) : photo ? (
        <span className="h-[56px] w-[56px] rounded-full bg-white transition-colors group-hover:bg-zinc-200" />
      ) : (
        <span className="h-[56px] w-[56px] rounded-full bg-red-500 transition-colors group-hover:bg-red-400" />
      )}
    </button>
  );
}

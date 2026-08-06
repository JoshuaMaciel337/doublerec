"use client";

import { CaptureKind } from "@/lib/media/capabilities";

export type SaveToastTone = "ok" | "warn";

interface SaveToastProps {
  open: boolean;
  kind: CaptureKind;
  message: string;
  tone?: SaveToastTone;
  canShare: boolean;
  onShare: () => void;
  onOpenPanel: () => void;
  onDismiss: () => void;
}

/** Confirmação discreta após salvar — não bloqueia a próxima gravação */
export default function SaveToast({
  open,
  kind,
  message,
  tone = "ok",
  canShare,
  onShare,
  onOpenPanel,
  onDismiss,
}: SaveToastProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 md:bottom-32">
      <div
        className={`pointer-events-auto flex max-w-md flex-col gap-2 rounded-2xl px-4 py-3 shadow-lg ring-1 backdrop-blur-md ${
          tone === "warn"
            ? "bg-amber-950/90 ring-amber-400/30"
            : "bg-zinc-900/95 ring-white/15"
        }`}
        role="status"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
              tone === "warn"
                ? "bg-amber-400/20 text-amber-300"
                : "bg-emerald-400/20 text-emerald-300"
            }`}
          >
            {tone === "warn" ? "!" : "✓"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{message}</p>
            <p className="text-[11px] text-zinc-400">
              {kind === "photo"
                ? "Pode tirar a próxima foto quando quiser."
                : "Pode gravar o próximo take quando quiser."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onDismiss}
            className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pl-10">
          {canShare && (
            <button
              type="button"
              onClick={onShare}
              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-zinc-200"
            >
              Salvar na Galeria…
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPanel}
            className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-100 hover:bg-white/20"
          >
            Ver prévia
          </button>
        </div>
      </div>
    </div>
  );
}

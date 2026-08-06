"use client";

import { CaptureMode } from "@/lib/media/capabilities";

interface OrientationBadgeProps {
  mode: CaptureMode;
  visible: boolean;
}

/** Aviso passageiro confirmando qual formato passou a ser o principal */
export default function OrientationBadge({
  mode,
  visible,
}: OrientationBadgeProps) {
  const portrait = mode === "portrait";

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 z-40 grid place-items-center transition-all duration-300 ${
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/80 px-6 py-4 text-center ring-1 ring-white/15">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {portrait ? (
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
          ) : (
            <rect x="2.5" y="7" width="19" height="10" rx="2" />
          )}
          <path d="M4 4.5A9 9 0 0 1 12 1" opacity="0.7" />
          <path d="M20 19.5A9 9 0 0 1 12 23" opacity="0.7" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-white">
            {portrait ? "Gravação vertical 9:16" : "Gravação horizontal 16:9"}
          </p>
          <p className="text-[11px] text-zinc-400">
            {portrait
              ? "O 16:9 vira o recorte derivado"
              : "O 9:16 vira o recorte derivado"}
          </p>
        </div>
      </div>
    </div>
  );
}

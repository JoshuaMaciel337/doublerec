"use client";

import {
  FILTER_PRESETS,
  FilterId,
  getFilterPreset,
  supportsNativeCanvasFilter,
} from "@/lib/media/filters";

interface FilterStripProps {
  open: boolean;
  value: FilterId;
  onChange: (id: FilterId) => void;
  onClose: () => void;
}

/** Tira de presets sobre a barra inferior; o filtro entra na gravação e na foto */
export default function FilterStrip({
  open,
  value,
  onChange,
  onClose,
}: FilterStripProps) {
  // só abre por toque do usuário — nunca na pré-renderização do servidor
  if (!open) return null;
  const active = getFilterPreset(value);
  const native = supportsNativeCanvasFilter();

  return (
    <div className="border-t border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[11px] text-zinc-400">
          {active.hint}
          {!native && value !== "none"
            ? " · processado no app (WebKit)"
            : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-zinc-300 hover:bg-white/10"
        >
          Fechar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              preset.id === value
                ? "bg-white text-black"
                : "bg-white/10 text-zinc-100 hover:bg-white/20"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

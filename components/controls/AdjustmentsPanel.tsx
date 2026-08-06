"use client";

import { RangeCapability } from "@/lib/media/capabilities";
import { ImageAdjustments, NEUTRAL_ADJUSTMENTS } from "@/lib/media/filters";

interface AdjustmentsPanelProps {
  open: boolean;
  onClose: () => void;
  adjustments: ImageAdjustments;
  onAdjustmentsChange: (adj: ImageAdjustments) => void;
  exposure: RangeCapability | null;
  exposureValue: number;
  onExposureChange: (value: number) => void;
  iso: RangeCapability | null;
  isoValue: number;
  onIsoChange: (value: number) => void;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        <span className="font-mono text-xs text-zinc-300">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
      />
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export default function AdjustmentsPanel({
  open,
  onClose,
  adjustments,
  onAdjustmentsChange,
  exposure,
  exposureValue,
  onExposureChange,
  iso,
  isoValue,
  onIsoChange,
}: AdjustmentsPanelProps) {
  if (!open) return null;

  const percent = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-zinc-900 p-6 ring-1 ring-white/10 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Ajustes de imagem</h2>
          <button
            type="button"
            aria-label="Fechar ajustes"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {exposure && (
            <Slider
              label="Exposição da câmera"
              hint="Controla o sensor: clareia sem amplificar ruído. Ideal para ambiente escuro."
              value={exposureValue}
              min={exposure.min}
              max={exposure.max}
              step={exposure.step}
              format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
              onChange={onExposureChange}
            />
          )}

          {iso && (
            <Slider
              label="ISO"
              hint="Sensibilidade do sensor em modo manual."
              value={isoValue}
              min={iso.min}
              max={iso.max}
              step={iso.step}
              format={(v) => String(Math.round(v))}
              onChange={onIsoChange}
            />
          )}

          <Slider
            label="Brilho"
            hint={
              exposure
                ? "Clareia depois da captura, por cima da exposição."
                : "Sua câmera não expõe controle de exposição, então o brilho é aplicado na imagem."
            }
            value={adjustments.brightness}
            min={0.5}
            max={1.8}
            step={0.02}
            format={percent}
            onChange={(brightness) =>
              onAdjustmentsChange({ ...adjustments, brightness })
            }
          />

          <Slider
            label="Contraste"
            value={adjustments.contrast}
            min={0.6}
            max={1.6}
            step={0.02}
            format={percent}
            onChange={(contrast) =>
              onAdjustmentsChange({ ...adjustments, contrast })
            }
          />

          <Slider
            label="Saturação"
            value={adjustments.saturation}
            min={0}
            max={2}
            step={0.02}
            format={percent}
            onChange={(saturation) =>
              onAdjustmentsChange({ ...adjustments, saturation })
            }
          />

          <button
            type="button"
            onClick={() => {
              onAdjustmentsChange(NEUTRAL_ADJUSTMENTS);
              if (exposure) onExposureChange(0);
            }}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/20"
          >
            Voltar ao neutro
          </button>

          <p className="text-xs leading-relaxed text-zinc-500">
            Brilho, contraste e saturação são aplicados no canvas, então saem
            gravados nos dois vídeos e nas fotos. Exposição e ISO dependem do
            suporte da câmera e só aparecem quando disponíveis.
          </p>
        </div>
      </div>
    </div>
  );
}

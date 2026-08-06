"use client";

import {
  Fps,
  GridMode,
  QUALITY_LABELS,
  QUALITY_OPTIONS,
  QualityPreset,
  RESOLUTION_LABELS,
  RESOLUTION_OPTIONS,
  Resolution,
  Size,
  StartTimer,
} from "@/lib/media/capabilities";
import { DeviceLists } from "@/lib/media/useCameraStream";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  devices: DeviceLists;
  videoDeviceId: string | null;
  onVideoDeviceChange: (id: string | null) => void;
  audioDeviceId: string | null;
  onAudioDeviceChange: (id: string | null) => void;
  resolution: Resolution;
  onResolutionChange: (r: Resolution) => void;
  /** teto reportado pela câmera atual, se a API expuser */
  cameraMaxSize: Size | null;
  quality: QualityPreset;
  onQualityChange: (q: QualityPreset) => void;
  fps: Fps;
  onFpsChange: (f: Fps) => void;
  startTimer: StartTimer;
  onStartTimerChange: (t: StartTimer) => void;
  grid: GridMode;
  onGridChange: (g: GridMode) => void;
  autoSave: boolean;
  onAutoSaveChange: (value: boolean) => void;
  fileName: string;
  onFileNameChange: (name: string) => void;
}

function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  format = (v) => String(v),
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap rounded-lg bg-white/8 p-1">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`min-w-[4.5rem] flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            opt === value
              ? "bg-white text-black"
              : "text-zinc-300 hover:bg-white/10"
          }`}
        >
          {format(opt)}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectClass =
  "w-full rounded-lg bg-white/8 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-white/40 [&>option]:bg-zinc-900";

export default function SettingsSheet({
  open,
  onClose,
  devices,
  videoDeviceId,
  onVideoDeviceChange,
  audioDeviceId,
  onAudioDeviceChange,
  resolution,
  onResolutionChange,
  cameraMaxSize,
  quality,
  onQualityChange,
  fps,
  onFpsChange,
  startTimer,
  onStartTimerChange,
  grid,
  onGridChange,
  autoSave,
  onAutoSaveChange,
  fileName,
  onFileNameChange,
}: SettingsSheetProps) {
  if (!open) return null;

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
          <h2 className="text-base font-semibold">Configurações</h2>
          <button
            type="button"
            aria-label="Fechar configurações"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Câmera">
            <select
              className={selectClass}
              value={videoDeviceId ?? ""}
              onChange={(e) => onVideoDeviceChange(e.target.value || null)}
            >
              <option value="">Automática</option>
              {devices.cameras.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Câmera ${i + 1}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Microfone">
            <select
              className={selectClass}
              value={audioDeviceId ?? ""}
              onChange={(e) => onAudioDeviceChange(e.target.value || null)}
            >
              <option value="">Automático</option>
              {devices.microphones.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${i + 1}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ao parar / tirar foto">
            <Segmented
              options={[true, false] as const}
              value={autoSave}
              onChange={onAutoSaveChange}
              format={(v) => (v ? "Salvar na hora" : "Só prévia")}
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Com “Salvar na hora”, as duas versões vão para Downloads assim que
              você para — sem precisar baixar manualmente entre os takes. No
              celular, o aviso também oferece “Salvar na Galeria…” quando o
              navegador permitir. Isso libera memória do navegador e evita
              perder takes.
            </p>
          </Field>

          <Field label="Resolução">
            <Segmented
              options={RESOLUTION_OPTIONS}
              value={resolution}
              onChange={onResolutionChange}
              format={(v) => RESOLUTION_LABELS[v]}
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {resolution === "native"
                ? cameraMaxSize
                  ? `Usa o máximo da câmera (${cameraMaxSize.width}×${cameraMaxSize.height}). O recorte derivado sai na resolução real do sensor, sem esticar.`
                  : "Usa o máximo que o navegador conseguir pedir à câmera. O recorte derivado sai na resolução real do sensor, sem esticar."
                : resolution === "4k" || resolution === "2k"
                  ? "2K/4K melhoram muito o recorte derivado. Em celulares mais fracos pode esquentar ou cair o FPS — se travar, volte para 1080p."
                  : "O recorte do segundo formato herda os pixels da câmera; em 720p/1080p ele fica menor que o arquivo principal."}
            </p>
          </Field>

          <Field label="Qualidade do vídeo">
            <Segmented
              options={QUALITY_OPTIONS}
              value={quality}
              onChange={onQualityChange}
              format={(v) => QUALITY_LABELS[v]}
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Alta/Ultra aumentam o bitrate (mais nítido, arquivos maiores). Sem
              filtro ativo, o formato principal grava direto da câmera — bem
              mais próximo do app nativo. Com filtro, os dois passam pelo
              canvas.
            </p>
          </Field>

          <Field label="FPS">
            <Segmented
              options={[24, 30, 60] as const}
              value={fps}
              onChange={onFpsChange}
            />
          </Field>

          <Field label="Timer de início">
            <Segmented
              options={[0, 3, 5, 10] as const}
              value={startTimer}
              onChange={onStartTimerChange}
              format={(v) => (v === 0 ? "Off" : `${v}s`)}
            />
          </Field>

          <Field label="Grade de composição">
            <Segmented
              options={["none", "3x3", "cross", "safe"] as const}
              value={grid}
              onChange={onGridChange}
              format={(v) =>
                v === "none"
                  ? "Sem"
                  : v === "3x3"
                    ? "3x3"
                    : v === "cross"
                      ? "Cruz"
                      : "Safe"
              }
            />
          </Field>

          <Field label="Nome dos arquivos">
            <input
              type="text"
              value={fileName}
              onChange={(e) => onFileNameChange(e.target.value)}
              placeholder="video"
              className="w-full rounded-lg bg-white/8 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-white/40"
            />
          </Field>

          <p className="text-xs leading-relaxed text-zinc-500">
            No modo automático a gravação principal acompanha a rotação do
            celular — a câmera reabre na orientação nova, por isso pisca por um
            instante. Durante a gravação a troca fica travada. Controles de
            exposição e ISO aparecem em Ajustes apenas quando o navegador e a
            câmera oferecem suporte. Em eventos longos, 1080p + “Salvar na
            hora” costuma ser o melhor equilíbrio entre qualidade e fluidez.
          </p>
        </div>
      </div>
    </div>
  );
}

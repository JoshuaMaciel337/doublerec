"use client";

import { CaptureKind } from "@/lib/media/capabilities";
import { sanitizeFileName } from "@/lib/media/download";

interface ExportPanelProps {
  kind: CaptureKind;
  horizontalUrl: string;
  verticalUrl: string;
  extension: string;
  /** só existe em vídeo */
  durationMs?: number;
  fileName: string;
  onFileNameChange: (name: string) => void;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function DownloadButton({
  href,
  download,
  label,
}: {
  href: string;
  download: string;
  label: string;
}) {
  return (
    <a
      href={href}
      download={download}
      className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 21h16" />
      </svg>
      {label}
    </a>
  );
}

export default function ExportPanel({
  kind,
  horizontalUrl,
  verticalUrl,
  extension,
  durationMs,
  fileName,
  onFileNameChange,
  onClose,
}: ExportPanelProps) {
  const base = sanitizeFileName(fileName);
  const isPhoto = kind === "photo";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-zinc-900 p-6 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {isPhoto
                ? "Suas fotos estão prontas"
                : "Seus vídeos estão prontos"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isPhoto
                ? `Dois enquadramentos · formato .${extension}`
                : `Gravação de ${formatDuration(durationMs ?? 0)} · formato .${extension}`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Horizontal 16:9 · YouTube
            </span>
            {isPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={horizontalUrl}
                alt="Prévia horizontal 16:9"
                className="aspect-video w-full rounded-xl bg-black object-cover ring-1 ring-white/10"
              />
            ) : (
              <video
                src={horizontalUrl}
                controls
                playsInline
                className="aspect-video w-full rounded-xl bg-black ring-1 ring-white/10"
              />
            )}
            <DownloadButton
              href={horizontalUrl}
              download={`${base}_youtube.${extension}`}
              label="Baixar 16:9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Vertical 9:16 · Reels/Shorts
            </span>
            {isPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={verticalUrl}
                alt="Prévia vertical 9:16"
                className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-xl bg-black object-cover ring-1 ring-white/10"
              />
            ) : (
              <video
                src={verticalUrl}
                controls
                playsInline
                className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-xl bg-black ring-1 ring-white/10"
              />
            )}
            <DownloadButton
              href={verticalUrl}
              download={`${base}_reels.${extension}`}
              label="Baixar 9:16"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <label
            htmlFor="export-filename"
            className="text-xs font-medium uppercase tracking-wide text-zinc-400"
          >
            Nome dos arquivos
          </label>
          <input
            id="export-filename"
            type="text"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            placeholder="video"
            className="w-full rounded-lg bg-white/8 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-white/40"
          />
          <p className="text-xs text-zinc-500">
            Serão baixados como {base}_youtube.{extension} e {base}_reels.
            {extension}.
            {!isPhoto &&
              (extension === "mp4"
                ? " Formato MP4/H.264 — o mais compatível com Instagram, WhatsApp e editores."
                : " Este navegador gravou em WebM; conversão garantida para MP4 chega em fase futura.")}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/20"
        >
          {isPhoto ? "Voltar à câmera" : "Gravar novamente"}
        </button>
      </div>
    </div>
  );
}

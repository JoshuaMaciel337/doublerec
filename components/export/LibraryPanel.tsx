"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  StorageUsage,
  TakeRecord,
  TakeSummary,
  formatBytes,
  takeFileNames,
} from "@/lib/media/library";
import {
  canAutoDownload,
  canShareFiles,
  downloadBlobs,
  shareFiles,
} from "@/lib/media/download";

interface LibraryPanelProps {
  open: boolean;
  takes: TakeSummary[];
  usage: StorageUsage | null;
  error: string | null;
  loadTake: (id: string) => Promise<TakeRecord | null>;
  onSetSaved: (id: string, saved?: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRemoveMany: (ids: string[]) => Promise<void>;
  onClear: () => Promise<void>;
  onNotify: (message: string, tone?: "ok" | "warn") => void;
  onClose: () => void;
}

/** iOS costuma recusar folhas de compartilhamento gigantes */
const SHARE_BATCH_TAKES = 5;

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string | null {
  if (!ms) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function ActionButton({
  label,
  onClick,
  busy = false,
  tone = "ghost",
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  tone?: "primary" | "ghost" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-white text-black hover:bg-zinc-200"
      : tone === "danger"
        ? "bg-white/5 text-red-300 hover:bg-red-500/15"
        : "bg-white/10 text-zinc-100 hover:bg-white/20";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${toneClass}`}
    >
      {busy ? "…" : label}
    </button>
  );
}

function TakeRow({
  take,
  loadTake,
  onShare,
  onDownload,
  onRemove,
  busyId,
}: {
  take: TakeSummary;
  loadTake: (id: string) => Promise<TakeRecord | null>;
  onShare: (take: TakeSummary) => void;
  onDownload: (take: TakeSummary) => void;
  onRemove: (take: TakeSummary) => void;
  busyId: string | null;
}) {
  const [urls, setUrls] = useState<{ h: string; v: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const urlsRef = useRef<{ h: string; v: string } | null>(null);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  useEffect(
    () => () => {
      if (urlsRef.current) {
        URL.revokeObjectURL(urlsRef.current.h);
        URL.revokeObjectURL(urlsRef.current.v);
      }
    },
    [],
  );

  const toggle = async () => {
    if (urls) {
      URL.revokeObjectURL(urls.h);
      URL.revokeObjectURL(urls.v);
      setUrls(null);
      return;
    }
    setLoading(true);
    const record = await loadTake(take.id);
    setLoading(false);
    if (!record) return;
    setUrls({
      h: URL.createObjectURL(record.horizontal),
      v: URL.createObjectURL(record.vertical),
    });
  };

  const isPhoto = take.kind === "photo";
  const duration = formatDuration(take.durationMs);
  const busy = busyId === take.id;

  return (
    <li className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${
            take.saved
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-white/10 text-zinc-300"
          }`}
        >
          {isPhoto ? "◻" : "▶"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">
            {take.baseName}
          </p>
          <p className="text-[11px] text-zinc-400">
            {formatTime(take.createdAt)}
            {duration ? ` · ${duration}` : ""} · {formatBytes(take.bytes)} ·{" "}
            {take.extension.toUpperCase()}
            {take.saved ? " · salvo" : ""}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2 pl-12">
        {canShareFiles() && (
          <ActionButton
            label="Salvar em Fotos"
            tone="primary"
            busy={busy}
            onClick={() => onShare(take)}
          />
        )}
        {canAutoDownload() && (
          <ActionButton
            label="Baixar"
            busy={busy}
            onClick={() => onDownload(take)}
          />
        )}
        <ActionButton
          label={urls ? "Ocultar" : loading ? "…" : "Ver"}
          onClick={() => void toggle()}
        />
        <ActionButton
          label="Excluir"
          tone="danger"
          busy={busy}
          onClick={() => onRemove(take)}
        />
      </div>

      {urls && (
        <div className="mt-3 grid grid-cols-[3fr_2fr] gap-3 pl-12">
          {isPhoto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls.h}
                alt="Prévia 16:9"
                className="aspect-video w-full rounded-lg bg-black object-cover"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls.v}
                alt="Prévia 9:16"
                className="aspect-[9/16] w-full rounded-lg bg-black object-cover"
              />
            </>
          ) : (
            <>
              <video
                src={urls.h}
                controls
                playsInline
                className="aspect-video w-full rounded-lg bg-black"
              />
              <video
                src={urls.v}
                controls
                playsInline
                className="aspect-[9/16] w-full rounded-lg bg-black"
              />
            </>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Tudo que foi capturado fica aqui até você mandar embora. É o que permite
 * gravar take atrás de take sem parar para salvar: no fim, um toque manda o
 * lote inteiro para a folha de compartilhamento (Fotos/Galeria).
 */
export default function LibraryPanel({
  open,
  takes,
  usage,
  error,
  loadTake,
  onSetSaved,
  onRemove,
  onRemoveMany,
  onClear,
  onNotify,
  onClose,
}: LibraryPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filesFor = useCallback(
    async (list: TakeSummary[]): Promise<File[]> => {
      const files: File[] = [];
      for (const summary of list) {
        const record = await loadTake(summary.id);
        if (!record) continue;
        const names = takeFileNames(summary);
        files.push(
          new File([record.horizontal], names.horizontal, {
            type: record.mimeType,
          }),
          new File([record.vertical], names.vertical, {
            type: record.mimeType,
          }),
        );
      }
      return files;
    },
    [loadTake],
  );

  const shareTakes = useCallback(
    async (list: TakeSummary[]) => {
      const files = await filesFor(list);
      if (files.length === 0) {
        onNotify("Nada para salvar.", "warn");
        return;
      }
      const outcome = await shareFiles(files, "DoubleRec");
      if (outcome === "shared") {
        await Promise.all(list.map((t) => onSetSaved(t.id, true)));
        onNotify("Escolha Fotos/Galeria na folha que abriu.");
      } else if (outcome === "unavailable") {
        onNotify(
          list.length > 1
            ? "O sistema recusou o lote — tente salvar em grupos menores ou take a take."
            : "Este navegador não manda arquivos para a Galeria.",
          "warn",
        );
      }
    },
    [filesFor, onNotify, onSetSaved],
  );

  const downloadTakes = useCallback(
    async (list: TakeSummary[]) => {
      const files: { blob: Blob; filename: string }[] = [];
      for (const summary of list) {
        const record = await loadTake(summary.id);
        if (!record) continue;
        const names = takeFileNames(summary);
        files.push(
          { blob: record.horizontal, filename: names.horizontal },
          { blob: record.vertical, filename: names.vertical },
        );
      }
      if (files.length === 0) return;
      await downloadBlobs(files);
      await Promise.all(list.map((t) => onSetSaved(t.id, true)));
      onNotify(`${files.length} arquivos enviados para Downloads`);
    },
    [loadTake, onNotify, onSetSaved],
  );

  if (!open) return null;

  const unsaved = takes.filter((t) => !t.saved);
  const savedIds = takes.filter((t) => t.saved).map((t) => t.id);
  const totalBytes = takes.reduce((sum, t) => sum + t.bytes, 0);
  const tightOnSpace =
    usage !== null && usage.quota > 0 && usage.usage / usage.quota > 0.7;

  const runTake = async (
    take: TakeSummary,
    action: (list: TakeSummary[]) => Promise<void>,
  ) => {
    setBusyId(take.id);
    try {
      await action([take]);
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action: () => Promise<void>) => {
    setBulkBusy(true);
    try {
      await action();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-zinc-900 ring-1 ring-white/10 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Biblioteca</h2>
            <p className="text-xs text-zinc-400">
              {takes.length === 0
                ? "Nada gravado ainda"
                : `${takes.length} ${takes.length === 1 ? "take" : "takes"} · ${formatBytes(totalBytes)} neste aparelho`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar biblioteca"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {takes.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {canShareFiles() && unsaved.length > 0 && (
              <ActionButton
                label={`Salvar ${unsaved.length > 1 ? "tudo" : "o take"} em Fotos`}
                tone="primary"
                busy={bulkBusy}
                onClick={() =>
                  void runBulk(() =>
                    shareTakes(unsaved.slice(0, SHARE_BATCH_TAKES)),
                  )
                }
              />
            )}
            {canAutoDownload() && (
              <ActionButton
                label="Baixar tudo"
                busy={bulkBusy}
                onClick={() => void runBulk(() => downloadTakes(takes))}
              />
            )}
            {savedIds.length > 0 && (
              <ActionButton
                label={`Limpar salvos (${savedIds.length})`}
                busy={bulkBusy}
                onClick={() => void runBulk(() => onRemoveMany(savedIds))}
              />
            )}
            <ActionButton
              label="Limpar tudo"
              tone="danger"
              busy={bulkBusy}
              onClick={() => void runBulk(onClear)}
            />
          </div>
        )}

        {unsaved.length > SHARE_BATCH_TAKES && (
          <p className="px-5 pb-2 text-[11px] leading-relaxed text-zinc-500">
            São {unsaved.length} takes pendentes. O botão manda os{" "}
            {SHARE_BATCH_TAKES} mais recentes de uma vez — repita para enviar o
            resto, porque o sistema recusa folhas de compartilhamento muito
            grandes.
          </p>
        )}

        {tightOnSpace && (
          <p className="mx-5 mb-2 rounded-xl bg-amber-950/60 px-3 py-2 text-[11px] leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
            O espaço reservado ao app está em{" "}
            {Math.round((usage!.usage / usage!.quota) * 100)}%. Salve e limpe os
            takes antigos para o navegador não apagá-los sozinho.
          </p>
        )}

        {error && (
          <p className="mx-5 mb-2 rounded-xl bg-amber-950/60 px-3 py-2 text-[11px] text-amber-200 ring-1 ring-amber-400/25">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {takes.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              Cada gravação ou foto entra aqui automaticamente, com as duas
              versões, e fica guardada mesmo se você fechar o app.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {takes.map((take) => (
                <TakeRow
                  key={take.id}
                  take={take}
                  loadTake={loadTake}
                  busyId={busyId}
                  onShare={(t) => void runTake(t, shareTakes)}
                  onDownload={(t) => void runTake(t, downloadTakes)}
                  onRemove={(t) => void runTake(t, () => onRemove(t.id))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

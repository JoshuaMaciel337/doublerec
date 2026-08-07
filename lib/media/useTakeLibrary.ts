"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StorageUsage,
  TakeKind,
  TakeSummary,
  clearAll,
  deleteTake,
  deleteTakes,
  estimateUsage,
  getTake,
  isLibraryAvailable,
  listTakes,
  markSaved,
  putTake,
  requestPersistentStorage,
} from "./library";

export interface NewTakeInput {
  kind: TakeKind;
  durationMs?: number;
  extension: string;
  mimeType: string;
  baseName: string;
  horizontal: Blob;
  vertical: Blob;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Estado em React da biblioteca de takes. Guarda só os metadados em memória —
 * os blobs ficam no IndexedDB e são carregados sob demanda pelo painel.
 */
export function useTakeLibrary() {
  const [takes, setTakes] = useState<TakeSummary[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!availableRef.current) return;
    try {
      const [list, storage] = await Promise.all([
        listTakes(),
        estimateUsage(),
      ]);
      setTakes(list);
      setUsage(storage);
      setError(null);
    } catch {
      setError("Não foi possível ler a biblioteca deste navegador.");
    }
  }, []);

  useEffect(() => {
    availableRef.current = isLibraryAvailable();
    if (!availableRef.current) {
      setReady(true);
      setError("Este navegador não guarda os takes localmente.");
      return;
    }
    void requestPersistentStorage();
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  const addTake = useCallback(
    async (input: NewTakeInput): Promise<TakeSummary | null> => {
      if (!availableRef.current) return null;
      const { horizontal, vertical, ...meta } = input;
      const summary: TakeSummary = {
        ...meta,
        id: newId(),
        createdAt: Date.now(),
        saved: false,
        bytes: horizontal.size + vertical.size,
      };
      try {
        await putTake({ ...summary, horizontal, vertical });
        await refresh();
        return summary;
      } catch {
        setError(
          "Não deu para guardar o take na biblioteca — o espaço do navegador pode estar cheio.",
        );
        return null;
      }
    },
    [refresh],
  );

  const loadTake = useCallback(async (id: string) => getTake(id), []);

  const setSaved = useCallback(
    async (id: string, saved = true) => {
      await markSaved(id, saved);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTake(id);
      await refresh();
    },
    [refresh],
  );

  const removeMany = useCallback(
    async (ids: string[]) => {
      await deleteTakes(ids);
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await clearAll();
    await refresh();
  }, [refresh]);

  // identidade estável: quem depende disso em useCallback não recria a cada render
  return useMemo(
    () => ({
      takes,
      usage,
      ready,
      error,
      refresh,
      addTake,
      loadTake,
      setSaved,
      remove,
      removeMany,
      clear,
    }),
    [
      takes,
      usage,
      ready,
      error,
      refresh,
      addTake,
      loadTake,
      setSaved,
      remove,
      removeMany,
      clear,
    ],
  );
}

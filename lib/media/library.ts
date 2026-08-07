/**
 * Biblioteca local de takes. Cada captura vai para o IndexedDB assim que fica
 * pronta, antes de qualquer tentativa de download — no iOS o download abre o
 * arquivo por cima do app e descarrega a página, então guardar primeiro é o
 * que garante que nenhum take se perde.
 *
 * Metadados e arquivos ficam em stores separadas de propósito: listar a
 * biblioteca não pode trazer centenas de MB de vídeo para a memória junto.
 */

const DB_NAME = "doublerec";
const DB_VERSION = 1;
const META_STORE = "takes";
const BLOB_STORE = "blobs";

export type TakeKind = "video" | "photo";

/** Metadados de um take — é o que a lista carrega */
export interface TakeSummary {
  id: string;
  kind: TakeKind;
  createdAt: number;
  /** só em vídeo */
  durationMs?: number;
  extension: string;
  mimeType: string;
  /** nome base já com carimbo do take, sem o sufixo de formato */
  baseName: string;
  /** marcado depois de baixar ou mandar para a galeria */
  saved: boolean;
  bytes: number;
}

export interface TakeFiles {
  id: string;
  horizontal: Blob;
  vertical: Blob;
}

export type TakeRecord = TakeSummary & Omit<TakeFiles, "id">;

export function isLibraryAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB"));
  });
}

function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        let value: T;
        let failed = false;
        Promise.resolve(work(tx))
          .then((result) => {
            value = result;
          })
          .catch((err) => {
            failed = true;
            tx.abort();
            db.close();
            reject(err);
          });
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        tx.onerror = () => {
          if (failed) return;
          db.close();
          reject(tx.error ?? new Error("transação falhou"));
        };
        tx.onabort = () => {
          if (failed) return;
          db.close();
          reject(tx.error ?? new Error("transação abortada"));
        };
      }),
  );
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("idb request"));
  });
}

/** Pede armazenamento persistente para o navegador não despejar os takes */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function putTake(take: TakeRecord): Promise<void> {
  const { horizontal, vertical, ...meta } = take;
  await transact([META_STORE, BLOB_STORE], "readwrite", (tx) => {
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BLOB_STORE).put({ id: take.id, horizontal, vertical });
  });
}

/** Do mais novo para o mais antigo, sem tocar nos arquivos */
export async function listTakes(): Promise<TakeSummary[]> {
  const all = await transact([META_STORE], "readonly", (tx) =>
    wrap<TakeSummary[]>(tx.objectStore(META_STORE).getAll()),
  );
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTake(id: string): Promise<TakeRecord | null> {
  return transact([META_STORE, BLOB_STORE], "readonly", async (tx) => {
    const meta = await wrap<TakeSummary | undefined>(
      tx.objectStore(META_STORE).get(id),
    );
    const files = await wrap<TakeFiles | undefined>(
      tx.objectStore(BLOB_STORE).get(id),
    );
    if (!meta || !files) return null;
    return { ...meta, horizontal: files.horizontal, vertical: files.vertical };
  });
}

export async function markSaved(id: string, saved = true): Promise<void> {
  await transact([META_STORE], "readwrite", async (tx) => {
    const store = tx.objectStore(META_STORE);
    const meta = await wrap<TakeSummary | undefined>(store.get(id));
    if (meta) store.put({ ...meta, saved });
  });
}

export async function deleteTakes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await transact([META_STORE, BLOB_STORE], "readwrite", (tx) => {
    const meta = tx.objectStore(META_STORE);
    const blobs = tx.objectStore(BLOB_STORE);
    ids.forEach((id) => {
      meta.delete(id);
      blobs.delete(id);
    });
  });
}

export async function deleteTake(id: string): Promise<void> {
  await deleteTakes([id]);
}

export async function clearAll(): Promise<void> {
  await transact([META_STORE, BLOB_STORE], "readwrite", (tx) => {
    tx.objectStore(META_STORE).clear();
    tx.objectStore(BLOB_STORE).clear();
  });
}

export interface StorageUsage {
  usage: number;
  quota: number;
}

export async function estimateUsage(): Promise<StorageUsage | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function takeFileNames(take: TakeSummary): {
  horizontal: string;
  vertical: string;
} {
  return {
    horizontal: `${take.baseName}_youtube.${take.extension}`,
    vertical: `${take.baseName}_reels.${take.extension}`,
  };
}

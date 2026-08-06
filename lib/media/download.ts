/**
 * Utilitários de salvamento local. Navegadores não escrevem direto na Galeria
 * como o app Câmera; o caminho confiável é baixar o arquivo (Downloads) e,
 * no celular, oferecer o compartilhar nativo quando existir.
 */

export function sanitizeFileName(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  return clean || "video";
}

/** carimbo curto para cada take — evita sobrescrever o anterior no Downloads */
export function takeStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

export function buildTakeBase(fileName: string, date = new Date()): string {
  return `${sanitizeFileName(fileName)}_${takeStamp(date)}`;
}

function clickDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Dispara downloads em sequência — alguns Chromium bloqueiam dois no mesmo tick */
export async function downloadUrls(
  files: { url: string; filename: string }[],
  gapMs = 280,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    clickDownload(files[i].url, files[i].filename);
    if (i < files.length - 1) {
      await new Promise((r) => window.setTimeout(r, gapMs));
    }
  }
}

export function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

export async function shareCaptureFiles(input: {
  horizontalUrl: string;
  verticalUrl: string;
  horizontalName: string;
  verticalName: string;
  mimeType: string;
  title: string;
}): Promise<"shared" | "cancelled" | "unavailable"> {
  if (!canShareFiles()) return "unavailable";
  try {
    const [blobH, blobV] = await Promise.all([
      fetch(input.horizontalUrl).then((r) => r.blob()),
      fetch(input.verticalUrl).then((r) => r.blob()),
    ]);
    const files = [
      new File([blobH], input.horizontalName, { type: input.mimeType }),
      new File([blobV], input.verticalName, { type: input.mimeType }),
    ];
    if (!navigator.canShare({ files })) return "unavailable";
    await navigator.share({ files, title: input.title });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unavailable";
  }
}

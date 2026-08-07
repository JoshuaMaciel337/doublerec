/**
 * Utilitários de salvamento local. Navegadores não escrevem direto na Galeria
 * como o app Câmera; o caminho confiável é baixar o arquivo (Downloads) e,
 * no celular, oferecer o compartilhar nativo quando existir.
 */

/** WebKit de iPhone/iPad — inclui todos os navegadores do iOS */
export function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS se apresenta como Mac; o toque é o que denuncia
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (
    navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    iosStandalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * O `download` de um `<a>` é ignorado pelo WebKit em URLs `blob:`: em vez de
 * baixar, o iOS abre o arquivo por cima da página e descarrega o app — o que
 * derruba a gravação seguinte. Instalado na tela inicial é ainda pior, porque
 * a volta reinicia tudo. Nesses casos o caminho é a biblioteca + compartilhar.
 */
export function canAutoDownload(): boolean {
  if (typeof document === "undefined") return false;
  if (isIosWebKit()) return false;
  if (isStandalonePwa()) return false;
  return "download" in document.createElement("a");
}

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

/** Baixa blobs criando e revogando as URLs na hora */
export async function downloadBlobs(
  files: { blob: Blob; filename: string }[],
  gapMs = 280,
): Promise<void> {
  const urls = files.map((f) => ({
    url: URL.createObjectURL(f.blob),
    filename: f.filename,
  }));
  try {
    await downloadUrls(urls, gapMs);
  } finally {
    // o clique já foi processado; segurar um instante evita cancelar o download
    window.setTimeout(
      () => urls.forEach((u) => URL.revokeObjectURL(u.url)),
      10_000,
    );
  }
}

export function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

export type ShareOutcome = "shared" | "cancelled" | "unavailable";

/**
 * Manda arquivos para a folha de compartilhamento do sistema, de onde o
 * usuário escolhe Fotos/Galeria. Precisa sair de um toque: o navegador exige
 * gesto do usuário, então não dá para chamar sozinho ao terminar a gravação.
 */
export async function shareFiles(
  files: File[],
  title: string,
): Promise<ShareOutcome> {
  if (!canShareFiles() || files.length === 0) return "unavailable";
  try {
    if (!navigator.canShare({ files })) return "unavailable";
    await navigator.share({ files, title });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unavailable";
  }
}

export async function shareCaptureFiles(input: {
  horizontalUrl: string;
  verticalUrl: string;
  horizontalName: string;
  verticalName: string;
  mimeType: string;
  title: string;
}): Promise<ShareOutcome> {
  if (!canShareFiles()) return "unavailable";
  try {
    const [blobH, blobV] = await Promise.all([
      fetch(input.horizontalUrl).then((r) => r.blob()),
      fetch(input.verticalUrl).then((r) => r.blob()),
    ]);
    return shareFiles(
      [
        new File([blobH], input.horizontalName, { type: input.mimeType }),
        new File([blobV], input.verticalName, { type: input.mimeType }),
      ],
      input.title,
    );
  } catch {
    return "unavailable";
  }
}

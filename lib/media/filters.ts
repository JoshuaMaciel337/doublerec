export type FilterId =
  | "none"
  | "retro"
  | "lowlight"
  | "nature"
  | "cinema"
  | "vlog"
  | "vintage"
  | "cold"
  | "warm"
  | "bw"
  | "flat";

export interface FilterTint {
  color: string;
  alpha: number;
  mode: GlobalCompositeOperation;
}

export interface FilterPreset {
  id: FilterId;
  label: string;
  hint: string;
  /** cadeia de filtros CSS aplicada no contexto 2D antes do drawImage */
  css: string;
  /** intensidade da vinheta desenhada por cima (0 = nenhuma) */
  vignette?: number;
  /** camada de cor aplicada depois do frame */
  tint?: FilterTint;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "none",
    label: "Original",
    hint: "Sem tratamento",
    css: "",
  },
  {
    id: "retro",
    label: "Retrô",
    hint: "Sépia quente com vinheta",
    css: "sepia(0.42) contrast(1.14) saturate(1.12) hue-rotate(-8deg) brightness(1.02)",
    vignette: 0.38,
    tint: { color: "#ff9a3c", alpha: 0.08, mode: "soft-light" },
  },
  {
    id: "lowlight",
    label: "Ambiente escuro",
    hint: "Igreja, teatro, luz baixa",
    css: "brightness(1.34) contrast(1.14) saturate(0.92)",
    tint: { color: "#0a1a33", alpha: 0.05, mode: "soft-light" },
  },
  {
    id: "nature",
    label: "Natureza",
    hint: "Verdes e céu reforçados",
    css: "saturate(1.4) contrast(1.08) brightness(1.03) hue-rotate(-6deg)",
  },
  {
    id: "cinema",
    label: "Cinema",
    hint: "Contraste alto, tom frio",
    css: "contrast(1.2) saturate(0.9) brightness(0.98)",
    vignette: 0.26,
    tint: { color: "#1d5f7a", alpha: 0.1, mode: "soft-light" },
  },
  {
    id: "vlog",
    label: "Vlog",
    hint: "Pele clara e viva",
    css: "saturate(1.16) contrast(1.05) brightness(1.07)",
  },
  {
    id: "vintage",
    label: "Vintage",
    hint: "Desbotado anos 80",
    css: "sepia(0.28) saturate(0.82) contrast(0.94) brightness(1.06)",
    vignette: 0.42,
  },
  {
    id: "cold",
    label: "Frio",
    hint: "Azulado",
    css: "hue-rotate(10deg) saturate(1.05) contrast(1.06)",
    tint: { color: "#3f7fd6", alpha: 0.1, mode: "soft-light" },
  },
  {
    id: "warm",
    label: "Quente",
    hint: "Dourado",
    css: "sepia(0.18) saturate(1.12) contrast(1.02)",
    tint: { color: "#ff8a2b", alpha: 0.1, mode: "soft-light" },
  },
  {
    id: "bw",
    label: "P&B",
    hint: "Preto e branco",
    css: "grayscale(1) contrast(1.18)",
  },
  {
    id: "flat",
    label: "Flat",
    hint: "Baixo contraste para editar depois",
    css: "contrast(0.82) saturate(0.86) brightness(1.08)",
  },
];

export function getFilterPreset(id: FilterId): FilterPreset {
  return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0];
}

export interface ImageAdjustments {
  /** 1 = neutro */
  brightness: number;
  contrast: number;
  saturation: number;
}

export const NEUTRAL_ADJUSTMENTS: ImageAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
};

export function isNeutral(adj: ImageAdjustments): boolean {
  return (
    adj.brightness === 1 && adj.contrast === 1 && adj.saturation === 1
  );
}

/** Monta o valor de ctx.filter combinando preset e ajustes manuais */
export function buildFilterString(
  preset: FilterPreset,
  adj: ImageAdjustments,
): string {
  const parts: string[] = [];
  if (preset.css) parts.push(preset.css);
  if (adj.brightness !== 1) parts.push(`brightness(${adj.brightness})`);
  if (adj.contrast !== 1) parts.push(`contrast(${adj.contrast})`);
  if (adj.saturation !== 1) parts.push(`saturate(${adj.saturation})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

/** resultado do teste de pixel — só preenchido no cliente */
let nativeFilterCached: boolean | null = null;

/**
 * true só quando o motor realmente altera pixels com ctx.filter.
 * No Safari / Chrome do iPhone (WebKit) a propriedade pode existir e mesmo
 * assim ficar desligada por padrão — nesses casos o fallback em
 * softwareFilter.ts assume. A UI nunca bloqueia a escolha do filtro.
 */
export function supportsNativeCanvasFilter(): boolean {
  if (nativeFilterCached !== null) return nativeFilterCached;
  // no servidor não cacheamos: senão o false da pré-renderização vaza pro cliente
  if (typeof document === "undefined") return false;
  if (
    typeof CanvasRenderingContext2D === "undefined" ||
    !("filter" in CanvasRenderingContext2D.prototype)
  ) {
    nativeFilterCached = false;
    return false;
  }
  try {
    const src = document.createElement("canvas");
    src.width = 1;
    src.height = 1;
    const sctx = src.getContext("2d");
    if (!sctx) {
      nativeFilterCached = false;
      return false;
    }
    sctx.fillStyle = "#ff0000";
    sctx.fillRect(0, 0, 1, 1);

    const dst = document.createElement("canvas");
    dst.width = 1;
    dst.height = 1;
    const dctx = dst.getContext("2d");
    if (!dctx) {
      nativeFilterCached = false;
      return false;
    }
    dctx.filter = "grayscale(1)";
    dctx.drawImage(src, 0, 0);
    const [r, g, b] = dctx.getImageData(0, 0, 1, 1).data;
    // filtro nativo deixa o vermelho cinza; se continuar vermelho puro, está off
    nativeFilterCached = Math.abs(r - g) < 30 && Math.abs(g - b) < 30;
    return nativeFilterCached;
  } catch {
    nativeFilterCached = false;
    return false;
  }
}

/** Filtros sempre podem ser escolhidos — nativo ou software */
export function supportsCanvasFilter(): boolean {
  return true;
}

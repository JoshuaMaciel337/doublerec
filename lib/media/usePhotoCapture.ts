"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PhotoResult {
  horizontalUrl: string;
  verticalUrl: string;
  takenAt: number;
}

const JPEG_QUALITY = 0.92;

function canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("canvas vazio"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function revoke(photo: PhotoResult | null) {
  if (!photo) return;
  URL.revokeObjectURL(photo.horizontalUrl);
  URL.revokeObjectURL(photo.verticalUrl);
}

/**
 * A foto sai dos mesmos canvases já renderizados, então herda filtro, ajustes
 * e enquadramento de cada formato sem abrir uma segunda câmera.
 */
export function usePhotoCapture() {
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<PhotoResult | null>(null);

  const capture = useCallback(
    async (
      canvasH: HTMLCanvasElement,
      canvasV: HTMLCanvasElement,
    ): Promise<PhotoResult | null> => {
      try {
        const [horizontalUrl, verticalUrl] = await Promise.all([
          canvasToUrl(canvasH),
          canvasToUrl(canvasV),
        ]);
        const next: PhotoResult = {
          horizontalUrl,
          verticalUrl,
          takenAt: Date.now(),
        };
        revoke(photoRef.current);
        photoRef.current = next;
        setPhoto(next);
        setError(null);
        return next;
      } catch {
        setError("Não foi possível gerar a foto neste navegador.");
        return null;
      }
    },
    [],
  );

  useEffect(() => () => revoke(photoRef.current), []);

  return { photo, error, capture };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PhotoResult {
  horizontalUrl: string;
  verticalUrl: string;
  horizontalBlob: Blob;
  verticalBlob: Blob;
  takenAt: number;
}

const JPEG_QUALITY = 0.92;
export const PHOTO_MIME = "image/jpeg";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("canvas vazio"));
          return;
        }
        resolve(blob);
      },
      PHOTO_MIME,
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
        const [horizontalBlob, verticalBlob] = await Promise.all([
          canvasToBlob(canvasH),
          canvasToBlob(canvasV),
        ]);
        const next: PhotoResult = {
          horizontalUrl: URL.createObjectURL(horizontalBlob),
          verticalUrl: URL.createObjectURL(verticalBlob),
          horizontalBlob,
          verticalBlob,
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

export const maximumCanvasPixels = 8_388_608;

export interface DocumentSource {
  pages: number;
  draw: (
    canvas: HTMLCanvasElement,
    page: number,
    width: number,
    zoom: number,
    rotation: number,
    signal: AbortSignal,
  ) => Promise<void>;
  readText: (page: number, signal: AbortSignal) => Promise<string | null>;
  destroy: () => void;
}

/** Refuse oversized raster dimensions before allocating a decoded bitmap. */
export function checkImageDimensions(bytes: ArrayBuffer, type: string) {
  const data = new DataView(bytes);
  let width = 0;
  let height = 0;
  if (
    type === "image/png" &&
    data.byteLength >= 24 &&
    data.getUint32(0) === 0x89504e47 &&
    data.getUint32(4) === 0x0d0a1a0a
  ) {
    width = data.getUint32(16);
    height = data.getUint32(20);
  } else if (
    type === "image/jpeg" &&
    data.byteLength >= 4 &&
    data.getUint16(0) === 0xffd8
  ) {
    let at = 2;
    while (at + 4 <= data.byteLength) {
      if (data.getUint8(at++) !== 0xff) break;
      while (at < data.byteLength && data.getUint8(at) === 0xff) at++;
      if (at + 3 > data.byteLength) break;
      const marker = data.getUint8(at++);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = data.getUint16(at);
      if (length < 2 || at + length > data.byteLength) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 7
      ) {
        height = data.getUint16(at + 3);
        width = data.getUint16(at + 5);
        break;
      }
      at += length;
    }
  }
  if (
    !width ||
    !height ||
    width > 16_384 ||
    height > 16_384 ||
    width * height > 40_000_000
  )
    throw new Error("Image dimensions are not suitable for preview.");
}

/** A bounded backing canvas, independent of zoom and high-DPI screen size. */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 16_384 ||
    height > 16_384
  )
    throw new Error("Page dimensions are not suitable for preview.");
  const ratio = Math.min(
    window.devicePixelRatio || 1,
    2,
    Math.sqrt(maximumCanvasPixels / (width * height)),
  );
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return ratio;
}

/** Open a decoded raster image (PNG or JPEG) as a one-page document source. */
export async function openImageDocument(
  bytes: ArrayBuffer,
  contentType: string,
  signal: AbortSignal,
): Promise<DocumentSource> {
  checkImageDimensions(bytes, contentType);
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: contentType }),
  );
  if (signal.aborted) {
    bitmap.close();
    signal.throwIfAborted();
  }
  return {
    pages: 1,
    destroy: () => bitmap.close(),
    async readText() {
      return "";
    },
    async draw(canvas, _page, width, zoom, rotation, renderSignal) {
      renderSignal.throwIfAborted();
      const sideways = rotation % 180 !== 0;
      const naturalWidth = sideways ? bitmap.height : bitmap.width;
      const naturalHeight = sideways ? bitmap.width : bitmap.height;
      const scale = (width / naturalWidth) * zoom;
      const ratio = sizeCanvas(
        canvas,
        naturalWidth * scale,
        naturalHeight * scale,
      );
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.translate((naturalWidth * scale) / 2, (naturalHeight * scale) / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        bitmap,
        (-bitmap.width * scale) / 2,
        (-bitmap.height * scale) / 2,
        bitmap.width * scale,
        bitmap.height * scale,
      );
    },
  };
}

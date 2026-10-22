// =============================================================================
// Fit any image onto WhatsApp's wide carousel/header card (1.91:1) WITHOUT
// cropping the original. WhatsApp always renders template/carousel images in a
// fixed ~1.91:1 landscape shape and center-crops anything taller — so a square
// (e.g. 1200×1200) or portrait graphic would lose its top and bottom.
//
// To preserve the full image, we letterbox it onto a 1.91:1 canvas: the
// complete original is drawn centered and sharp, and the side gaps are filled
// with a blurred, slightly darkened copy of the same image so it looks seamless
// rather than empty bars. Runs entirely in the browser (Canvas) before upload,
// so there's no server image-processing dependency.
// =============================================================================

const TARGET_ASPECT = 1.91;      // WhatsApp card width : height
const MAX_CANVAS_WIDTH = 1600;   // plenty for a small chat card; keeps files light
const ASPECT_TOLERANCE = 0.03;   // already-landscape images are left untouched

/**
 * Returns a new JPEG File fitted to 1.91:1 (full original preserved, blurred
 * backdrop on the gaps). If the image is already ~1.91:1, or anything goes
 * wrong, the original file is returned unchanged.
 */
export async function fitToWhatsAppCard(file: File): Promise<File> {
  // Only raster images; skip SVG/unknown.
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // can't decode in this browser — upload as-is
  }

  try {
    const w = bitmap.width;
    const h = bitmap.height;
    if (!w || !h) return file;

    const aspect = w / h;
    if (Math.abs(aspect - TARGET_ASPECT) < ASPECT_TOLERANCE) return file; // already fine

    // Canvas (in source pixels) that fully contains the image at 1.91:1.
    let canvasW: number;
    let canvasH: number;
    if (aspect < TARGET_ASPECT) {
      canvasH = h;
      canvasW = Math.round(h * TARGET_ASPECT);
    } else {
      canvasW = w;
      canvasH = Math.round(w / TARGET_ASPECT);
    }

    // Keep the output light.
    const scale = canvasW > MAX_CANVAS_WIDTH ? MAX_CANVAS_WIDTH / canvasW : 1;
    const cw = Math.max(1, Math.round(canvasW * scale));
    const ch = Math.max(1, Math.round(canvasH * scale));
    const fw = Math.round(w * scale); // foreground (full image) width
    const fh = Math.round(h * scale); // foreground height

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // 1) Blurred "cover" backdrop filling the whole card.
    const coverScale = Math.max(cw / w, ch / h);
    const bw = w * coverScale;
    const bh = h * coverScale;
    try {
      ctx.filter = 'blur(28px)';
    } catch {
      /* ctx.filter unsupported — backdrop will just be a sharp cover, still fine */
    }
    ctx.drawImage(bitmap, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
    ctx.filter = 'none';

    // Subtle dark wash so the centred image stands out from its backdrop.
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, 0, cw, ch);

    // 2) The full, sharp original, centred (nothing cropped).
    ctx.drawImage(bitmap, (cw - fw) / 2, (ch - fh) / 2, fw, fh);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.(png|jpe?g|webp)$/i, '') || 'image';
    return new File([blob], `${baseName}-card.jpg`, { type: 'image/jpeg' });
  } catch {
    return file; // any failure → fall back to the original upload
  } finally {
    bitmap?.close?.();
  }
}

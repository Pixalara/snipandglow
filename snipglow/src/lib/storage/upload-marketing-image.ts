// =============================================================================
// Upload a marketing-template header image to Supabase Storage → public URL.
//
// Bucket: marketing (PUBLIC) — WhatsApp's media servers fetch the header image
// by public https URL at send time, so it must be publicly readable. Mirrors
// the `logos` / `invoices` bucket pattern.
// Path:   {tenantId}/tpl-{timestamp}.{ext}  (timestamped so the CDN never serves
//         a stale image after a re-upload).
//
// FORMAT: WhatsApp image headers accept only JPG and PNG (no WEBP/GIF/SVG), and
// cap the file at 5 MB — enforced here so a bad file fails fast, before we ever
// call Meta.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'marketing';

/** WhatsApp image-header formats only. */
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

/** Max header image size WhatsApp accepts. */
export const MARKETING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type MarketingImageUploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

/** Upload header-image bytes and return a permanent public URL. */
export async function uploadMarketingImage(
  tenantId: string,
  bytes: Buffer,
  contentType: string
): Promise<MarketingImageUploadResult> {
  const ext = EXT_BY_TYPE[contentType.toLowerCase()];
  if (!ext) return { ok: false, error: 'Use a JPG or PNG image (those are the formats WhatsApp accepts).' };
  if (!bytes?.length) return { ok: false, error: 'The image is empty.' };
  if (bytes.length > MARKETING_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'Image must be under 5 MB.' };
  }

  const admin = createAdminClient();
  const storagePath = `${tenantId}/tpl-${Date.now()}.${ext}`;

  // Ensure the bucket exists as PUBLIC (idempotent — no-op if already created).
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MARKETING_IMAGE_MAX_BYTES,
  });
  if (bucketErr && !bucketErr.message?.includes('already')) {
    console.error('[uploadMarketingImage] Bucket create error:', bucketErr.message);
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });

  if (uploadErr) {
    console.error('[uploadMarketingImage] Upload failed:', uploadErr.message);
    return { ok: false, error: `Image upload failed: ${uploadErr.message}` };
  }

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  if (!publicData?.publicUrl) {
    return { ok: false, error: 'Could not generate the image URL.' };
  }

  return { ok: true, url: publicData.publicUrl, path: storagePath };
}

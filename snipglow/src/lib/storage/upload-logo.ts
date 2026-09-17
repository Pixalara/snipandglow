// =============================================================================
// Upload a tenant logo to Supabase Storage and return a public URL.
//
// Bucket: logos (PUBLIC) — the booking page is public and unauthenticated, so
// the logo must be publicly readable. Mirrors the invoices-bucket pattern.
// Path:   {tenantId}/logo-{timestamp}.{ext}  (timestamped so the CDN never
//         serves a stale image after a re-upload).
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'logos';

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

export type LogoUploadResult = { ok: true; url: string; path: string } | { ok: false; error: string };

/** Upload logo bytes and return a permanent public URL. */
export async function uploadTenantLogo(
  tenantId: string,
  bytes: Buffer,
  contentType: string
): Promise<LogoUploadResult> {
  const ext = EXT_BY_TYPE[contentType.toLowerCase()];
  if (!ext) return { ok: false, error: 'Unsupported image type. Use PNG, JPG, WEBP or SVG.' };

  const admin = createAdminClient();
  const storagePath = `${tenantId}/logo-${Date.now()}.${ext}`;

  // Ensure the bucket exists as PUBLIC (idempotent).
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
  });
  if (bucketErr && !bucketErr.message?.includes('already')) {
    console.error('[uploadTenantLogo] Bucket create error:', bucketErr.message);
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });

  if (uploadErr) {
    console.error('[uploadTenantLogo] Upload failed:', uploadErr.message);
    return { ok: false, error: `Logo upload failed: ${uploadErr.message}` };
  }

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  if (!publicData?.publicUrl) {
    return { ok: false, error: 'Could not generate the logo URL.' };
  }

  return { ok: true, url: publicData.publicUrl, path: storagePath };
}

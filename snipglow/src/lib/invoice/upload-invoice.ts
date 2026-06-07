// =============================================================================
// Upload a generated invoice PDF to Supabase Storage and return a public URL.
//
// Bucket: invoices (PUBLIC)
// Path:   {tenantId}/{invoiceNumber}.pdf
//
// The bucket is public, so we return a permanent public URL. This is simpler
// and more reliable than signed URLs (no expiry, no signing round-trip), and
// WhatsApp's media servers can fetch it directly when used as a document
// header link.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'invoices';

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

/**
 * Upload a PDF buffer to Supabase Storage and return a 30-day signed URL.
 * Creates the bucket on first use if it doesn't exist.
 */
export async function uploadInvoicePdf(
  tenantId: string,
  invoiceNumber: string,
  pdfBuffer: Buffer
): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const storagePath = `${tenantId}/${invoiceNumber}.pdf`;

  // Ensure the bucket exists as PUBLIC (idempotent — no-op if already created).
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  });
  // 'BucketAlreadyExists' is expected and safe to ignore.
  if (bucketErr && !bucketErr.message?.includes('already')) {
    console.error('[uploadInvoicePdf] Bucket create error:', bucketErr.message);
    // Non-fatal: proceed — the bucket may already exist.
  }

  // Upload (upsert so re-sending the same invoice is idempotent).
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.error('[uploadInvoicePdf] Upload failed:', uploadErr.message);
    return { ok: false, error: `PDF upload failed: ${uploadErr.message}` };
  }

  // Bucket is public — return the permanent public URL.
  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

  if (!publicData?.publicUrl) {
    console.error('[uploadInvoicePdf] Could not resolve public URL');
    return { ok: false, error: 'Could not generate download URL' };
  }

  return { ok: true, url: publicData.publicUrl, path: storagePath };
}

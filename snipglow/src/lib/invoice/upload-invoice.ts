// =============================================================================
// Upload a generated invoice PDF to Supabase Storage and return a signed URL.
//
// Bucket: invoices (private, RLS off for service-role)
// Path:   {tenantId}/{invoiceNumber}.pdf
//
// The signed URL is valid for 30 days (2_592_000 seconds), which is plenty of
// time for the customer to download it from the WhatsApp message link.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'invoices';
const SIGNED_URL_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

  // Ensure the bucket exists (idempotent — no-op if already created).
  const { error: bucketErr } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  });
  // PGRST error code 'BucketAlreadyExists' is expected and safe to ignore.
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

  // Generate a signed URL valid for 30 days.
  const { data: signedData, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (signErr || !signedData?.signedUrl) {
    console.error('[uploadInvoicePdf] Signed URL error:', signErr?.message);
    return { ok: false, error: 'Could not generate download URL' };
  }

  return { ok: true, url: signedData.signedUrl, path: storagePath };
}

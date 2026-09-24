// =============================================================================
// Meta resumable media upload.
//
// Used when cloning a template that has a media (document) header: Meta's
// template CREATE endpoint needs an example media *handle* (not a URL), which
// you obtain by uploading a sample file through the App-scoped resumable upload
// API. Two steps:
//   1. Start a session:  POST /{app-id}/uploads?file_length&file_type&file_name
//   2. Upload the bytes: POST /{upload-session-id}  (Authorization: OAuth <tok>)
//      -> returns { h: "<handle>" }
//
// The returned handle is passed as example.header_handle when creating the
// template. The sample file is only used for Meta's preview/review — the real
// document is attached at send time.
// =============================================================================

import { WA_BASE_URL } from './config';

export interface MediaUploadResult {
  ok: boolean;
  handle?: string;
  error?: string;
}

/**
 * Upload any small sample file (document OR image) via the resumable upload API
 * and return its reusable media handle for template creation. `appId` is the
 * Meta App ID; `accessToken` should be the token that will also create the
 * template (self-consistent ownership). The sample is only used for Meta's
 * preview/review — the real media is attached at send time by link.
 */
export async function uploadResumableMedia(
  appId: string,
  accessToken: string,
  bytes: Buffer,
  fileName: string,
  fileType: string
): Promise<MediaUploadResult> {
  if (!appId) return { ok: false, error: 'META_APP_ID is not configured.' };
  if (!bytes?.length) return { ok: false, error: 'Sample file is empty.' };

  try {
    // 1) Start an upload session.
    const startUrl =
      `${WA_BASE_URL}/${appId}/uploads` +
      `?file_name=${encodeURIComponent(fileName)}` +
      `&file_length=${bytes.length}` +
      `&file_type=${encodeURIComponent(fileType)}`;
    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok || !startData?.id) {
      return { ok: false, error: startData?.error?.message || `upload session failed (${startRes.status})` };
    }

    // 2) Upload the file bytes to the returned session id.
    const upRes = await fetch(`${WA_BASE_URL}/${String(startData.id)}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: '0',
        'Content-Type': fileType,
      },
      body: new Uint8Array(bytes),
    });
    const upData = await upRes.json().catch(() => ({}));
    if (!upRes.ok || !upData?.h) {
      return { ok: false, error: upData?.error?.message || `upload failed (${upRes.status})` };
    }

    return { ok: true, handle: String(upData.h) };
  } catch {
    return { ok: false, error: 'Could not reach the upload API.' };
  }
}

/** Back-compat: upload a sample PDF document header (used by the template cloner). */
export function uploadResumableDocument(
  appId: string,
  accessToken: string,
  bytes: Buffer,
  fileName: string,
  fileType = 'application/pdf'
): Promise<MediaUploadResult> {
  return uploadResumableMedia(appId, accessToken, bytes, fileName, fileType);
}

/** Upload a sample image header (JPG/PNG) for a marketing template. */
export function uploadResumableImage(
  appId: string,
  accessToken: string,
  bytes: Buffer,
  fileName: string,
  fileType: string
): Promise<MediaUploadResult> {
  return uploadResumableMedia(appId, accessToken, bytes, fileName, fileType);
}

import type {SupabaseClient} from '@supabase/supabase-js';
import {DISASTER_REPORTS_BUCKET, formatSupabaseDbError} from './supabase';

export const MAX_DISASTER_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
]);

export interface ValidatableFile {
  name: string;
  size: number;
  type: string;
}

export function validateDisasterImageFile(file: ValidatableFile): string | null {
  if (!file) return 'No image file selected.';
  if (file.size <= 0) {
    return 'Selected image file is empty.';
  }
  if (file.size > MAX_DISASTER_IMAGE_BYTES) {
    return 'Incident photo must be 5 MB or smaller.';
  }
  const hasImageMime = Boolean(file.type && file.type.startsWith('image/'));
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!hasImageMime && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return 'Please select a valid image file (JPEG, PNG, or WebP).';
  }
  return null;
}

export function buildUserDisasterImagePath(
  userId: string,
  originalFileName: string,
  timestamp = Date.now(),
): string {
  const cleanUserId = userId.trim().replace(/[^a-zA-Z0-9-]/g, '');
  if (!cleanUserId) {
    throw new Error('Authenticated user UUID is required to store disaster images.');
  }
  const rawName = originalFileName.trim() || 'incident.jpg';
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${cleanUserId}/${timestamp}_${safeName}`;
}

export function extractStoragePathFromReport(
  report: {
    incident_photo_path?: string | null;
    incident_photo_url?: string | null;
  },
  bucketName = DISASTER_REPORTS_BUCKET,
): string {
  const rawPath = (report.incident_photo_path || '').trim();
  if (rawPath) {
    return rawPath
      .replace(/^\/+/, '')
      .replace(new RegExp(`^${bucketName}/`), '');
  }

  const rawUrl = (report.incident_photo_url || '').trim();
  if (!rawUrl) return '';

  const marker = `/${bucketName}/`;
  const idx = rawUrl.indexOf(marker);
  if (idx !== -1) {
    const afterBucket = rawUrl.slice(idx + marker.length).split('?')[0];
    try {
      return decodeURIComponent(afterBucket).replace(/^\/+/, '');
    } catch {
      return afterBucket.replace(/^\/+/, '');
    }
  }

  // Handle legacy records where a relative storage path was saved inside incident_photo_url
  if (!/^https?:\/\//i.test(rawUrl) && rawUrl.includes('/')) {
    return rawUrl.replace(/^\/+/, '').replace(new RegExp(`^${bucketName}/`), '');
  }

  return '';
}

export interface UploadedDisasterImage {
  path: string;
  signedUrl: string;
}

export async function uploadDisasterImageWithSignedUrl(
  client: SupabaseClient,
  userId: string,
  file: File,
  expiresInSeconds = 3600,
): Promise<UploadedDisasterImage> {
  const validationError = validateDisasterImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const objectPath = buildUserDisasterImagePath(userId, file.name);
  const {error: uploadErr} = await client.storage
    .from(DISASTER_REPORTS_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(formatSupabaseDbError(`Image upload failed: ${uploadErr.message}`));
  }

  const {data: signedData, error: signedErr} = await client.storage
    .from(DISASTER_REPORTS_BUCKET)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (signedErr || !signedData?.signedUrl) {
    await deleteDisasterImage(client, objectPath);
    throw new Error(
      formatSupabaseDbError(
        `Uploaded image could not be signed for private access: ${
          signedErr?.message || 'Missing signed URL'
        }`,
      ),
    );
  }

  return {
    path: objectPath,
    signedUrl: signedData.signedUrl,
  };
}

export async function deleteDisasterImage(
  client: SupabaseClient,
  objectPath: string,
): Promise<void> {
  if (!objectPath) return;
  try {
    await client.storage.from(DISASTER_REPORTS_BUCKET).remove([objectPath]);
  } catch {
    // Best-effort cleanup of orphaned uploads
  }
}

export async function resolveReportSignedUrls(
  client: SupabaseClient,
  reports: Array<{
    id: string;
    incident_photo_path?: string | null;
    incident_photo_url?: string | null;
  }>,
  expiresInSeconds = 3600,
): Promise<{
  signedUrlMap: Record<string, string>;
  failedReportIds: string[];
}> {
  const signedUrlMap: Record<string, string> = {};
  const failedReportIds: string[] = [];

  const pathByReportId = new Map<string, string>();
  const uniquePaths: string[] = [];

  for (const r of reports) {
    const path = extractStoragePathFromReport(r);
    if (path) {
      pathByReportId.set(r.id, path);
      if (!uniquePaths.includes(path)) {
        uniquePaths.push(path);
      }
    }
  }

  if (uniquePaths.length === 0) {
    return {signedUrlMap, failedReportIds};
  }

  const pathToSignedUrl = new Map<string, string>();

  const {data: batchData, error: batchErr} = await client.storage
    .from(DISASTER_REPORTS_BUCKET)
    .createSignedUrls(uniquePaths, expiresInSeconds);

  if (!batchErr && Array.isArray(batchData)) {
    for (const item of batchData) {
      if (item.path && item.signedUrl && /^https?:\/\//i.test(item.signedUrl)) {
        pathToSignedUrl.set(item.path, item.signedUrl);
      }
    }
  }

  // Fallback individually for any path not resolved in batch
  const missingPaths = uniquePaths.filter((p) => !pathToSignedUrl.has(p));
  if (missingPaths.length > 0) {
    await Promise.all(
      missingPaths.map(async (p) => {
        const {data: singleData} = await client.storage
          .from(DISASTER_REPORTS_BUCKET)
          .createSignedUrl(p, expiresInSeconds);
        if (singleData?.signedUrl && /^https?:\/\//i.test(singleData.signedUrl)) {
          pathToSignedUrl.set(p, singleData.signedUrl);
        }
      }),
    );
  }

  for (const [reportId, path] of pathByReportId.entries()) {
    const url = pathToSignedUrl.get(path);
    if (url) {
      signedUrlMap[reportId] = url;
    } else {
      failedReportIds.push(reportId);
    }
  }

  return {signedUrlMap, failedReportIds};
}

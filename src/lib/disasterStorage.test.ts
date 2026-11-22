import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {
  buildUserDisasterImagePath,
  deleteDisasterImage,
  extractStoragePathFromReport,
  MAX_DISASTER_IMAGE_BYTES,
  resolveReportSignedUrls,
  uploadDisasterImageWithSignedUrl,
  validateDisasterImageFile,
} from './disasterStorage.ts';

function makeMockStorageClient(handlers: {
  upload?: (path: string, file: File, opts: unknown) => Promise<{error: {message: string} | null}>;
  createSignedUrl?: (
    path: string,
    expiresIn: number,
  ) => Promise<{data: {signedUrl: string} | null; error: {message: string} | null}>;
  createSignedUrls?: (
    paths: string[],
    expiresIn: number,
  ) => Promise<{
    data: Array<{path: string | null; signedUrl: string; error: string | null}> | null;
    error: {message: string} | null;
  }>;
  remove?: (paths: string[]) => Promise<{error: {message: string} | null}>;
}): SupabaseClient {
  return {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'disaster-reports');
        return {
          upload: handlers.upload ?? (async () => ({error: null})),
          createSignedUrl:
            handlers.createSignedUrl ??
            (async (path: string) => ({
              data: {signedUrl: `https://qpjmzqpomsitvdaxjgou.supabase.co/storage/v1/object/sign/disaster-reports/${path}?token=abc`},
              error: null,
            })),
          createSignedUrls:
            handlers.createSignedUrls ??
            (async (paths: string[]) => ({
              data: paths.map((p) => ({
                path: p,
                signedUrl: `https://qpjmzqpomsitvdaxjgou.supabase.co/storage/v1/object/sign/disaster-reports/${p}?token=batch`,
                error: null,
              })),
              error: null,
            })),
          remove: handlers.remove ?? (async () => ({error: null})),
        };
      },
    },
  } as unknown as SupabaseClient;
}

test('validateDisasterImageFile enforces image MIME/extension and 5 MB limit', () => {
  assert.equal(
    validateDisasterImageFile({name: 'flood.jpg', size: 1024, type: 'image/jpeg'}),
    null,
  );
  assert.equal(
    validateDisasterImageFile({name: 'empty.png', size: 0, type: 'image/png'}),
    'Selected image file is empty.',
  );
  assert.equal(
    validateDisasterImageFile({
      name: 'huge.png',
      size: MAX_DISASTER_IMAGE_BYTES + 1,
      type: 'image/png',
    }),
    'Incident photo must be 5 MB or smaller.',
  );
  assert.equal(
    validateDisasterImageFile({name: 'notes.pdf', size: 2048, type: 'application/pdf'}),
    'Please select a valid image file (JPEG, PNG, or WebP).',
  );
});

test('buildUserDisasterImagePath stores inside authenticated user UUID folder and sanitizes filename', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  const path = buildUserDisasterImagePath(uid, '../../cyclone photo (1).png', 1700000000000);
  assert.equal(path, `${uid}/1700000000000_.._.._cyclone_photo__1_.png`);
  assert.ok(path.startsWith(`${uid}/`));
  assert.throws(() => buildUserDisasterImagePath('', 'photo.jpg'));
});

test('extractStoragePathFromReport parses incident_photo_path and signed disaster-reports URLs', () => {
  assert.equal(
    extractStoragePathFromReport({
      incident_photo_path: '/disaster-reports/user-1/123_img.jpg',
      incident_photo_url: '',
    }),
    'user-1/123_img.jpg',
  );
  assert.equal(
    extractStoragePathFromReport({
      incident_photo_path: '',
      incident_photo_url:
        'https://qpjmzqpomsitvdaxjgou.supabase.co/storage/v1/object/sign/disaster-reports/user-2/456_storm.webp?token=xyz',
    }),
    'user-2/456_storm.webp',
  );
});

test('uploadDisasterImageWithSignedUrl uploads to disaster-reports/<uuid>/ and returns signedUrl', async () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  let uploadedPath = '';
  const mockClient = makeMockStorageClient({
    upload: async (path) => {
      uploadedPath = path;
      return {error: null};
    },
  });

  const file = new File([new Uint8Array([1, 2, 3, 4])], 'flood.jpg', {
    type: 'image/jpeg',
  });
  const res = await uploadDisasterImageWithSignedUrl(mockClient, uid, file, 3600);

  assert.equal(res.path, uploadedPath);
  assert.ok(res.path.startsWith(`${uid}/`));
  assert.ok(res.signedUrl.startsWith('https://'));
  assert.ok(res.signedUrl.includes('/object/sign/disaster-reports/'));
});

test('uploadDisasterImageWithSignedUrl cleans up uploaded object if signed URL creation fails', async () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  let removedPaths: string[] = [];
  const mockClient = makeMockStorageClient({
    createSignedUrl: async () => ({
      data: null,
      error: {message: 'Object not found'},
    }),
    remove: async (paths) => {
      removedPaths = paths;
      return {error: null};
    },
  });

  const file = new File([new Uint8Array([1, 2, 3])], 'storm.png', {
    type: 'image/png',
  });

  await assert.rejects(
    () => uploadDisasterImageWithSignedUrl(mockClient, uid, file, 3600),
    /could not be signed/i,
  );
  assert.equal(removedPaths.length, 1);
  assert.ok(removedPaths[0].startsWith(`${uid}/`));
});

test('resolveReportSignedUrls uses batch createSignedUrls and fallback createSignedUrl for retrieval', async () => {
  const mockClient = makeMockStorageClient({
    createSignedUrls: async () => ({
      data: [
        {
          path: 'u1/a.jpg',
          signedUrl: 'https://example.supabase.co/storage/v1/object/sign/disaster-reports/u1/a.jpg?token=1',
          error: null,
        },
        {
          path: 'u1/b.jpg',
          signedUrl: '',
          error: 'retry',
        },
      ],
      error: null,
    }),
    createSignedUrl: async (path) => ({
      data: {
        signedUrl: `https://example.supabase.co/storage/v1/object/sign/disaster-reports/${path}?token=fallback`,
      },
      error: null,
    }),
  });

  const {signedUrlMap, failedReportIds} = await resolveReportSignedUrls(
    mockClient,
    [
      {id: 'r1', incident_photo_path: 'u1/a.jpg'},
      {id: 'r2', incident_photo_path: 'u1/b.jpg'},
      {id: 'r3', incident_photo_path: ''},
    ],
    3600,
  );

  assert.equal(failedReportIds.length, 0);
  assert.ok(signedUrlMap.r1.includes('token=1'));
  assert.ok(signedUrlMap.r2.includes('token=fallback'));
  assert.equal(signedUrlMap.r3, undefined);

  await deleteDisasterImage(mockClient, 'u1/a.jpg');
});

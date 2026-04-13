// ============================================================
// AutoEcom Lab — Vercel Blob client-upload token endpoint
// POST /api/contribute/upload
// Used by /contribute page to upload attachments directly from
// the browser to Vercel Blob. We issue a one-shot token scoped
// to the specific pathname + content type so uploads are safe.
// ============================================================

import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 60;

// Max file size: 20 MB — contributions are text-heavy, files are
// supporting material (screenshots, PDFs, short docs).
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

export async function POST(request: Request): Promise<NextResponse> {
  // Defense-in-depth: require a valid session before issuing any upload token.
  const session = requireSession(request);
  if (session instanceof Response) return session as unknown as NextResponse;

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The session cookie is the only trust source. Ignore any
        // user tag the client shoved into clientPayload.
        const user = session.user;

        console.log(`[contribute:upload] token issued to ${user} for ${pathname}`);

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          // Private — files are only read back via authenticated get()
          // on the server when curating.
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ user }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Just logging — the actual /api/contribute POST below persists
        // the url + metadata into Postgres.
        console.log(`[contribute:upload] completed ${blob.url} (${tokenPayload})`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[contribute:upload] error:', err);
    return NextResponse.json({ message }, { status: 400 });
  }
}

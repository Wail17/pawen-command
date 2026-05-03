// ============================================================
// PAWEN — /api/extract/file
//
// Accepts a single uploaded file (PDF, Markdown, plain text) and
// returns its plain-text content. Used by Brand DNA page (and any
// future gate) to bootstrap a research bundle from a document the
// user already wrote externally — pitch deck, brand brief, founder
// memo, transcript, etc.
//
// Why server-side: PDFs need parsing (`unpdf`, ~250KB serverless-
// safe). Markdown / .txt are trivially `await file.text()` but we
// keep one entrypoint so the client UI doesn't branch on file type.
//
// Auth: requires session (defense in depth — proxy already gates
// /api/* but a misconfig could let unauthed callers burn compute).
// Size cap: 10 MB (PDFs over that are almost always image-scans
// anyway and won't OCR usefully).
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { extractText } from 'unpdf';

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const TEXT_EXT = /\.(txt|md|markdown|csv)$/i;
const PDF_EXT = /\.pdf$/i;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: 'invalid multipart body: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: 'expected field "file" to be a File' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, message: 'file is empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, message: `file too large (${(file.size / 1_048_576).toFixed(1)}MB > 10MB cap)` },
      { status: 413 },
    );
  }

  const filename = file.name || 'unnamed';
  const isPdf = PDF_EXT.test(filename) || file.type === 'application/pdf';
  const isText =
    TEXT_EXT.test(filename) ||
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === '';

  try {
    let text: string;
    let pageCount: number | undefined;

    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await extractText(buf, { mergePages: true });
      // unpdf returns { text: string | string[], totalPages }
      text = Array.isArray(result.text) ? result.text.join('\n\n') : result.text;
      pageCount = result.totalPages;
    } else if (isText) {
      text = await file.text();
    } else {
      return NextResponse.json(
        { ok: false, message: `unsupported file type: ${filename} (${file.type || 'no MIME'}). Accepted: .pdf, .md, .txt, .csv` },
        { status: 415 },
      );
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'extracted text is empty (image-only PDF? unsupported encoding?)' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      filename,
      type: isPdf ? 'pdf' : 'text',
      pageCount,
      bytes: file.size,
      charCount: trimmed.length,
      text: trimmed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[extract/file] failed for ${filename}: ${msg}`);
    return NextResponse.json({ ok: false, message: `extraction failed: ${msg}` }, { status: 500 });
  }
}

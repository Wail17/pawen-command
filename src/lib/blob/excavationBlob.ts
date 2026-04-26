// ============================================================
// PAWEN — Vercel Blob helper for large Inngest step outputs
//
// Inngest serializes step.run() return values via JSON. Large blobs
// (Phase 2 fetch output: 200+ items × ~2KB each = 0.5-2MB; cross-source
// validation matrix; etc.) blow up the function-to-function payload
// size. We thread small handles through Inngest and stash the heavy
// payload on Vercel Blob.
//
// Threshold: 1MB. Below = inline, above = Blob.
// ============================================================

import 'server-only';
import { put as blobPut } from '@vercel/blob';

const BLOB_THRESHOLD_BYTES = 1_000_000;

export type StepOutputHandle<T> =
  | { kind: 'inline'; data: T }
  | { kind: 'blob'; url: string; sizeBytes: number; key: string };

/**
 * Wraps a step's payload in a handle: inline if small, Blob if large.
 * The Blob upload is server-side via @vercel/blob — needs
 * BLOB_READ_WRITE_TOKEN env var (auto-set by Vercel).
 */
export async function wrapStepOutput<T>(
  jobId: string,
  stepName: string,
  data: T,
): Promise<StepOutputHandle<T>> {
  const json = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  if (sizeBytes < BLOB_THRESHOLD_BYTES) {
    return { kind: 'inline', data };
  }
  // Random suffix in the key so retries on the same step produce a
  // fresh blob (don't overwrite a successful prior write).
  const key = `excavation/${jobId}/${stepName}-${Date.now()}.json`;
  const blob = await blobPut(key, json, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
  console.log(`[blob] uploaded ${stepName} for ${jobId} (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) → ${blob.url}`);
  return { kind: 'blob', url: blob.url, sizeBytes, key };
}

export async function unwrapStepOutput<T>(handle: StepOutputHandle<T>): Promise<T> {
  if (handle.kind === 'inline') return handle.data;
  const res = await fetch(handle.url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`[blob] fetch failed for ${handle.key}: HTTP ${res.status}`);
  }
  const json = await res.text();
  console.log(`[blob] hydrated ${handle.key} (${(handle.sizeBytes / 1024 / 1024).toFixed(2)}MB)`);
  return JSON.parse(json) as T;
}

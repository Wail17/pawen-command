'use client';

// ============================================================
// PAWEN — useAvatarJob
//
// Client hook that owns the lifecycle of a server-side avatar
// excavation job. Responsibilities:
//   - start(input)        → POST /api/avatars/start, returns jobId
//   - poll(jobId)         → GET /api/avatars/jobs/{id} every 2.5s
//   - resume(jobId)       → re-attach to an in-flight job (e.g. after
//                           the user closed and re-opened the page)
// Calls onProgress for each phase change so the UI can render the
// progress bar, and onComplete with the final AvatarRunResult once
// the job hits status='completed'. Errors flow through onError.
//
// The hook does NOT touch IndexedDB or the Project — the parent
// component is in charge of persistence so the existing post-run
// hydration logic in Gate1 stays in one place.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CoreAvatarInput,
  SourceConfig,
  AvatarRunResult,
  AvatarProgressEvent,
  AvatarProgressPhase,
} from '@/lib/avatars/types';
import type { RedditDepth } from '@/lib/sources/reddit';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

const POLL_MS = 2500;

export interface AvatarJobStartInput {
  projectId: string;
  gateId?: string;
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  reverseSeeds?: ReverseEngineeredFunnel | null;
}

interface JobSnapshot {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  phase: string;
  progress: { phase: AvatarProgressPhase; message: string; percent: number; itemCount?: number } | null;
  result: { avatarRunResult: AvatarRunResult; rawText?: string; totalTokens?: { input: number; output: number } } | null;
  error: string | null;
  heartbeatAt: string | null;
}

export interface UseAvatarJobOptions {
  onProgress?: (event: AvatarProgressEvent) => void;
  onComplete?: (result: AvatarRunResult, totalTokens?: { input: number; output: number }) => void | Promise<void>;
  onError?: (message: string) => void;
}

export function useAvatarJob(opts: UseAvatarJobOptions) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhase = useRef<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollOnce = useCallback(async (jobId: string): Promise<'continue' | 'done'> => {
    let snap: JobSnapshot | null = null;
    try {
      const res = await fetch(`/api/avatars/jobs/${jobId}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          optsRef.current.onError?.('Job not found (it may have expired).');
          return 'done';
        }
        // Transient — keep polling.
        return 'continue';
      }
      const data = await res.json();
      if (!data?.ok || !data.job) return 'continue';
      snap = data.job as JobSnapshot;
    } catch {
      // Network blip — keep polling.
      return 'continue';
    }

    if (snap.progress && snap.progress.phase !== lastPhase.current) {
      lastPhase.current = snap.progress.phase;
      optsRef.current.onProgress?.({
        phase: snap.progress.phase,
        message: snap.progress.message,
        itemCount: snap.progress.itemCount,
      });
    }

    if (snap.status === 'completed' && snap.result) {
      await optsRef.current.onComplete?.(snap.result.avatarRunResult, snap.result.totalTokens);
      return 'done';
    }
    if (snap.status === 'failed' || snap.status === 'canceled') {
      optsRef.current.onError?.(snap.error ?? `Job ${snap.status}`);
      return 'done';
    }
    return 'continue';
  }, []);

  const startPollLoop = useCallback(
    (jobId: string) => {
      stopPolling();
      const tick = async () => {
        const verdict = await pollOnce(jobId);
        if (verdict === 'done') {
          setIsRunning(false);
          setActiveJobId(null);
          lastPhase.current = null;
          return;
        }
        pollTimer.current = setTimeout(tick, POLL_MS);
      };
      // Poll immediately, then on interval.
      pollTimer.current = setTimeout(tick, 100);
    },
    [pollOnce, stopPolling],
  );

  const start = useCallback(
    async (input: AvatarJobStartInput): Promise<string | null> => {
      setIsRunning(true);
      try {
        const res = await fetch('/api/avatars/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok || !data.jobId) {
          const msg = data?.message ?? `Failed to start job (HTTP ${res.status})`;
          optsRef.current.onError?.(msg);
          setIsRunning(false);
          return null;
        }
        const jobId = String(data.jobId);
        setActiveJobId(jobId);
        startPollLoop(jobId);
        return jobId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        optsRef.current.onError?.(msg);
        setIsRunning(false);
        return null;
      }
    },
    [startPollLoop],
  );

  const resume = useCallback(
    (jobId: string) => {
      setIsRunning(true);
      setActiveJobId(jobId);
      startPollLoop(jobId);
    },
    [startPollLoop],
  );

  const cancel = useCallback(async (jobId?: string): Promise<boolean> => {
    const id = jobId ?? activeJobId;
    if (!id) return false;
    try {
      const res = await fetch(`/api/avatars/jobs/${id}/cancel`, { method: 'POST' });
      const ok = res.ok;
      // Fire one more poll right away so the UI flips to 'failed'
      // before the next interval tick. If that fails we just wait.
      if (ok) await pollOnce(id).catch(() => null);
      return ok;
    } catch {
      return false;
    }
  }, [activeJobId, pollOnce]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { start, resume, cancel, activeJobId, isRunning, stopPolling };
}

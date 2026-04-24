'use client';

// ============================================================
// PAWEN — useDeepDiveJob
//
// Client hook for background deep-dive runs. Mirrors useAvatarJob
// but typed for DeepDiveResult.
//   - start(input)   → POST /api/avatars/deep-dive/start, returns jobId
//   - poll(jobId)    → GET /api/avatars/jobs/{id} every 2.5s
//   - resume(jobId)  → re-attach to an in-flight job after a tab refresh
//
// onComplete fires with the parsed DeepDiveResult once the worker
// finishes; the parent component is responsible for appending it to
// the right sub-avatar via appendDeepDive.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CoreAvatarInput,
  DeepDiveResult,
  SubAvatarV2,
} from '@/lib/avatars/types';

const POLL_MS = 2500;

export interface DeepDiveJobStartInput {
  projectId: string;
  gateId?: string;
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  focus?: string | null;
  priorDives?: DeepDiveResult[];
}

interface JobSnapshot {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  phase: string;
  progress: { phase: string; message: string; percent: number } | null;
  result: { dive: DeepDiveResult; subAvatarId: string } | null;
  error: string | null;
}

export interface UseDeepDiveJobOptions {
  onProgress?: (event: { phase: string; message: string; percent: number }) => void;
  onComplete?: (dive: DeepDiveResult, subAvatarId: string) => void | Promise<void>;
  onError?: (message: string) => void;
}

export function useDeepDiveJob(opts: UseDeepDiveJobOptions) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; message: string; percent: number } | null>(null);
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
          optsRef.current.onError?.('Deep-dive job not found (it may have expired).');
          return 'done';
        }
        return 'continue';
      }
      const data = await res.json();
      if (!data?.ok || !data.job) return 'continue';
      snap = data.job as JobSnapshot;
    } catch {
      return 'continue';
    }

    if (snap.progress && snap.progress.phase !== lastPhase.current) {
      lastPhase.current = snap.progress.phase;
      setProgress(snap.progress);
      optsRef.current.onProgress?.(snap.progress);
    }

    if (snap.status === 'completed' && snap.result) {
      await optsRef.current.onComplete?.(snap.result.dive, snap.result.subAvatarId);
      return 'done';
    }
    if (snap.status === 'failed' || snap.status === 'canceled') {
      optsRef.current.onError?.(snap.error ?? `Deep-dive ${snap.status}`);
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
          setProgress(null);
          lastPhase.current = null;
          return;
        }
        pollTimer.current = setTimeout(tick, POLL_MS);
      };
      pollTimer.current = setTimeout(tick, 100);
    },
    [pollOnce, stopPolling],
  );

  const start = useCallback(
    async (input: DeepDiveJobStartInput): Promise<string | null> => {
      setIsRunning(true);
      try {
        const res = await fetch('/api/avatars/deep-dive/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok || !data.jobId) {
          const msg = data?.message ?? `Failed to start deep-dive (HTTP ${res.status})`;
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

  return { start, resume, cancel, activeJobId, isRunning, progress, stopPolling };
}

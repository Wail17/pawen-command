// ============================================================
// PAWEN — tiny pLimit (no dependency)
// Used to cap concurrent /api/imagegen and /api/generate fan-outs from
// client-side "Generate All Picked" buttons. Without it, 60+ simultaneous
// Fluid invocations hit Vercel's concurrency wall and half come back 5xx.
// ============================================================

export type PLimit = <T>(fn: () => Promise<T>) => Promise<T>;

export function pLimit(concurrency: number): PLimit {
  if (concurrency < 1) concurrency = 1;
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          active--;
          next();
        }
      };
      queue.push(task);
      next();
    });
  };
}

/**
 * Run an array of async-producing functions with capped concurrency.
 * Equivalent to `Promise.all(fns.map(limit(concurrency)))` but cleaner.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = pLimit(concurrency);
  return Promise.all(items.map((item, i) => limit(() => fn(item, i))));
}

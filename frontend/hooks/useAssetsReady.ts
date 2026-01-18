// hooks/useAssetsReady.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function toAbsolute(url: string) {
  try {
    return new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();
  } catch {
    return url;
  }
}

function decodeImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // Try decode() for correctness
      // @ts-ignore
      const d = typeof img.decode === "function" ? img.decode() : Promise.resolve();
      Promise.resolve(d).then(() => resolve()).catch(() => resolve());
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

type Options = {
  timeoutMs?: number;     // global timeout (optional)
  retries?: number;       // per-image retries
  retryDelayMs?: number;  // delay between retries
  skipWindowLoadIfCached?: boolean; // if all assets are in cache, skip waiting for 'load'
};

async function decodeWithRetry(url: string, retries: number, retryDelayMs: number) {
  let lastError: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      await decodeImage(url);
      return;
    } catch (err) {
      lastError = err;
      if (i < retries) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError ?? new Error(`Unknown error loading ${url}`);
}

async function allAssetsInAnyCache(urls: string[]) {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  // Search across all caches (simplest + robust with next-pwa)
  const results = await Promise.all(urls.map((u) => caches.match(u)));
  return results.every(Boolean);
}

export function useAssetsReady(urls: string[] = [], opts: Options = {}) {
  const {
    timeoutMs,
    retries = 0,
    retryDelayMs = 300,
    skipWindowLoadIfCached = true,
  } = opts;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Normalize & de-dupe URLs so they match CacheStorage keys
  const assetUrls = useMemo(
    () => Array.from(new Set(urls.filter(Boolean).map(toAbsolute))),
    [urls]
  );

  const runId = useRef(0);

  const start = useCallback(() => {
    runId.current++;
    const id = runId.current;
    setReady(false);
    setError(null);

    (async () => {
      try {
        // If everything is already cached, we can skip the window 'load' wait.
        const cached = await allAssetsInAnyCache(assetUrls);

        const tasks: Promise<any>[] = [];

        // 1) Fonts first to avoid late reflow
        if (typeof document !== "undefined" && "fonts" in document) {
          tasks.push((document as any).fonts.ready);
        }

        // 2) Required images (strict decode, instant if cached)
        tasks.push(...assetUrls.map((u) => decodeWithRetry(u, retries, retryDelayMs)));

        // 3) 'load' only when not already cached (ensures bg images kick off)
        if (!(cached && skipWindowLoadIfCached)) {
          tasks.push(
            new Promise<void>((resolve) => {
              if (typeof window === "undefined") return resolve();
              if (document.readyState === "complete") return resolve();
              const onLoad = () => {
                window.removeEventListener("load", onLoad);
                resolve();
              };
              window.addEventListener("load", onLoad);
            })
          );
        }

        const all = Promise.all(tasks);
        const timed =
          typeof timeoutMs === "number"
            ? Promise.race([
                all,
                new Promise((_, rej) =>
                  setTimeout(() => rej(new Error("Asset load timed out")), timeoutMs)
                ),
              ])
            : all;

        await timed;
        if (runId.current === id) setReady(true);
      } catch (e: any) {
        if (runId.current === id) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  }, [assetUrls, timeoutMs, retries, retryDelayMs, skipWindowLoadIfCached]);

  useEffect(() => {
    start();
  }, [start]);

  const retry = useCallback(() => {
    start();
  }, [start]);

  return { ready, error, retry };
}

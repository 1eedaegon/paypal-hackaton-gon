import { useCallback, useEffect, useRef, useState } from "react";

export interface PolledResource<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads a resource on mount and again every `intervalMs` while the page is visible.
 * Keeps the last good data when a poll fails so the screen never blanks out.
 */
export function usePolledResource<T>(load: () => Promise<T>, intervalMs: number): PolledResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const latestRequest = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    try {
      const next = await loadRef.current();
      if (latestRequest.current === requestId) {
        setData(next);
        setError(null);
      }
    } catch (caught) {
      if (latestRequest.current === requestId) {
        setError(caught);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      latestRequest.current += 1;
    };
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

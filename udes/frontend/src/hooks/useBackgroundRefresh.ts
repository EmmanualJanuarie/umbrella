import { useCallback, useEffect, useRef, useState } from "react";

type RefreshOptions<T> = {
  fetcher: () => Promise<T>;
  intervalMs?: number;
  enabled?: boolean;
  keepPreviousData?: boolean;
  refreshOnFocus?: boolean;
  staleMs?: number;
  onError?: (error: unknown) => void;
};

export function useBackgroundRefresh<T>({
  fetcher,
  intervalMs = 0,
  enabled = true,
  keepPreviousData = true,
  refreshOnFocus = false,
  staleMs = 15000,
  onError,
}: RefreshOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);
  const inFlightRef = useRef<Promise<T | null> | null>(null);
  const lastFinishedAtRef = useRef(0);
  const dataRef = useRef<T | null>(null);
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refresh = useCallback(
    async (showLoading = false) => {
      if (!enabled) return null;
      if (inFlightRef.current) return inFlightRef.current;

      const now = Date.now();
      const isFresh = hasDataRef.current && now - lastFinishedAtRef.current < staleMs;
      if (!showLoading && isFresh) return dataRef.current;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (showLoading && (!keepPreviousData || !hasDataRef.current)) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const request = (async () => {
      try {
        const nextData = await fetcherRef.current();
        if (requestId === requestIdRef.current) {
          setData(nextData);
          hasDataRef.current = true;
          setError(null);
          lastFinishedAtRef.current = Date.now();
          setLastUpdatedAt(new Date());
        }
        return nextData;
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err);
          onErrorRef.current?.(err);
        }
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        inFlightRef.current = null;
      }
      })();

      inFlightRef.current = request;
      return request;
    },
    [enabled, keepPreviousData, staleMs],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    void refresh(true);

    const refreshQuietly = () => {
      void refresh(false);
    };

    const refreshOnVisibility = () => {
      if (!document.hidden && refreshOnFocus) refreshQuietly();
    };

    const interval = intervalMs > 0 ? window.setInterval(refreshQuietly, intervalMs) : null;
    if (refreshOnFocus) window.addEventListener("focus", refreshQuietly);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener("focus", refreshQuietly);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [enabled, intervalMs, refresh, refreshOnFocus]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    refresh,
  };
}

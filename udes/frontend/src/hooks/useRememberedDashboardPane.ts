import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const STORAGE_PREFIX = "umbrella:dashboard-pane:v1:";

function storageKey(userId: string, dashboard: string) {
  return `${STORAGE_PREFIX}${userId}:${dashboard}`;
}

function readPane(userId: string | undefined, dashboard: string) {
  if (!userId) return "";

  try {
    return window.localStorage.getItem(storageKey(userId, dashboard)) ?? "";
  } catch {
    return "";
  }
}

function writePane(userId: string | undefined, dashboard: string, pane: string) {
  if (!userId) return;

  try {
    const key = storageKey(userId, dashboard);
    if (pane) {
      window.localStorage.setItem(key, pane);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Dashboard navigation remains usable when browser storage is unavailable.
  }
}

export function clearRememberedDashboardPanes(userId?: string) {
  try {
    const userPrefix = userId ? `${STORAGE_PREFIX}${userId}:` : STORAGE_PREFIX;
    const keysToRemove: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(userPrefix)) keysToRemove.push(key);
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Clearing navigation state must never prevent login or logout.
  }
}

export function useRememberedDashboardPane<T extends string>(
  dashboard: string,
  userId?: string,
): [T | "", Dispatch<SetStateAction<T | "">>] {
  const [pane, setPaneState] = useState<T | "">(
    () => readPane(userId, dashboard) as T | "",
  );

  useEffect(() => {
    setPaneState(readPane(userId, dashboard) as T | "");
  }, [dashboard, userId]);

  const setPane = useCallback<Dispatch<SetStateAction<T | "">>>(
    (value) => {
      setPaneState((current) => {
        const next =
          typeof value === "function"
            ? (value as (previous: T | "") => T | "")(current)
            : value;
        writePane(userId, dashboard, next);
        return next;
      });
    },
    [dashboard, userId],
  );

  return [pane, setPane];
}

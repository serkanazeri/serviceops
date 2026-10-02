import { useCallback, useEffect, useRef, useState } from "react";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(data.error ?? "İstek tamamlanamadı.");
  return data as T;
}
export function useData<T>(
  path: string,
  period = 0,
  stopWhen?: (data: T) => boolean,
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const latest = useRef<{ data: T | null; stopWhen?: (data: T) => boolean }>({
    data,
    stopWhen,
  });
  latest.current = { data, stopWhen };
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [path, revision]);
  useEffect(() => {
    if (!period) return;
    const timer = setInterval(() => {
      const current = latest.current;
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !(current.data && current.stopWhen?.(current.data))
      )
        refresh();
    }, period);
    return () => clearInterval(timer);
  }, [period, refresh]);
  return { data, error, refresh };
}

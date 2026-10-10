import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getActiveAccountId } from "./account";
import { currentTimezone } from "./utils/timezone";
import { readSnapshot, saveSnapshot } from "./offline-snapshots";

// API URL for production deployment (empty string for local dev)
const API_URL = import.meta.env?.VITE_API_URL || '';

export function apiUrl(path: string) {
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function requestHeaders(url: string, accountId = getActiveAccountId()) {
  const headers: Record<string, string> = { "X-Timezone": currentTimezone() ?? "UTC" };
  if (accountId && !url.startsWith("/api/auth/")) headers["X-Account-Id"] = String(accountId);
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try { message = JSON.parse(text).message || text; } catch { /* Non-JSON upstream error. */ }
    throw new ApiError(res.status, `${res.status}: ${message}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { accountId?: number; signal?: AbortSignal },
): Promise<Response> {
  const owner = options?.accountId ?? getActiveAccountId();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, {
      method,
      headers: { ...requestHeaders(url, owner), ...(data ? { "Content-Type": "application/json" } : {}) },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: options?.signal,
    });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    if (method === "GET" && owner && !navigator.onLine && owner === getActiveAccountId()) {
      const snapshot = await readSnapshot(owner, url);
      if (snapshot && owner === getActiveAccountId() && !options?.signal?.aborted) return snapshot;
    }
    throw error;
  }
  if (!url.startsWith("/api/auth/") && owner !== getActiveAccountId()) throw new Error("Your account changed during this request");

  await throwIfResNotOk(res);
  if (method === "GET" && owner) {
    await saveSnapshot(owner, url, res.clone()).catch(() => {});
  }
  if (!url.startsWith("/api/auth/") && owner !== getActiveAccountId()) throw new Error("Your account changed during this request");
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export async function readApiJson<T>(
  method: string, url: string, data?: unknown,
  options?: { accountId?: number; signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const owner = options?.accountId ?? getActiveAccountId();
  const controller = new AbortController();
  const abort = () => controller.abort();
  options?.signal?.addEventListener("abort", abort, { once: true });
  if (options?.signal?.aborted) abort();
  const timeout = setTimeout(abort, options?.timeoutMs ?? 30_000);
  let rejectAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new DOMException("Request cancelled or timed out", "AbortError"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    return await Promise.race([aborted, (async () => {
      const res = await apiRequest(method, url, data, { accountId: owner ?? undefined, signal: controller.signal });
      const value = res.status === 204 ? undefined : await res.json();
      if (!url.startsWith("/api/auth/") && owner !== getActiveAccountId()) throw new Error("Your account changed during this request");
      return value as T;
    })()]);
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort!);
  }
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  timeoutMs?: number;
}) => QueryFunction<T | null> =
  ({ on401: unauthorizedBehavior, timeoutMs = 15_000 }) =>
  async ({ queryKey, signal }) => {
    try {
      return await readApiJson("GET", queryKey[0] as string, undefined, { signal, timeoutMs });
    } catch (error) {
      if (unauthorizedBehavior === "returnNull" && error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Run reads offline so apiRequest can return account-scoped device snapshots.
      networkMode: "always",
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

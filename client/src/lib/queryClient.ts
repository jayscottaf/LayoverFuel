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
  options?: { accountId?: number },
): Promise<Response> {
  const owner = options?.accountId ?? getActiveAccountId();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, {
      method,
      headers: { ...requestHeaders(url, owner), ...(data ? { "Content-Type": "application/json" } : {}) },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (error) {
    if (method === "GET" && owner && !navigator.onLine && owner === getActiveAccountId()) {
      const snapshot = await readSnapshot(owner, url);
      if (snapshot) return snapshot;
    }
    throw error;
  }
  if (!url.startsWith("/api/auth/") && owner !== getActiveAccountId()) throw new Error("Your account changed during this request");

  await throwIfResNotOk(res);
  if (method === "GET" && owner) {
    await saveSnapshot(owner, url, res.clone()).catch(() => {});
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const res = await fetch(`${API_URL}${queryKey[0] as string}`, {
      credentials: "include",
      headers: requestHeaders(queryKey[0] as string),
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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

import {
  type Result,
  type FetchError,
  HttpError,
  NetworkError,
  ParseError,
  ok,
  err,
} from "./result.js";

export type RequestOptions = Omit<RequestInit, "method" | "body"> & {
  /** Request timeout in milliseconds. Default: 30_000 */
  timeout?: number;
};

export type JsonRequestOptions = RequestOptions & {
  body?: unknown;
};

async function request(
  method: string,
  url: string,
  options?: RequestInit & { timeout?: number },
): Promise<Result<Response, FetchError>> {
  const { timeout = 30_000, ...fetchOptions } = options ?? {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...fetchOptions,
      method,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      return err(new HttpError(response.status, response.statusText, body));
    }

    return ok(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return err(new NetworkError(`Request timed out after ${timeout}ms`, error));
    }
    return err(
      new NetworkError(error instanceof Error ? error.message : "Unknown network error", error),
    );
  }
}

async function parseJson<T>(response: Response): Promise<Result<T, ParseError>> {
  const text = await response.text();
  try {
    return ok(JSON.parse(text) as T);
  } catch (cause) {
    return err(new ParseError(text, cause));
  }
}

// ── Public API ──────────────────────────────────────────────

export async function getJson<T = unknown>(
  url: string,
  options?: RequestOptions,
): Promise<Result<T, FetchError>> {
  const [response, fetchErr] = await request("GET", url, options);
  if (fetchErr) return err(fetchErr);
  return parseJson<T>(response);
}

export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<Result<T, FetchError>> {
  const [response, fetchErr] = await request("POST", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (fetchErr) return err(fetchErr);
  return parseJson<T>(response);
}

export async function putJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<Result<T, FetchError>> {
  const [response, fetchErr] = await request("PUT", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (fetchErr) return err(fetchErr);
  return parseJson<T>(response);
}

export async function patchJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<Result<T, FetchError>> {
  const [response, fetchErr] = await request("PATCH", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (fetchErr) return err(fetchErr);
  return parseJson<T>(response);
}

export async function del<T = unknown>(
  url: string,
  options?: RequestOptions,
): Promise<Result<T, FetchError>> {
  const [response, fetchErr] = await request("DELETE", url, options);
  if (fetchErr) return err(fetchErr);
  return parseJson<T>(response);
}

export async function getText(
  url: string,
  options?: RequestOptions,
): Promise<Result<string, FetchError>> {
  const [response, fetchErr] = await request("GET", url, options);
  if (fetchErr) return err(fetchErr);
  try {
    const text = await response.text();
    return ok(text);
  } catch (cause) {
    return err(
      new NetworkError(
        cause instanceof Error ? cause.message : "Failed to read response body",
        cause,
      ),
    );
  }
}

export async function head(
  url: string,
  options?: RequestOptions,
): Promise<Result<Headers, FetchError>> {
  const [response, fetchErr] = await request("HEAD", url, options);
  if (fetchErr) return err(fetchErr);
  return ok(response.headers);
}

/**
 * Convenience namespace for `http.getJson(...)` style usage.
 */
export const http = {
  getJson,
  postJson,
  putJson,
  patchJson,
  del,
  getText,
  head,
} as const;

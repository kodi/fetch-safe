import { err, ok, type Result } from "../result-core.js";
import {
  HttpError,
  NetworkError,
  ParseError,
  ValidationError,
  type FetchError,
} from "../errors.js";

export type FetchSafeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RequestHook = (url: string, init: RequestInit) => void | Promise<void>;
export type ResponseHook = (response: Response) => void | Promise<void>;

/**
 * A minimal schema interface compatible with Zod, Valibot, ArkType, and similar
 * validation libraries. Any object with a `.parse(value) => T` method works.
 */
export type Schema<T> = {
  parse(value: unknown): T;
};

export type RequestOptions<T = unknown> = Omit<RequestInit, "method" | "body"> & {
  /** Request timeout in milliseconds. Default: 30_000 */
  timeout?: number;
  /** Custom fetch implementation, useful for tests, SSR, and edge runtimes. */
  fetch?: FetchSafeFetch;
  /** Called immediately before fetch is invoked. */
  onRequest?: RequestHook;
  /** Called after a successful HTTP response is received, including non-2xx responses. */
  onResponse?: ResponseHook;
  /**
   * Optional schema for runtime response validation.
   * When provided, the parsed JSON is validated and `T` is inferred from the schema.
   * Compatible with Zod, Valibot, ArkType, or any object with a `.parse()` method.
   */
  schema?: Schema<T>;
};

export type JsonRequestOptions<T = unknown> = RequestOptions<T> & {
  body?: unknown;
};

/**
 * Executes fetch with a timeout and converts every failure mode into FetchError.
 * HTTP non-2xx responses are not thrown; their status and body are preserved.
 */
export async function request(
  method: string,
  url: string,
  options?: RequestInit & {
    timeout?: number;
    fetch?: FetchSafeFetch;
    onRequest?: RequestHook;
    onResponse?: ResponseHook;
  },
): Promise<Result<Response, FetchError>> {
  const {
    timeout = 30_000,
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
    onRequest,
    onResponse,
    ...fetchOptions
  } = options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const init: RequestInit = {
    ...fetchOptions,
    method,
    signal: controller.signal,
  };

  try {
    await onRequest?.(url, init);

    const response = await fetchImpl(url, init);

    await onResponse?.(response);

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
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads and parses a JSON response, then optionally validates it with a schema.
 * Validation issues are normalized so consumers always receive an array.
 */
export async function parseJson<T>(
  response: Response,
  schema?: Schema<T>,
): Promise<Result<T, ParseError | ValidationError | NetworkError>> {
  let text: string;

  try {
    text = await response.text();
  } catch (cause) {
    return err(
      new NetworkError(
        cause instanceof Error ? cause.message : "Failed to read response body",
        cause,
      ),
    );
  }

  if (text === "") {
    if (!schema) {
      return ok(undefined as T);
    }

    try {
      return ok(schema.parse(undefined));
    } catch (cause) {
      const issues =
        cause != null &&
        typeof cause === "object" &&
        "issues" in cause &&
        Array.isArray((cause as { issues: unknown[] }).issues)
          ? (cause as { issues: unknown[] }).issues
          : [cause];

      return err(new ValidationError(issues, undefined, cause));
    }
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return err(new ParseError(text, cause));
  }

  if (schema) {
    try {
      return ok(schema.parse(parsed));
    } catch (cause) {
      const issues =
        cause != null &&
        typeof cause === "object" &&
        "issues" in cause &&
        Array.isArray((cause as { issues: unknown[] }).issues)
          ? (cause as { issues: unknown[] }).issues
          : [cause];

      return err(new ValidationError(issues, parsed, cause));
    }
  }

  return ok(parsed as T);
}

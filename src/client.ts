import {
  type Result,
  type FetchError,
  HttpError,
  NetworkError,
  ParseError,
  ValidationError,
  ok,
  err,
} from "./result.js";

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
  /**
   * Optional schema for runtime response validation.
   * When provided, the parsed JSON is validated and `T` is inferred from the schema.
   * Compatible with Zod, Valibot, ArkType, or any object with a `.parse()` method.
   *
   * @example
   * const UserSchema = z.object({ id: z.number(), name: z.string() });
   * const [user, err] = await http.getJson("/api/users/1", { schema: UserSchema });
   */
  schema?: Schema<T>;
};

export type JsonRequestOptions<T = unknown> = RequestOptions<T> & {
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

async function parseJson<T>(
  response: Response,
  schema?: Schema<T>,
): Promise<Result<T, ParseError | ValidationError>> {
  const text = await response.text();
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

// ── Public API ──────────────────────────────────────────────

export async function getJson<T = unknown>(
  url: string,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request("GET", url, options);
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request("POST", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

export async function putJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request("PUT", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

export async function patchJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request("PATCH", url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

export async function del<T = unknown>(
  url: string,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request("DELETE", url, options);
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

export async function getText(
  url: string,
  options?: RequestOptions,
): Promise<Result<string, FetchError>> {
  const responseResult = await request("GET", url, options);
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  try {
    const text = await (responseResult.value as Response).text();
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
  const responseResult = await request("HEAD", url, options);
  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return ok((responseResult.value as Response).headers);
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

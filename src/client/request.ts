import { err, ok, type Result } from "../result-core.js";
import {
  HttpError,
  NetworkError,
  ParseError,
  ValidationError,
  type FetchError,
} from "../errors.js";

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
   */
  schema?: Schema<T>;
};

export type JsonRequestOptions<T = unknown> = RequestOptions<T> & {
  body?: unknown;
};

export async function request(
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

export async function parseJson<T>(
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

import { err, type Result } from "../result-core.js";
import { type FetchError } from "../errors.js";
import { parseJson, request, type RequestOptions } from "./request.js";

/**
 * Adds a JSON content type while preserving caller-provided headers.
 * Accepts all HeadersInit shapes so the public API can mirror fetch.
 */
function mergeJsonHeaders(headers?: HeadersInit): HeadersInit {
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!headers) {
    return mergedHeaders;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      mergedHeaders[key] = value;
    });

    return mergedHeaders;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      mergedHeaders[key] = value;
    }

    return mergedHeaders;
  }

  return { ...mergedHeaders, ...headers };
}

/**
 * Shared JSON request path for methods with bodies.
 * It serializes non-null bodies and then delegates response parsing/validation.
 */
async function requestJsonBody<T>(
  method: string,
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request(method, url, {
    ...options,
    headers: mergeJsonHeaders(options?.headers),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

/**
 * Performs a GET request and parses the response as JSON.
 * Optional schema validation narrows the returned value type.
 */
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

/** Sends a JSON POST body and parses the JSON response. */
export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  return requestJsonBody<T>("POST", url, body, options);
}

/** Sends a JSON PUT body and parses the JSON response. */
export async function putJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  return requestJsonBody<T>("PUT", url, body, options);
}

/** Sends a JSON PATCH body and parses the JSON response. */
export async function patchJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  return requestJsonBody<T>("PATCH", url, body, options);
}

/**
 * Performs a DELETE request and parses the response as JSON.
 * Use this for APIs that return a confirmation payload after deletion.
 */
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

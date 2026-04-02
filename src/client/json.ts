import { err, type Result } from "../result-core.js";
import { type FetchError } from "../errors.js";
import { parseJson, request, type RequestOptions } from "./request.js";

async function requestJsonBody<T>(
  method: string,
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  const responseResult = await request(method, url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return parseJson<T>(responseResult.value as Response, options?.schema);
}

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
  return requestJsonBody<T>("POST", url, body, options);
}

export async function putJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  return requestJsonBody<T>("PUT", url, body, options);
}

export async function patchJson<T = unknown>(
  url: string,
  body?: unknown,
  options?: RequestOptions<T>,
): Promise<Result<T, FetchError>> {
  return requestJsonBody<T>("PATCH", url, body, options);
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

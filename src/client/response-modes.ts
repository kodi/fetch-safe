import { err, ok, type Result } from "../result-core.js";
import { NetworkError, type FetchError } from "../errors.js";
import { parseJson, request as fetchRequest, type RequestOptions } from "./request.js";

export type ResponseMode = "json" | "text" | "blob" | "void" | "response";

export type ModeResult<T, As extends ResponseMode> = As extends "json"
  ? T
  : As extends "text"
    ? string
    : As extends "blob"
      ? Blob
      : As extends "void"
        ? void
        : Response;

export type HttpRequestOptions<
  T = unknown,
  As extends ResponseMode = "json",
> = RequestOptions<T> & {
  /** Response reader. Defaults to `json`. */
  as?: As;
  /** Raw request body for non-JSON payloads. */
  body?: BodyInit | null;
};

export type HttpJsonRequestOptions<
  T = unknown,
  As extends ResponseMode = "json",
> = RequestOptions<T> & {
  /** Response reader. Defaults to `json`. */
  as?: As;
  /** JSON request body. */
  body?: unknown;
};

function mergeJsonHeaders(headers?: HeadersInit): HeadersInit {
  const merged = new Headers(headers);

  if (!merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }

  return merged;
}

async function readText(response: Response): Promise<Result<string, FetchError>> {
  try {
    return ok(await response.text());
  } catch (cause) {
    return err(
      new NetworkError(
        cause instanceof Error ? cause.message : "Failed to read response body",
        cause,
      ),
    );
  }
}

async function readBlob(response: Response): Promise<Result<Blob, FetchError>> {
  try {
    return ok(await response.blob());
  } catch (cause) {
    return err(
      new NetworkError(
        cause instanceof Error ? cause.message : "Failed to read response body",
        cause,
      ),
    );
  }
}

export async function readResponse<T = unknown, As extends ResponseMode = "json">(
  response: Response,
  options?: { as?: As; schema?: RequestOptions<T>["schema"] },
): Promise<Result<ModeResult<T, As>, FetchError>> {
  const mode = options?.as ?? "json";

  if (mode === "response") {
    return ok(response as ModeResult<T, As>);
  }

  if (mode === "void") {
    await response.body?.cancel().catch(() => undefined);
    return ok(undefined as ModeResult<T, As>);
  }

  if (mode === "text") {
    return readText(response) as Promise<Result<ModeResult<T, As>, FetchError>>;
  }

  if (mode === "blob") {
    return readBlob(response) as Promise<Result<ModeResult<T, As>, FetchError>>;
  }

  return parseJson<T>(response, options?.schema) as Promise<Result<ModeResult<T, As>, FetchError>>;
}

/** Executes any HTTP method and reads the response using `options.as` (`json` by default). */
export async function httpRequest<T = unknown, As extends ResponseMode = "json">(
  method: string,
  url: string,
  options?: HttpRequestOptions<T, As>,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  const { as, schema, ...requestOptions } = options ?? {};
  const responseResult = await fetchRequest(method, url, requestOptions);

  if (!responseResult.ok) {
    return err(responseResult.error as FetchError);
  }

  return readResponse<T, As>(responseResult.value as Response, { as, schema });
}

/** GET with selectable response mode. */
export async function get<T = unknown, As extends ResponseMode = "json">(
  url: string,
  options?: HttpRequestOptions<T, As>,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return httpRequest<T, As>("GET", url, options);
}

async function jsonBodyRequest<T = unknown, As extends ResponseMode = "json">(
  method: string,
  url: string,
  body?: unknown,
  options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return httpRequest<T, As>(method, url, {
    ...options,
    headers: mergeJsonHeaders(options?.headers),
    body: body != null ? JSON.stringify(body) : undefined,
  } as HttpRequestOptions<T, As>);
}

/** POST JSON with selectable response mode. */
export async function post<T = unknown, As extends ResponseMode = "json">(
  url: string,
  body?: unknown,
  options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return jsonBodyRequest<T, As>("POST", url, body, options);
}

/** PUT JSON with selectable response mode. */
export async function put<T = unknown, As extends ResponseMode = "json">(
  url: string,
  body?: unknown,
  options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return jsonBodyRequest<T, As>("PUT", url, body, options);
}

/** PATCH JSON with selectable response mode. */
export async function patch<T = unknown, As extends ResponseMode = "json">(
  url: string,
  body?: unknown,
  options?: Omit<HttpJsonRequestOptions<T, As>, "body">,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return jsonBodyRequest<T, As>("PATCH", url, body, options);
}

/** DELETE with selectable response mode. */
export async function delAs<T = unknown, As extends ResponseMode = "json">(
  url: string,
  options?: HttpRequestOptions<T, As>,
): Promise<Result<ModeResult<T, As>, FetchError>> {
  return httpRequest<T, As>("DELETE", url, options);
}

/** DELETE helper for APIs that return 204/empty bodies. */
export async function delVoid(
  url: string,
  options?: Omit<HttpRequestOptions<unknown, "void">, "as">,
): Promise<Result<void, FetchError>> {
  return delAs(url, { ...options, as: "void" });
}

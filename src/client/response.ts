import { err, ok, type Result } from "../result-core.js";
import { type FetchError, NetworkError } from "../errors.js";
import { request, type RequestOptions } from "./request.js";

/**
 * Fetches a resource as raw text while preserving Result-based error handling.
 * Body read failures become NetworkError because they happen after fetch starts.
 */
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

/**
 * Performs a HEAD request and returns only response headers.
 * This avoids body parsing and is useful for metadata checks.
 */
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

import { err, ok, type Result } from "../result-core.js";
import { type FetchError, NetworkError } from "../errors.js";
import { request, type RequestOptions } from "./request.js";

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

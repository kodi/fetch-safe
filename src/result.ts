/**
 * A Go/Rust-inspired Result tuple type.
 *
 * Success: [data, null]
 * Failure: [null, error]
 */
export type Result<T, E = HttpError> = [T, null] | [null, E];

/** A success tuple — data is T, error is always null */
export type Ok<T> = [T, null];

/** An error tuple — data is always null, error is E */
export type Err<E> = [null, E];

/** Create a success result */
export function ok<T>(value: T): Ok<T> {
  return [value, null];
}

/** Create an error result */
export function err<E>(error: E): Err<E> {
  return [null, error];
}

/**
 * HTTP error with status code, status text, and optional body.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string | undefined;

  constructor(status: number, statusText: string, body?: string) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Network-level error (DNS failure, timeout, connection refused, etc.)
 */
export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * JSON parse error
 */
export class ParseError extends Error {
  readonly body: string;
  readonly cause: unknown;

  constructor(body: string, cause?: unknown) {
    super("Failed to parse response as JSON");
    this.name = "ParseError";
    this.body = body;
    this.cause = cause;
  }
}

/** Union of all possible errors from the HTTP client */
export type FetchError = HttpError | NetworkError | ParseError;

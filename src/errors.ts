/** HTTP error with status code, status text, and optional body. */
export class HttpError extends Error {
  readonly kind = "http" as const;
  readonly status: number;
  readonly statusText: string;
  readonly body: string | undefined;

  /** Captures non-2xx HTTP responses without losing status or response body. */
  constructor(status: number, statusText: string, body?: string) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/** Network-level error (DNS failure, timeout, connection refused, etc.) */
export class NetworkError extends Error {
  readonly kind = "network" as const;
  readonly cause: unknown;

  /** Wraps fetch, timeout, and body-read failures with their original cause. */
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** JSON parse error. */
export class ParseError extends Error {
  readonly kind = "parse" as const;
  readonly body: string;
  readonly cause: unknown;

  /** Stores the raw response text so callers can inspect invalid JSON payloads. */
  constructor(body: string, cause?: unknown) {
    super("Failed to parse response as JSON");
    this.name = "ParseError";
    this.body = body;
    this.cause = cause;
  }
}

/** Schema validation error — thrown when a parsed response fails schema validation. */
export class ValidationError extends Error {
  readonly kind = "validation" as const;
  readonly issues: unknown[];
  readonly body: unknown;
  readonly cause: unknown;

  /** Keeps both normalized validation issues and the parsed body that failed. */
  constructor(issues: unknown[], body: unknown, cause?: unknown) {
    super("Response failed schema validation");
    this.name = "ValidationError";
    this.issues = issues;
    this.body = body;
    this.cause = cause;
  }
}

/** Union of all possible errors from the HTTP client. */
export type FetchError = HttpError | NetworkError | ParseError | ValidationError;

/** Narrow an unknown value to an HttpError without relying on instanceof. */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError || hasKind(error, "http");
}

/** Narrow an unknown value to a NetworkError without relying on instanceof. */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || hasKind(error, "network");
}

/** Narrow an unknown value to a ParseError without relying on instanceof. */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError || hasKind(error, "parse");
}

/** Narrow an unknown value to a ValidationError without relying on instanceof. */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError || hasKind(error, "validation");
}

function hasKind(error: unknown, kind: FetchError["kind"]): boolean {
  return error != null && typeof error === "object" && "kind" in error && error.kind === kind;
}

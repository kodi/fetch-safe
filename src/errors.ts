/** HTTP error with status code, status text, and optional body. */
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

/** Network-level error (DNS failure, timeout, connection refused, etc.) */
export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** JSON parse error. */
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

/** Schema validation error — thrown when a parsed response fails schema validation. */
export class ValidationError extends Error {
  readonly issues: unknown[];
  readonly body: unknown;
  readonly cause: unknown;

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

/** A tuple view of a Result, used for destructuring compatibility */
type ResultTuple<T, E> = readonly [T | null, E | null];

export interface Result<T, E = HttpError> extends Iterable<T | E | null> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly error: E | null;
  readonly 0: T | null;
  readonly 1: E | null;
  readonly length: 2;
  map<U>(fn: (value: T) => U): Result<U, E>;
  toTuple(): ResultTuple<T, E>;
  toValue(): T | null;
  toValueOr(fallback: T): T;
  toValueOrThrow(): T;
}

/** Success result variant */
export type Ok<T> = Result<T, never> & {
    readonly ok: true;
    readonly value: T;
    readonly error: null;
    readonly 0: T;
    readonly 1: null;
  };

/** Error result variant */
export type Err<E> = Result<never, E> & {
    readonly ok: false;
    readonly value: null;
    readonly error: E;
    readonly 0: null;
    readonly 1: E;
  };

/** Alias for the object-based Result API */
export type ResultObject<T, E = HttpError> = Result<T, E>;

type Awaitable<T> = T | Promise<T>;

class ResultImpl<T, E = HttpError> implements Result<T, E> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly error: E | null;
  readonly 0: T | null;
  readonly 1: E | null;
  readonly length = 2 as const;

  constructor(ok: boolean, value: T | null, error: E | null) {
    this.ok = ok;
    this.value = value;
    this.error = error;
    this[0] = value;
    this[1] = error;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (!this.ok) {
      return createResult<U, E>(false, null, this.error as E);
    }

    return createResult<U, E>(true, fn(this.value as T), null);
  }

  toTuple(): ResultTuple<T, E> {
    return [this.value, this.error];
  }

  toValue(): T | null {
    return this.value;
  }

  toValueOr(fallback: T): T {
    if (!this.ok) {
      return fallback;
    }

    return this.value as T;
  }

  toValueOrThrow(): T {
    if (this.ok) {
      return this.value as T;
    }

    if (this.error instanceof Error) {
      throw this.error;
    }

    throw new Error("Result contained a non-Error failure", { cause: this.error });
  }

  *[Symbol.iterator](): IterableIterator<T | E | null> {
    yield this.value;
    yield this.error;
  }
}

function createResult<T, E>(ok: boolean, value: T | null, error: E | null): Result<T, E> {
  return new ResultImpl(ok, value, error) as Result<T, E>;
}

function createOk<T>(value: T): Ok<T> {
  return new ResultImpl<T, never>(true, value, null) as Ok<T>;
}

function createErr<E>(error: E): Err<E> {
  return new ResultImpl<never, E>(false, null, error) as Err<E>;
}

/** Create a success result */
export function ok<T>(value: T): Ok<T> {
  return createOk(value);
}

/** Create an error result */
export function err<E>(error: E): Err<E> {
  return createErr(error);
}

export interface ChainResult<T, E> {
  map<U>(fn: (value: T) => Awaitable<U>): ChainResult<U, E>;
  toTuple(): Promise<ResultTuple<T, E>>;
  toValue(): Promise<T | null>;
  toValueOr(fallback: T): Promise<T>;
  toValueOrThrow(): Promise<T>;
}

class ChainResultWrapper<T, E> implements ChainResult<T, E> {
  readonly #resultPromise: Promise<Result<T, E>>;

  constructor(result: Awaitable<Result<T, E>>) {
    this.#resultPromise = Promise.resolve(result);
  }

  map<U>(fn: (value: T) => Awaitable<U>): ChainResult<U, E> {
    return new ChainResultWrapper<U, E>(
      this.#resultPromise.then(async (result): Promise<Result<U, E>> => {
        if (!result.ok) {
          return createResult<U, E>(false, null, result.error as E);
        }

        return createResult<U, E>(true, await fn(result.value as T), null);
      }),
    );
  }

  async toTuple(): Promise<ResultTuple<T, E>> {
    return (await this.#resultPromise).toTuple();
  }

  async toValue(): Promise<T | null> {
    return (await this.#resultPromise).toValue();
  }

  async toValueOr(fallback: T): Promise<T> {
    return (await this.#resultPromise).toValueOr(fallback);
  }

  async toValueOrThrow(): Promise<T> {
    return (await this.#resultPromise).toValueOrThrow();
  }
}

/** Create an async-aware chainable view over a Result */
export function chainResult<T, E>(result: Awaitable<Result<T, E>>): ChainResult<T, E> {
  return new ChainResultWrapper(result);
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

/**
 * Schema validation error — thrown when a parsed response fails schema validation.
 * Compatible with Zod, Valibot, ArkType, or any parser that throws on `.parse()`.
 */
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

/** Union of all possible errors from the HTTP client */
export type FetchError = HttpError | NetworkError | ParseError | ValidationError;

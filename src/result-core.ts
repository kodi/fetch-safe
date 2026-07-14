import type { HttpError } from "./errors.js";

/** A tuple view of a Result, used for destructuring compatibility. */
export type ResultTuple<T, E> = readonly [T | null, E | null];

type Awaitable<T> = T | Promise<T>;

export type ResultMatchHandlers<T, E, U> = {
  ok(value: T): U;
  err(error: E): U;
};

export interface Result<T, E = HttpError> extends Iterable<T | E | null> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly error: E | null;
  readonly 0: T | null;
  readonly 1: E | null;
  readonly length: 2;
  map<U>(fn: (value: T) => U): Result<U, E>;
  mapError<F>(fn: (error: E) => F): Result<T, F>;
  andThen<U, F = E>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
  match<U>(handlers: ResultMatchHandlers<T, E, U>): U;
  toTuple(): ResultTuple<T, E>;
  toValue(): T | null;
  toValueOr(fallback: T): T;
  toValueOrThrow(): T;
}

/** Success result variant. */
export type Ok<T> = Result<T, never> & {
  readonly ok: true;
  readonly value: T;
  readonly error: null;
  readonly 0: T;
  readonly 1: null;
};

/** Error result variant. */
export type Err<E> = Result<never, E> & {
  readonly ok: false;
  readonly value: null;
  readonly error: E;
  readonly 0: null;
  readonly 1: E;
};

/** Alias for the object-based Result API. */
export type ResultObject<T, E = HttpError> = Result<T, E>;

class ResultImpl<T, E = HttpError> implements Result<T, E> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly error: E | null;
  readonly 0: T | null;
  readonly 1: E | null;
  readonly length = 2 as const;

  /**
   * Stores both object fields and tuple indexes so callers can choose
   * `result.value`/`result.error` or `[value, error]` without adapters.
   */
  constructor(ok: boolean, value: T | null, error: E | null) {
    this.ok = ok;
    this.value = value;
    this.error = error;
    this[0] = value;
    this[1] = error;
  }

  /**
   * Transforms only successful values and preserves the original error object.
   * This keeps failure identity intact for callers that compare or rethrow it.
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (!this.ok) {
      return createResult<U, E>(false, null, this.error as E);
    }

    return createResult<U, E>(true, fn(this.value as T), null);
  }

  /** Transforms only failures and preserves successful values unchanged. */
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.ok) {
      return createResult<T, F>(true, this.value as T, null);
    }

    return createResult<T, F>(false, null, fn(this.error as E));
  }

  /**
   * Chains another Result-returning operation after a successful value.
   * Failures skip the mapper and pass the original error through unchanged.
   */
  andThen<U, F = E>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    if (!this.ok) {
      return createResult<U, E | F>(false, null, this.error as E);
    }

    return fn(this.value as T) as Result<U, E | F>;
  }

  /** Exhaustively handles success and failure branches with one expression. */
  match<U>(handlers: ResultMatchHandlers<T, E, U>): U {
    if (this.ok) {
      return handlers.ok(this.value as T);
    }

    return handlers.err(this.error as E);
  }

  /** Returns the destructuring-friendly tuple representation. */
  toTuple(): ResultTuple<T, E> {
    return [this.value, this.error];
  }

  /** Returns the success value or `null`, matching the tuple's first slot. */
  toValue(): T | null {
    return this.value;
  }

  /** Unwraps the success value while letting callers provide an error fallback. */
  toValueOr(fallback: T): T {
    if (!this.ok) {
      return fallback;
    }

    return this.value as T;
  }

  /**
   * Bridges Result-style handling back to exception flow.
   * Non-Error failures are wrapped so the thrown value is always an Error.
   */
  toValueOrThrow(): T {
    if (this.ok) {
      return this.value as T;
    }

    if (this.error instanceof Error) {
      throw this.error;
    }

    throw new Error("Result contained a non-Error failure", { cause: this.error });
  }

  /** Makes Result iterable as `[value, error]` for native destructuring. */
  *[Symbol.iterator](): IterableIterator<T | E | null> {
    yield this.value;
    yield this.error;
  }
}

/**
 * Internal factory for generic Result construction when the concrete variant
 * is determined by control flow rather than the public `ok`/`err` helpers.
 */
function createResult<T, E>(ok: boolean, value: T | null, error: E | null): Result<T, E> {
  return new ResultImpl(ok, value, error) as Result<T, E>;
}

/** Builds the typed success variant while hiding implementation casting. */
function createOk<T>(value: T): Ok<T> {
  return new ResultImpl<T, never>(true, value, null) as Ok<T>;
}

/** Builds the typed error variant while hiding implementation casting. */
function createErr<E>(error: E): Err<E> {
  return new ResultImpl<never, E>(false, null, error) as Err<E>;
}

/** Create a success result. */
export function ok<T>(value: T): Ok<T> {
  return createOk(value);
}

/** Create an error result. */
export function err<E>(error: E): Err<E> {
  return createErr(error);
}

export interface ChainResult<T, E> {
  map<U>(fn: (value: T) => Awaitable<U>): ChainResult<U, E>;
  mapError<F>(fn: (error: E) => Awaitable<F>): ChainResult<T, F>;
  andThen<U, F = E>(fn: (value: T) => Awaitable<Result<U, F>>): ChainResult<U, E | F>;
  match<U>(handlers: { ok(value: T): Awaitable<U>; err(error: E): Awaitable<U> }): Promise<U>;
  toTuple(): Promise<ResultTuple<T, E>>;
  toValue(): Promise<T | null>;
  toValueOr(fallback: T): Promise<T>;
  toValueOrThrow(): Promise<T>;
}

class ChainResultWrapper<T, E> implements ChainResult<T, E> {
  readonly #resultPromise: Promise<Result<T, E>>;

  /**
   * Normalizes sync and async Results into one Promise-backed pipeline.
   * Each chained method can then defer unwrapping until a terminal method.
   */
  constructor(result: Awaitable<Result<T, E>>) {
    this.#resultPromise = Promise.resolve(result);
  }

  /**
   * Queues a mapper that runs only for successful results.
   * Errors skip the mapper and continue through the chain unchanged.
   */
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

  /** Queues a mapper that runs only for errors. */
  mapError<F>(fn: (error: E) => Awaitable<F>): ChainResult<T, F> {
    return new ChainResultWrapper<T, F>(
      this.#resultPromise.then(async (result): Promise<Result<T, F>> => {
        if (result.ok) {
          return createResult<T, F>(true, result.value as T, null);
        }

        return createResult<T, F>(false, null, await fn(result.error as E));
      }),
    );
  }

  /** Queues a Result-returning mapper that runs only for successful values. */
  andThen<U, F = E>(fn: (value: T) => Awaitable<Result<U, F>>): ChainResult<U, E | F> {
    return new ChainResultWrapper<U, E | F>(
      this.#resultPromise.then(async (result): Promise<Result<U, E | F>> => {
        if (!result.ok) {
          return createResult<U, E | F>(false, null, result.error as E);
        }

        return (await fn(result.value as T)) as Result<U, E | F>;
      }),
    );
  }

  /** Resolves the chain by handling both success and failure branches. */
  async match<U>(handlers: {
    ok(value: T): Awaitable<U>;
    err(error: E): Awaitable<U>;
  }): Promise<U> {
    const result = await this.#resultPromise;

    if (result.ok) {
      return handlers.ok(result.value as T);
    }

    return handlers.err(result.error as E);
  }

  /** Resolves the chain into the same tuple shape as a plain Result. */
  async toTuple(): Promise<ResultTuple<T, E>> {
    return (await this.#resultPromise).toTuple();
  }

  /** Resolves only the value side, returning `null` for failures. */
  async toValue(): Promise<T | null> {
    return (await this.#resultPromise).toValue();
  }

  /** Resolves the value side with a fallback for failures. */
  async toValueOr(fallback: T): Promise<T> {
    return (await this.#resultPromise).toValueOr(fallback);
  }

  /** Resolves the value or throws the stored error, matching Result semantics. */
  async toValueOrThrow(): Promise<T> {
    return (await this.#resultPromise).toValueOrThrow();
  }
}

/** Create an async-aware chainable view over a Result. */
export function chainResult<T, E>(result: Awaitable<Result<T, E>>): ChainResult<T, E> {
  return new ChainResultWrapper(result);
}

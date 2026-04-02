import { describe, it, expect, vi } from "vitest";
import {
  type Result,
  ok,
  err,
  chainResult,
  HttpError,
  NetworkError,
  ParseError,
} from "../src/result.js";

describe("ok()", () => {
  it("returns a success result that destructures to [value, null]", () => {
    const result = ok(42);
    const [data, error] = result;

    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
    expect(result.error).toBeNull();
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("works with objects", () => {
    const result = ok({ name: "test" });
    const [data, error] = result;

    expect(result.ok).toBe(true);
    expect(data).toEqual({ name: "test" });
    expect(error).toBeNull();
  });

  it("can represent a successful null value via the result object", () => {
    const result = ok<null>(null);
    const [data, error] = result;

    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
    expect(result.error).toBeNull();
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});

describe("err()", () => {
  it("returns an error result that destructures to [null, error]", () => {
    const result = err(new HttpError(404, "Not Found"));
    const [data, error] = result;

    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
  });
});

describe("Result.map()", () => {
  it("transforms the success value", () => {
    const result = ok(21).map((value) => value * 2);
    const [data, error] = result;

    expect(result.ok).toBe(true);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("passes errors through unchanged", () => {
    const originalError = new HttpError(404, "Not Found");
    const mapper = vi.fn((value: number) => value * 2);
    const [data, error] = err(originalError).map(mapper);

    expect(data).toBeNull();
    expect(error).toBe(originalError);
    expect(mapper).not.toHaveBeenCalled();
  });
});

describe("chainResult()", () => {
  it("maps a synchronous result and unwraps to a tuple", async () => {
    const [data, error] = await chainResult(ok(21))
      .map((value) => value * 2)
      .toTuple();

    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("maps an async result and async mapper", async () => {
    const [data, error] = await chainResult(Promise.resolve(ok(21)))
      .map(async (value) => value * 2)
      .toTuple();

    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("passes errors through without calling the mapper", async () => {
    const originalError = new HttpError(404, "Not Found");
    const mapper = vi.fn(async (value: number) => value * 2);
    const result: Result<number, HttpError> = err(originalError);
    const [data, error] = await chainResult<number, HttpError>(result).map(mapper).toTuple();

    expect(data).toBeNull();
    expect(error).toBe(originalError);
    expect(mapper).not.toHaveBeenCalled();
  });

  it("can extract only the success value", async () => {
    const value = await chainResult(ok("hello")).toValue();

    expect(value).toBe("hello");
  });

  it("can destructure directly from a mapped result object", () => {
    const [value, error] = ok("hello").map((text) => text.toUpperCase());

    expect(value).toBe("HELLO");
    expect(error).toBeNull();
  });

  it("returns null from toValue() when the result is an error", async () => {
    const value = await chainResult(err(new HttpError(500, "Internal Server Error"))).toValue();

    expect(value).toBeNull();
  });

  it("returns a fallback from toValueOr() when the result is an error", async () => {
    const result: Result<string, HttpError> = err(new HttpError(500, "Internal Server Error"));
    const value = await chainResult<string, HttpError>(result).toValueOr("fallback");

    expect(value).toBe("fallback");
  });

  it("returns the success value from toValueOr() when the result is ok", async () => {
    const value = await chainResult(ok("hello")).toValueOr("fallback");

    expect(value).toBe("hello");
  });

  it("throws the original error from toValueOrThrow()", async () => {
    const originalError = new HttpError(404, "Not Found");

    await expect(chainResult(err(originalError)).toValueOrThrow()).rejects.toBe(originalError);
  });

  it("returns the success value from toValueOrThrow()", async () => {
    const value = await chainResult(ok("hello")).toValueOrThrow();

    expect(value).toBe("hello");
  });
});

describe("HttpError", () => {
  it("has status, statusText, and optional body", () => {
    const e = new HttpError(500, "Internal Server Error", '{"msg":"oops"}');
    expect(e.status).toBe(500);
    expect(e.statusText).toBe("Internal Server Error");
    expect(e.body).toBe('{"msg":"oops"}');
    expect(e.message).toBe("HTTP 500: Internal Server Error");
    expect(e.name).toBe("HttpError");
  });
});

describe("NetworkError", () => {
  it("wraps a cause", () => {
    const cause = new TypeError("fetch failed");
    const e = new NetworkError("Connection refused", cause);
    expect(e.message).toBe("Connection refused");
    expect(e.cause).toBe(cause);
    expect(e.name).toBe("NetworkError");
  });
});

describe("ParseError", () => {
  it("stores the raw body", () => {
    const e = new ParseError("<html>not json</html>");
    expect(e.body).toBe("<html>not json</html>");
    expect(e.message).toBe("Failed to parse response as JSON");
    expect(e.name).toBe("ParseError");
  });
});

describe("tuple destructuring pattern", () => {
  it("allows Go-style error checking", () => {
    const result = ok("hello");
    const [data, error] = result;

    if (error) {
      throw new Error("should not reach here");
    }

    // After null check, data is narrowed to string
    expect(data).toBe("hello");
  });

  it("allows early return on error", () => {
    function doSomething(): string {
      const [data, error] = err(new HttpError(400, "Bad Request"));

      if (error) {
        return `Error: ${error.message}`;
      }

      return `Data: ${data}`;
    }

    expect(doSomething()).toBe("Error: HTTP 400: Bad Request");
  });

  it("can still distinguish nullable success values via result.ok", () => {
    const result = ok<string | null>(null);
    const [data, error] = result;

    expect(data).toBeNull();
    expect(error).toBeNull();
    expect(result.ok).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { ok, err, HttpError, NetworkError, ParseError } from "../src/result.js";

describe("ok()", () => {
  it("returns [value, null]", () => {
    const [data, error] = ok(42);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("works with objects", () => {
    const [data, error] = ok({ name: "test" });
    expect(data).toEqual({ name: "test" });
    expect(error).toBeNull();
  });
});

describe("err()", () => {
  it("returns [null, error]", () => {
    const [data, error] = err(new HttpError(404, "Not Found"));
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
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
});

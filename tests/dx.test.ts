import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import {
  createClient,
  delVoid,
  get,
  http,
  ok,
  err,
  HttpError,
  NetworkError,
  isHttpError,
  isNetworkError,
} from "../src/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createClient", () => {
  it("applies base URL, dynamic headers, timeout, custom fetch, and hooks", async () => {
    const customFetch = vi.fn().mockResolvedValueOnce(jsonResponse({ id: 1 }));
    const onRequest = vi.fn();
    const onResponse = vi.fn();
    const api = createClient({
      baseUrl: "https://api.example.com/v1/",
      fetch: customFetch,
      timeout: 5_000,
      headers: () => ({ Authorization: "Bearer token" }),
      onRequest,
      onResponse,
    });

    const [data, error] = await api.getJson<{ id: number }>("/users/1", {
      headers: { "X-Request-Id": "abc" },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ id: 1 });
    expect(customFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/users/1",
      expect.objectContaining({ method: "GET" }),
    );

    const [, init] = customFetch.mock.calls[0];
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("authorization")).toBe("Bearer token");
    expect((init.headers as Headers).get("x-request-id")).toBe("abc");
    expect(onRequest).toHaveBeenCalledWith("https://api.example.com/v1/users/1", init);
    expect(onResponse).toHaveBeenCalledWith(expect.any(Response));
  });

  it("supports selectable response modes on client methods", async () => {
    mockFetch.mockResolvedValueOnce(new Response("hello", { status: 200 }));
    const api = createClient({ baseUrl: "https://api.example.com" });

    const [text, error] = await api.get("/health", { as: "text" });

    expect(error).toBeNull();
    expect(text).toBe("hello");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/health",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("response modes", () => {
  it("reads text responses via get(..., { as: 'text' })", async () => {
    mockFetch.mockResolvedValueOnce(new Response("plain text", { status: 200 }));

    const [data, error] = await get("/message", { as: "text" });

    expect(error).toBeNull();
    expect(data).toBe("plain text");
  });

  it("returns the raw Response via http.request(..., { as: 'response' })", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const [response, error] = await http.request("GET", "/raw", { as: "response" });

    expect(error).toBeNull();
    expect(response).toBeInstanceOf(Response);
    expect(response?.headers.get("content-type")).toBe("application/json");
  });

  it("handles empty DELETE responses with delVoid", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const [data, error] = await delVoid("/users/1");

    expect(error).toBeNull();
    expect(data).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/users/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("error and result ergonomics", () => {
  it("adds kind discriminators and predicate helpers", () => {
    const httpError = new HttpError(404, "Not Found");
    const networkError = new NetworkError("offline");

    expect(httpError.kind).toBe("http");
    expect(networkError.kind).toBe("network");
    expect(isHttpError(httpError)).toBe(true);
    expect(isNetworkError(networkError)).toBe(true);
    expect(isHttpError(networkError)).toBe(false);
  });

  it("supports match, mapError, and andThen on Result", () => {
    const doubled = ok(21).andThen((value) => ok(value * 2));
    const message = doubled.match({
      ok: (value) => `value:${value}`,
      err: (error) => `error:${String(error)}`,
    });
    const mappedError = err(new HttpError(500, "Boom")).mapError((error) => error.status);

    expect(message).toBe("value:42");
    expect(mappedError.error).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getJson, postJson, putJson, patchJson, del, getText, head } from "../src/client.js";
import { HttpError, NetworkError, ParseError } from "../src/result.js";

// Mock global fetch
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

function textResponse(text: string, status = 200, statusText = "OK"): Response {
  return new Response(text, {
    status,
    statusText,
    headers: { "Content-Type": "text/plain" },
  });
}

// ── getJson ─────────────────────────────────────────────────

describe("getJson", () => {
  it("returns [data, null] on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: "Alice" }));

    const [data, error] = await getJson<{ id: number; name: string }>(
      "https://api.example.com/users/1",
    );

    expect(error).toBeNull();
    expect(data).toEqual({ id: 1, name: "Alice" });
  });

  it("returns [null, HttpError] on 404", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );

    const [data, error] = await getJson("https://api.example.com/users/999");

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(HttpError);
    if (error instanceof HttpError) {
      expect(error.status).toBe(404);
      expect(error.body).toBe("Not Found");
    }
  });

  it("returns [null, HttpError] on 500", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"boom"}', { status: 500, statusText: "Internal Server Error" }),
    );

    const [data, error] = await getJson("https://api.example.com/crash");

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(HttpError);
    if (error instanceof HttpError) {
      expect(error.status).toBe(500);
      expect(error.body).toBe('{"error":"boom"}');
    }
  });

  it("returns [null, NetworkError] on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    const [data, error] = await getJson("https://unreachable.example.com");

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(NetworkError);
    if (error instanceof NetworkError) {
      expect(error.message).toBe("fetch failed");
    }
  });

  it("returns [null, ParseError] on invalid JSON", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("<html>not json</html>"));

    const [data, error] = await getJson("https://api.example.com/broken");

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(ParseError);
    if (error instanceof ParseError) {
      expect(error.body).toBe("<html>not json</html>");
    }
  });

  it("passes custom headers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await getJson("https://api.example.com", {
      headers: { Authorization: "Bearer token123" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer token123" },
      }),
    );
  });
});

// ── postJson ────────────────────────────────────────────────

describe("postJson", () => {
  it("sends JSON body and returns parsed response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42 }, 201, "Created"));

    const [data, error] = await postJson<{ id: number }>("https://api.example.com/users", {
      name: "Bob",
    });

    expect(error).toBeNull();
    expect(data).toEqual({ id: 42 });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users",
      expect.objectContaining({
        method: "POST",
        body: '{"name":"Bob"}',
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

// ── putJson ─────────────────────────────────────────────────

describe("putJson", () => {
  it("sends PUT with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ updated: true }));

    const [data, error] = await putJson("https://api.example.com/users/1", { name: "Updated" });

    expect(error).toBeNull();
    expect(data).toEqual({ updated: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users/1",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});

// ── patchJson ───────────────────────────────────────────────

describe("patchJson", () => {
  it("sends PATCH with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ patched: true }));

    const [data, error] = await patchJson("https://api.example.com/users/1", { name: "Patched" });

    expect(error).toBeNull();
    expect(data).toEqual({ patched: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users/1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

// ── del ─────────────────────────────────────────────────────

describe("del", () => {
  it("sends DELETE and returns parsed response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ deleted: true }));

    const [data, error] = await del("https://api.example.com/users/1");

    expect(error).toBeNull();
    expect(data).toEqual({ deleted: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

// ── getText ─────────────────────────────────────────────────

describe("getText", () => {
  it("returns raw text on success", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Hello, world!"));

    const [data, error] = await getText("https://example.com");

    expect(error).toBeNull();
    expect(data).toBe("Hello, world!");
  });
});

// ── head ────────────────────────────────────────────────────

describe("head", () => {
  it("returns headers on success", async () => {
    const response = new Response(null, {
      status: 200,
      statusText: "OK",
      headers: { "X-Custom": "value" },
    });
    mockFetch.mockResolvedValueOnce(response);

    const [headers, error] = await head("https://example.com");

    expect(error).toBeNull();
    expect(headers).toBeInstanceOf(Headers);
    expect(headers?.get("X-Custom")).toBe("value");
  });
});

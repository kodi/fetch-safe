import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { getJson, postJson, putJson, patchJson, del } from "../src/client.js";
import { ParseError, ValidationError } from "../src/result.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const UserSchema = z.object({ id: z.number(), name: z.string() });

// ── success ──────────────────────────────────────────────────

it("returns typed data when schema passes", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: "Alice" }));

  const [data, error] = await getJson("/users/1", { schema: UserSchema });

  expect(error).toBeNull();
  expect(data).toEqual({ id: 1, name: "Alice" });
});

it("infers T from schema — no generic needed", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: 2, name: "Bob" }));

  const [data] = await getJson("/users/2", { schema: UserSchema });

  // TypeScript: data is { id: number; name: string } | null
  expect(data?.name).toBe("Bob");
});

// ── ValidationError ──────────────────────────────────────────

it("returns ValidationError when required field is missing", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 })); // missing 'name'

  const [data, error] = await getJson("/users/1", { schema: UserSchema });

  expect(data).toBeNull();
  expect(error).toBeInstanceOf(ValidationError);
});

it("ValidationError.body holds the raw parsed value", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));

  const [, error] = await getJson("/users/1", { schema: UserSchema });

  expect(error).toBeInstanceOf(ValidationError);
  if (error instanceof ValidationError) {
    expect(error.body).toEqual({ id: 1 });
  }
});

it("ValidationError.issues is a non-empty array of Zod issues", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: "bad", name: 99 }));

  const [, error] = await getJson("/users/1", { schema: UserSchema });

  expect(error).toBeInstanceOf(ValidationError);
  if (error instanceof ValidationError) {
    expect(Array.isArray(error.issues)).toBe(true);
    expect(error.issues.length).toBeGreaterThan(0);
    const issues = error.issues as Array<{ message: string }>;
    expect(issues.every((i) => typeof i.message === "string")).toBe(true);
  }
});

// ── ParseError takes priority over schema ────────────────────

it("returns ParseError (not ValidationError) when body is not valid JSON", async () => {
  mockFetch.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 200 }));

  const [data, error] = await getJson("/broken", { schema: UserSchema });

  expect(data).toBeNull();
  expect(error).toBeInstanceOf(ParseError);
});

// ── schema option on all JSON methods ────────────────────────

describe("schema option on all JSON methods", () => {
  it("postJson validates response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "New" }));

    const [data, error] = await postJson("/users", { name: "New" }, { schema: UserSchema });

    expect(error).toBeNull();
    expect(data?.id).toBe(42);
  });

  it("putJson validates response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: "Updated" }));

    const [data, error] = await putJson("/users/1", { name: "Updated" }, { schema: UserSchema });

    expect(error).toBeNull();
    expect(data?.name).toBe("Updated");
  });

  it("patchJson validates response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: "Patched" }));

    const [data, error] = await patchJson("/users/1", { name: "Patched" }, { schema: UserSchema });

    expect(error).toBeNull();
    expect(data?.name).toBe("Patched");
  });

  it("del validates response", async () => {
    const DeletedSchema = z.object({ deleted: z.boolean() });
    mockFetch.mockResolvedValueOnce(jsonResponse({ deleted: true }));

    const [data, error] = await del("/users/1", { schema: DeletedSchema });

    expect(error).toBeNull();
    expect(data?.deleted).toBe(true);
  });

  it("postJson returns ValidationError when response fails schema", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ wrong: true }));

    const [data, error] = await postJson("/users", { name: "X" }, { schema: UserSchema });

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(ValidationError);
  });
});

// ── no schema = no change in behaviour ──────────────────────

it("omitting schema preserves original behaviour", async () => {
  mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, name: "Alice" }));

  const [data, error] = await getJson<{ id: number; name: string }>("/users/1");

  expect(error).toBeNull();
  expect(data).toEqual({ id: 1, name: "Alice" });
});

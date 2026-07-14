# fetch-safe

[![npm version](https://img.shields.io/npm/v/fetch-safe)](https://www.npmjs.com/package/fetch-safe)
[![Publish to npm](https://github.com/kodi/fetch-safe/actions/workflows/publish.yml/badge.svg)](https://github.com/kodi/fetch-safe/actions/workflows/publish.yml)

Tiny HTTP client for TypeScript with explicit errors and no `try/catch` at the call site.

`fetch-safe` returns `Result` objects that still destructure like `[data, err]`, so the simplest path stays simple while richer result helpers remain available when you need them.

```ts
import { getJson } from "fetch-safe";

const [user, err] = await getJson<User>("/api/users/1");
if (err) {
  console.error(err.message);
  return;
}
console.log(user.name);
```

## Install

```bash
pnpm add fetch-safe
```

## Simple HTTP

The core idea is straightforward:

- call an HTTP helper
- destructure `[data, err]`
- return early on failure
- keep working with typed data on success

```ts
import { getJson } from "fetch-safe";

const [user, err] = await getJson<{ id: number; name: string }>("/api/users/1");

if (err) {
  console.error(err.message);
  return;
}

console.log(user.name);
```

All request helpers return `Promise<Result<T, FetchError>>`:

| Method                               | Description                      |
| ------------------------------------ | -------------------------------- |
| `get<T>(url, opts?)`                 | GET → selectable response        |
| `post<T>(url, body?, opts?)`         | POST JSON → selectable response  |
| `put<T>(url, body?, opts?)`          | PUT JSON → selectable response   |
| `patch<T>(url, body?, opts?)`        | PATCH JSON → selectable response |
| `httpRequest<T>(method, url, opts?)` | Any method → selectable response |
| `getJson<T>(url, opts?)`             | GET → parsed JSON                |
| `postJson<T>(url, body?, opts?)`     | POST JSON → parsed JSON          |
| `putJson<T>(url, body?, opts?)`      | PUT JSON → parsed JSON           |
| `patchJson<T>(url, body?, opts?)`    | PATCH JSON → parsed JSON         |
| `del<T>(url, opts?)`                 | DELETE → parsed JSON             |
| `delAs<T>(url, opts?)`               | DELETE → selectable response     |
| `delVoid(url, opts?)`                | DELETE → no response body        |
| `getText(url, opts?)`                | GET → raw string                 |
| `head(url, opts?)`                   | HEAD → Headers                   |

You can import individual functions:

```ts
import { getJson, postJson } from "fetch-safe";
```

Or use the `http` namespace:

```ts
import { http } from "fetch-safe";

const [data, err] = await http.getJson("https://api.example.com/data");
```

Use `createClient(...)` when an app has shared configuration like a base URL,
auth headers, timeout, custom `fetch`, or request/response hooks:

```ts
import { createClient } from "fetch-safe";

const api = createClient({
  baseUrl: "https://api.example.com/v1",
  timeout: 5_000,
  headers: () => ({ Authorization: `Bearer ${getToken()}` }),
  onRequest(url, init) {
    console.debug("request", init.method, url);
  },
});

const [user, err] = await api.getJson<User>("/users/1");
```

Pass standard `RequestInit` options plus a `timeout` in milliseconds:

```ts
const [data, err] = await getJson<User>("/api/me", {
  headers: { Authorization: "Bearer token" },
  timeout: 5_000,
});
```

## Response modes

The JSON helpers stay as the simple path, but the `get`, `post`, `put`,
`patch`, `delAs`, and `http.request` APIs can read different response shapes
with `as`:

```ts
const [user] = await http.get<User>("/users/1"); // defaults to { as: "json" }
const [text] = await http.get("/health", { as: "text" });
const [file] = await http.get("/report.pdf", { as: "blob" });
const [response] = await http.request("GET", "/users/1", { as: "response" });
const [, deleteErr] = await http.delVoid("/users/1");
```

Empty JSON bodies now resolve to `undefined` instead of a parse error, so `204`
responses are handled cleanly.

## Errors

Errors are returned, not thrown.

| Error             | When                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `HttpError`       | Server responded with non-2xx status. Has `.status`, `.statusText`, `.body` |
| `NetworkError`    | DNS failure, timeout, connection refused                                    |
| `ParseError`      | Response body is not valid JSON. Has `.body` with raw text                  |
| `ValidationError` | Parsed JSON failed schema validation. Has `.issues` and `.body`             |

```ts
import { getJson, isHttpError, isNetworkError, isParseError } from "fetch-safe";

const [data, err] = await getJson<User>("/api/users/1");

if (err) {
  if (isHttpError(err)) {
    console.error(`HTTP ${err.status}: ${err.body}`);
  } else if (isNetworkError(err)) {
    console.error("Network issue:", err.message);
  } else if (isParseError(err)) {
    console.error("Bad JSON:", err.body);
  }
  return;
}

console.log(data);
```

Each error also has a stable `.kind` discriminator: `"http"`, `"network"`,
`"parse"`, or `"validation"`. `instanceof` still works if you prefer it.

## Schema Validation

Add a `schema` to validate parsed JSON at runtime. Any object with a `.parse(value)` method works, including Zod, Valibot, ArkType, or a hand-rolled validator.

```ts
import { z } from "zod";
import { http, ValidationError } from "fetch-safe";

const UserSchema = z.object({ id: z.number(), name: z.string() });

const [user, err] = await http.getJson("/api/users/1", { schema: UserSchema });

if (err) {
  if (err instanceof ValidationError) {
    console.error("Schema mismatch:", err.issues);
  }
  return;
}

console.log(user.name);
```

When validation fails, `fetch-safe` returns a `ValidationError` instead of throwing. It includes:

- `.issues` — validation issues from the schema library
- `.body` — the parsed value that failed validation
- `.cause` — the original error thrown by `.parse()`

Schema validation works with all JSON methods: `getJson`, `postJson`, `putJson`, `patchJson`, and `del`.

## Result Types

Under the hood, `fetch-safe` returns a `Result` object, not a raw tuple.

That object gives you:

- `.ok` to distinguish success from failure
- `.value` and `.error`
- result methods like `.map()` and `.toValueOrThrow()`
- tuple-style destructuring so the common HTTP path still looks like `[data, err]`

| Type           | Shape          | Description                                                                  |
| -------------- | -------------- | ---------------------------------------------------------------------------- |
| `Result<T, E>` | Result object  | Supports `.ok`, `.value`, `.error`, methods, and `[data, err]` destructuring |
| `Ok<T>`        | Success result | `ok: true`, `value: T`, `error: null`                                        |
| `Err<E>`       | Error result   | `ok: false`, `value: null`, `error: E`                                       |

Tuple-style destructuring still works:

```ts
const [data, error] = ok({ name: "Alice" });

if (!error) {
  console.log(data.name);
}
```

Object-style access is also available:

```ts
const result = ok({ name: "Alice" });

if (result.ok) {
  console.log(result.value.name);
}
```

If `null` is a meaningful success value in your app, use `.ok` as the authoritative discriminator.

## Helpers

For simple HTTP calls, destructuring is enough. The helpers are there for transformation and composition.

Use `result.map(...)` when you already have a `Result` in hand.
Use `chainResult(...)` when you want to start from `getJson(...)` directly, or when your mapper is async.

### `result.map(...)`

`Result.map(...)` is synchronous. This is the right tool after you already `await` a request helper.

```ts
const result = await getJson<{ id: number; title: string }>("/api/todos/1");

const mapped = result.map((todo) => ({
  id: todo.id,
  title: todo.title.toUpperCase(),
}));

if (mapped.ok) {
  console.log(mapped.value.title);
}
```

### `chainResult(...)`

Use `chainResult` when you want async-aware chaining from a `Result` or `Promise<Result<...>>`.
It exists for two cases:

- you want to start chaining from `getJson(...)` before `await`
- your mapper returns a `Promise`

```ts
import { chainResult, getJson } from "fetch-safe";

const [name, err] = await chainResult(getJson<{ name: string }>("/api/users/1"))
  .map((user) => user.name)
  .toTuple();
```

Async mapper example:

```ts
const title = await chainResult(getJson<{ title: string }>("/api/todos/1"))
  .map(async (todo) => todo.title.toUpperCase())
  .toValueOrThrow();
```

### Value extraction helpers

```ts
const value = await chainResult(getJson<{ name: string }>("/api/users/1")).toValue();
const valueOr = await chainResult(getJson<{ name: string }>("/api/users/1")).toValueOr("unknown");
const valueOrThrow = await chainResult(getJson<{ name: string }>("/api/users/1")).toValueOrThrow();
```

- `toValue()` returns `T | null`
- `toValueOr(fallback)` returns the fallback on error
- `toValueOrThrow()` throws the original error on failure

If `null` is a meaningful success value in your app, prefer `.ok`, `toValueOr(...)`, or `toValueOrThrow()` over `toValue()`.

## Prerequisites

Install [Vite+](https://viteplus.dev/guide/) for the project toolchain:

```bash
curl -fsSL https://vite.plus | bash
```

## Development

```bash
vp install            # dependencies
vp check              # format, lint, and type check
vp test               # unit tests
vp pack               # package build
vp run perf           # manual throughput benchmarks
vp run perf:memory    # manual retention tests, requires --expose-gc
vp run perf:soak      # manual mixed workload soak test
```

## Manual Performance Testing

Performance and long-running reliability checks are intentionally separate from the unit suite.

- `vp test` stays focused on correctness.
- `vp run perf` measures relative throughput for hot paths.
- `vp run perf:memory` looks for retained heap growth across batched runs.
- `vp run perf:soak` runs a mixed success and failure workload for a longer interval and shows an in-place ASCII progress bar.

The manual scripts live under `perf/` as TypeScript files and execute against the built package in `dist/` so they measure the published runtime shape while keeping the harness itself typed.

Each perf command has a matching pre-script, so `dist/` is rebuilt from the latest source automatically before the benchmark starts.

### Suggested workflow

```bash
vp run perf
vp run perf:memory
PERF_SOAK_MS=300000 vp run perf:soak
```

`vp run perf:soak` defaults to a 5 minute run when `PERF_SOAK_MS` is not set.

What to watch for:

- throughput regressions compared to your last baseline
- post-GC heap usage that keeps climbing batch after batch
- RSS growth during the soak test that never stabilizes
- disproportionate growth on failure-heavy runs compared to success-heavy runs

The request layer now clears its timeout timer on both success and failure paths, which matters when you stress rejected or timed out requests in long-running apps.

## License

MIT

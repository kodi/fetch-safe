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

| Method                            | Description              |
| --------------------------------- | ------------------------ |
| `getJson<T>(url, opts?)`          | GET → parsed JSON        |
| `postJson<T>(url, body?, opts?)`  | POST JSON → parsed JSON  |
| `putJson<T>(url, body?, opts?)`   | PUT JSON → parsed JSON   |
| `patchJson<T>(url, body?, opts?)` | PATCH JSON → parsed JSON |
| `del<T>(url, opts?)`              | DELETE → parsed JSON     |
| `getText(url, opts?)`             | GET → raw string         |
| `head(url, opts?)`                | HEAD → Headers           |

You can import individual functions:

```ts
import { getJson, postJson } from "fetch-safe";
```

Or use the `http` namespace:

```ts
import { http } from "fetch-safe";

const [data, err] = await http.getJson("https://api.example.com/data");
```

Pass standard `RequestInit` options plus a `timeout` in milliseconds:

```ts
const [data, err] = await getJson<User>("/api/me", {
  headers: { Authorization: "Bearer token" },
  timeout: 5_000,
});
```

## Errors

Errors are returned, not thrown.

| Error             | When                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `HttpError`       | Server responded with non-2xx status. Has `.status`, `.statusText`, `.body` |
| `NetworkError`    | DNS failure, timeout, connection refused                                    |
| `ParseError`      | Response body is not valid JSON. Has `.body` with raw text                  |
| `ValidationError` | Parsed JSON failed schema validation. Has `.issues` and `.body`             |

```ts
import { getJson, HttpError, NetworkError, ParseError } from "fetch-safe";

const [data, err] = await getJson<User>("/api/users/1");

if (err) {
  if (err instanceof HttpError) {
    console.error(`HTTP ${err.status}: ${err.body}`);
  } else if (err instanceof NetworkError) {
    console.error("Network issue:", err.message);
  } else if (err instanceof ParseError) {
    console.error("Bad JSON:", err.body);
  }
  return;
}

console.log(data);
```

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

| Type           | Shape         | Description |
| -------------- | ------------- | ----------- |
| `Result<T, E>` | Result object | Supports `.ok`, `.value`, `.error`, methods, and `[data, err]` destructuring |
| `Ok<T>`        | Success result | `ok: true`, `value: T`, `error: null` |
| `Err<E>`       | Error result | `ok: false`, `value: null`, `error: E` |

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

Install [mise](https://mise.jdx.dev/) for managing development tools:

```bash
brew install mise
```

## Development

```bash
mise install          # Node 24, Bun, pnpm 10
pnpm install          # dependencies
pnpm test             # vitest
pnpm lint             # oxlint
pnpm fmt              # oxfmt
pnpm check            # tsgo type check
pnpm build            # tsdown package build
pnpm perf             # manual throughput benchmarks
pnpm perf:memory      # manual retention tests, requires --expose-gc
pnpm perf:soak        # manual mixed workload soak test
```

### Mise Tasks

```bash
mise run typecheck    # tsgo --noEmit
mise run lint         # oxlint
mise run format-check # oxfmt --check
mise run local-ci     # all three in parallel
```

## Manual Performance Testing

Performance and long-running reliability checks are intentionally separate from the unit suite.

- `pnpm test` stays focused on correctness.
- `pnpm perf` measures relative throughput for hot paths.
- `pnpm perf:memory` looks for retained heap growth across batched runs.
- `pnpm perf:soak` runs a mixed success and failure workload for a longer interval and shows an in-place ASCII progress bar.

The manual scripts live under `perf/` as TypeScript files and execute against the built package in `dist/` so they measure the published runtime shape while keeping the harness itself typed.

Each perf command has a matching pnpm pre-script, so `dist/` is rebuilt from the latest source automatically before the benchmark starts.

### Suggested workflow

```bash
pnpm perf
pnpm perf:memory
PERF_SOAK_MS=300000 pnpm perf:soak
```

`pnpm perf:soak` defaults to a 5 minute run when `PERF_SOAK_MS` is not set.

What to watch for:

- throughput regressions compared to your last baseline
- post-GC heap usage that keeps climbing batch after batch
- RSS growth during the soak test that never stabilizes
- disproportionate growth on failure-heavy runs compared to success-heavy runs

The request layer now clears its timeout timer on both success and failure paths, which matters when you stress rejected or timed out requests in long-running apps.

## License

MIT

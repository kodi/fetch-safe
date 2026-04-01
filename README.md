# fetch-ok

Go/Rust-style HTTP client for TypeScript. No try/catch, just tuples.

```ts
const [user, err] = await http.getJson<User>("/api/users/1");
if (err) {
  console.error(err.message);
  return;
}
console.log(user.name);
```

## Install

```bash
pnpm add fetch-ok
```

## Result Types

| Type           | Shape                    | Description                                      |
| -------------- | ------------------------ | ------------------------------------------------ |
| `Result<T, E>` | `[T, null] \| [null, E]` | Union — use for function return types            |
| `Ok<T>`        | `[T, null]`              | Success tuple — `data` is `T`, no null ambiguity |
| `Err<E>`       | `[null, E]`              | Error tuple — `error` is `E`, no null ambiguity  |

`ok()` returns `Ok<T>` and `err()` returns `Err<E>`, so destructured values are fully narrowed without `!` assertions:

```ts
const [data, error] = err(new HttpError(404, "Not Found"));
error.status; // ✅ no `!` needed — TS knows error is HttpError

const [data, error] = ok({ name: "Alice" });
data.name; // ✅ no `!` needed — TS knows data is { name: string }
```

When the return type is `Result<T, E>` (either outcome possible), use the standard `if (error)` check:

```ts
const [data, err] = await getJson<User>("/api/users/1");
if (err) return; // narrows: err is FetchError
data.name; // narrows: data is User
```

## API

Every method returns `Promise<Result<T, FetchError>>`.

| Method                            | Description              |
| --------------------------------- | ------------------------ |
| `getJson<T>(url, opts?)`          | GET → parsed JSON        |
| `postJson<T>(url, body?, opts?)`  | POST JSON → parsed JSON  |
| `putJson<T>(url, body?, opts?)`   | PUT JSON → parsed JSON   |
| `patchJson<T>(url, body?, opts?)` | PATCH JSON → parsed JSON |
| `del<T>(url, opts?)`              | DELETE → parsed JSON     |
| `getText(url, opts?)`             | GET → raw string         |
| `head(url, opts?)`                | HEAD → Headers           |

All methods are also available on the `http` namespace object:

```ts
import { http } from "fetch-ok";

const [data, err] = await http.getJson("https://api.example.com/data");
```

Or import individual functions:

```ts
import { getJson, postJson } from "fetch-ok";
```

## Error Types

| Error             | When                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `HttpError`       | Server responded with non-2xx status. Has `.status`, `.statusText`, `.body`     |
| `NetworkError`    | DNS failure, timeout, connection refused                                        |
| `ParseError`      | Response body isn't valid JSON. Has `.body` with raw text                       |
| `ValidationError` | Parsed JSON failed schema validation. Has `.issues`, `.body` (raw parsed value) |

```ts
import { HttpError, NetworkError, ParseError } from "fetch-ok";

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

Pass a `schema` option to validate the parsed JSON at runtime. Any object with a `.parse(value)` method works — Zod, Valibot, ArkType, or a hand-rolled validator.

```ts
import { z } from "zod";

const UserSchema = z.object({ id: z.number(), name: z.string() });

// T is inferred from the schema — no need to pass a generic
const [user, err] = await http.getJson("/api/users/1", { schema: UserSchema });

if (err) {
  if (err instanceof ValidationError) {
    console.error("Schema mismatch:", err.issues);
  }
  return;
}

console.log(user.name); // fully typed as { id: number; name: string }
```

Works with all JSON methods: `getJson`, `postJson`, `putJson`, `patchJson`, `del`.

When validation fails, a `ValidationError` is returned (not thrown). It has:

- `.issues` — array of validation issues from the schema library
- `.body` — the raw parsed JSON that failed validation
- `.cause` — the original error thrown by `.parse()`

```ts
import { ValidationError } from "fetch-ok";

if (err instanceof ValidationError) {
  console.error(err.issues); // Zod ZodIssue[], Valibot issues, etc.
  console.error(err.body); // the raw parsed object
}
```

## Options

Pass standard `RequestInit` options (headers, credentials, etc.) plus a `timeout` (default: 30s):

```ts
const [data, err] = await getJson<User>("/api/me", {
  headers: { Authorization: "Bearer token" },
  timeout: 5_000,
});
```

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
pnpm build            # tsgo emit
```

### Mise Tasks

```bash
mise run typecheck    # tsgo --noEmit
mise run lint         # oxlint
mise run format-check # oxfmt --check
mise run local-ci     # all three in parallel
```

## License

MIT

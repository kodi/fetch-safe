# http-result

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
pnpm add http-result
```

## Result Types

| Type | Shape | Description |
| --- | --- | --- |
| `Result<T, E>` | `[T, null] \| [null, E]` | Union — use for function return types |
| `Ok<T>` | `[T, null]` | Success tuple — `data` is `T`, no null ambiguity |
| `Err<E>` | `[null, E]` | Error tuple — `error` is `E`, no null ambiguity |

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

| Method | Description |
| --- | --- |
| `getJson<T>(url, opts?)` | GET → parsed JSON |
| `postJson<T>(url, body?, opts?)` | POST JSON → parsed JSON |
| `putJson<T>(url, body?, opts?)` | PUT JSON → parsed JSON |
| `patchJson<T>(url, body?, opts?)` | PATCH JSON → parsed JSON |
| `del<T>(url, opts?)` | DELETE → parsed JSON |
| `getText(url, opts?)` | GET → raw string |
| `head(url, opts?)` | HEAD → Headers |

All methods are also available on the `http` namespace object:

```ts
import { http } from "http-result";

const [data, err] = await http.getJson("https://api.example.com/data");
```

Or import individual functions:

```ts
import { getJson, postJson } from "http-result";
```

## Error Types

| Error | When |
| --- | --- |
| `HttpError` | Server responded with non-2xx status. Has `.status`, `.statusText`, `.body` |
| `NetworkError` | DNS failure, timeout, connection refused |
| `ParseError` | Response body isn't valid JSON. Has `.body` with raw text |

```ts
import { HttpError, NetworkError, ParseError } from "http-result";

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

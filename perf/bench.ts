import { Bench } from "tinybench";
import { z } from "zod";
import { chainResult, err, getJson, ok, ParseError } from "../dist/index.mjs";

const UserSchema = z.object({
  id: z.number(),
  profile: z.object({
    name: z.string(),
    email: z.email(),
    flags: z.array(z.string()),
  }),
});

const jsonPayload = JSON.stringify({
  id: 1,
  profile: { name: "Alice", email: "alice@example.com", flags: ["admin", "beta"] },
});

function installFetchMock() {
  globalThis.fetch = async () =>
    new Response(jsonPayload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

async function main() {
  installFetchMock();

  const bench = new Bench({
    iterations: 200,
    time: 1_000,
    warmupTime: 250,
  });

  bench
    .add("ok() creation", () => {
      ok({ id: 1, name: "Alice" });
    })
    .add("err() creation", () => {
      err(new ParseError("{bad json}"));
    })
    .add("ok().map()", () => {
      ok(21).map((value) => value * 2);
    })
    .add("tuple destructuring", () => {
      const [value, error] = ok(42);

      if (error) {
        throw error;
      }

      return value;
    })
    .add("chainResult sync", async () => {
      await chainResult(ok(21))
        .map((value) => value * 2)
        .toTuple();
    })
    .add("chainResult async", async () => {
      await chainResult(ok(21))
        .map(async (value) => value * 2)
        .toTuple();
    })
    .add("getJson parse only", async () => {
      await getJson("https://bench.example.com/user");
    })
    .add("getJson with schema", async () => {
      await getJson("https://bench.example.com/user", { schema: UserSchema });
    });

  await bench.run();

  const rows = bench.tasks.map((task) => ({
    name: task.name,
    hz: task.result?.hz?.toFixed(2) ?? "n/a",
    averageNs: task.result?.mean ? (task.result.mean * 1e9).toFixed(0) : "n/a",
    samples: task.result?.samples.length ?? 0,
  }));

  console.table(rows);
}

await main();

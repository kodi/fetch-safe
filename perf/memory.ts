import { z } from "zod";
import { chainResult, err, getJson, ok, ParseError } from "../dist/index.mjs";
import {
  assertGcAvailable,
  forceGc,
  memorySnapshot,
  printDeltaSummary,
  printMemoryTable,
  printSection,
  runBatches,
} from "./common.ts";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  tags: z.array(z.string()),
});

const successBody = JSON.stringify({ id: 1, name: "Alice", tags: ["one", "two", "three"] });

function installFetchMock(mode: "success" | "reject" | "timeout") {
  globalThis.fetch = async (_url, options) => {
    if (mode === "reject") {
      throw new TypeError("fetch failed");
    }

    if (mode === "timeout") {
      const signal = options?.signal;

      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }

    return new Response(successBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

async function runResultAllocationTest() {
  printSection("Result allocation retention");
  forceGc();
  const start = memorySnapshot("start");

  const snapshots = await runBatches({
    label: "result allocations",
    batches: 8,
    async runBatch() {
      for (let index = 0; index < 500_000; index += 1) {
        const success = ok(index).map((value) => value + 1);
        const failure = err(new ParseError(`bad-${index}`));
        void success[0];
        void failure[1];
      }
    },
  });

  const end = memorySnapshot("end");
  printMemoryTable([start, ...snapshots, end]);
  printDeltaSummary(start, end);
}

async function runChainResultTest() {
  printSection("ChainResult retention");
  forceGc();
  const start = memorySnapshot("start");

  const snapshots = await runBatches({
    label: "chainResult",
    batches: 6,
    async runBatch() {
      for (let index = 0; index < 100_000; index += 1) {
        await chainResult(ok(index))
          .map((value) => value * 2)
          .map(async (value) => value + 1)
          .toTuple();
      }
    },
  });

  const end = memorySnapshot("end");
  printMemoryTable([start, ...snapshots, end]);
  printDeltaSummary(start, end);
}

async function runRequestSuccessTest() {
  printSection("Request success retention");
  installFetchMock("success");
  forceGc();
  const start = memorySnapshot("start");

  const snapshots = await runBatches({
    label: "request success",
    batches: 6,
    async runBatch() {
      for (let index = 0; index < 100_000; index += 1) {
        await getJson("https://bench.example.com/user", { schema: UserSchema });
      }
    },
  });

  const end = memorySnapshot("end");
  printMemoryTable([start, ...snapshots, end]);
  printDeltaSummary(start, end);
}

async function runRequestFailureTest() {
  printSection("Request failure retention");
  installFetchMock("reject");
  forceGc();
  const start = memorySnapshot("start");

  const snapshots = await runBatches({
    label: "request rejection",
    batches: 6,
    async runBatch() {
      for (let index = 0; index < 100_000; index += 1) {
        await getJson("https://bench.example.com/user", { timeout: 60_000 });
      }
    },
  });

  const end = memorySnapshot("end");
  printMemoryTable([start, ...snapshots, end]);
  printDeltaSummary(start, end);
}

async function main() {
  assertGcAvailable();
  await runResultAllocationTest();
  await runChainResultTest();
  await runRequestSuccessTest();
  await runRequestFailureTest();
}

await main();

import { z } from "zod";
import { getJson } from "../dist/index.mjs";
import {
  assertGcAvailable,
  forceGc,
  finishProgressLine,
  formatDuration,
  formatNumber,
  memorySnapshot,
  printDeltaSummary,
  printMemoryTable,
  printSection,
  renderProgressBar,
  sleep,
  updateProgressLine,
} from "./common.ts";

const UserSchema = z.object({ id: z.number(), name: z.string(), flags: z.array(z.string()) });

function createFetchMock() {
  let requestCount = 0;

  return async (_url: string, options?: RequestInit) => {
    requestCount += 1;
    const mode = requestCount % 20;

    if (mode === 0) {
      throw new TypeError("fetch failed");
    }

    if (mode === 1) {
      const signal = options?.signal;

      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }

    if (mode === 2) {
      return new Response("<html>oops</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (mode === 3) {
      return new Response(JSON.stringify({ id: requestCount }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ id: requestCount, name: `user-${requestCount}`, flags: ["stable"] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
}

async function main() {
  assertGcAvailable();
  globalThis.fetch = createFetchMock();

  const durationMs = Number(process.env.PERF_SOAK_MS ?? 300_000);
  const batchSize = Number(process.env.PERF_SOAK_BATCH ?? 10_000);
  const snapshots = [];

  printSection("Mixed soak test");
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Batch size: ${batchSize}`);

  forceGc();
  const start = memorySnapshot("start");
  snapshots.push(start);

  const startedAt = Date.now();
  let batch = 0;
  let ops = 0;
  let lastProgressUpdateAt = 0;

  function printProgress(force = false) {
    const now = Date.now();

    if (!force && now - lastProgressUpdateAt < 200) {
      return;
    }

    lastProgressUpdateAt = now;
    const elapsedMs = Math.min(now - startedAt, durationMs);
    const progress = elapsedMs / durationMs;
    const remainingMs = Math.max(0, durationMs - elapsedMs);
    const progressText =
      `${renderProgressBar(progress)} ${Math.min(100, progress * 100).toFixed(1)}% ` +
      `elapsed ${formatDuration(elapsedMs)} remaining ${formatDuration(remainingMs)} ` +
      `batches ${formatNumber(batch)} ops ${formatNumber(ops)}`;

    updateProgressLine(progressText);
  }

  while (Date.now() - startedAt < durationMs) {
    for (let index = 0; index < batchSize; index += 1) {
      await getJson("https://soak.example.com/user", {
        schema: UserSchema,
        timeout: 5,
      });
      ops += 1;
      printProgress();
    }

    batch += 1;
    forceGc();
    snapshots.push(memorySnapshot(`batch ${batch}`));

    if (Date.now() - startedAt < durationMs) {
      printProgress(true);
    }

    await sleep(25);
  }

  finishProgressLine(
    `${renderProgressBar(1)} 100.0% elapsed ${formatDuration(durationMs)} remaining 0:00 batches ${formatNumber(batch)} ops ${formatNumber(ops)}`,
  );

  const end = memorySnapshot("end");
  snapshots.push(end);

  console.log(`Operations completed: ${ops}`);
  printMemoryTable(snapshots);
  printDeltaSummary(start, end);
}

await main();

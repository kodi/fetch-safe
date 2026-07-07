import Table from "cli-table3";
import { Bench } from "tinybench";
import type { Task, TaskResultWithStatistics } from "tinybench";
import { z } from "zod";
import { chainResult, err, getJson, ok, ParseError } from "../dist/index.mjs";
import { formatNumber, printSection } from "./common.ts";

const BENCHMARK_NOTES: Record<string, string> = {
  "ok() creation": "success Result wrapper",
  "err() creation": "error Result wrapper",
  "ok().map()": "sync transform on success",
  "tuple destructuring": "read [value, error]",
  "chainResult sync": "fluent sync chain",
  "chainResult async": "fluent async chain",
  "getJson parse only": "mock fetch + JSON parse",
  "getJson with schema": "mock fetch + JSON parse + Zod",
};

const BENCHMARK_COLUMNS = [
  "operation",
  "measures",
  "ops/sec",
  "avg/op",
  "p99/op",
  "100k ops",
  "+/-",
  "stability",
  "samples",
] as const;

type BenchmarkColumn = (typeof BENCHMARK_COLUMNS)[number];
type HighlightColumn = "ops/sec" | "avg/op" | "p99/op" | "100k ops" | "+/-" | "samples";
type BenchmarkMetrics = Record<HighlightColumn, number>;
type BenchmarkRow = Record<BenchmarkColumn, string> & { metrics?: BenchmarkMetrics };
type CompletedBenchmarkRow = BenchmarkRow & { metrics: BenchmarkMetrics };
type TableCell = string | { content: string; hAlign?: "left" | "right" };

const ANSI = {
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
};

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

function hasStatistics(task: Task): task is Task & { result: TaskResultWithStatistics } {
  return task.result.state === "completed" || task.result.state === "aborted-with-statistics";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: "compact",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}%`;
}

function formatPerOperation(ms: number) {
  const ns = ms * 1e6;

  if (ns < 1_000) {
    return `${formatNumber(ns)} ns`;
  }

  const us = ms * 1_000;

  if (us < 1_000) {
    return `${formatNumber(us)} us`;
  }

  if (ms < 1_000) {
    return `${formatNumber(ms)} ms`;
  }

  return `${formatNumber(ms / 1_000)} s`;
}

function formatScaledCost(perOperationMs: number, operations: number) {
  const ms = perOperationMs * operations;

  if (ms < 1) {
    return formatPerOperation(ms);
  }

  if (ms < 1_000) {
    return `${formatNumber(ms)} ms`;
  }

  return `${formatNumber(ms / 1_000)} s`;
}

function formatStability(relativeMarginOfError: number) {
  if (relativeMarginOfError <= 2) {
    return "stable";
  }

  if (relativeMarginOfError <= 5) {
    return "usable";
  }

  if (relativeMarginOfError <= 10) {
    return "noisy";
  }

  return "very noisy";
}

function colorText(text: string, ...styles: Array<keyof typeof ANSI>) {
  return `${styles.map((style) => ANSI[style]).join("")}${text}${ANSI.reset}`;
}

function getTaskStats(bench: Bench, name: string) {
  const task = bench.getTask(name);

  if (!task || !hasStatistics(task)) {
    return undefined;
  }

  return task.result;
}

function getHighlightedColumns(rows: BenchmarkRow[]) {
  const completedRows = rows.filter(
    (row): row is CompletedBenchmarkRow => row.metrics !== undefined,
  );
  const highlightedRows = new Map<BenchmarkRow, Set<HighlightColumn>>();

  function highlightBest(
    column: HighlightColumn,
    compare: (left: number, right: number) => number,
  ) {
    const bestRow = completedRows.reduce<CompletedBenchmarkRow | undefined>((currentBest, row) => {
      if (!currentBest) {
        return row;
      }

      return compare(row.metrics[column], currentBest.metrics[column]) < 0 ? row : currentBest;
    }, undefined);

    if (!bestRow) {
      return;
    }

    highlightedRows.set(bestRow, new Set([...(highlightedRows.get(bestRow) ?? []), column]));
  }

  highlightBest("ops/sec", (left, right) => right - left);
  highlightBest("avg/op", (left, right) => left - right);
  highlightBest("p99/op", (left, right) => left - right);
  highlightBest("100k ops", (left, right) => left - right);
  highlightBest("+/-", (left, right) => left - right);
  highlightBest("samples", (left, right) => right - left);

  return highlightedRows;
}

function createCell(row: BenchmarkRow, column: BenchmarkColumn, highlighted: boolean): TableCell {
  const value = row[column];

  if (column === "stability") {
    const content =
      value === "stable"
        ? colorText(value, "green")
        : value === "usable"
          ? colorText(value, "yellow")
          : colorText(value, "red", "bold");

    return { content, hAlign: "left" };
  }

  if (
    !highlighted &&
    !["ops/sec", "avg/op", "p99/op", "100k ops", "+/-", "samples"].includes(column)
  ) {
    return value;
  }

  return {
    content: highlighted ? colorText(`⭐ ${value}`, "bold") : value,
    hAlign: column === "operation" || column === "measures" ? "left" : "right",
  };
}

function printTable(rows: BenchmarkRow[]) {
  const highlightedRows = getHighlightedColumns(rows);
  const table = new Table({
    head: [...BENCHMARK_COLUMNS],
    colAligns: ["left", "left", "right", "right", "right", "right", "right", "left", "right"],
    style: {
      border: ["gray"],
      head: ["cyan", "bold"],
    },
    wordWrap: false,
  });

  table.push(
    ...rows.map((row) =>
      BENCHMARK_COLUMNS.map((column) =>
        createCell(row, column, highlightedRows.get(row)?.has(column as HighlightColumn) ?? false),
      ),
    ),
  );
  console.log(table.toString());
}

function createPendingRow(task: Task): BenchmarkRow {
  return {
    operation: task.name,
    measures: BENCHMARK_NOTES[task.name] ?? "",
    "ops/sec": task.result.state,
    "avg/op": "",
    "p99/op": "",
    "100k ops": "",
    "+/-": "",
    stability: "",
    samples: "",
    metrics: undefined,
  };
}

function createBenchmarkRow(task: Task & { result: TaskResultWithStatistics }): BenchmarkRow {
  return {
    operation: task.name,
    measures: BENCHMARK_NOTES[task.name] ?? "",
    "ops/sec": formatCompact(task.result.throughput.mean),
    "avg/op": formatPerOperation(task.result.latency.mean),
    "p99/op": formatPerOperation(task.result.latency.p99),
    "100k ops": formatScaledCost(task.result.latency.mean, 100_000),
    "+/-": `${task.result.latency.rme.toFixed(2)}%`,
    stability: formatStability(task.result.latency.rme),
    samples: formatCompact(task.result.latency.samplesCount),
    metrics: {
      "ops/sec": task.result.throughput.mean,
      "avg/op": task.result.latency.mean,
      "p99/op": task.result.latency.p99,
      "100k ops": task.result.latency.mean * 100_000,
      "+/-": task.result.latency.rme,
      samples: task.result.latency.samplesCount,
    },
  };
}

function printHowToRead() {
  printSection("How to read this");
  console.log("ops/sec: completed operations per second; higher is faster.");
  console.log("avg/op: average time for one operation; lower is faster.");
  console.log("p99/op: slow end of the measured samples, useful for spotting jitter.");
  console.log("100k ops: avg/op translated into a more human-sized batch.");
  console.log("+/-: relative margin of error; under 5% is usually a useful local signal.");
  console.log("samples: timing samples used by Tinybench, not a workload size target.");
  console.log("⭐: best value in that column for this run.");
}

function printQuickRead(bench: Bench) {
  const completedTasks = bench.tasks.filter(hasStatistics);

  if (completedTasks.length === 0) {
    return;
  }

  const fastest = completedTasks.reduce((currentFastest, task) =>
    task.result.latency.mean < currentFastest.result.latency.mean ? task : currentFastest,
  );
  const slowest = completedTasks.reduce((currentSlowest, task) =>
    task.result.latency.mean > currentSlowest.result.latency.mean ? task : currentSlowest,
  );

  printSection("Quick read");
  console.log(
    `Fastest: ${fastest.name} at ${formatPerOperation(fastest.result.latency.mean)} per call ` +
      `(${formatCompact(fastest.result.throughput.mean)} ops/sec).`,
  );
  console.log(
    `Slowest: ${slowest.name} at ${formatPerOperation(slowest.result.latency.mean)} per call ` +
      `(${formatCompact(slowest.result.throughput.mean)} ops/sec).`,
  );

  const okCreation = getTaskStats(bench, "ok() creation");
  const errCreation = getTaskStats(bench, "err() creation");

  if (okCreation && errCreation) {
    console.log(
      `err() creation is ${formatNumber(errCreation.latency.mean / okCreation.latency.mean)}x ` +
        "slower than ok() creation because it constructs a real error object.",
    );
  }

  const parseOnly = getTaskStats(bench, "getJson parse only");
  const withSchema = getTaskStats(bench, "getJson with schema");

  if (parseOnly && withSchema) {
    const addedMs = withSchema.latency.mean - parseOnly.latency.mean;
    const addedPercent = (addedMs / parseOnly.latency.mean) * 100;
    const maxRme = Math.max(parseOnly.latency.rme, withSchema.latency.rme);

    if (addedMs >= 0 && maxRme <= 5) {
      console.log(
        `Schema validation adds about ${formatPerOperation(addedMs)} per mocked request ` +
          `(${formatPercent(addedPercent)} vs parse-only).`,
      );
    } else {
      const direction = addedMs >= 0 ? "slower" : "faster";

      console.log(
        `Schema validation measured ${formatPerOperation(Math.abs(addedMs))} ${direction} ` +
          `than parse-only this run (${formatPercent(addedPercent)}), but the comparison is noisy; ` +
          "rerun before treating that delta as signal.",
      );
    }
  }

  console.log(
    "Fetch is mocked here, so the request numbers measure local library work, JSON parsing, " +
      "and schema validation, not real network latency.",
  );
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

  printHowToRead();

  printSection("Benchmark results");
  const rows = bench.tasks.map<BenchmarkRow>((task) => {
    if (!hasStatistics(task)) {
      return createPendingRow(task);
    }

    return createBenchmarkRow(task);
  });
  printTable(rows);
  printQuickRead(bench);
}

await main();

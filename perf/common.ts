import process from "node:process";
import v8 from "node:v8";

type MemorySnapshot = {
  label: string;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  heapLimit: number;
};

type BatchRunnerOptions = {
  label: string;
  batches: number;
  beforeEachBatch?: (batchIndex: number) => Promise<void> | void;
  runBatch: (batchIndex: number) => Promise<void> | void;
  afterEachBatch?: (batchIndex: number) => Promise<void> | void;
};

export function assertGcAvailable(): asserts globalThis is typeof globalThis & {
  gc: () => void;
} {
  if (typeof globalThis.gc !== "function") {
    throw new Error("Run this script with node --expose-gc");
  }
}

export function forceGc() {
  globalThis.gc();
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${formatNumber(value)} ${units[unitIndex]}`;
}

export function memorySnapshot(label: string): MemorySnapshot {
  const memory = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();

  return {
    label,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    heapLimit: heapStats.heap_size_limit,
  };
}

export function printMemoryTable(snapshots: MemorySnapshot[]) {
  const rows = snapshots.map((snapshot) => ({
    stage: snapshot.label,
    rss: formatBytes(snapshot.rss),
    heapUsed: formatBytes(snapshot.heapUsed),
    heapTotal: formatBytes(snapshot.heapTotal),
    external: formatBytes(snapshot.external),
  }));

  console.table(rows);
}

export async function runBatches({
  label,
  batches,
  beforeEachBatch,
  runBatch,
  afterEachBatch,
}: BatchRunnerOptions) {
  const snapshots: MemorySnapshot[] = [];

  for (let batchIndex = 0; batchIndex < batches; batchIndex += 1) {
    if (beforeEachBatch) {
      await beforeEachBatch(batchIndex);
    }

    await runBatch(batchIndex);

    if (afterEachBatch) {
      await afterEachBatch(batchIndex);
    }

    forceGc();
    snapshots.push(memorySnapshot(`${label} batch ${batchIndex + 1}`));
  }

  return snapshots;
}

export function printSection(title: string) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

export function calculateDelta(
  start: MemorySnapshot,
  end: MemorySnapshot,
  key: keyof MemorySnapshot,
) {
  return end[key] - start[key];
}

export function printDeltaSummary(start: MemorySnapshot, end: MemorySnapshot) {
  console.log(`RSS delta: ${formatBytes(calculateDelta(start, end, "rss"))}`);
  console.log(`Heap used delta: ${formatBytes(calculateDelta(start, end, "heapUsed"))}`);
  console.log(`External delta: ${formatBytes(calculateDelta(start, end, "external"))}`);
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function renderProgressBar(progress: number, width = 32) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const filledWidth = Math.round(clampedProgress * width);
  const emptyWidth = width - filledWidth;

  return `[${"#".repeat(filledWidth)}${"-".repeat(emptyWidth)}]`;
}

export function updateProgressLine(text: string) {
  process.stdout.write(`\r${text}`);
}

export function finishProgressLine(text = "") {
  process.stdout.write(`\r${text}\n`);
}

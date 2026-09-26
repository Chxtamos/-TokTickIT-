import { performance } from "node:perf_hooks";
import { hashPassword } from "../../src/password.js";

const serialSamples: number[] = [];
const benchmarkPassword = "lab3 benchmark password 2026";

for (let index = 0; index < 10; index += 1) {
  const startedAt = performance.now();
  await hashPassword(`${benchmarkPassword}-${index}`);
  serialSamples.push(performance.now() - startedAt);
}

const baselineRss = process.memoryUsage().rss;
let peakRss = baselineRss;
const sampleTimer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 10);
const concurrentStartedAt = performance.now();
await Promise.all([
  hashPassword(`${benchmarkPassword}-concurrent-a`),
  hashPassword(`${benchmarkPassword}-concurrent-b`),
]);
const concurrentElapsedMs = performance.now() - concurrentStartedAt;
clearInterval(sampleTimer);
peakRss = Math.max(peakRss, process.memoryUsage().rss);

const sorted = [...serialSamples].sort((left, right) => left - right);
const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
const p95Ms = sorted[p95Index];
const additionalPeakRssBytes = Math.max(0, peakRss - baselineRss);
const result = {
  node: process.version,
  serialHashes: serialSamples.length,
  serialSamplesMs: serialSamples.map((value) => Number(value.toFixed(2))),
  p95Ms: Number(p95Ms.toFixed(2)),
  concurrentHashes: 2,
  concurrentElapsedMs: Number(concurrentElapsedMs.toFixed(2)),
  additionalPeakRssMiB: Number((additionalPeakRssBytes / (1024 * 1024)).toFixed(2)),
  gate: { p95Ms: 2000, additionalPeakRssMiB: 320 },
};
console.log(JSON.stringify(result));

if (p95Ms > 2000 || additionalPeakRssBytes > 320 * 1024 * 1024) {
  console.error("PERF-01 gate failed; review the scrypt profile before continuing auth implementation.");
  process.exitCode = 1;
}

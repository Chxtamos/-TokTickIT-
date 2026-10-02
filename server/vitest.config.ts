import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Database-writing integration suites share one isolated target. Keep the
    // full run deterministic so seed assertions cannot race another worker.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});

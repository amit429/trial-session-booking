import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const envFile = resolve(__dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
// Tests always run against the throwaway test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    globalSetup: ["./test/helpers/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});

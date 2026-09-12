import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  oxc: {
    jsx: "react-jsx",
  },
  test: {
    environment: "node",
    include: ["e2e/security-direct.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});

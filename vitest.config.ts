/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.ts"],
    environment: "node",
  },
});

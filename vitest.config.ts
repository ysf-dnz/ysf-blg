/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    // integration: yalnız POSTGRES_URL_TEST tanımlıysa koşar (dosya içinde skipIf)
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
  },
});

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit Node'da koşar; .env.local'dan yüklenir (package.json script)
    url: process.env.POSTGRES_URL!,
  },
});

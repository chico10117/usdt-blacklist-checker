import { defineConfig } from "drizzle-kit";
import { getDatabaseUrlFromEnv } from "./src/lib/db/database-url";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: getDatabaseUrlFromEnv() ?? "",
  },
  casing: "snake_case",
});

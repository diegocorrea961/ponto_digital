import { defineConfig } from "drizzle-kit";

// drizzle-kit não carrega o .env sozinho (o Next.js carrega, mas só ele).
try {
  process.loadEnvFile(".env");
} catch {
  // em produção as variáveis já vêm do ambiente
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});

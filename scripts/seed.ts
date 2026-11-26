// Cria o usuário administrador (a dona da loja). Pode rodar mais de uma vez:
// se o usuário já existe, não mexe nele.
//   npm run db:seed
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

try {
  process.loadEnvFile(".env");
} catch {
  // em produção as variáveis já vêm do ambiente
}

async function main() {
  const { db, pool } = await import("../src/db");
  const { users } = await import("../src/db/schema");

  const username = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Administradora";

  if (!password || password.length < 8) {
    throw new Error(
      "Defina ADMIN_PASSWORD (mínimo 8 caracteres) para criar o administrador.",
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing) {
    console.log(`Administrador "${username}" já existe. Nada foi alterado.`);
  } else {
    await db.insert(users).values({
      name,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
    });
    console.log(`Administrador "${username}" criado.`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** Erro de "valor duplicado" do Postgres (código 23505), mesmo embrulhado pelo Drizzle. */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
}

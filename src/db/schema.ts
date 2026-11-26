import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ADMIN", "EMPLOYEE"]);

// A ordem aqui é a ordem em que as batidas acontecem no dia.
export const punchTypeEnum = pgEnum("punch_type", [
  "ENTRY",
  "LUNCH_OUT",
  "LUNCH_IN",
  "EXIT",
]);

export const punchSourceEnum = pgEnum("punch_source", ["CLOCK", "MANUAL"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("EMPLOYEE"),
  active: boolean("active").notNull().default(true),
  // Vai dentro do cookie de login. Quando a senha muda, o número sobe e todos os
  // cookies emitidos antes deixam de valer (sessões antigas são derrubadas).
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tentativas de login erradas, guardadas no banco para o bloqueio valer mesmo
// com várias instâncias do servidor e depois de reinícios.
// A chave é "u:<usuário>" (limite por conta) ou "ip:<endereço>" (limite por origem).
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const punches = pgTable(
  "punches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: punchTypeEnum("type").notNull(),
    // Instante exato da batida (guardado em UTC).
    at: timestamp("at", { withTimezone: true }).notNull(),
    // Dia de trabalho no fuso America/Sao_Paulo ("YYYY-MM-DD").
    workDate: date("work_date", { mode: "string" }).notNull(),
    source: punchSourceEnum("source").notNull().default("CLOCK"),
    // Justificativa (obrigatória nos ajustes manuais).
    note: text("note"),
    createdById: uuid("created_by_id"),
    // Batidas nunca são apagadas: ficam "anuladas" com motivo, para auditoria.
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    voidedById: uuid("voided_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("punches_user_date_idx").on(t.userId, t.workDate),
    // No máximo uma batida ATIVA de cada tipo por funcionário por dia.
    // Também protege contra duplo clique / duas abas ao mesmo tempo.
    uniqueIndex("punches_one_active_per_type_idx")
      .on(t.userId, t.workDate, t.type)
      .where(sql`${t.voidedAt} is null`),
  ],
);

export type User = typeof users.$inferSelect;
export type Punch = typeof punches.$inferSelect;
export type PunchType = (typeof punchTypeEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];

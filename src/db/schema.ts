import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
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

// HOLIDAY: feriado ou folga (não se espera trabalho; o que for trabalhado vira hora extra).
// EXCUSED: atestado ou abono (nunca gera débito; só vira extra o que passar da jornada normal).
export const dayOffKindEnum = pgEnum("day_off_kind", ["HOLIDAY", "EXCUSED"]);

// Como o local de uma batida foi conferido. Nenhum resultado bloqueia a batida:
// OUTSIDE e UNCONFIRMED só geram aviso.
export const locationCheckEnum = pgEnum("location_check", [
  "NETWORK", // veio da rede (internet) da loja
  "GPS", // fora da rede, mas o GPS confirmou que estava na loja
  "OUTSIDE", // o GPS indica que estava fora
  "UNCONFIRMED", // fora da rede e sem GPS confiável
]);

/** Jornada de um dia da semana. Horários no formato "09:00"; null = não é fixo. */
export type DaySchedule = {
  /** Minutos que a pessoa precisa trabalhar no dia (sem o almoço). É o que vale no banco de horas. */
  minutes: number;
  /** Entrada e saída fixas (opcional). */
  start: string | null;
  end: string | null;
  /** Almoço em horário fixo (opcional). */
  lunchStart: string | null;
  lunchEnd: string | null;
  /** Minutos de almoço considerados na conta; null quando o almoço é livre e só o total importa. */
  lunch: number | null;
  /** Horário da loja, em dia de entrada e saída livres: fora dele o relatório avisa. */
  open: string | null;
  close: string | null;
};

/** Chave: dia da semana, "0" (domingo) a "6" (sábado). Dia ausente = não trabalha. */
export type WeekSchedule = Partial<Record<string, DaySchedule>>;

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
  // Dia em que foi desativado: a partir dele o banco de horas para de contar faltas.
  deactivatedOn: date("deactivated_on", { mode: "string" }),
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
    // Conferência de local (null: batida manual ou conferência não configurada).
    // Guardamos só a distância até a loja e a precisão, nunca as coordenadas da pessoa.
    locationCheck: locationCheckEnum("location_check"),
    distanceMeters: integer("distance_meters"),
    accuracyMeters: integer("accuracy_meters"),
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

// Jornada contratada, versionada: cada linha vale a partir de `validFrom`. Mudar a jornada
// cria uma linha nova, então os meses anteriores continuam calculados pela jornada antiga.
export const workSchedules = pgTable(
  "work_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    days: jsonb("days").$type<WeekSchedule>().notNull(),
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Nada é apagado: uma jornada lançada errado é marcada como removida.
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedById: uuid("removed_by_id"),
  },
  (t) => [index("work_schedules_user_idx").on(t.userId, t.validFrom)],
);

// Feriados, folgas, atestados e férias. Um dia só é um período com início = fim.
export const dayOffs = pgTable(
  "day_offs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    kind: dayOffKindEnum("kind").notNull(),
    reason: text("reason").notNull(),
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedById: uuid("removed_by_id"),
  },
  (t) => [index("day_offs_user_idx").on(t.userId, t.startDate)],
);

// Onde fica a loja. Uma linha só (id = 1).
export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  radiusMeters: integer("radius_meters").notNull().default(100),
  // Redes de internet da loja: endereço IPv4, ou o prefixo /64 de um IPv6.
  networks: jsonb("networks").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedById: uuid("updated_by_id"),
});

export type LocationCheck = (typeof locationCheckEnum.enumValues)[number];
export type DayOff = typeof dayOffs.$inferSelect;
export type DayOffKind = (typeof dayOffKindEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Punch = typeof punches.$inferSelect;
export type PunchType = (typeof punchTypeEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];

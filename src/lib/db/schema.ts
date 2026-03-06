import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  uuid,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ─── Auth.js tables ───────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  githubUsername: text("github_username"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// ─── App tables ───────────────────────────────────────────────────────────────

export const userSettings = pgTable("user_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  // Walking durations in minutes
  walkHomeToJsq: integer("walk_home_to_jsq").default(8).notNull(),
  walkWtcToOffice: integer("walk_wtc_to_office").default(10).notNull(),
  walkOfficeToWtc: integer("walk_office_to_wtc").default(10).notNull(),
  walkJsqToHome: integer("walk_jsq_to_home").default(8).notNull(),
  // Decision windows (stored as "HH:MM")
  morningWindowStart: text("morning_window_start").default("08:30").notNull(),
  morningWindowEnd: text("morning_window_end").default("10:00").notNull(),
  eveningWindowStart: text("evening_window_start").default("19:00").notNull(),
  eveningWindowEnd: text("evening_window_end").default("21:00").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type Direction = "outbound" | "return";

export const commuteSessions = pgTable(
  "commute_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: text("direction").$type<Direction>().notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    totalDurationMin: real("total_duration_min"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_sessions_user_date").on(t.userId, t.startedAt),
    index("idx_sessions_direction").on(t.direction),
  ]
);

export type EventStep =
  | "start_commute"
  | "reached_station"
  | "boarded_train"
  | "arrived_wtc"
  | "arrived_jsq"
  | "arrived_destination";

export const commuteEvents = pgTable(
  "commute_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => commuteSessions.id, { onDelete: "cascade" }),
    step: text("step").$type<EventStep>().notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_events_session").on(t.sessionId)]
);

export const commuteTags = pgTable(
  "commute_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => commuteSessions.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(), // e.g. "path_delay", "crowded", "missed_train", "bad_weather", "slow_walking"
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_tags_session").on(t.sessionId)]
);

export const recommendationSnapshots = pgTable(
  "recommendation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: text("direction").$type<Direction>().notNull(),
    bestBand: text("best_band").notNull(), // e.g. "08:40-08:50"
    fallbackBands: jsonb("fallback_bands").$type<string[]>(),
    confidence: text("confidence").notNull(), // "high" | "medium" | "low"
    explanation: text("explanation").notNull(),
    scoringInputs: jsonb("scoring_inputs"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_rec_user_date").on(t.userId, t.createdAt)]
);

export const transitSnapshots = pgTable(
  "transit_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    route: text("route").default("JSQ-WTC").notNull(),
    status: text("status").notNull(), // "normal", "delays", "suspended", "unknown"
    advisoryText: text("advisory_text"),
    headwayMin: real("headway_min"),
    source: text("source").notNull(),
    rawData: jsonb("raw_data"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_transit_fetched").on(t.fetchedAt)]
);

export const weatherSnapshots = pgTable(
  "weather_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    temperature: real("temperature"), // Fahrenheit
    feelsLike: real("feels_like"),
    precipProbability: real("precip_probability"), // 0-100
    precipType: text("precip_type"), // "rain", "snow", etc.
    windSpeed: real("wind_speed"), // mph
    condition: text("condition"), // "clear", "cloudy", "rain", etc.
    isSevere: boolean("is_severe").default(false).notNull(),
    forecastHours: jsonb("forecast_hours"), // next few hours forecast
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_weather_fetched").on(t.fetchedAt)]
);

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
  walkHomeToJsq: integer("walk_home_to_jsq").default(8).notNull(),
  walkWtcToOffice: integer("walk_wtc_to_office").default(10).notNull(),
  walkOfficeToWtc: integer("walk_office_to_wtc").default(10).notNull(),
  walkJsqToHome: integer("walk_jsq_to_home").default(8).notNull(),
  morningWindowStart: text("morning_window_start").default("08:30").notNull(),
  morningWindowEnd: text("morning_window_end").default("10:00").notNull(),
  eveningWindowStart: text("evening_window_start").default("19:00").notNull(),
  eveningWindowEnd: text("evening_window_end").default("21:00").notNull(),
  pushEnabled: boolean("push_enabled").default(false).notNull(),
  pushLeaveReminder: boolean("push_leave_reminder").default(true).notNull(),
  pushServiceAlert: boolean("push_service_alert").default(true).notNull(),
  pushWeatherAlert: boolean("push_weather_alert").default(false).notNull(),
  // v2.5: multi-route — JSONB array of route IDs (backward compat: defaults to single-element)
  activeRoutes: jsonb("active_routes").$type<string[]>().default(["JSQ-WTC"]).notNull(),
  activeRoute: text("active_route").default("JSQ-WTC").notNull(),
  // v3: mode + schedule + onboarding
  preferredMode: text("preferred_mode").default("subway").notNull(),
  commuteDays: text("commute_days").default("weekdays").notNull(),
  customDays: jsonb("custom_days").$type<number[]>(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth_key").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const calendarConnections = pgTable("calendar_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  provider: text("provider").default("google").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  calendarId: text("calendar_id").default("primary"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
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
    // v2.5: route-aware sessions
    route: text("route").default("JSQ-WTC").notNull(),
    mode: text("mode").default("subway").notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    totalDurationMin: real("total_duration_min"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_sessions_user_date").on(t.userId, t.startedAt),
    index("idx_sessions_direction").on(t.direction),
    index("idx_sessions_route").on(t.route),
  ]
);

export type EventStep =
  | "start_commute"
  | "reached_station"
  | "reached_terminal"
  | "boarded_train"
  | "boarded_ferry"
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
    tag: text("tag").notNull(),
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
    bestBand: text("best_band").notNull(),
    fallbackBands: jsonb("fallback_bands").$type<string[]>(),
    confidence: text("confidence").notNull(),
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
    mode: text("mode").default("subway").notNull(),
    status: text("status").notNull(),
    advisoryText: text("advisory_text"),
    headwayMin: real("headway_min"),
    source: text("source").notNull(),
    // v2.5: richer metadata
    sourceType: text("source_type"), // "gtfsrt" | "panynj-json" | "schedule"
    rawData: jsonb("raw_data"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_transit_fetched").on(t.fetchedAt)]
);

export const weatherSnapshots = pgTable(
  "weather_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    temperature: real("temperature"),
    feelsLike: real("feels_like"),
    precipProbability: real("precip_probability"),
    precipType: text("precip_type"),
    windSpeed: real("wind_speed"),
    condition: text("condition"),
    isSevere: boolean("is_severe").default(false).notNull(),
    forecastHours: jsonb("forecast_hours"),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_weather_fetched").on(t.fetchedAt)]
);

// ─── v2.5 tables ──────────────────────────────────────────────────────────────

export const streakSnapshots = pgTable(
  "streak_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    checkinStreak: integer("checkin_streak").default(0).notNull(),
    longestCheckinStreak: integer("longest_checkin_streak").default(0).notNull(),
    onTimeStreak: integer("on_time_streak").default(0).notNull(),
    fastestOutbound: real("fastest_outbound"),
    fastestReturn: real("fastest_return"),
    totalCommutes: integer("total_commutes").default(0).notNull(),
    lastComputedAt: timestamp("last_computed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_streak_user").on(t.userId)]
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "leave_reminder" | "service_alert" | "weather_alert"
    title: text("title").notNull(),
    body: text("body").notNull(),
    tag: text("tag"), // dedupe key
    delivered: boolean("delivered").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_notif_user").on(t.userId, t.createdAt),
    index("idx_notif_tag").on(t.tag),
  ]
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  tokens: integer("tokens").default(0).notNull(),
  lastRefill: timestamp("last_refill", { mode: "date" }).defaultNow().notNull(),
});

// ─── v3: types ───────────────────────────────────────────────────────────────

export type CommuteMode = "subway" | "path" | "bus" | "commuter_rail" | "ferry";
export type CommuteDays = "weekdays" | "all" | "custom";
export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type ReliabilityPref = "fastest" | "most_reliable" | "least_crowded";

// ─── v3: commuter profiles ───────────────────────────────────────────────────

export const commuterProfiles = pgTable("commuter_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  homeArea: text("home_area"), // "Jersey City Heights", "Hoboken", "Astoria", "Stamford"
  officeArea: text("office_area"), // "WTC", "Midtown", "FiDi"
  preferredModes: jsonb("preferred_modes").$type<string[]>().default(["path"]).notNull(),
  riskTolerance: text("risk_tolerance").$type<RiskTolerance>().default("moderate").notNull(),
  reliabilityPref: text("reliability_pref").$type<ReliabilityPref>().default("fastest").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── v3: transit reference data ──────────────────────────────────────────────

export const transitRoutes = pgTable(
  "transit_routes",
  {
    id: text("id").primaryKey(), // "PATH:JSQ-WTC", "MTA:4", "NJT:MOBO", "MNRR:HUDSON"
    mode: text("mode").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    agency: text("agency").notNull(), // PATH, MTA, NJT, MNRR, LIRR, NYCFERRY
    color: text("color"),
    stations: jsonb("stations").$type<string[]>(),
    baseTimeMin: integer("base_time_min"),
    peakHeadwayMin: integer("peak_headway_min"),
    offpeakHeadwayMin: integer("offpeak_headway_min"),
    source: text("source").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_routes_mode").on(t.mode), index("idx_routes_agency").on(t.agency)]
);

export const transitStations = pgTable(
  "transit_stations",
  {
    id: text("id").primaryKey(), // "PATH:JSQ", "MTA:127", "MNRR:STAMFORD"
    name: text("name").notNull(),
    lat: real("lat"),
    lon: real("lon"),
    modes: jsonb("modes").$type<string[]>().default([]).notNull(),
    agencies: jsonb("agencies").$type<string[]>().default([]).notNull(),
    parentStation: text("parent_station"),
    accessible: boolean("accessible").default(true).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_stations_modes").on(t.modes)]
);

// ─── v3: data quality ────────────────────────────────────────────────────────

export const dataIngestionLog = pgTable(
  "data_ingestion_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(), // "gtfs:mta", "gtfs:njt", "gtfs:mnrr"
    recordsIngested: integer("records_ingested").default(0).notNull(),
    status: text("status").notNull(), // "success" | "partial" | "failed"
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    sourceHash: text("source_hash"),
    ingestedAt: timestamp("ingested_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_ingestion_source").on(t.source, t.ingestedAt)]
);

// ─── v3: changelog ───────────────────────────────────────────────────────────

export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    version: text("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category").default("improvement").notNull(),
    publishedAt: timestamp("published_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_changelog_published").on(t.publishedAt)]
);

export const userChangelogSeen = pgTable(
  "user_changelog_seen",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("idx_changelog_seen_user").on(t.userId)]
);

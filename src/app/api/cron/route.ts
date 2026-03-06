import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  userSettings,
  notificationLog,
  transitSnapshots,
  weatherSnapshots,
} from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { getTransitStatus } from "@/lib/services/transit";
import { getWeather } from "@/lib/services/weather";
import { sendPushNotification } from "@/lib/services/push";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Cron endpoint for:
 * 1. Background data refresh (transit + weather snapshots)
 * 2. Proactive push notifications (leave reminders, service alerts, weather alerts)
 *
 * Designed to be called by Vercel Cron (vercel.json) or external scheduler.
 * Secured via CRON_SECRET header.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { allowed } = checkRateLimit("system", "cron");
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const results = {
    transitRefresh: false,
    weatherRefresh: false,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    // 1. Background data refresh
    const [transit, weather] = await Promise.all([
      getTransitStatus().catch((e: Error) => {
        results.errors.push(`transit: ${e.message}`);
        return null;
      }),
      getWeather().catch((e: Error) => {
        results.errors.push(`weather: ${e.message}`);
        return null;
      }),
    ]);

    if (transit) {
      await db.insert(transitSnapshots).values({
        route: "JSQ-WTC",
        status: transit.status,
        advisoryText: transit.advisoryText,
        headwayMin: transit.headwayMin,
        source: transit.source,
        sourceType: transit.source.includes("gtfs") ? "gtfsrt" : "panynj-json",
      });
      results.transitRefresh = true;
    }

    if (weather) {
      await db.insert(weatherSnapshots).values({
        temperature: weather.temperature,
        feelsLike: weather.feelsLike,
        precipProbability: weather.precipProbability,
        precipType: weather.precipType,
        windSpeed: weather.windSpeed,
        condition: weather.condition,
        isSevere: weather.isSevere,
        forecastHours: weather.forecastHours,
        source: weather.source,
      });
      results.weatherRefresh = true;
    }

    // 2. Proactive push notifications
    const allUsers = await db.select().from(users);
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;

    for (const user of allUsers) {
      const [settings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);

      if (!settings?.pushEnabled) continue;

      // Dedupe: check if already sent this type today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const recentNotifs = await db
        .select()
        .from(notificationLog)
        .where(
          and(
            eq(notificationLog.userId, user.id),
            gte(notificationLog.createdAt, todayStart)
          )
        );
      const sentTags = new Set(recentNotifs.map((n) => n.tag));

      // Leave reminder: 15 min before morning window start on weekdays
      if (isWeekday && settings.pushLeaveReminder) {
        const [wh, wm] = settings.morningWindowStart.split(":").map(Number);
        const reminderHour = wm < 15 ? wh - 1 : wh;
        const reminderMin = (wm + 45) % 60;

        if (
          hour === reminderHour &&
          minute >= reminderMin &&
          minute < reminderMin + 10 &&
          !sentTags.has(`leave-morning-${now.toISOString().split("T")[0]}`)
        ) {
          const tag = `leave-morning-${now.toISOString().split("T")[0]}`;
          const sent = await sendPushNotification(user.id, {
            title: "Time to check your commute",
            body: transit
              ? `PATH: ${transit.status}. Check your departure window.`
              : "Check your morning departure recommendation.",
            tag,
            url: "/",
          });
          await db.insert(notificationLog).values({
            userId: user.id,
            type: "leave_reminder",
            title: "Time to check your commute",
            body: `PATH: ${transit?.status ?? "unknown"}`,
            tag,
            delivered: sent,
          });
          if (sent) results.notificationsSent++;
        }
      }

      // Service alert: if PATH has delays/suspension
      if (
        settings.pushServiceAlert &&
        transit &&
        (transit.status === "delays" || transit.status === "suspended")
      ) {
        const tag = `service-${transit.status}-${now.toISOString().split("T")[0]}-${hour}`;
        if (!sentTags.has(tag)) {
          const sent = await sendPushNotification(user.id, {
            title: `PATH ${transit.status === "suspended" ? "Suspended" : "Delays"}`,
            body: transit.advisoryText || `PATH service is experiencing ${transit.status}.`,
            tag,
            url: "/",
          });
          await db.insert(notificationLog).values({
            userId: user.id,
            type: "service_alert",
            title: `PATH ${transit.status}`,
            body: transit.advisoryText || transit.status,
            tag,
            delivered: sent,
          });
          if (sent) results.notificationsSent++;
        }
      }

      // Weather alert: severe weather
      if (settings.pushWeatherAlert && weather?.isSevere) {
        const tag = `weather-severe-${now.toISOString().split("T")[0]}`;
        if (!sentTags.has(tag)) {
          const sent = await sendPushNotification(user.id, {
            title: "Severe Weather Alert",
            body: `${weather.condition}, ${Math.round(weather.temperature)}°F. Plan extra commute time.`,
            tag,
            url: "/",
          });
          await db.insert(notificationLog).values({
            userId: user.id,
            type: "weather_alert",
            title: "Severe Weather Alert",
            body: weather.condition,
            tag,
            delivered: sent,
          });
          if (sent) results.notificationsSent++;
        }
      }
    }
  } catch (e) {
    results.errors.push(e instanceof Error ? e.message : "Unknown error");
  }

  return NextResponse.json(results);
}

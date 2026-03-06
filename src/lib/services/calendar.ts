/**
 * Calendar integration service.
 *
 * Fetches today's events to determine "must arrive by" time
 * for the morning recommendation. Uses Google Calendar API
 * with OAuth tokens stored from the auth flow.
 *
 * For v1: Google Calendar via service-account-free approach.
 * Users link their Google Calendar through OAuth consent.
 *
 * If no calendar is linked or fetch fails, the engine proceeds
 * without calendar constraints.
 */

import { db } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { resilientFetch } from "@/lib/resilient-fetch";
import { eq } from "drizzle-orm";

export interface CalendarEvent {
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
}

export interface CalendarContext {
  connected: boolean;
  firstMeetingTime: Date | null;
  firstMeetingTitle: string | null;
  eventsToday: number;
  mustArriveBy: string | null; // "HH:MM" format
  source: string;
}

/**
 * Get today's calendar context for a user.
 * Returns the earliest meeting time and a "must arrive by" constraint.
 */
export async function getCalendarContext(
  userId: string,
  walkWtcToOffice = 10
): Promise<CalendarContext> {
  const empty: CalendarContext = {
    connected: false,
    firstMeetingTime: null,
    firstMeetingTitle: null,
    eventsToday: 0,
    mustArriveBy: null,
    source: "none",
  };

  try {
    const [connection] = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId))
      .limit(1);

    if (!connection || !connection.accessToken) {
      return empty;
    }

    // Check if token needs refresh
    let accessToken = connection.accessToken;
    if (!accessToken) return { ...empty, connected: true };

    if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
      const refreshed = await refreshGoogleToken(
        connection.refreshToken,
        userId
      );
      if (!refreshed) return { ...empty, connected: true };
      accessToken = refreshed;
    }

    // Fetch today's events
    const events = await fetchTodayEvents(
      accessToken,
      connection.calendarId || "primary"
    );

    if (events.length === 0) {
      return {
        connected: true,
        firstMeetingTime: null,
        firstMeetingTitle: null,
        eventsToday: 0,
        mustArriveBy: null,
        source: "google",
      };
    }

    // Find the first non-all-day event after current time
    const now = new Date();
    const workEvents = events
      .filter((e) => !e.isAllDay && e.startTime > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const firstMeeting = workEvents[0] || null;

    // Calculate must-arrive-by: meeting time minus walking time minus 5 min buffer
    let mustArriveBy: string | null = null;
    if (firstMeeting) {
      const arriveByDate = new Date(
        firstMeeting.startTime.getTime() - (walkWtcToOffice + 5) * 60 * 1000
      );
      mustArriveBy = `${arriveByDate.getHours().toString().padStart(2, "0")}:${arriveByDate.getMinutes().toString().padStart(2, "0")}`;
    }

    return {
      connected: true,
      firstMeetingTime: firstMeeting?.startTime || null,
      firstMeetingTitle: firstMeeting?.title || null,
      eventsToday: events.filter((e) => !e.isAllDay).length,
      mustArriveBy,
      source: "google",
    };
  } catch {
    return empty;
  }
}

async function fetchTodayEvents(
  accessToken: string,
  calendarId: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set("timeMin", startOfDay.toISOString());
  url.searchParams.set("timeMax", endOfDay.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");

  const res = await resilientFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    label: "google-calendar-events",
  });

  if (!res.ok) return [];

  const data = await res.json();
  const items = data.items || [];

  return items.map(
    (item: {
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
    }) => ({
      title: item.summary || "Untitled",
      startTime: new Date(item.start?.dateTime || item.start?.date || ""),
      endTime: new Date(item.end?.dateTime || item.end?.date || ""),
      location: item.location,
      isAllDay: !item.start?.dateTime,
    })
  );
}

async function refreshGoogleToken(
  refreshToken: string | null,
  userId: string
): Promise<string | null> {
  if (!refreshToken) return null;

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await resilientFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      label: "google-token-refresh",
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;

    // Update stored token
    await db
      .update(calendarConnections)
      .set({
        accessToken: newAccessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      })
      .where(eq(calendarConnections.userId, userId));

    return newAccessToken;
  } catch {
    return null;
  }
}

import { test, expect } from "@playwright/test";

/**
 * E2E tests for the commute dashboard.
 *
 * Test strategy:
 * - Public pages: tested directly (no auth needed)
 * - Protected pages: tested via redirect behavior (verify auth wall works)
 * - API endpoints: tested for correct 401 on unauthenticated requests
 *
 * For authenticated E2E testing against production:
 * 1. Create a test GitHub account
 * 2. Add it to ALLOWED_GITHUB_USERS
 * 3. Set E2E_BASE_URL=https://your-app.vercel.app
 * 4. Use Playwright's storageState to persist a login session
 *
 * See tests/e2e/README.md for full setup instructions.
 */

test.describe("Public pages", () => {
  test("sign-in page renders correctly", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.locator("text=Commute Dashboard")).toBeVisible();
    await expect(page.locator("text=Sign in with GitHub")).toBeVisible();
    await expect(page.locator("text=Access is restricted")).toBeVisible();
  });

  test("offline page renders", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("text=You're Offline")).toBeVisible();
    await expect(page.locator("text=Check your internet connection")).toBeVisible();
  });

  test("auth error page renders", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.locator("text=Access Denied")).toBeVisible();
    await expect(page.locator("text=Try Again")).toBeVisible();
  });
});

test.describe("Auth wall (protected pages redirect)", () => {
  test("dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("checkin redirects to sign-in", async ({ page }) => {
    await page.goto("/checkin");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("history redirects to sign-in", async ({ page }) => {
    await page.goto("/history");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("settings redirects to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("widget redirects to sign-in", async ({ page }) => {
    await page.goto("/widget");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });
});

test.describe("API auth enforcement", () => {
  test("widget API returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/widget");
    expect(res.status()).toBe(401);
  });

  test("checkin sync returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/checkin/sync", {
      data: { type: "start_session", payload: { direction: "outbound" } },
    });
    expect(res.status()).toBe(401);
  });

  test("push subscribe returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/push/subscribe", {
      data: { endpoint: "test", keys: { p256dh: "a", auth: "b" } },
    });
    expect(res.status()).toBe(401);
  });

  test("calendar disconnect returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/calendar/disconnect");
    expect(res.status()).toBe(401);
  });

  test("cron endpoint accessible without auth (secured via CRON_SECRET in prod)", async ({
    request,
  }) => {
    const res = await request.get("/api/cron");
    // Without CRON_SECRET env var, endpoint is open (by design for dev)
    // Will likely 500 without DB, but should not 401
    expect([200, 429, 500]).toContain(res.status());
  });
});

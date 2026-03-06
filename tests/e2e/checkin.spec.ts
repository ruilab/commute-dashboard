import { test, expect } from "@playwright/test";

/**
 * E2E tests for the check-in flow.
 *
 * NOTE: These tests require:
 * 1. A running dev server with a real/test database
 * 2. An authenticated session (bypassed in test env or via test cookie)
 *
 * For CI, these would need a test database and auth bypass.
 * For local dev, ensure you're signed in before running.
 */

test.describe("Check-in Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to check-in page
    // In a real setup, we'd set an auth cookie here
    await page.goto("/checkin");
  });

  test("displays start buttons when no active session", async ({ page }) => {
    // Should show "To Office" and "To Home" buttons (or sign-in redirect)
    const pageContent = await page.textContent("body");

    // Either we see the checkin UI or we get redirected to sign-in
    const isSignIn = pageContent?.includes("Sign in");
    const isCheckin =
      pageContent?.includes("To Office") ||
      pageContent?.includes("No active commute");

    expect(isSignIn || isCheckin).toBeTruthy();
  });

  test("sign-in page renders correctly", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.locator("text=Commute Dashboard")).toBeVisible();
    await expect(page.locator("text=Sign in with GitHub")).toBeVisible();
    await expect(page.locator("text=Access is restricted")).toBeVisible();
  });

  test("widget page loads or redirects", async ({ page }) => {
    await page.goto("/widget");
    const content = await page.textContent("body");
    // Either shows recommendation or redirects to sign-in
    const hasContent =
      content?.includes("Leave") ||
      content?.includes("Sign in") ||
      content?.includes("Unable to load");
    expect(hasContent).toBeTruthy();
  });

  test("offline page renders", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("text=You're Offline")).toBeVisible();
    await expect(
      page.locator("text=Check your internet connection")
    ).toBeVisible();
  });

  test("auth error page renders", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.locator("text=Access Denied")).toBeVisible();
    await expect(page.locator("text=Try Again")).toBeVisible();
  });

  test("API widget endpoint returns JSON or 401", async ({ request }) => {
    const response = await request.get("/api/widget");
    // Without auth, should be 401
    expect([200, 401]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("bestBand");
      expect(data).toHaveProperty("confidence");
      expect(data).toHaveProperty("generatedAt");
    }
  });

  test("API cron endpoint returns JSON or 401", async ({ request }) => {
    const response = await request.get("/api/cron");
    // Without CRON_SECRET, should succeed (no secret = open)
    // or 429 if rate limited
    expect([200, 401, 429]).toContain(response.status());
  });

  test("checkin sync rejects invalid payload", async ({ request }) => {
    const response = await request.post("/api/checkin/sync", {
      data: { type: "invalid" },
    });
    // Without auth → 401, with auth → 400
    expect([400, 401]).toContain(response.status());
  });
});

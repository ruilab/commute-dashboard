import { test, expect } from "@playwright/test";

/**
 * Onboarding flow E2E tests.
 * Tests redirect behavior and page rendering.
 * Authenticated flow testing requires a logged-in session.
 */

test.describe("Onboarding redirect", () => {
  test("dashboard redirects unauthenticated to sign-in (not onboarding)", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("onboarding page redirects unauthenticated to sign-in", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("onboarding reset param accepted", async ({ page }) => {
    // Without auth, still redirects to sign-in regardless of reset param
    await page.goto("/onboarding?reset=1");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });
});

test.describe("Onboarding page access", () => {
  test("sign-in page renders before onboarding", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.locator("text=Commute Dashboard")).toBeVisible();
  });
});

test.describe("Feature request API", () => {
  test("POST returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/feature-request", {
      data: { title: "Test", description: "Test feature request" },
      maxRedirects: 0,
    });
    expect([307, 401]).toContain(res.status());
  });

  test("GET returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/feature-request", { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
  });
});

import { test, expect } from "@playwright/test";

test.describe("Changelog", () => {
  test("changelog page redirects unauthenticated to sign-in", async ({ page }) => {
    await page.goto("/changelog");
    await page.waitForURL(/\/auth\/signin/);
    expect(page.url()).toContain("/auth/signin");
  });

  test("changelog API returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/changelog", { maxRedirects: 0 });
    expect([307, 401]).toContain(res.status());
  });

  test("changelog API publish requires CRON_SECRET", async ({ request }) => {
    const res = await request.post("/api/changelog", {
      data: { version: "3.0.0", title: "Test", content: "Test" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(401);
  });
});

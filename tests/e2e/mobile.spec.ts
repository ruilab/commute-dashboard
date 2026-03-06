import { test, expect, devices } from "@playwright/test";

/**
 * Mobile viewport tests — verify phone-first UX on key pages.
 * Uses iPhone 14 viewport (390×844).
 */

test.use({ ...devices["iPhone 14"] });

test.describe("Mobile UX — public pages", () => {
  test("sign-in page fits mobile viewport", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.locator("text=Commute Dashboard")).toBeVisible();

    // Button should be tappable (min 44px height)
    const button = page.locator("text=Sign in with GitHub");
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("offline page fits mobile viewport", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("text=You're Offline")).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("auth error page fits mobile viewport", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.locator("text=Access Denied")).toBeVisible();

    const link = page.locator("text=Try Again");
    const box = await link.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Mobile UX — auth wall", () => {
  test("redirects preserve mobile layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/auth\/signin/);

    // Sign-in page should still be mobile-friendly after redirect
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});

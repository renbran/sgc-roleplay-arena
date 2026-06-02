import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const PASSWORD = "SGC2025";
const AUTH_KEY = "sgc-roleplay-auth-v2";
const NAME_KEY = "sgc-roleplay-username-v2";
const SCORES_KEY = "sgc-roleplay-scores-v2";

test.describe("Cache removal — auth v2 key enforcement", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    // Clear ALL localStorage so each test starts clean
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("fresh visit shows login gate, not dashboard", async ({ page }) => {
    await expect(page.getByText("SGC TECH Roleplay Arena")).toBeVisible();
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
    // Dashboard should NOT be visible
    await expect(page.getByText("Start Roleplay").first()).not.toBeVisible();
  });

  test("old v1 auth key does NOT grant access", async ({ page }) => {
    // Simulate a user who had the old key set
    await page.evaluate(() => {
      localStorage.setItem("sgc-roleplay-auth", "true");
      localStorage.setItem("sgc-roleplay-username", "OldUser");
    });
    await page.reload();
    // Should still show login gate because v1 key is ignored
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  });

  test("correct password advances to name step", async ({ page }) => {
    await page.fill('[placeholder="Enter password"]', PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page.getByPlaceholder("Your full name")).toBeVisible();
    await expect(page.getByText("One more step")).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.fill('[placeholder="Enter password"]', "wrongpass");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Invalid password")).toBeVisible();
    // Still on password step
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  });

  test("blank name shows error on name step", async ({ page }) => {
    await page.fill('[placeholder="Enter password"]', PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForSelector('[placeholder="Your full name"]');
    await page.click('button:has-text("Enter Arena")');
    await expect(page.getByText("Please enter your name")).toBeVisible();
  });

  test("full login flow: password → name → dashboard", async ({ page }) => {
    // Step 1: enter password
    await page.fill('[placeholder="Enter password"]', PASSWORD);
    await page.keyboard.press("Enter");

    // Step 2: enter name
    await page.waitForSelector('[placeholder="Your full name"]');
    await page.fill('[placeholder="Your full name"]', "Test Rep");
    await page.keyboard.press("Enter");

    // Step 3: should be on dashboard
    await expect(page.getByRole("button", { name: /Start Roleplay/i }).first()).toBeVisible({ timeout: 5000 });

    // v2 keys should be set in localStorage
    const authVal = await page.evaluate(() => localStorage.getItem("sgc-roleplay-auth-v2"));
    const nameVal = await page.evaluate(() => localStorage.getItem("sgc-roleplay-username-v2"));
    expect(authVal).toBe("true");
    expect(nameVal).toBe("Test Rep");
  });

  test("name appears in header after login", async ({ page }) => {
    await page.fill('[placeholder="Enter password"]', PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForSelector('[placeholder="Your full name"]');
    await page.fill('[placeholder="Your full name"]', "Jane Doe");
    await page.keyboard.press("Enter");

    // Name should be visible in the header (desktop viewport)
    await page.waitForTimeout(500);
    await expect(page.locator("header").getByText("Jane Doe")).toBeVisible();
  });

  test("returning user with v2 keys skips login entirely", async ({ page }) => {
    // Pre-seed the v2 keys
    await page.evaluate(() => {
      localStorage.setItem("sgc-roleplay-auth-v2", "true");
      localStorage.setItem("sgc-roleplay-username-v2", "Returning Rep");
    });
    await page.reload();

    // Should land directly on dashboard
    await expect(page.getByRole("button", { name: /Start Roleplay/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("header").getByText("Returning Rep")).toBeVisible();
  });

  test("authenticated user with no name sees name registration screen", async ({ page }) => {
    // Simulate someone who authenticated but has no name (pre-feature migration)
    await page.evaluate(() => {
      localStorage.setItem("sgc-roleplay-auth-v2", "true");
      // No username key set
    });
    await page.reload();

    // Should see the name registration screen, not the dashboard
    await expect(page.getByPlaceholder("Your full name")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Welcome to the Arena")).toBeVisible();
  });
});

test.describe("Score recording", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    // Pre-authenticate with name to skip auth flow
    await page.evaluate(() => {
      localStorage.setItem("sgc-roleplay-auth-v2", "true");
      localStorage.setItem("sgc-roleplay-username-v2", "Score Tester");
    });
    await page.reload();
    await page.waitForSelector('button:has-text("Start Roleplay")', { timeout: 5000 });
  });

  test("score history view shows empty state initially", async ({ page }) => {
    await page.click('button:has-text("History")');
    await expect(page.getByText("No scores recorded yet")).toBeVisible();
  });

  test("scores key uses v2 namespace", async ({ page }) => {
    // Inject a fake score record to verify key
    await page.evaluate((key) => {
      const fake = [{
        id: "test-1", userName: "Score Tester", personaId: "p1_faisal",
        personaName: "Faisal Al Marri", date: new Date().toISOString(),
        duration: 120, rapport: 75, discovery: 60, objectionHandling: 55,
        closing: 80, overall: 68, grade: "C", outcome: "partial",
        summary: "Good effort but discovery was shallow."
      }];
      localStorage.setItem(key, JSON.stringify(fake));
    }, SCORES_KEY);
    await page.reload();
    await page.waitForSelector('button:has-text("History")', { timeout: 5000 });
    await page.click('button:has-text("History")');

    await expect(page.getByRole("main").getByText("Score Tester")).toBeVisible();
    await expect(page.getByText("Faisal Al Marri")).toBeVisible();
    await expect(page.getByText("Good effort but discovery was shallow.")).toBeVisible();
  });
});

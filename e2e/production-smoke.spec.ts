import { test, expect } from "@playwright/test";

const BASE = "https://roleplay-arena-psi.vercel.app";
const PASSWORD = "SGCTECH2025";

test.describe("Production smoke tests", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText("SGC TECH Roleplay Arena")).toBeVisible({ timeout: 10000 });
  });

  test("can authenticate with password", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    const passwordInput = page.getByPlaceholder("Enter password");
    await passwordInput.fill(PASSWORD);
    await page.getByRole("button", { name: "Enter" }).click();
    
    // Should see name step or dashboard
    await expect(page.getByText(/Name|Start Roleplay/)).toBeVisible({ timeout: 8000 });
  });

  test("can see persona selection after login", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate((pwd) => {
      localStorage.setItem("sgc-roleplay-auth-v2", "true");
      localStorage.setItem("sgc-roleplay-username-v2", "Test User");
    }, PASSWORD);
    await page.reload();
    
    await page.click('button:has-text("Start Roleplay")');
    await expect(page.getByText("Choose Your Persona")).toBeVisible({ timeout: 8000 });
    
    // Check personas are loaded
    await expect(page.getByText("Faisal Al Marri")).toBeVisible();
    await expect(page.getByText("Noura Al Suwaidi")).toBeVisible();
  });

  test("API endpoints are accessible", async ({ page, request }) => {
    // Test personas API
    const personasRes = await request.get(`${BASE}/api/personas`);
    expect(personasRes.ok()).toBeTruthy();
    const personas = await personasRes.json();
    expect(personas.length).toBeGreaterThan(0);
  });
});

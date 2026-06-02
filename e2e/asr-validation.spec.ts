import { test, expect } from "@playwright/test";

const BASE = "https://roleplay-arena-psi.vercel.app";
const PASSWORD = "SGCTECH2025";

test.describe("ASR Service Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    // Set auth and name to bypass login
    await page.evaluate(() => {
      localStorage.setItem("sgc-roleplay-auth-v2", "true");
      localStorage.setItem("sgc-roleplay-username-v2", "E2E Tester");
    });
    await page.reload();
  });

  test("ASR endpoint responds without 504 errors", async ({ request }) => {
    // Create a small audio blob (silence)
    const audioBlob = Buffer.from(new Array(1000).fill(0));
    const base64Audio = audioBlob.toString('base64');
    
    const response = await request.post(`${BASE}/api/roleplay/asr`, {
      data: { audio: base64Audio },
      timeout: 35000, // Should complete within 30s function timeout
    });
    
    // Should NOT be 504 timeout
    expect(response.status()).not.toBe(504);
    
    // Should return JSON response (even if transcription fails, should get structured error)
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test("TTS endpoint is functional", async ({ request }) => {
    const response = await request.post(`${BASE}/api/roleplay/tts`, {
      data: {
        text: "Hello, this is a test",
        voiceId: "aura-asteria-en"
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.audioUrl).toBeTruthy();
  });

  test("homepage shows roleplay interface", async ({ page }) => {
    await expect(page.getByText("Start Roleplay")).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to persona selection", async ({ page }) => {
    await page.click('button:has-text("Start Roleplay")');
    await expect(page.getByText("Choose Your Persona")).toBeVisible({ timeout: 8000 });
    
    // All personas visible
    await expect(page.getByText("Faisal Al Marri")).toBeVisible();
    await expect(page.getByText("Noura Al Suwaidi")).toBeVisible();
    await expect(page.getByText("Omar Al Rashidi")).toBeVisible();
  });

  test("admin dashboard is accessible", async ({ request }) => {
    const response = await request.get(`${BASE}/admin`);
    expect(response.ok()).toBeTruthy();
  });
});

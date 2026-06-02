import { test, expect } from "@playwright/test";

const PROD_URL = "https://roleplay-arena-psi.vercel.app";
const BASE = process.env.BASE_URL || PROD_URL;

test.describe("ASR Service Validation", () => {
  test("ASR endpoint responds without 504 errors", async ({ request }) => {
    // Generate base64 test audio (small WebM file header)
    const testAudioBase64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8AAWPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8AAWPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8BAOfBB+mA";
    
    const response = await request.post(`${BASE}/api/roleplay/asr`, {
      data: { audio: testAudioBase64 },
      timeout: 35000,
    });

    console.log(`ASR Response Status: ${response.status()}`);
    
    if (!response.ok()) {
      const errorText = await response.text();
      console.log(`ASR Error: ${errorText}`);
    }
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("success");
    expect(data).toHaveProperty("text");
  });

  test("TTS endpoint is functional", async ({ request }) => {
    const response = await request.post(`${BASE}/api/roleplay/tts`, {
      data: {
        text: "Hello, this is a test",
        voiceId: "aura-asteria-en"
      },
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Verify we received audio data, not JSON error
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("audio/wav");
    
    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(1000); // Should have meaningful audio data
    console.log(`TTS Response: ${buffer.length} bytes of WAV audio`);
  });

  test("homepage shows roleplay interface", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("text=SGC Tech AI Roleplay Arena")).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to persona selection", async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[type="password"]', "SGCTECH2025");
    await page.click('button:has-text("Submit")');
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
  });

  test("admin dashboard is accessible", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.locator("text=Admin Dashboard")).toBeVisible({ timeout: 10000 });
  });
});

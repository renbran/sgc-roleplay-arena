# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: asr-validation.spec.ts >> ASR Service Validation >> can navigate to persona selection
- Location: e2e\asr-validation.spec.ts:53:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Submit")')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "SGC TECH" [ref=e9]
      - generic [ref=e10]: SGC TECH Roleplay Arena
      - generic [ref=e11]: Enter your access password to continue
    - generic [ref=e12]:
      - generic [ref=e14]:
        - img [ref=e15]
        - textbox "Enter password" [active] [ref=e18]: SGCTECH2025
        - button [ref=e19]:
          - img [ref=e20]
      - button "Access Arena" [ref=e23]:
        - img
        - text: Access Arena
    - paragraph [ref=e25]:
      - img [ref=e26]
      - text: Secured access — authorized personnel only
  - region "Notifications (F8)":
    - list
  - alert [ref=e29]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const PROD_URL = "https://roleplay-arena-psi.vercel.app";
  4  | const BASE = process.env.BASE_URL || PROD_URL;
  5  | 
  6  | test.describe("ASR Service Validation", () => {
  7  |   test("ASR endpoint responds without 504 errors", async ({ request }) => {
  8  |     // Generate base64 test audio (small WebM file header)
  9  |     const testAudioBase64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8AAWPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8AAWPFhQGTgQRCh4EEQoWBAhhTgGcB//////////8BAOfBB+mA";
  10 |     
  11 |     const response = await request.post(`${BASE}/api/roleplay/asr`, {
  12 |       data: { audio: testAudioBase64 },
  13 |       timeout: 35000,
  14 |     });
  15 | 
  16 |     console.log(`ASR Response Status: ${response.status()}`);
  17 |     
  18 |     if (!response.ok()) {
  19 |       const errorText = await response.text();
  20 |       console.log(`ASR Error: ${errorText}`);
  21 |     }
  22 |     
  23 |     expect(response.ok()).toBeTruthy();
  24 |     const data = await response.json();
  25 |     expect(data).toHaveProperty("success");
  26 |     expect(data).toHaveProperty("text");
  27 |   });
  28 | 
  29 |   test("TTS endpoint is functional", async ({ request }) => {
  30 |     const response = await request.post(`${BASE}/api/roleplay/tts`, {
  31 |       data: {
  32 |         text: "Hello, this is a test",
  33 |         voiceId: "aura-asteria-en"
  34 |       },
  35 |     });
  36 |     
  37 |     expect(response.ok()).toBeTruthy();
  38 |     
  39 |     // Verify we received audio data, not JSON error
  40 |     const contentType = response.headers()["content-type"];
  41 |     expect(contentType).toContain("audio/wav");
  42 |     
  43 |     const buffer = await response.body();
  44 |     expect(buffer.length).toBeGreaterThan(1000); // Should have meaningful audio data
  45 |     console.log(`TTS Response: ${buffer.length} bytes of WAV audio`);
  46 |   });
  47 | 
  48 |   test("homepage shows roleplay interface", async ({ page }) => {
  49 |     await page.goto(BASE);
  50 |     await expect(page.locator("text=SGC Tech AI Roleplay Arena")).toBeVisible({ timeout: 10000 });
  51 |   });
  52 | 
  53 |   test("can navigate to persona selection", async ({ page }) => {
  54 |     await page.goto(BASE);
  55 |     await page.fill('input[type="password"]', "SGCTECH2025");
> 56 |     await page.click('button:has-text("Submit")');
     |                ^ Error: page.click: Test timeout of 60000ms exceeded.
  57 |     await page.waitForTimeout(1000);
  58 |     await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
  59 |   });
  60 | 
  61 |   test("admin dashboard is accessible", async ({ page }) => {
  62 |     await page.goto(`${BASE}/admin`);
  63 |     await expect(page.locator("text=Admin Dashboard")).toBeVisible({ timeout: 10000 });
  64 |   });
  65 | });
  66 | 
```
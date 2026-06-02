# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: asr-validation.spec.ts >> ASR Service Validation >> TTS endpoint is functional
- Location: e2e\asr-validation.spec.ts:35:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - img "SGC TECH" [ref=e6]
          - generic [ref=e7]:
            - heading "SGC TECH" [level=1] [ref=e8]
            - text: Roleplay Arena
        - generic [ref=e9]:
          - button "Start" [ref=e10]:
            - img
            - text: Start
          - button "History" [ref=e11]:
            - img
            - text: History
          - generic [ref=e12]: E2E Tester
          - button "Exit" [ref=e13]:
            - img
            - text: Exit
    - main [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e18]:
          - generic [ref=e19]:
            - img "SGC TECH" [ref=e20]
            - generic [ref=e21]:
              - generic [ref=e22]: AI-Powered
              - generic [ref=e23]: Sales Roleplay Arena
          - heading "SGC TECH Roleplay Arena" [level=1] [ref=e24]
          - paragraph [ref=e25]: Practice your sales pitch against AI-powered buyer personas. Text chat with voice playback or immersive voice calls.
          - generic [ref=e26]:
            - button "Start Roleplay" [ref=e27]:
              - img
              - text: Start Roleplay
            - button "History" [ref=e28]:
              - img
              - text: History
        - generic [ref=e29]:
          - generic [ref=e32]:
            - img [ref=e33]
            - generic [ref=e38]: "13"
            - generic [ref=e39]: Personas
          - generic [ref=e42]:
            - img [ref=e43]
            - generic [ref=e46]: "0"
            - generic [ref=e47]: Sessions
          - generic [ref=e50]:
            - img [ref=e51]
            - generic [ref=e54]: "0"
            - generic [ref=e55]: Wins
          - generic [ref=e58]:
            - img [ref=e59]
            - generic [ref=e62]: 0%
            - generic [ref=e63]: Win Rate
        - generic [ref=e64]:
          - generic [ref=e65]:
            - heading "Quick Start" [level=2] [ref=e66]
            - button "View All" [ref=e67]:
              - text: View All
              - img
          - generic [ref=e68]:
            - generic [ref=e70] [cursor=pointer]:
              - generic [ref=e72]:
                - generic [ref=e73]:
                  - img "Faisal Al Marri" [ref=e75]
                  - generic [ref=e76]:
                    - generic [ref=e77]: Faisal Al Marri
                    - generic [ref=e78]: Managing Director
                - generic [ref=e80]: Intermediate
              - generic [ref=e82]:
                - generic [ref=e83]:
                  - img [ref=e84]
                  - text: Al Marri Properties LLC
                - generic [ref=e88]:
                  - generic [ref=e89]: Family Business
                  - generic [ref=e90]: Real Estate
                  - generic [ref=e91]: UAE Corporate Tax
              - generic [ref=e93]:
                - generic [ref=e94]: “Hello, Faisal speaking.”
                - img [ref=e95]
            - generic [ref=e98] [cursor=pointer]:
              - generic [ref=e100]:
                - generic [ref=e101]:
                  - img "Noura Al Suwaidi" [ref=e103]
                  - generic [ref=e104]:
                    - generic [ref=e105]: Noura Al Suwaidi
                    - generic [ref=e106]: COO
                - generic [ref=e108]: Advanced
              - generic [ref=e110]:
                - generic [ref=e111]:
                  - img [ref=e112]
                  - text: SkyPark Property Management
                - generic [ref=e116]:
                  - generic [ref=e117]: Property Management
                  - generic [ref=e118]: UAE Corporate Tax
                  - generic [ref=e119]: Odoo ERP
              - generic [ref=e121]:
                - generic [ref=e122]: “Hello, Noura speaking. I have a few minutes, please go ahead.”
                - img [ref=e123]
            - generic [ref=e126] [cursor=pointer]:
              - generic [ref=e128]:
                - generic [ref=e129]:
                  - img "Omar Al Rashidi" [ref=e131]
                  - generic [ref=e132]:
                    - generic [ref=e133]: Omar Al Rashidi
                    - generic [ref=e134]: Managing Director
                - generic [ref=e136]: Advanced
              - generic [ref=e138]:
                - generic [ref=e139]:
                  - img [ref=e140]
                  - text: Al Rashidi Developments
                - generic [ref=e144]:
                  - generic [ref=e145]: Property Developer
                  - generic [ref=e146]: Project Costing
                  - generic [ref=e147]: Odoo ERP
              - generic [ref=e149]:
                - generic [ref=e150]: “Omar speaking. Make it quick — I'm heading into a meeting.”
                - img [ref=e151]
        - generic [ref=e153]:
          - heading "How It Works" [level=2] [ref=e154]
          - generic [ref=e155]:
            - generic [ref=e158]:
              - img [ref=e160]
              - generic [ref=e165]: Step 1
              - generic [ref=e166]: Choose
              - generic [ref=e167]: Pick a buyer persona
            - generic [ref=e170]:
              - img [ref=e172]
              - generic [ref=e174]: Step 2
              - generic [ref=e175]: Start
              - generic [ref=e176]: Text chat or voice call
            - generic [ref=e179]:
              - img [ref=e181]
              - generic [ref=e183]: Step 3
              - generic [ref=e184]: Navigate
              - generic [ref=e185]: Handle real objections
            - generic [ref=e188]:
              - img [ref=e190]
              - generic [ref=e193]: Step 4
              - generic [ref=e194]: Improve
              - generic [ref=e195]: Track your performance
        - generic [ref=e197]:
          - generic [ref=e199]:
            - generic [ref=e200]:
              - img [ref=e201]
              - generic [ref=e203]: Pro Tips
            - button [ref=e204]:
              - img
          - list [ref=e206]:
            - listitem [ref=e207]:
              - img [ref=e208]
              - text: Listen to the persona's tone before pitching
            - listitem [ref=e211]:
              - img [ref=e212]
              - text: Ask open-ended questions to uncover pain points
            - listitem [ref=e215]:
              - img [ref=e216]
              - text: Gatekeepers need a different approach — be specific
    - contentinfo [ref=e219]:
      - generic [ref=e220]:
        - generic [ref=e221]:
          - img "SGC TECH" [ref=e222]
          - generic [ref=e223]: SGC TECH AI · Sales Roleplay Arena
        - generic [ref=e224]: v1.0
  - region "Notifications (F8)":
    - list
  - alert [ref=e225]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const BASE = "https://roleplay-arena-psi.vercel.app";
  4  | const PASSWORD = "SGCTECH2025";
  5  | 
  6  | test.describe("ASR Service Validation", () => {
  7  |   test.beforeEach(async ({ page }) => {
  8  |     await page.goto(BASE);
  9  |     // Set auth and name to bypass login
  10 |     await page.evaluate(() => {
  11 |       localStorage.setItem("sgc-roleplay-auth-v2", "true");
  12 |       localStorage.setItem("sgc-roleplay-username-v2", "E2E Tester");
  13 |     });
  14 |     await page.reload();
  15 |   });
  16 | 
  17 |   test("ASR endpoint responds without 504 errors", async ({ request }) => {
  18 |     // Create a small audio blob (silence)
  19 |     const audioBlob = Buffer.from(new Array(1000).fill(0));
  20 |     const base64Audio = audioBlob.toString('base64');
  21 |     
  22 |     const response = await request.post(`${BASE}/api/roleplay/asr`, {
  23 |       data: { audio: base64Audio },
  24 |       timeout: 35000, // Should complete within 30s function timeout
  25 |     });
  26 |     
  27 |     // Should NOT be 504 timeout
  28 |     expect(response.status()).not.toBe(504);
  29 |     
  30 |     // Should return JSON response (even if transcription fails, should get structured error)
  31 |     const contentType = response.headers()['content-type'];
  32 |     expect(contentType).toContain('application/json');
  33 |   });
  34 | 
  35 |   test("TTS endpoint is functional", async ({ request }) => {
  36 |     const response = await request.post(`${BASE}/api/roleplay/tts`, {
  37 |       data: {
  38 |         text: "Hello, this is a test",
  39 |         voiceId: "aura-asteria-en"
  40 |       },
  41 |     });
  42 |     
> 43 |     expect(response.ok()).toBeTruthy();
     |                           ^ Error: expect(received).toBeTruthy()
  44 |     const data = await response.json();
  45 |     expect(data.audioUrl).toBeTruthy();
  46 |   });
  47 | 
  48 |   test("homepage shows roleplay interface", async ({ page }) => {
  49 |     await expect(page.getByText("Start Roleplay")).toBeVisible({ timeout: 5000 });
  50 |   });
  51 | 
  52 |   test("can navigate to persona selection", async ({ page }) => {
  53 |     await page.click('button:has-text("Start Roleplay")');
  54 |     await expect(page.getByText("Choose Your Persona")).toBeVisible({ timeout: 8000 });
  55 |     
  56 |     // All personas visible
  57 |     await expect(page.getByText("Faisal Al Marri")).toBeVisible();
  58 |     await expect(page.getByText("Noura Al Suwaidi")).toBeVisible();
  59 |     await expect(page.getByText("Omar Al Rashidi")).toBeVisible();
  60 |   });
  61 | 
  62 |   test("admin dashboard is accessible", async ({ request }) => {
  63 |     const response = await request.get(`${BASE}/admin`);
  64 |     expect(response.ok()).toBeTruthy();
  65 |   });
  66 | });
  67 | 
```
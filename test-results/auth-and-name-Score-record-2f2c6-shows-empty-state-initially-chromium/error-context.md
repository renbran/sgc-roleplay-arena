# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-and-name.spec.ts >> Score recording >> score history view shows empty state initially
- Location: e2e\auth-and-name.spec.ts:130:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Start Roleplay")') to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]: Cannot GET /
```

# Test source

```ts
  27  |       localStorage.setItem("sgc-roleplay-auth", "true");
  28  |       localStorage.setItem("sgc-roleplay-username", "OldUser");
  29  |     });
  30  |     await page.reload();
  31  |     // Should still show login gate because v1 key is ignored
  32  |     await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  33  |   });
  34  | 
  35  |   test("correct password advances to name step", async ({ page }) => {
  36  |     await page.fill('[placeholder="Enter password"]', PASSWORD);
  37  |     await page.keyboard.press("Enter");
  38  |     await expect(page.getByPlaceholder("Your full name")).toBeVisible();
  39  |     await expect(page.getByText("One more step")).toBeVisible();
  40  |   });
  41  | 
  42  |   test("wrong password shows error", async ({ page }) => {
  43  |     await page.fill('[placeholder="Enter password"]', "wrongpass");
  44  |     await page.keyboard.press("Enter");
  45  |     await expect(page.getByText("Invalid password")).toBeVisible();
  46  |     // Still on password step
  47  |     await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  48  |   });
  49  | 
  50  |   test("blank name shows error on name step", async ({ page }) => {
  51  |     await page.fill('[placeholder="Enter password"]', PASSWORD);
  52  |     await page.keyboard.press("Enter");
  53  |     await page.waitForSelector('[placeholder="Your full name"]');
  54  |     await page.click('button:has-text("Enter Arena")');
  55  |     await expect(page.getByText("Please enter your name")).toBeVisible();
  56  |   });
  57  | 
  58  |   test("full login flow: password → name → dashboard", async ({ page }) => {
  59  |     // Step 1: enter password
  60  |     await page.fill('[placeholder="Enter password"]', PASSWORD);
  61  |     await page.keyboard.press("Enter");
  62  | 
  63  |     // Step 2: enter name
  64  |     await page.waitForSelector('[placeholder="Your full name"]');
  65  |     await page.fill('[placeholder="Your full name"]', "Test Rep");
  66  |     await page.keyboard.press("Enter");
  67  | 
  68  |     // Step 3: should be on dashboard
  69  |     await expect(page.getByRole("button", { name: /Start Roleplay/i }).first()).toBeVisible({ timeout: 5000 });
  70  | 
  71  |     // v2 keys should be set in localStorage
  72  |     const authVal = await page.evaluate(() => localStorage.getItem("sgc-roleplay-auth-v2"));
  73  |     const nameVal = await page.evaluate(() => localStorage.getItem("sgc-roleplay-username-v2"));
  74  |     expect(authVal).toBe("true");
  75  |     expect(nameVal).toBe("Test Rep");
  76  |   });
  77  | 
  78  |   test("name appears in header after login", async ({ page }) => {
  79  |     await page.fill('[placeholder="Enter password"]', PASSWORD);
  80  |     await page.keyboard.press("Enter");
  81  |     await page.waitForSelector('[placeholder="Your full name"]');
  82  |     await page.fill('[placeholder="Your full name"]', "Jane Doe");
  83  |     await page.keyboard.press("Enter");
  84  | 
  85  |     // Name should be visible in the header (desktop viewport)
  86  |     await page.waitForTimeout(500);
  87  |     await expect(page.locator("header").getByText("Jane Doe")).toBeVisible();
  88  |   });
  89  | 
  90  |   test("returning user with v2 keys skips login entirely", async ({ page }) => {
  91  |     // Pre-seed the v2 keys
  92  |     await page.evaluate(() => {
  93  |       localStorage.setItem("sgc-roleplay-auth-v2", "true");
  94  |       localStorage.setItem("sgc-roleplay-username-v2", "Returning Rep");
  95  |     });
  96  |     await page.reload();
  97  | 
  98  |     // Should land directly on dashboard
  99  |     await expect(page.getByRole("button", { name: /Start Roleplay/i }).first()).toBeVisible({ timeout: 5000 });
  100 |     await expect(page.locator("header").getByText("Returning Rep")).toBeVisible();
  101 |   });
  102 | 
  103 |   test("authenticated user with no name sees name registration screen", async ({ page }) => {
  104 |     // Simulate someone who authenticated but has no name (pre-feature migration)
  105 |     await page.evaluate(() => {
  106 |       localStorage.setItem("sgc-roleplay-auth-v2", "true");
  107 |       // No username key set
  108 |     });
  109 |     await page.reload();
  110 | 
  111 |     // Should see the name registration screen, not the dashboard
  112 |     await expect(page.getByPlaceholder("Your full name")).toBeVisible({ timeout: 3000 });
  113 |     await expect(page.getByText("Welcome to the Arena")).toBeVisible();
  114 |   });
  115 | });
  116 | 
  117 | test.describe("Score recording", () => {
  118 |   test.beforeEach(async ({ page }) => {
  119 |     await page.goto(BASE);
  120 |     await page.evaluate(() => localStorage.clear());
  121 |     // Pre-authenticate with name to skip auth flow
  122 |     await page.evaluate(() => {
  123 |       localStorage.setItem("sgc-roleplay-auth-v2", "true");
  124 |       localStorage.setItem("sgc-roleplay-username-v2", "Score Tester");
  125 |     });
  126 |     await page.reload();
> 127 |     await page.waitForSelector('button:has-text("Start Roleplay")', { timeout: 5000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  128 |   });
  129 | 
  130 |   test("score history view shows empty state initially", async ({ page }) => {
  131 |     await page.click('button:has-text("History")');
  132 |     await expect(page.getByText("No scores recorded yet")).toBeVisible();
  133 |   });
  134 | 
  135 |   test("scores key uses v2 namespace", async ({ page }) => {
  136 |     // Inject a fake score record to verify key
  137 |     await page.evaluate((key) => {
  138 |       const fake = [{
  139 |         id: "test-1", userName: "Score Tester", personaId: "p1_faisal",
  140 |         personaName: "Faisal Al Marri", date: new Date().toISOString(),
  141 |         duration: 120, rapport: 75, discovery: 60, objectionHandling: 55,
  142 |         closing: 80, overall: 68, grade: "C", outcome: "partial",
  143 |         summary: "Good effort but discovery was shallow."
  144 |       }];
  145 |       localStorage.setItem(key, JSON.stringify(fake));
  146 |     }, SCORES_KEY);
  147 |     await page.reload();
  148 |     await page.waitForSelector('button:has-text("History")', { timeout: 5000 });
  149 |     await page.click('button:has-text("History")');
  150 | 
  151 |     await expect(page.getByRole("main").getByText("Score Tester")).toBeVisible();
  152 |     await expect(page.getByText("Faisal Al Marri")).toBeVisible();
  153 |     await expect(page.getByText("Good effort but discovery was shallow.")).toBeVisible();
  154 |   });
  155 | });
  156 | 
```
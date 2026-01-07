import { test, expect } from "@playwright/test";

test("debug admin login", async ({ page }) => {
  // コンソールログをキャプチャ
  page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.message));

  await page.goto("http://localhost:5173/admin.html");

  // ID/PASS を入力
  await page.fill("#login-userid", "admin");
  await page.fill("#login-pass", "password");

  // ログインボタンをクリック
  await page.click('button[type="submit"]');

  // アラートが出るか待機
  page.on("dialog", async (dialog) => {
    console.log("ALERT MESSAGE:", dialog.message());
    await dialog.dismiss();
  });

  // しばらく待機して変化を観察
  await page.waitForTimeout(5000);

  const loginOverlay = page.locator("#login-overlay");
  const isVisible = await loginOverlay.isVisible();
  console.log("Login Overlay Visible:", isVisible);

  if (isVisible) {
    console.log("Login failed as expected for debugging.");
  } else {
    console.log("Login succeeded!");
  }
});

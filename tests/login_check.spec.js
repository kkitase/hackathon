import { test, expect } from "@playwright/test";

test("admin login with id/pass", async ({ page }) => {
  // 管理画面へアクセス
  await page.goto("http://localhost:5173/admin.html");

  // ログインオーバーレイが表示されるまで待機
  const loginOverlay = page.locator("#login-overlay");
  await expect(loginOverlay).toBeVisible();

  // ID/PASS を入力
  await page.fill("#login-userid", "admin");
  await page.fill("#login-pass", "password");

  // ログインボタンをクリック
  await page.click('button[type="submit"]');

  // ログインオーバーレイが消えることを確認
  await expect(loginOverlay).not.toBeVisible({ timeout: 10000 });

  // ダッシュボードのタイトルが表示されていることを確認
  await expect(page.locator("#page-title")).toContainText("編集");
});

import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 管理画面にアクセス
  await page.goto("http://localhost:5173/admin.html");

  console.log("ブラウザを開きました。ログインしてください...");
  console.log("ログイン完了後、フォームが表示されるまで待機します...");

  // フォームが生成されるまで待つ（最大3分）
  await page.waitForSelector("#field-hero-title", { timeout: 180000 });
  console.log("フォームを検出しました！");

  // ヒーローセクションの入力
  console.log("ヒーローセクションを入力中...");
  await page.fill("#field-hero-title", "サウナハッカソン 2025");
  await page.fill(
    "#field-hero-subtitle",
    "心身を「ととのえる」サウナの力を活かし、革新的なウェルネステックソリューションを開発せよ。"
  );

  // 保存ボタンをクリック
  await page.click("#save-btn");
  await page.waitForTimeout(2000);
  console.log("ヒーローセクション保存完了！");

  // 概要タブに移動
  console.log("概要セクションを入力中...");
  await page.click('[data-target="overview"]');
  await page.waitForSelector("#field-description", { timeout: 10000 });

  // 概要セクションには field-title がない。field-description, field-theme, field-tech のみ
  await page.fill(
    "#field-description",
    "サウナ文化とテクノロジーを融合させ、ウェルネス領域の新たな可能性を追求するハッカソンです。心身の「ととのい」を科学的にサポートするプロダクトを開発します。"
  );
  await page.fill(
    "#field-theme",
    "サウナ × テクノロジー で「ととのい」を科学する"
  );
  await page.fill(
    "#field-tech",
    "IoTセンサー, AI/ML, ウェアラブルデバイス, クラウド"
  );

  await page.click("#save-btn");
  await page.waitForTimeout(2000);
  console.log("概要セクション保存完了！");

  // ソーシャル/OGP タブに移動
  console.log("OGP設定を入力中...");
  await page.click('[data-target="social"]');
  await page.waitForSelector("#field-social-title", { timeout: 10000 });

  await page.fill("#field-social-title", "サウナハッカソン 2025");
  await page.fill(
    "#field-social-desc",
    "心身を「ととのえる」サウナの力を活かし、革新的なウェルネステックソリューションを開発せよ。"
  );

  await page.click("#save-btn");
  await page.waitForTimeout(2000);
  console.log("OGP設定保存完了！");

  // トップページに移動して確認
  console.log("トップページで確認中...");
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(3000);

  console.log("✅ サウナハッカソンのデータ入力が完了しました！");
  console.log("ブラウザで結果を確認してください。5秒後に閉じます...");
  await page.waitForTimeout(5000);
  await browser.close();
})();

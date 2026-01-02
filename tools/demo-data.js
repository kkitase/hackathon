/**
 * Hackathon Builder - デモデータ投入スクリプト
 *
 * 目的:
 * ローカル開発サーバー(npm run dev)上で動作している管理画面を自動操作し、
 * サンプルデータを入力します。手動での入力を省略して動作を確認したい時に使用します。
 *
 * 事前準備:
 * 1. npm run dev を実行して開発サーバーを起動しておく
 * 2. このスクリプトを実行し、ブラウザが開いたらログインを済ませる
 *
 * 実行方法:
 * node tools/demo-data.js
 */

import { chromium } from "@playwright/test";

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

  // 概要セクションの入力
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

  // 検索エンジンに公開を有効にする
  console.log("検索エンジン公開設定を有効化中...");
  await page.check("#field-allow-indexing");

  await page.click("#save-btn");
  await page.waitForTimeout(2000);
  console.log("OGP設定保存完了！");

  // トップページに移動して確認
  console.log("トップページで確認中...");
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(3000);

  console.log("✅ サウナハッカソンのデータ入力が完了しました！");

  // 参加者登録のデモ
  console.log("参加者登録のデモを実行中...");
  await page.click("#register-btn-header");
  await page.waitForSelector("#register-form", { timeout: 10000 });

  await page.fill("#reg-last-name", "田中");
  await page.fill("#reg-first-name", "太郎");
  await page.fill("#reg-email", "tanaka@example.com");
  await page.fill("#reg-company", "サウナテック株式会社");
  await page.fill("#reg-organization", "開発部");
  await page.fill("#reg-role", "エンジニア");
  await page.fill("#reg-motivation", "サウナとAIの融合に興味があります！");
  await page.fill("#reg-team-name", "ととのい隊");
  await page.selectOption("select[name='teamSize']", "3");
  await page.fill(
    "#reg-slide-url",
    "https://docs.google.com/presentation/d/demo"
  );
  await page.check("#consent-yes");

  await page.click("#register-submit-btn");
  await page.waitForSelector(".register-message", { timeout: 10000 });
  console.log("✅ デモ参加者の登録が完了しました！");

  console.log("ブラウザで結果を確認してください。5秒後に閉じます...");
  await page.waitForTimeout(5000);
  await browser.close();
})();

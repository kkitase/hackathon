/**
 * Hackathon Builder - HTML構造最終チェックスクリプト
 *
 * 目的:
 * ブラウザ操作ツール(Playwright)を使用して、index.html の構造が
 * 正しく保たれているか（要素の入れ子エラーなどがないか）を自動点検します。
 *
 * 実行方法:
 * node tools/final_check.cjs
 */

const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    // ブラウザの起動
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // 開発サーバーではなく、プロジェクトルートの index.html を直接読み込む
    const htmlPath = path.resolve(__dirname, "..", "index.html");
    const html = fs.readFileSync(htmlPath, "utf8");
    await page.setContent(html);

    // 1. body直下の主要な部品(タグ)の並び順とIDを抽出
    const children = await page.evaluate(() => {
      return Array.from(document.body.children)
        .map((c) => ({
          tagName: c.tagName,
          id: c.id,
        }))
        .filter((c) => c.tagName !== "SCRIPT" && c.tagName !== "STYLE");
    });

    console.log("--- Body要素の配置順チェック ---");
    console.log(JSON.stringify(children, null, 2));

    // 2. 重要なコンポーネントが「body直下」に存在するか判定（入れ子崩れの防止）

    // ヘッダーの親要素を確認
    const headerParent = await page.evaluate(
      () => document.querySelector("header").parentElement.tagName
    );
    console.log("Headerの親:", headerParent);

    // フッターの親要素を確認
    const footerParent = await page.evaluate(
      () => document.querySelector("footer").parentElement.tagName
    );
    console.log("Footerの親:", footerParent);

    // 参加登録モーダルの親要素を確認
    const modalParent = await page.evaluate(
      () => document.getElementById("register-modal").parentElement.tagName
    );
    console.log("登録モーダルの親:", modalParent);

    // 全てが BODY 直下にあれば合格
    if (
      headerParent === "BODY" &&
      footerParent === "BODY" &&
      modalParent === "BODY"
    ) {
      console.log("\n✅ 成功: DOM構造はフラットで、正しく配置されています。");
    } else {
      console.log("\n❌ 失敗: 要素の入れ子（階層エラー）が検出されました。");
      process.exit(1);
    }

    await browser.close();
  } catch (err) {
    console.error("点検中にエラーが発生しました:", err);
    process.exit(1);
  }
})();

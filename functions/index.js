const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

// デフォルトのヒーローデータ
const defaultHeroData = {
  title: "Hackathon Builder",
  subtitle:
    "Firebase で爆速構築。理想のハッカソンイベントを、今すぐ始めましょう。",
};

// OGP SSR Function (東京リージョン)
exports.ssr = onRequest({ region: "asia-northeast1" }, async (req, res) => {
  try {
    // robots.txt のリクエストを処理 (Hosting 経由 / 直アクセス両対応)
    const normalizedPath = (req.path || req.url || "").split("?")[0];
    if (
      normalizedPath === "/robots.txt" ||
      normalizedPath.endsWith("/robots.txt") ||
      normalizedPath === "/robots_dynamic" ||
      normalizedPath.endsWith("/robots_dynamic")
    ) {
      const ogpSnap = await admin.firestore().doc("config/ogp").get();
      const ogpData = ogpSnap.exists ? ogpSnap.data() : {};
      const allowIndexing = ogpData.allowIndexing === true;

      let robotsTxt;
      if (allowIndexing) {
        robotsTxt = `# Hackathon Builder - robots.txt\n# 検索エンジンに公開: 有効\n\nUser-agent: *\nDisallow: /admin.html\nAllow: /\n`;
      } else {
        robotsTxt = `# Hackathon Builder - robots.txt\n# 検索エンジンに公開: 無効\n\nUser-agent: *\nDisallow: /\n`;
      }

      res.set("Content-Type", "text/plain");
      // robots.txt は即時反映が必要なため、ブラウザキャッシュ無効、CDNキャッシュも最小限にする
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).send(robotsTxt);
    }

    // 1. Firestore から最新の OGP データを取得
    const ogpSnap = await admin.firestore().doc("config/ogp").get();
    const ogpData = ogpSnap.exists
      ? ogpSnap.data()
      : {
          ogTitle: "Hackathon Builder",
          ogDescription:
            "Firebase で爆速構築。理想のハッカソンイベントを、今すぐ始めましょう。",
          ogImage: "",
        };

    // 2. Firestore から最新のコンテンツデータを取得
    const contentSnap = await admin.firestore().doc("config/content").get();
    const contentData = contentSnap.exists ? contentSnap.data() : {};
    const heroData = contentData.hero || defaultHeroData;

    // 3. ビルド済みの HTML テンプレートを読み込む
    let html = fs.readFileSync(path.join(__dirname, "template.html"), "utf-8");

    // 4. メタタグのプレースホルダーを Firestore の値で置換
    html = html
      .replace(/{{OGP_TITLE}}/g, ogpData.ogTitle || "")
      .replace(/{{OGP_DESCRIPTION}}/g, ogpData.ogDescription || "")
      .replace(/{{OGP_IMAGE}}/g, ogpData.ogImage || "");

    // 5. ヒーローセクションのプレースホルダーを置換
    html = html
      .replace(/{{HERO_TITLE}}/g, heroData.title || defaultHeroData.title)
      .replace(
        /{{HERO_SUBTITLE}}/g,
        heroData.subtitle || defaultHeroData.subtitle
      )
      .replace(/{{HERO_CTA}}/g, heroData.ctaText || "");

    // 6. 完成した HTML を返却
    res.set("Cache-Control", "public, max-age=600, s-maxage=1200");
    res.status(200).send(html);
  } catch (error) {
    console.error("SSR Error:", error);
    // エラー時はフォールバックとして元の HTML を返す
    try {
      const fallbackHtml = fs.readFileSync(
        path.join(__dirname, "template.html"),
        "utf-8"
      );
      res.status(200).send(fallbackHtml);
    } catch (fallbackError) {
      res.status(500).send("Internal Server Error");
    }
  }
});

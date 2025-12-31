const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

// デフォルトのヒーローデータ
const defaultHeroData = {
  title: "第3回 AI Agent Hackathon with Google Cloud",
  subtitle:
    "未来を創るAIエージェントの競演。Google Cloudのパワーを使い、次世代のソリューションを開発せよ。",
  notice: "本イベントの申し込み期間は終了しました",
};

// OGP SSR Function
exports.ssr = functions.https.onRequest(async (req, res) => {
  try {
    // 1. Firestore から最新の OGP データを取得
    const ogpSnap = await admin.firestore().doc("config/ogp").get();
    const ogpData = ogpSnap.exists
      ? ogpSnap.data()
      : {
          ogTitle: "第3回 AI Agent Hackathon with Google Cloud",
          ogDescription:
            "未来を創るAIエージェントの競演。Google Cloudのパワーを使い、次世代のソリューションを開発せよ。",
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
      .replace(/{{HERO_NOTICE}}/g, heroData.notice || defaultHeroData.notice);

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

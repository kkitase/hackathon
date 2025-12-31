import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

// OGP 設定ファイルを読み込んでプレースホルダーを置換するプラグイン
const ogpPlugin = () => {
  return {
    name: "vite-plugin-ogp",
    transformIndexHtml(html) {
      const configPath = resolve(__dirname, "ogp-config.json");
      // デフォルトは空（Firestore から読み込む）
      let ogpConfig = {
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
      };

      if (existsSync(configPath)) {
        try {
          ogpConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        } catch (e) {
          console.warn(
            "ogp-config.json の読み込みに失敗しました。デフォルト値を使用します。",
            e
          );
        }
      }

      return html
        .replace(/{{OGP_TITLE}}/g, ogpConfig.ogTitle || "")
        .replace(/{{OGP_DESCRIPTION}}/g, ogpConfig.ogDescription || "")
        .replace(/{{OGP_IMAGE}}/g, ogpConfig.ogImage || "")
        .replace(/{{HERO_TITLE}}/g, ogpConfig.ogTitle || "")
        .replace(/{{HERO_SUBTITLE}}/g, ogpConfig.ogDescription || "")
        .replace(/{{HERO_NOTICE}}/g, "");
    },
  };
};

export default defineConfig({
  plugins: [ogpPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
});

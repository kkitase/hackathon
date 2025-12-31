#!/usr/bin/env node
/**
 * Hackathon Launch Kit - セットアップスクリプト
 * Firestore の初期管理者データを対話式で設定します。
 */

import { createInterface } from "readline";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 対話式入力のヘルパー
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

async function main() {
  console.log("\n🚀 Hackathon Launch Kit - セットアップ\n");

  // サービスアカウントキーの確認
  const keyPath = resolve(__dirname, "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.log("⚠️  serviceAccountKey.json が見つかりません。");
    console.log("   以下の手順でダウンロードしてください:\n");
    console.log(
      "   1. Firebase Console → プロジェクト設定 → サービスアカウント"
    );
    console.log("   2. 「新しい秘密鍵の生成」をクリック");
    console.log(
      "   3. ダウンロードしたファイルを serviceAccountKey.json としてプロジェクトルートに配置\n"
    );
    rl.close();
    process.exit(1);
  }

  // Firebase Admin 初期化
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
  initializeApp({
    credential: cert(serviceAccount),
  });
  const db = getFirestore();

  console.log("✅ Firebase に接続しました\n");

  // 管理者情報の入力
  console.log("--- 管理者アカウントの設定 ---\n");

  const defaultUser = await question("管理者 ID (例: admin): ");
  const defaultPass = await question("管理者パスワード: ");
  const emailsInput = await question(
    "許可するメールアドレス (カンマ区切り, 例: admin@gmail.com, staff@gmail.com): "
  );

  const authorizedEmails = emailsInput
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  // Firestore に書き込み
  try {
    await db.doc("config/admin").set({
      defaultUser,
      defaultPass,
      authorizedEmails,
      createdAt: new Date().toISOString(),
    });

    console.log("\n✅ 管理者情報を Firestore に保存しました！");
    console.log("\n--- 設定内容 ---");
    console.log(`   ID: ${defaultUser}`);
    console.log(`   許可メール: ${authorizedEmails.join(", ")}`);
    console.log("\n次のステップ:");
    console.log("   npm run build && firebase deploy\n");
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error.message);
  }

  rl.close();
}

main();

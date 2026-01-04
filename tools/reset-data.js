#!/usr/bin/env node
/**
 * Hackathon Builder - データリセットスクリプト
 * コンテンツと参加者データを初期状態にリセットします。
 * 管理者情報 (config/admin) は保持されます。
 */

import { createInterface } from "readline";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
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

// 初期データ（空の状態）
const initialData = {
  hero: {
    title: "",
    subtitle: "",
    ctaText: "",
  },
  overview: {
    title: "",
    description: "",
    theme: "",
    tech: "",
  },
  schedule: [],
  judges: [],
  updates: [],
  prizes: [],
  rules: [],
  projects: [],
  faq: [],
  social: {
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    allowIndexing: false,
  },
  updatedAt: FieldValue.serverTimestamp(),
};

// 初期 OGP データ
const initialOgp = {
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  allowIndexing: false,
  updatedAt: FieldValue.serverTimestamp(),
};

async function deleteCollection(db, collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve, reject);
  });
}

async function deleteQueryBatch(db, query, resolve, reject) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = db.batch();

    for (const doc of snapshot.docs) {
      // サブコレクション（comments）も削除
      const commentsRef = doc.ref.collection("comments");
      const comments = await commentsRef.get();
      comments.docs.forEach((comment) => batch.delete(comment.ref));

      batch.delete(doc.ref);
    }

    await batch.commit();

    // 次のバッチへ
    process.nextTick(() => {
      deleteQueryBatch(db, query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function deleteStorageFolder(bucket, folderPath) {
  try {
    const [files] = await bucket.getFiles({ prefix: folderPath });
    if (files.length === 0) {
      console.log(`   📁 ${folderPath}: ファイルなし`);
      return;
    }

    for (const file of files) {
      await file.delete();
    }
    console.log(`   ✅ ${folderPath}: ${files.length} ファイル削除`);
  } catch (error) {
    console.log(`   ⚠️  ${folderPath}: ${error.message}`);
  }
}

async function main() {
  console.log("\n🔄 Hackathon Builder - データリセット\n");

  // サービスアカウントキーの確認
  const keyPath = resolve(__dirname, "..", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.log("⚠️  serviceAccountKey.json が見つかりません。");
    console.log("   セットアップを完了してから実行してください。\n");
    rl.close();
    process.exit(1);
  }

  // Firebase Admin 初期化
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
  const projectId = serviceAccount.project_id;

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${projectId}.firebasestorage.app`,
  });

  const db = getFirestore();
  const bucket = getStorage().bucket();

  console.log(`📌 プロジェクト: ${projectId}\n`);

  // 削除対象の確認
  console.log("⚠️  以下のデータがリセットされます：");
  console.log("   - config/data（コンテンツデータ）");
  console.log("   - config/content（プリレンダリング HTML）");
  console.log("   - config/ogp（OGP 設定）");
  console.log("   - participants/*（参加者データ・コメント）");
  console.log("   - Storage: ogp/*（OGP 画像）\n");
  console.log("✅ 保持されるデータ：");
  console.log("   - config/admin（管理者情報）\n");

  const confirm = await question('続行するには "reset" と入力してください: ');

  if (confirm.toLowerCase() !== "reset") {
    console.log("\n❌ キャンセルしました。\n");
    rl.close();
    process.exit(0);
  }

  console.log("\n🔄 リセット処理を開始します...\n");

  try {
    // 1. config/data をリセット
    console.log("1/5 config/data をリセット中...");
    await db.doc("config/data").set(initialData);
    console.log("   ✅ 完了");

    // 2. config/content を削除
    console.log("2/5 config/content を削除中...");
    await db.doc("config/content").delete();
    console.log("   ✅ 完了");

    // 3. config/ogp をリセット
    console.log("3/5 config/ogp をリセット中...");
    await db.doc("config/ogp").set(initialOgp);
    console.log("   ✅ 完了");

    // 4. participants コレクションを削除
    console.log("4/5 participants コレクションを削除中...");
    await deleteCollection(db, "participants");
    console.log("   ✅ 完了");

    // 5. Storage の ogp/ フォルダを削除
    console.log("5/5 Storage (ogp/) を削除中...");
    await deleteStorageFolder(bucket, "ogp/");

    console.log("\n✅ データリセットが完了しました！");
    console.log("\n📌 管理者情報 (config/admin) は保持されています。");
    console.log("   管理画面から新しいコンテンツを作成してください。");
    console.log(`\n🔗 管理画面: https://${projectId}.web.app/admin.html\n`);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error.message);
    console.error(error);
  }

  rl.close();
}

main();

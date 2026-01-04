#!/usr/bin/env node
/**
 * Hackathon Builder - プロジェクト完全削除スクリプト
 * Firebase プロジェクトのすべてのデータとサービスを削除します。
 *
 * ⚠️ 警告: この操作は元に戻せません！
 */

import { createInterface } from "readline";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 対話式入力のヘルパー
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

// コマンド実行ヘルパー
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

// Firestore の全コレクションを取得
async function getAllCollections(db) {
  const collections = await db.listCollections();
  return collections.map((col) => col.id);
}

// Firestore コレクション全削除（サブコレクションも含む）
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
      // サブコレクションも再帰的に削除
      const subcollections = await doc.ref.listCollections();
      for (const subcol of subcollections) {
        await deleteCollection(db, `${doc.ref.path}/${subcol.id}`);
      }
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

// Authentication の全ユーザー削除
async function deleteAllUsers(auth) {
  let deletedCount = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);

    if (listResult.users.length === 0) {
      break;
    }

    const uids = listResult.users.map((user) => user.uid);
    await auth.deleteUsers(uids);
    deletedCount += uids.length;

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  return deletedCount;
}

// Storage 全ファイル削除
async function deleteAllStorageFiles(bucket) {
  try {
    const [files] = await bucket.getFiles();
    if (files.length === 0) {
      console.log("   📁 ファイルなし");
      return 0;
    }

    for (const file of files) {
      await file.delete();
    }
    return files.length;
  } catch (error) {
    console.log(`   ⚠️  Storage エラー: ${error.message}`);
    return 0;
  }
}

// Firebase Hosting サイト削除
async function deleteHostingSite(projectId, projectRoot) {
  try {
    await runCommand(
      "npx",
      ["firebase", "hosting:disable", "--project", projectId, "-f"],
      projectRoot
    );
    return true;
  } catch (error) {
    console.log(`   ⚠️  ${error.message}`);
    return false;
  }
}

// Cloud Functions 削除
async function deleteCloudFunctions(projectId, projectRoot) {
  try {
    // 関数一覧を取得
    const output = await runCommand(
      "npx",
      ["firebase", "functions:list", "--project", projectId, "--json"],
      projectRoot
    );

    let functions = [];
    try {
      const parsed = JSON.parse(output);
      if (parsed.result && Array.isArray(parsed.result)) {
        functions = parsed.result.map((f) => f.id || f.name?.split("/").pop());
      }
    } catch {
      // JSON パースに失敗した場合はスキップ
    }

    if (functions.length === 0) {
      console.log("   📁 関数なし");
      return 0;
    }

    // 関数を削除
    await runCommand(
      "npx",
      [
        "firebase",
        "functions:delete",
        ...functions,
        "--project",
        projectId,
        "-f",
      ],
      projectRoot
    );

    return functions.length;
  } catch (error) {
    console.log(`   ⚠️  ${error.message}`);
    return 0;
  }
}

// Firebase プロジェクト自体を削除 (gcloud を使用)
async function deleteFirebaseProject(projectId, projectRoot) {
  try {
    // gcloud がインストールされているか確認
    await runCommand("gcloud", ["--version"], projectRoot);

    // gcloud でプロジェクトを削除
    await runCommand(
      "gcloud",
      ["projects", "delete", projectId, "--quiet"],
      projectRoot
    );
    return true;
  } catch (error) {
    console.log(`   ⚠️  ${error.message}`);
    console.log(
      "   ℹ️  gcloud CLI がインストールされていないか、権限がありません"
    );
    return false;
  }
}

// ローカルファイル削除
function deleteLocalFile(filePath, description) {
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
      console.log(`   ✅ ${description} を削除`);
      return true;
    } catch (error) {
      console.log(`   ⚠️  ${description}: ${error.message}`);
      return false;
    }
  } else {
    console.log(`   ℹ️  ${description}: 存在しません`);
    return false;
  }
}

async function main() {
  console.log("\n🗑️  Hackathon Builder - プロジェクト完全削除\n");
  console.log(
    "╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║  ⚠️  警告: この操作は元に戻せません！                             ║"
  );
  console.log(
    "║  Firebase プロジェクトとすべてのサービスが完全に削除されます。    ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n"
  );

  // サービスアカウントキーの確認
  const keyPath = resolve(__dirname, "..", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.log("⚠️  serviceAccountKey.json が見つかりません。");
    console.log(
      "   すでにプロジェクトが削除されているか、セットアップ前の状態です。\n"
    );
    rl.close();
    process.exit(1);
  }

  // Firebase Admin 初期化
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
  const projectId = serviceAccount.project_id;
  const projectRoot = resolve(__dirname, "..");

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${projectId}.firebasestorage.app`,
  });

  const db = getFirestore();
  const bucket = getStorage().bucket();
  const auth = getAuth();

  console.log(`📌 対象プロジェクト: ${projectId}\n`);

  // 削除対象の表示
  console.log("以下が完全に削除されます：");
  console.log("   🔸 Firestore: すべてのコレクションとドキュメント");
  console.log("   🔸 Authentication: すべてのユーザー");
  console.log("   🔸 Storage: すべてのファイル");
  console.log("   🔸 Hosting: デプロイされたサイト");
  console.log("   🔸 Cloud Functions: すべての関数");
  console.log("   🔸 Firebase プロジェクト自体");
  console.log(
    "   🔸 ローカル: firebase.js, .firebaserc, serviceAccountKey.json\n"
  );

  // 第一確認: プロジェクト ID の入力
  const inputProjectId = await question(
    `確認のため、プロジェクトID「${projectId}」を入力してください: `
  );

  if (inputProjectId !== projectId) {
    console.log("\n❌ プロジェクトIDが一致しません。キャンセルしました。\n");
    rl.close();
    process.exit(0);
  }

  // 第二確認: 最終確認
  const finalConfirm = await question(
    '\n⚠️  本当に削除しますか？ "DELETE" と入力してください: '
  );

  if (finalConfirm !== "DELETE") {
    console.log("\n❌ キャンセルしました。\n");
    rl.close();
    process.exit(0);
  }

  console.log("\n🗑️  削除処理を開始します...\n");

  try {
    // 1. Firestore: すべてのコレクション削除
    console.log("1/7 Firestore の全コレクションを削除中...");
    const collections = await getAllCollections(db);
    if (collections.length === 0) {
      console.log("   📁 コレクションなし");
    } else {
      for (const collectionId of collections) {
        await deleteCollection(db, collectionId);
        console.log(`   ✅ ${collectionId}`);
      }
    }

    // 2. Authentication: 全ユーザー削除
    console.log("2/7 Authentication の全ユーザーを削除中...");
    const deletedUserCount = await deleteAllUsers(auth);
    if (deletedUserCount === 0) {
      console.log("   📁 ユーザーなし");
    } else {
      console.log(`   ✅ ${deletedUserCount} ユーザー削除`);
    }

    // 3. Storage: 全ファイル削除
    console.log("3/7 Storage の全ファイルを削除中...");
    const deletedFileCount = await deleteAllStorageFiles(bucket);
    if (deletedFileCount > 0) {
      console.log(`   ✅ ${deletedFileCount} ファイル削除`);
    }

    // 4. Hosting: サイト無効化
    console.log("4/7 Firebase Hosting を無効化中...");
    const hostingDisabled = await deleteHostingSite(projectId, projectRoot);
    if (hostingDisabled) {
      console.log("   ✅ Hosting を無効化");
    }

    // 5. Cloud Functions: 全関数削除
    console.log("5/7 Cloud Functions を削除中...");
    const deletedFuncCount = await deleteCloudFunctions(projectId, projectRoot);
    if (deletedFuncCount > 0) {
      console.log(`   ✅ ${deletedFuncCount} 関数削除`);
    }

    // 6. Firebase プロジェクト削除
    console.log("6/7 Firebase プロジェクトを削除中...");
    const projectDeleted = await deleteFirebaseProject(projectId, projectRoot);
    if (projectDeleted) {
      console.log("   ✅ プロジェクト削除完了");
    } else {
      console.log(
        "   ℹ️  プロジェクト削除は Firebase Console から手動で行ってください"
      );
    }

    // 7. ローカルファイルの削除
    console.log("7/7 ローカル設定ファイルを削除中...");
    deleteLocalFile(resolve(projectRoot, "firebase.js"), "firebase.js");
    deleteLocalFile(resolve(projectRoot, ".firebaserc"), ".firebaserc");
    deleteLocalFile(keyPath, "serviceAccountKey.json");

    console.log("\n" + "═".repeat(60));
    console.log("✅ プロジェクトの完全削除が完了しました！");
    console.log("═".repeat(60));

    console.log(`\n🔗 Firebase Console で確認もできます:`);
    console.log(
      `   https://console.firebase.google.com/project/${projectId}\n`
    );

    console.log("📌 次のステップ:");
    console.log("   - 新しいプロジェクトを開始する場合:");
    console.log("     npm run init\n");
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error.message);
    console.error(error);
  }

  rl.close();
}

main();

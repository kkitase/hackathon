#!/usr/bin/env node
/**
 * Hackathon Builder - オールインワン初期化スクリプト
 * プロジェクト作成から管理者設定まで一括で処理します。
 */

import { createInterface } from "readline";
import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

// 対話式入力のヘルパー
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt, defaultValue = null) => {
  // すでに引数で指定されている場合はスキップ
  if (
    defaultValue !== null &&
    defaultValue !== undefined &&
    defaultValue !== ""
  ) {
    return Promise.resolve(defaultValue);
  }
  return new Promise((resolve) => rl.question(prompt, resolve));
};

// 引数のパース (例: --title "Name" または -t "Name")
const args = {};
process.argv.slice(2).forEach((val, index, array) => {
  if (val.startsWith("-")) {
    const key = val.replace(/^-+/, "");
    const nextVal = array[index + 1];
    if (nextVal && !nextVal.startsWith("-")) {
      args[key] = nextVal;
    } else {
      args[key] = true;
    }
  }
});

// エイリアスの設定
const getArg = (keys) => {
  for (const key of keys) {
    // 直接引数 (--title 等)
    if (args[key]) return args[key];

    // npm run init --title="xxx" のように渡された場合
    const envKey = `npm_config_${key.replace(/-/g, "_")}`;
    if (process.env[envKey] && process.env[envKey] !== "true") {
      return process.env[envKey];
    }
  }
  return null;
};

// コマンド実行ヘルパー
const exec = (cmd, options = {}) => {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "ignore"], // stderr を抑制
      ...options,
    }).trim();
  } catch (error) {
    return null;
  }
};

// コマンド実行（出力表示）
const execShow = (cmd) => {
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT_DIR });
    return true;
  } catch (error) {
    return false;
  }
};

// ステップ表示
const step = (num, text) => console.log(`\n\x1b[36m[${num}]\x1b[0m ${text}`);
const success = (text) => console.log(`\x1b[32m✓\x1b[0m ${text}`);
const warn = (text) => console.log(`\x1b[33m⚠\x1b[0m ${text}`);
const errorLog = (text) => console.log(`\x1b[31m✗\x1b[0m ${text}`);

// 新規プロジェクト作成
async function createNewProject() {
  const projectId = await question(
    "   新しいプロジェクトID: ",
    getArg(["project", "p", "id"])
  );
  const displayName = await question(
    "   プロジェクト表示名 (Firebase Console用): ",
    getArg(["project-name", "pn"])
  );
  console.log("   プロジェクトを作成中...");
  const created = execShow(
    `firebase projects:create ${projectId} -n "${displayName || projectId}"`
  );
  if (!created) {
    errorLog("プロジェクトの作成に失敗しました");
    rl.close();
    process.exit(1);
  }
  return projectId;
}

async function main() {
  console.log("\n🚀 \x1b[1mHackathon Builder - オールインワン初期化\x1b[0m\n");
  console.log("このスクリプトは以下を一括で行います:");
  console.log("  1. 依存関係のインストール");
  console.log("  2. Firebase CLI のセットアップ");
  console.log("  3. Firebase プロジェクトの選択");
  console.log("  4. ハッカソン情報の入力（タイトル・概要）");
  console.log("  5. firebase.js の自動生成");
  console.log("  6. サービスアカウントキーの確認");
  console.log("  7. 管理者アカウントの設定\n");
  console.log(
    "⚠️  事前に Firebase Console でプロジェクトとサービスを作成してください\n"
  );

  // ===========================================
  // Step 1: 依存関係のインストール
  // ===========================================
  step(1, "依存関係のインストール");

  if (!existsSync(resolve(ROOT_DIR, "node_modules"))) {
    console.log("   ルートの依存関係をインストール中...");
    execShow("npm install");
  } else {
    success("ルートの依存関係はインストール済み");
  }

  const functionsDir = resolve(ROOT_DIR, "functions");
  if (!existsSync(resolve(functionsDir, "node_modules"))) {
    console.log("   functions/ の依存関係をインストール中...");
    execShow("npm install --prefix functions");
  } else {
    success("functions/ の依存関係はインストール済み");
  }

  // ===========================================
  // Step 2: Firebase CLI 確認
  // ===========================================
  step(2, "Firebase CLI の確認");

  const firebaseVersion = exec("firebase --version");
  if (!firebaseVersion) {
    console.log("   Firebase CLI をインストール中...");
    execShow("npm install -g firebase-tools");
  } else {
    success(`Firebase CLI ${firebaseVersion}`);
  }

  // ログイン確認
  const loginStatus = exec("firebase login:list");
  if (!loginStatus || loginStatus.includes("No authorized accounts")) {
    warn("Firebase にログインしていません");
    console.log("   ブラウザでログインしてください...");
    execShow("firebase login");
  } else {
    // アカウント一覧をパース（メールアドレスのみ抽出）
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const allEmails = loginStatus.match(emailRegex) || [];
    const accounts = [...new Set(allEmails)]; // 重複除去

    const currentMatch = loginStatus.match(
      /Logged in as ([\w.-]+@[\w.-]+\.\w+)/
    );
    const currentEmail = currentMatch ? currentMatch[1] : accounts[0];
    success(`アカウント: ${currentEmail}`);
  }

  // ===========================================
  // Step 3: プロジェクト設定
  // ===========================================
  step(3, "Firebase プロジェクトの設定");

  // 既存のプロジェクト一覧を取得
  console.log("   プロジェクト一覧を取得中...");
  const projectList = exec("firebase projects:list --json");
  let projects = [];
  try {
    const parsed = JSON.parse(projectList);
    projects = parsed.result || [];
  } catch (e) {
    projects = [];
  }

  let projectId;

  if (projects.length > 0) {
    console.log("\n   既存のプロジェクト:");
    projects.slice(0, 10).forEach((p, i) => {
      console.log(
        `   ${i + 1}. ${p.projectId} (${p.displayName || "名前なし"})`
      );
    });
    console.log(`   0. 新規プロジェクトを作成`);

    const projectArg = getArg(["project", "p", "id"]);
    const maxNum = Math.min(projects.length, 10);
    let defaultChoice = null;
    if (projectArg) {
      const idx = projects.findIndex((p) => p.projectId === projectArg);
      defaultChoice = idx >= 0 ? (idx + 1).toString() : null;
    }
    const choice = await question(
      `\n   使用するプロジェクト番号を選択 (0-${maxNum}): `,
      defaultChoice
    );
    const num = parseInt(choice);

    if (num === 0) {
      projectId = await createNewProject();
    } else if (num >= 1 && num <= projects.length) {
      projectId = projects[num - 1].projectId;
    } else {
      errorLog("無効な選択です");
      rl.close();
      process.exit(1);
    }
  } else {
    // プロジェクトがない場合は新規作成
    projectId = await createNewProject();
  }

  // プロジェクトを使用
  console.log(`   プロジェクト ${projectId} を設定中...`);
  execShow(`firebase use ${projectId}`);
  success(`プロジェクト: ${projectId}`);

  success("Firebase サービスの初期設定が完了しました");

  // ===========================================
  // ハッカソン情報の入力
  // ===========================================
  step(4, "ハッカソン情報の入力");

  console.log("   Hero セクションに表示する情報を入力してください:\n");
  const hackathonTitle = await question(
    "   ハッカソンのタイトル (例: AI Innovation Hackathon 2026):\n   > ",
    getArg(["title", "t"])
  );
  const hackathonSubtitle = await question(
    "   概要・サブタイトル (例: 未来を創るAIアプリケーションを開発しよう):\n   > ",
    getArg(["subtitle", "s"])
  );
  const hackathonCta = await question(
    "   CTAボタンのテキスト (例: 今すぐ参加登録, 空欄でスキップ):\n   > ",
    getArg(["cta", "c"])
  );

  // ハッカソン情報を後で保存するためにグローバル変数に格納
  const hackathonInfo = {
    title: hackathonTitle || "Hackathon 2026",
    subtitle: hackathonSubtitle || "新しいアイデアで未来を切り拓こう",
    ctaText: hackathonCta || "参加登録",
    image: "./assets/hero-illustration.jpg",
  };
  success("ハッカソン情報を設定しました");

  // ===========================================
  // Step 5: Webアプリ登録と firebase.js 生成
  // ===========================================
  step(5, "firebase.js の生成");

  const firebaseJsPath = resolve(ROOT_DIR, "firebase.js");

  if (existsSync(firebaseJsPath)) {
    const overwrite = await question(
      "   firebase.js は既に存在します。上書きしますか？ (y/N): "
    );
    if (overwrite.toLowerCase() !== "y") {
      success("firebase.js をスキップ");
    } else {
      await generateFirebaseJs(projectId, firebaseJsPath);
    }
  } else {
    await generateFirebaseJs(projectId, firebaseJsPath);
  }

  // ===========================================
  // Step 6: サービスアカウントキーの確認
  // ===========================================
  step(6, "サービスアカウントキーの確認");

  const keyPath = resolve(ROOT_DIR, "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    warn("serviceAccountKey.json が見つかりません");
    console.log("\n   以下の手順でダウンロードしてください:");
    console.log(
      "   1. Firebase Console → プロジェクト設定 → サービスアカウント"
    );
    console.log("   2. 「新しい秘密鍵の生成」をクリック");
    console.log(
      "   3. ダウンロードしたファイルを serviceAccountKey.json としてルートに配置"
    );
    await question("\n   配置したら Enter を押してください... ");

    if (!existsSync(keyPath)) {
      errorLog(
        "serviceAccountKey.json が見つかりません。セットアップを中止します。"
      );
      rl.close();
      process.exit(1);
    }
  }
  success("serviceAccountKey.json を検出");

  // ===========================================
  // Step 7: 管理者アカウントの設定
  // ===========================================
  step(7, "管理者アカウントの設定");

  // Firebase Admin を動的にインポート
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
  initializeApp({
    credential: cert(serviceAccount),
  });
  const db = getFirestore();

  success("Firebase Admin に接続");

  const defaultUser = await question(
    "   管理者 ID (例: admin):\n   > ",
    getArg(["admin-user", "user", "u"])
  );
  const defaultPass = await question(
    "   管理者パスワード:\n   > ",
    getArg(["admin-pass", "pass", "pw"])
  );
  const emailsInput = await question(
    "   許可するメールアドレス (カンマ区切り):\n   > ",
    getArg(["admin-group", "group", "emails", "g", "e"])
  );

  const authorizedEmails = emailsInput
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  await db.doc("config/admin").set({
    defaultUser,
    defaultPass,
    authorizedEmails,
    createdAt: new Date().toISOString(),
  });

  success("管理者情報を Firestore に保存");

  // ハッカソン情報（Hero）を Firestore に保存
  console.log("   ハッカソン情報を Firestore に保存中...");
  await db.doc("config/content").set(
    {
      hero: hackathonInfo,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // OGP 情報も初期設定
  await db.doc("config/ogp").set(
    {
      ogTitle: hackathonInfo.title,
      ogDescription: hackathonInfo.subtitle,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  success("ハッカソン情報を Firestore に保存");

  // ===========================================
  // 完了 → デプロイ確認
  // ===========================================
  console.log("\n" + "=".repeat(50));
  console.log("\x1b[32m✓ 初期設定が完了しました！\x1b[0m\n");

  const doDeploy = await question(
    "Firebase にサイトを構築します。npm run deploy を実行しますか？ (Y/n): "
  );

  if (doDeploy.toLowerCase() !== "n") {
    console.log("\n🚀 デプロイを開始します...\n");
    rl.close();
    execShow("npm run deploy");
  } else {
    console.log("\n次のステップ:");
    console.log("  npm run deploy  (ビルドとデプロイ)\n");
    rl.close();
  }
}

// firebase.js 生成
async function generateFirebaseJs(projectId, outputPath) {
  console.log("   Webアプリの設定を取得中...");

  // 既存のWebアプリを確認
  const appsJson = exec(`firebase apps:list WEB --project ${projectId} --json`);
  let appId = null;

  try {
    const apps = JSON.parse(appsJson);
    if (apps.result && apps.result.length > 0) {
      appId = apps.result[0].appId;
      success(`既存のWebアプリを使用: ${apps.result[0].displayName || appId}`);
    }
  } catch {
    // アプリ一覧の取得に失敗した場合は新規作成に進む
  }

  // Webアプリがなければ作成
  if (!appId) {
    console.log("   Webアプリを作成中...");
    execShow(`firebase apps:create WEB "Hackathon Web" --project ${projectId}`);
  }

  // SDK 設定を取得
  const sdkConfig = exec(`firebase apps:sdkconfig WEB --project ${projectId}`);
  if (!sdkConfig) {
    errorLog("SDK 設定の取得に失敗しました");
    return;
  }

  // 設定をパース（JSON 形式または JavaScript 形式に対応）
  let configContent;

  // まず JSON 形式を試す（新しい firebase CLI の出力形式）
  const jsonMatch = sdkConfig.match(/\{[\s\S]*"projectId"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // 必要な項目のみ抽出
      configContent = JSON.stringify(
        {
          apiKey: parsed.apiKey,
          authDomain: parsed.authDomain,
          projectId: parsed.projectId,
          storageBucket: parsed.storageBucket,
          messagingSenderId: parsed.messagingSenderId,
          appId: parsed.appId,
        },
        null,
        2
      );
    } catch (e) {
      configContent = null;
    }
  }

  // JSON パースに失敗した場合は従来の JavaScript 形式を試す
  if (!configContent) {
    const configMatch = sdkConfig.match(/const firebaseConfig = \{[\s\S]*?\};/);
    if (configMatch) {
      configContent = configMatch[0]
        .replace("const firebaseConfig = ", "")
        .replace(";", "");
    }
  }

  if (!configContent) {
    errorLog("SDK 設定のパースに失敗しました");
    console.log("   手動で firebase.js.example をコピーして編集してください");
    return;
  }

  const firebaseJsContent = `// Firebase 設定（自動生成）
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = ${configContent};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
`;

  writeFileSync(outputPath, firebaseJsContent);
  success("firebase.js を生成しました");
}

main().catch((err) => {
  errorLog(err.message);
  rl.close();
  process.exit(1);
});

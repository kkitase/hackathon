#!/usr/bin/env node
/**
 * Firebase アカウントとプロジェクトの確認スクリプト
 * 重要なコマンドを実行する前に、現在のアカウント状況を表示し、ユーザーに確認を求めます。
 */

import { execSync } from "child_process";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

// コマンド実行ヘルパー
const exec = (cmd) => {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return null;
  }
};

async function main() {
  console.log("\n\x1b[1m🔍 Firebase 実行環境の確認\x1b[0m");

  // 現在のアカウントを取得
  const loginStatus = exec("firebase login:list");
  let currentAccount = "不明";
  if (loginStatus) {
    const match = loginStatus.match(/Logged in as ([\w.-]+@[\w.-]+\.\w+)/);
    if (match) {
      currentAccount = match[1];
    } else {
      // フォールバック: grep で (current) 行を探す
      const lines = loginStatus.split("\n");
      const currentLine = lines.find(
        (line) => line.includes("(current)") || line.includes("√")
      );
      if (currentLine) {
        const emailMatch = currentLine.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) currentAccount = emailMatch[0];
      }
    }
  }

  // 現在のプロジェクトを取得
  let currentProject = "未設定";
  const activeProject = exec("firebase use");
  if (activeProject) {
    const projectMatch = activeProject.match(/Active project: ([\w-]+)/);
    if (projectMatch) {
      currentProject = projectMatch[1];
    } else {
      currentProject = activeProject
        .split(" ")
        .pop()
        .replace(/\(.*\)/, "")
        .trim();
    }
  }

  console.log(`   -------------------------------------------`);
  console.log(`   \x1b[36m現在のアカウント:\x1b[0m ${currentAccount}`);
  console.log(`   \x1b[36m現在のプロジェクト:\x1b[0m ${currentProject}`);
  console.log(`   -------------------------------------------`);

  const answer = await question(
    "\n   この環境で実行してもよろしいですか？ (Y/n): "
  );

  if (answer.toLowerCase() === "n") {
    console.log("\n\x1b[33m⚠ 実行をキャンセルしました。\x1b[0m\n");
    process.exit(1);
  }

  console.log("\n\x1b[32m✓ 確認完了。処理を継続します...\x1b[0m\n");
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ エラーが発生しました:\x1b[0m ${err.message}`);
  process.exit(1);
});

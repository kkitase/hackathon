---
description: セキュリティ監査と機密情報定点チェック
---

このワークフローは、リポジトリ内に機密情報が混入していないか、および Firebase の設定が安全に保たれているかを定期的に確認するための手順です。

1. **機密情報の探索 (Secret Scanning)**
   - `apiKey`, `password`, `secret`, `token`, `private_key` などのキーワードで全ファイルを検索する。
   - 特に `setup.js` や `auth-utils.js` などの認証周りのファイルにテスト用の値がハードコードされていないか確認する。
   - 以前使用していたパスワード（例: `JetSki#555`）などが残っていないか確認する。

2. **Git 追跡状態の確認 (Git Tracking Audit)**
   - 以下のファイルが `git ls-files` に含まれていないか（誤って `git add` されていないか）確認する。
     - `firebase.js` (実体)
     - `serviceAccountKey.json`
     - `*-firebase-adminsdk-*.json`
     - `.env` 関連ファイル
   - 含まれていた場合は `git rm --cached` で追跡を解除し、`.gitignore` を再点検する。

3. **Firebase セキュリティルールの検証**
   - `firestore.rules` を開き、以下のポイントを確認する。
     - `config` コレクションへの書き込み制限：管理者（`isAdmin()`）以外に許可されていないか。
     - 全体的な読み書き制限：`allow read, write: if true;` のようなワイルドカード指定が残っていないか。
   - Cloud Functions (functions/index.js) 内で Firestore Admin SDK を使用する際、外部からの入力値がそのままクエリに使用されていないか確認する。

4. **環境変数の管理**
   - API キーやプロジェクト ID が、可能な限り環境変数や Firebase Hosting の自動インジェクト機能（`/__/firebase/init.js` 等）で管理されているか検討する。

5. **依存関係の脆弱性確認**
   - `npm audit` を実行し、既知の脆弱性を持つパッケージがないか確認する。

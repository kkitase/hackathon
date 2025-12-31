# Hackathon Launch Kit v2

Firebase と SSR (Server Side Rendering) を活用した、チラつきのない高速なハッカソン管理・公開システムです。

## 🌟 特徴

- **高速表示 (SSR)**: クラウド側でHTMLを組み立ててから届けるため、アクセスした瞬間に内容が表示されます（SEOに強く、SNSシェア時のOGPも完璧です）。
- **簡単編集**: 専用の管理画面から、エンジニアでなくてもサイト内容（ヒーロー/審査員/スポンサー等）をリアルタイムで更新できます。
- **安心の認証**: Google アカウントに加え、専用の ID/パスワードによる管理者認証もサポート。
- **一元管理**: 全てのデータは Firestore に保存され、IndexedDB などのローカル保存は使用しません。

---

## 🏗 システム構成

管理者が保存したデータを元に、Cloud Functions (SSR) がページ生成を行います。これにより、従来の SPA で見られた「一瞬白い画面が出る」「データが後から降ってくる」といったチラつきを完全に排除しました。

![システム構成](./assets/detailed_technical_flow.png)

---

## 🚀 構築・公開手順 (10分)

### 1. Firebase プロジェクトの作成と設定
CLI を使用して、プロジェクトの枠組みを迅速に作成します。

```bash
# 1. ログイン
firebase login

# 2. プロジェクトの作成 (IDは任意、小文字/数字/ハイフン)
firebase projects:create <PROJECT_ID> --title "My Hackathon"

# 3. Webアプリの登録
firebase apps:create WEB "Hackathon Web"
```

### 2. コンソールでの有効化 (最小限の手動操作)
以下の 2 つだけは [Firebase Console](https://console.firebase.google.com/) で行ってください。

1. **Firestore**: 「開始」→ 東京 (`asia-northeast1`) を選択して作成。
2. **Authentication**: 「使ってみる」→ **Google** を有効化。
3. **サービスアカウントキーの取得**: プロジェクト → プロジェクト設定 → サービスアカウント → 「新しい秘密鍵の生成」→ ダウンロードしたファイルを `serviceAccountKey.json` としてプロジェクトルートに配置。

### 3. セットアップとデプロイ
```bash
# 4. Firebase 設定ファイルの作成
#    テンプレートをコピーして firebase.js を作成します
cp firebase.js.example firebase.js

# 5. Firebase 設定情報の取得と反映
#    以下のコマンドで apiKey, authDomain などの設定情報が出力されます
firebase apps:sdkconfig WEB
#    ↑ 出力された firebaseConfig オブジェクトを firebase.js にコピー＆ペーストしてください

# 5. 依存関係のインストール
#    Node.js パッケージ（Firebase SDK など）をインストールします
npm install

# 6. 管理者アカウントのセットアップ
#    対話式で管理者ID、パスワード、許可メールアドレスを入力します
#    入力した情報は Firestore の config/admin に保存されます
npm run setup

# 7. ビルドとデプロイ
#    フロントエンドをビルドし、Firebase Hosting と Cloud Functions にデプロイします
npm run build && firebase deploy
```

---

## 📝 運用方法

- **管理画面**: デプロイされたURLの `/admin.html` にアクセスしてください。
- **ログイン**: 
  - **ID/Pass**: `初期設定時の userid` / `password` (初期設定時)
  - **Google**: 手動登録したメールアドレスでサインイン可能。
- **更新**: 各タブの内容を編集して「保存」を押すと、即座に公開サイトに反映されます。
- **ログアウト**: サイドバーの「Logout」ボタンから安全にログアウトできます。

---

## 🛠 開発者向け
- **開発サーバー**: `npm run dev` でローカル確認が可能です。
- **セキュリティルール**: `firestore.rules` で管理者以外の書き込みを禁止しています。
- **SSRテンプレート**: `functions/template.html` が SSR のベースとなります。

# Hackathon Launch Kit v2

Firebase と SSR (Server Side Rendering) を活用した、チラつきのない高速なハッカソン管理・公開システムです。

## 🌟 特徴

- **高速表示 (SSR)**: クラウド側でHTMLを組み立ててから届けるため、アクセスした瞬間に内容が表示されます（SEOに強く、SNSシェア時のOGPも完璧です）。
- **簡単編集**: 専用の管理画面から、エンジニアでなくてもサイト内容（ヒーロー/審査員/スポンサー等）をリアルタイムで更新できます。
- **参加者管理**: 登録者の閲覧、修正、削除、CSVエクスポートが管理画面から一括で行えます。
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

**前提条件**: Node.js がインストールされていること。未インストールの場合は [Node.js公式サイト](https://nodejs.org/) からダウンロードしてインストールしてください。

```bash
# 0. Firebase CLI のインストール（未インストールの場合）
npm install -g firebase-tools

# 1. ログイン
firebase login

# 2. プロジェクトの作成 (IDは任意、小文字/数字/ハイフン)
firebase projects:create <PROJECT_ID> --title "My Hackathon"

# 3. Webアプリの登録
firebase apps:create WEB "Hackathon Web" --project <PROJECT_ID>
```

### 2. コンソールでの有効化 (最小限の手動操作)
以下の 2 つだけは [Firebase Console](https://console.firebase.google.com/) で行ってください。

1. **Firestore**: 「開始」→ 東京 (`asia-northeast1`) を選択して作成。
2. **Authentication**: 「使ってみる」→ **Google** を有効化。
3. **Storage**: 「使ってみる」→ 「本番環境モード」で作成（OGP画像の保存に使用します）。
4. **サービスアカウントキーの取得**: プロジェクト → プロジェクト設定 → サービスアカウント → 「新しい秘密鍵の生成」→ ダウンロードしたファイルを `serviceAccountKey.json` としてプロジェクトルートに配置。

### 3. セットアップとデプロイ

#### 3.1 Firebase 設定ファイルの作成
```bash
# テンプレートをコピーして firebase.js を作成
cp firebase.js.example firebase.js
```

#### 3.2 Firebase 設定情報の取得

以下のコマンドを実行して、設定情報を取得します：
```bash
firebase apps:sdkconfig WEB --project YOUR_PROJECT_ID
```

> **📝 YOUR_PROJECT_ID**: 手順1で作成したプロジェクトID（例: `my-hackathon-2025`）を入力してください。

出力例：
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

| 設定項目 | 説明 | 取得元 |
|---------|------|--------|
| `apiKey` | Firebase API キー | `firebase apps:sdkconfig` の出力 |
| `authDomain` | 認証ドメイン | `{projectId}.firebaseapp.com` |
| `projectId` | Firebase プロジェクト ID | Firebase Console のプロジェクト設定 |
| `storageBucket` | Cloud Storage バケット | `{projectId}.firebasestorage.app` |
| `messagingSenderId` | FCM 送信者 ID | `firebase apps:sdkconfig` の出力 |
| `appId` | Firebase アプリ ID | `firebase apps:sdkconfig` の出力 |

> **📋 手順**: 上記の出力を `firebase.js` にコピー＆ペーストしてください。

#### 3.3 依存関係のインストール
```bash
npm install
```

#### 3.4 管理者アカウントのセットアップ
```bash
# 対話式で管理者ID、パスワード、許可メールアドレスを入力
npm run setup

# (任意) デモデータの投入
npm run demo-data
```

#### 3.5 ビルドとデプロイ
```bash
npm run build && firebase deploy
```

---

## 📝 運用方法

- **管理画面**: デプロイされたURLの `/admin.html` にアクセスしてください。
- **ログイン**: 
  - **ID/Pass**: `初期設定時の userid` / `password`
  - **Google**: 許可されたメールアドレスでサインイン可能。
- **更新**: 各タブの内容を編集して「保存」を押すと、即座に公開サイトに反映されます。
- **プロジェクト（参加者）管理**: 「プロジェクト」タブから登録者情報の修正、削除、CSVダウンロードが可能です。
- **参加者交流**: プロジェクト一覧での「いいね」・「コメント」が可能です。
    - 「◯人がいいね」をクリックして詳細（参加者の名前・所属）を確認できます。
- **参加者の自己編集**: ログインしたユーザーは自分のプロジェクト情報を編集・取り下げできます。
- **検索エンジン・OGP設定**: 「Social」タブの「検索エンジンに公開する」で制御可能です。OGP画像はローカルから直接アップロードして設定できます。
- **ログアウト**: サイドバー最下部のリンク、またはヘッダーからログアウトできます。

---

## 🛠 開発者向け
- **開発サーバー**: `npm run dev` でローカル確認が可能です。
- **セキュリティルール**: `firestore.rules` で管理者以外の書き込みを禁止しています。
- **SSRテンプレート**: `functions/template.html` が SSR のベースとなります。

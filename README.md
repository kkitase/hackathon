# Hackathon Builder

Firebase と SSR (Server Side Rendering) を活用した、チラつきのない高速なハッカソン管理・公開システムです。

## 🌟 特徴

- **高速表示 (SSR)**: クラウド側でHTMLを組み立ててから届けるため、アクセスした瞬間に内容が表示されます（SEOに強く、SNSシェア時のOGPも完璧です）。
- **簡単編集**: 専用の管理画面から、エンジニアでなくてもサイト内容（ヒーロー/審査員/スポンサー等）をリアルタイムで更新できます。
- **参加者管理**: 登録者の閲覧、修正、削除、CSVエクスポートが管理画面から一括で行えます。
- **安心の認証**: Google アカウントに加え、専用の ID/パスワードによる管理者認証もサポート。
- **一元管理**: 全てのデータは Firestore に保存され、IndexedDB などのローカル保存は使用しません。

---

## 🏗 システム構成

**Hackathon Builder** は、Firebase をフル活用したモダンな高パフォーマンス・アーキテクチャを採用しています。

- **SSR (Server Side Rendering)**: Cloud Functions がリクエストを受け取り、Firestore の最新データや Storage の画像を注入した HTML を即座に生成します。これにより、爆速の初回表示と、SNS シェア時の完璧な OGP 対応を実現しています。
- **統合管理**: 構造化データは **Cloud Firestore**、OGP 画像などのアセットは **Firebase Storage** で一元管理され、管理画面からシームレスに操作可能です。
- **セキュリティ**: すべての操作は Firebase Auth による認証と、強固なセキュリティルールによって適切に制御されています。

![システム構成](./assets/hackathon_builder_system_arch.png)

---

## 🚀 構築・公開手順 (10分)

### 1. リポジトリのクローン
まず、GitHub からリポジトリをクローンします。

```bash
git clone https://github.com/kkitase/hackathon-builder.git
cd hackathon-builder
```

### 2. Firebase プロジェクトの作成と設定
CLI を使用して、プロジェクトの枠組みを迅速に作成します。

**前提条件**: Node.js がインストールされていること。未インストールの場合は [Node.js公式サイト](https://nodejs.org/) からダウンロードしてインストールしてください。

```bash
# 0. Firebase CLI のインストール（未インストールの場合）
npm install -g firebase-tools

# 1. ログイン
firebase login

# (補足) 別のGoogleアカウントを使用したい場合
# 既にログイン済みで別のアカウントに切り替える場合は、まず追加してから切り替えます
firebase login:add          # ブラウザが開くので、使用したいアカウントでログイン
firebase login:use <email>  # 追加したアカウントに切り替え

# 2. プロジェクトの作成 (IDは任意、小文字/数字/ハイフン)
firebase projects:create <PROJECT_ID> -n "My Hackathon"

# 3. Webアプリの登録
firebase apps:create WEB "Hackathon Web" --project <PROJECT_ID>
```

### 3. コンソールでの有効化 (最小限の手動操作)
以下の 2 つだけは [Firebase Console](https://console.firebase.google.com/) で行ってください。

1. **Firestore**: 構築 → 「Firestore Database」を選択、「データベースの作成」→「Standardエディション」→「ロケーション (`asia-northeast1`)」→ 「本番環境モードで開始する」選択して作成。
2. **Authentication**:  構築 → 「Authentication」を選択、「始める」→ **Google** を有効化。
3. **Storage**: 構築 → 「Storage」を選択、「使ってみる」→ デフォルト バケットのセットアップで、「すべてのロケーション(`asia-northeast1`)」→「本番環境モード」で作成（OGP 画像の保存に使用します）。（Firebase Storage を使うには Blaze プランが必要です）。gs://<>.firebasestorage.app というようなストレージができたことを確認。
4. **サービスアカウントキーの取得**: プロジェクト → プロジェクト設定 → サービスアカウント → 「新しい秘密鍵の生成」→ ダウンロードしたファイルを `serviceAccountKey.json` という名前に変更して、プロジェクトルートに配置。

### 4. セットアップとデプロイ

#### 4.1 Firebase 設定ファイルの作成
```bash
# テンプレートをコピーして firebase.js を作成
cp firebase.js.example firebase.js
```

#### 4.2 Firebase 設定情報の取得

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

> **📋 手順**: 上記の出力を `firebase.js` にコピー＆ペーストしてください。


| 設定項目 | 説明 | 取得元 |
|---------|------|--------|
| `apiKey` | Firebase API キー | `firebase apps:sdkconfig` の出力 |
| `authDomain` | 認証ドメイン | `{projectId}.firebaseapp.com` |
| `projectId` | Firebase プロジェクト ID | Firebase Console のプロジェクト設定 |
| `storageBucket` | Cloud Storage バケット | `{projectId}.firebasestorage.app` |
| `messagingSenderId` | FCM 送信者 ID | `firebase apps:sdkconfig` の出力 |
| `appId` | Firebase アプリ ID | `firebase apps:sdkconfig` の出力 |

#### 4.3 依存関係のインストール
```bash
npm install
```

#### 4.4 管理者アカウントのセットアップ
```bash
# 対話式で管理者ID、パスワード、許可メールアドレスを入力
npm run setup

# (任意) デモデータの投入
npm run demo-data
```

#### 4.5 ビルドとデプロイ
```bash
# デプロイ先のプロジェクトを設定
firebase use <PROJECT_ID>

# ビルドとデプロイ
npm run build && firebase deploy
```

> **📝 初回デプロイ時の確認**
> - 「Cloud Storage for Firebase needs an IAM Role to use cross-service rules. Grant the new role? (Y/n)」→ `Y` を入力
> - 「How many days do you want to keep container images before they're deleted?」→ `1` (デフォルト) を入力

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
- **詳細仕様書**: プロジェクトの詳細な要件定義は [docs/PRD.md](docs/PRD.md) を参照してください。
- **セットアップツール**: `tools/` フォルダに初期設定用のスクリプトがまとめられています。
- **セキュリティルール**: `firestore.rules` で管理者以外の書き込みを禁止しています。
- **SSRテンプレート**: `functions/template.html` が SSR のベースとなります。

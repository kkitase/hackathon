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

## 🚀 構築・公開手順 (15分)

### 0. 事前準備（必要なければ飛ばしてください）

**Google Cloud アカウントの準備**

Firebase は Google Cloud 上で動作するため、事前に Google Cloud の課金アカウントを有効にしておく必要があります。

（課金アカウントが有効になっていない場合、下記の手順で有効にしてください）
1. Google アカウントでログイン
2. <a href="https://console.cloud.google.com/billing" target="_blank">Google Cloud 課金アカウント</a> にアクセスして、アカウントを作成
> ✅ Google Cloud は、2026 年 1 月 1 日から 2 段階認証プロセス（2SV）の適用を開始しました。設定していない人は、設定に移動 → 2 段階認証を有効にしてください。

> 📝 **補足**: 課金アカウントを作成してもすぐに請求が発生するわけではありません。小〜中規模のサイトであれば無料枠内で収まることがほとんどです。
> 

**Node.js のインストール**

Node.js がインストールされていない場合は、先にインストールしてください。Node.js は JavaScript をパソコンで動かすためのツールです。npm（パッケージ管理ツール）も一緒にインストールされます。

1. [Node.js 公式サイト](https://nodejs.org/ja/) にアクセス
2. **LTS（推奨版）** をダウンロード
3. ダウンロードしたファイルを開いてインストール（すべて「次へ」でOK）
4. インストール確認（ターミナル/コマンドプロンプトで実行）:
```bash
node -v    # 例: v20.10.0
npm -v     # 例: 10.2.3
```
> 📝 **ターミナルの開き方**:
> - **Mac**: Finder → アプリケーション → ユーティリティ → ターミナル
> - **Windows**: スタートメニュー → 「cmd」と検索 → コマンドプロンプト

---

### 1. ソースコードのダウンロード

1. [GitHub リポジトリ](https://github.com/kkitase/hackathon-builder) にアクセス
2. 緑色の「Code」ボタン → 「Download ZIP」をクリック
3. ダウンロードした ZIP を解凍
4. ターミナルで解凍したフォルダに移動:
```bash
cd hackathon-builder
```
### 2. Firebase プロジェクトの作成

<a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a> で新しいプロジェクトを作成します。

1. 「新しい Firebase プロジェクトを作成」をクリック
2. プロジェクト名を入力（例: `my-hackathon`）
3. Google Analytics は任意で設定
4. 「プロジェクトを作成」をクリック

### 3. Firebase サービスの有効化

作成したプロジェクトで、以下のサービスを有効化します：

**1. Firestore**

構築 → 「Firestore Database」→ データベースの作成 → Standard エディション → `asia-northeast1` → 本番環境モードで開始する

**2. Authentication**

構築 → 「Authentication」→ 始める → **Google** → プロジェクトのサポートメールの設定 → 有効にする

**3. Storage**

構築 → 「Storage」→ プロジェクトをアップグレード → Cloud請求先アカウントを構築する → Cloud請求先アカウントをリンク → 使ってみる → すべてのロケーション → `asia-northeast1` → 本番環境モードで開始する

> ⚠️ **Storage を `asia-northeast1` で使用するには Blaze プラン（従量制）へのアップグレードが必要です。** 小〜中規模のサイトであれば費用はほとんどかかりませんが、利用状況により課金が発生する場合があります。

### 4. サービスアカウントキーのダウンロード

1. <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a> → ⚙️ プロジェクト設定 → 「サービスアカウント」タブ
2. 「新しい秘密鍵の生成」をクリック
3. ダウンロードしたファイルを `serviceAccountKey.json` という名前に変更し、解凍したフォルダ（`hackathon-builder`）に配置

> 📝 **補足**: `serviceAccountKey.json` は Firebase プロジェクトごとに固有のファイルです。このファイルに含まれるプロジェクト ID によって、`npm run reset-data` や `npm run delete-project` などのデータ管理コマンドの対象プロジェクトが決定されます。

### 5. 初期化とデプロイ

```bash
# 対話形式で初期化（作成したFirebaseプロジェクトを選択）
npm run init
```

`npm run init` は以下を対話形式で行います：
1. 依存関係のインストール
2. Firebase CLI のセットアップ
3. **作成済みプロジェクトの選択**
4. ハッカソン情報の入力（タイトル・概要）
5. `firebase.js` の自動生成
6. 管理者アカウントの設定
7. **デプロイの実行確認**（Y を選択するとそのままデプロイ）

> **📝 初回デプロイ時の確認**
> - 「Cloud Storage for Firebase needs an IAM Role...」→ `Y` を入力
> - 「How many days do you want to keep container images...」→ `1` を入力

---

## 運用方法

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

## 開発者向け
- **開発サーバー**: `npm run dev` でローカル確認が可能です。
- **セットアップツール**: `tools/` フォルダに初期設定用のスクリプトがまとめられています。
- **セキュリティルール**: `firestore.rules` で管理者以外の書き込みを禁止しています。
- **SSRテンプレート**: `functions/template.html` が SSR のベースとなります。

---

## コマンド一覧

- **`npm run init`**: 対話形式で初期設定を行います（依存関係のインストール、Firebase CLI セットアップ、プロジェクト選択、ハッカソン情報入力、`firebase.js` 生成、管理者設定、デプロイ確認）
- **`npm run deploy`**: ビルドと Firebase へのデプロイを実行します
- **`npm run dev`**: ローカル開発サーバーを起動します
- **`npm run reset-data`**: コンテンツと参加者データを初期化します（管理者情報は保持）
- **`npm run delete-project`**: Firebase プロジェクトを完全削除します（Firestore、Authentication、Storage、Hosting、Cloud Functions、GCP プロジェクト、ローカル設定ファイル）

> ⚠️ **注意**: `reset-data` と `delete-project` は元に戻せません。実行前にプロジェクト ID の入力と「DELETE」の確認が必要です。

> 📝 **補足**: プロジェクト削除には `gcloud` CLI が必要です。削除されたプロジェクトは30日間の猶予期間があり、`gcloud projects undelete PROJECT_ID` で復元可能です。

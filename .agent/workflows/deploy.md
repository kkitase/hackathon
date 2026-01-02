---
description: Hosting と Cloud Functions を同時にビルド・デプロイし、環境を同期させる
---

1. ローカル開発サーバーで最終確認を行う（`npm run dev`）
2. 以下のコマンドを実行して、ビルドと同期デプロイを実行する
// turbo
3. `npm run build && firebase deploy --only hosting,functions --project hackathon-kkitase`
4. デプロイ完了後、公開URL（ https://hackathon-kkitase.web.app ）で表示と動作を確認する

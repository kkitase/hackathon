@echo off
setlocal
title Hackathon Builder - Windows 起動スクリプト

REM スクリプトのディレクトリに移動
cd /d %~dp0

echo ----------------------------------------------------
echo 🚀 Hackathon Builder を起動しています...
echo ----------------------------------------------------

REM Node.js の確認
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js が見つかりません。
    echo https://nodejs.org/ からインストールしてください。
    echo ----------------------------------------------------
    pause
    exit /b
)

REM 初期化スクリプトの実行
call npm run init

echo.
echo ----------------------------------------------------
echo ✅ 処理が完了しました。
echo このウィンドウは開いたままにしています。閉じても問題ありません。
echo ----------------------------------------------------

REM コマンドプロンプトを保持
cmd /k

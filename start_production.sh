#!/bin/bash

# 本番環境起動スクリプト

# 環境変数チェック
if [ ! -f .env ]; then
    echo "⚠️  .envファイルが見つかりません。.env.exampleをコピーして設定してください。"
    echo "   cp .env.example .env"
    exit 1
fi

# .envファイルを読み込み
export $(cat .env | grep -v '^#' | xargs)

# Gunicornインストール確認
if ! command -v gunicorn &> /dev/null; then
    echo "📦 Gunicornをインストールしています..."
    pip install gunicorn
fi

# ログディレクトリ作成
mkdir -p logs

echo "🚀 本番環境でアプリケーションを起動します..."
echo "   環境: ${FLASK_ENV:-production}"
echo "   ポート: 5000"

# Gunicornで起動
gunicorn -w 4 \
    -b 0.0.0.0:5000 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    --log-level info \
    src.app:app

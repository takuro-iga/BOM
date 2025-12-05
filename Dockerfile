FROM python:3.11-slim

WORKDIR /app

# 依存関係をコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# 環境変数
ENV FLASK_ENV=production
ENV PORT=5000

# ポート公開
EXPOSE 5000

# Gunicornで起動
CMD gunicorn -w 4 -b 0.0.0.0:$PORT src.app:app

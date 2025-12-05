# クラウドデプロイ方法

## 1. 🚀 ngrok（最速・簡単）

一時的に外部公開する最も簡単な方法：

```bash
# ngrokインストール
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# アカウント作成（https://ngrok.com/）してトークン取得
ngrok config add-authtoken YOUR_TOKEN

# サーバー起動（別ターミナルで）
python src/app.py

# ngrokでトンネル作成
ngrok http 5000
```

→ `https://xxxx.ngrok.io` のような公開URLが発行されます

## 2. 🐳 Render.com（無料・永続）

### Dockerfile作成済み：
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_ENV=production
ENV PORT=5000

CMD gunicorn -w 4 -b 0.0.0.0:$PORT src.app:app
```

### デプロイ手順：
1. https://render.com でアカウント作成
2. 「New Web Service」選択
3. GitHubリポジトリ連携
4. ビルドコマンド: `pip install -r requirements.txt`
5. 起動コマンド: `gunicorn -w 4 -b 0.0.0.0:$PORT src.app:app`

→ `https://your-app.onrender.com` で公開

## 3. ☁️ Heroku（有料プラン推奨）

```bash
# Heroku CLIインストール
curl https://cli-assets.heroku.com/install.sh | sh

# ログイン
heroku login

# アプリ作成
heroku create your-app-name

# デプロイ
git push heroku main

# 起動
heroku ps:scale web=1
```

## 4. 🌐 Railway（無料枠あり）

1. https://railway.app でサインアップ
2. 「Deploy from GitHub」
3. リポジトリ選択
4. 自動デプロイ開始

→ `https://your-app.up.railway.app` で公開

## 5. ⚡ Vercel/Netlify（静的サイト向き）

FlaskはWSGIなので、これらのプラットフォームには向きません。
代わりにRenderやRailwayを推奨。

---

## 推奨: ngrok（テスト用）+ Render（本番用）

- **今すぐ試す**: ngrok
- **長期運用**: Render.com（無料プランでOK）

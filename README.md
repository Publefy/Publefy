# Publefy

Платформа для создания и планирования контента в социальных сетях с AI-генерацией мемов.

## Технологии

### Backend
- Python 3.13, Flask + FastAPI
- MongoDB
- Google Vertex AI (Gemini)
- Google Cloud Storage

### Frontend
- Next.js 15, React 19
- TypeScript, Tailwind CSS
- Radix UI

## Требования

### Системные
- Python 3.13+
- Node.js 20+
- Tesseract OCR
- FFmpeg
- Google Cloud SDK

### Установка зависимостей (macOS)
```bash
brew install python@3.13 tesseract ffmpeg google-cloud-sdk
```

## Доступы

### Google Cloud
Для работы с Gemini AI и Cloud Storage нужен доступ к проекту `publefy-484406`:

1. Получить роль Editor/Owner в Google Cloud IAM
2. Авторизоваться:
```bash
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project publefy-484406
```

## Установка

### Backend
```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Отредактировать .env
```

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
```

## Запуск

### Backend
```bash
cd backend
source .venv/bin/activate
python run_uvicorn.py
# http://127.0.0.1:8000
```

### Frontend
```bash
cd frontend
npm run dev
# http://localhost:3000
```

## Переменные окружения (Backend)

| Переменная | Описание |
|------------|----------|
| MONGO_URI | MongoDB connection string |
| GEMINI_PROJECT | Google Cloud project ID |
| GEMINI_MODEL | Модель Gemini (gemini-2.0-flash-001) |
| TESSERACT_CMD | Путь к tesseract |
| VIDEO_BUCKET_NAME | GCS bucket для видео |
| FB_APP_ID, FB_APP_SECRET | Facebook OAuth |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Google OAuth |
| STRIPE_SECRET_KEY | Stripe API |
| SENTRY_DSN | Error tracking |

## URL после запуска

| URL | Описание |
|-----|----------|
| http://localhost:3000 | Frontend |
| http://127.0.0.1:8000/health | Health check |
| http://127.0.0.1:8000/docs | Swagger UI |

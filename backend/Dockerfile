FROM python:3.13-slim

WORKDIR /app

COPY . /app

RUN apt-get update && \
    apt-get install -y \
    tesseract-ocr \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Cloud Run предоставляет переменную PORT (по умолчанию 8080)
EXPOSE 8080

# Используем оболочку, чтобы подставить $PORT в bind
CMD ["sh", "-c", "exec gunicorn asgi_app:api -k uvicorn.workers.UvicornWorker -w 2 --threads 4 --timeout 600 --graceful-timeout 120 --bind 0.0.0.0:${PORT:-8080} --log-level info --forwarded-allow-ips=*"]

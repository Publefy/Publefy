import os
from dotenv import load_dotenv
load_dotenv()

# Initialize Sentry before importing other modules
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0,
        send_default_pii=True,
    )

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from asgiref.wsgi import WsgiToAsgi

# Import your existing Flask app
from main import flask_app

api = FastAPI(
    title="Publify API",
    description="FastAPI docs + legacy Flask mounted at /legacy",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS (mirror your Flask CORS)
api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://publefy.com",
        "https://www.publefy.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sentry is already initialized in main.py with FlaskIntegration
# No need to add Sentry middleware here to avoid conflicts

# Add native FastAPI routes first, then mount WSGI at the end to avoid shadowing

# Example FastAPI-native route that WILL appear in docs
from pydantic import BaseModel
class Health(BaseModel):
    status: str

@api.get("/health", response_model=Health, tags=["Health"])
def health():
    return {"status": "ok"}

# Mount your existing Flask app at the very end so it doesn't override /health and docs
api.mount("/legacy", WsgiToAsgi(flask_app))
api.mount("/", WsgiToAsgi(flask_app))

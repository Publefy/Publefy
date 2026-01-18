from pymongo import MongoClient
from pymongo.server_api import ServerApi
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    # Fallback to local Mongo for dev to avoid crashing /health if .env missing
    MONGO_URI = "mongodb://127.0.0.1:27017"

try:
    client = MongoClient(MONGO_URI, server_api=ServerApi("1"))
    client.admin.command("ping")
    print("✅ Connected to MongoDB")
except Exception as e:
    print("❌ MongoDB Connection Error:", e)
    # Create a lazy client anyway; operations will fail at call site, but ASGI can start
    client = MongoClient(MONGO_URI, server_api=ServerApi("1"))

db = client.get_database(os.getenv("MONGO_DB_NAME", "publefy_db"))

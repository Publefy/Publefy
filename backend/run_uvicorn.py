#!/usr/bin/env python3
"""
Uvicorn server runner for ASGI app
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set default environment variables for development
os.environ.setdefault("FLASK_DEBUG", "1")
os.environ.setdefault("PORT", "8000")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG") == "1"

    print(f"Starting ASGI server on http://0.0.0.0:{port}")
    print(f"Debug mode: {debug}")

    # Use import string for reload support
    uvicorn.run(
        "asgi_app:api",
        host="0.0.0.0",
        port=port,
        reload=debug,
        log_level="info",
        factory=False,
    )



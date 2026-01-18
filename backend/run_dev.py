#!/usr/bin/env python3
"""
Development server runner
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set default environment variables for development
os.environ.setdefault("FLASK_DEBUG", "1")
os.environ.setdefault("PORT", "8000")

# Import and run the Flask app directly
if __name__ == "__main__":
    from main import app
    
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG") == "1"
    
    print(f"Starting development server on http://127.0.0.1:{port}")
    print(f"Debug mode: {debug}")
    
    app.run(host="127.0.0.1", port=port, debug=debug)





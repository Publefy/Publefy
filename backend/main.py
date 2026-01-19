import os
import sys
import logging

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flasgger import Swagger

# ---- My Blueprints ------------------------------------------------ 
from routes.auth_routes import auth_blueprint
from routes.infrastructure_route import infrastructure_bp
from routes.profiles_route import profiles_bp
from routes.video_routes import video_blueprint
from routes.bank_memes_route import bank_memes_blueprint
from routes.analyze_route import analyze_blueprint
from routes.finalize_route import finalize_blueprint
from routes.instagram_route import instagram_bp
from routes.billing_routes import billing_blueprint
# --------------------------------------------------------------------

# ---- Logging --------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
# --------------------------------------------------------------------


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY")

    app.logger.setLevel(logging.INFO)
    app.logger.handlers = []
    app.logger.propagate = False

    # Max upload size: 100 MB
    app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

    # ---- CORS (only your allowed origins) ---------------------------
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://publefy.com",
            "https://www.publefy.com",
        ],
        allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
        methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS", "PUT"]
    )
    
    # Ensure CORS headers are always present, even on errors
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://publefy.com",
            "https://www.publefy.com",
        ]
        
        # If origin is in allowed list, use it; otherwise allow all for errors
        if origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        elif not response.headers.get("Access-Control-Allow-Origin"):
            # Fallback: allow the requesting origin if not already set
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                response.headers["Access-Control-Allow-Origin"] = "*"
        
        # Ensure other CORS headers are present
        if not response.headers.get("Access-Control-Allow-Methods"):
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, PATCH, OPTIONS, PUT"
        if not response.headers.get("Access-Control-Allow-Headers"):
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        
        return response
    # ----------------------------------------------------------------

    # ---- Swagger (Flasgger) ----------------------------------------
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "Publefy API",
            "description": "Swagger UI for the Publefy Flask app",
            "version": "1.0.0",
        },
        "basePath": "/",
        "schemes": ["https", "http"],
        "consumes": ["application/json", "application/x-www-form-urlencoded"],
        "produces": ["application/json"],
        "definitions": {
            "Health": {
                "type": "object",
                "properties": {"status": {"type": "string", "example": "ok"}},
            }
        },
    }
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/",
    }

    Swagger(app, template=swagger_template, config=swagger_config)
    # ----------------------------------------------------------------

    # ---- Simple health route (shows up in Swagger via docstring) ---
    @app.route("/health", methods=["GET"])
    def health():
        """
        Health check
        ---
        tags:
          - Health
        responses:
          200:
            description: Service status
            schema:
              $ref: '#/definitions/Health'
        """
        return jsonify({"status": "ok"}), 200
    # ----------------------------------------------------------------

    # ---- Register your existing blueprints --------------------------
    app.register_blueprint(video_blueprint)
    app.register_blueprint(auth_blueprint)
    app.register_blueprint(analyze_blueprint)
    app.register_blueprint(finalize_blueprint)
    app.register_blueprint(instagram_bp)
    app.register_blueprint(profiles_bp)
    app.register_blueprint(infrastructure_bp)
    app.register_blueprint(bank_memes_blueprint)
    app.register_blueprint(billing_blueprint)
    # ----------------------------------------------------------------

    # ---- Global error handlers with CORS ---------------------------
    from werkzeug.exceptions import HTTPException
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        """Handle all HTTP exceptions with CORS headers"""
        response = jsonify({"error": str(e.description), "message": str(e.description)})
        response.status_code = e.code
        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin and origin in [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://publefy.com",
            "https://www.publefy.com",
        ]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, PATCH, OPTIONS, PUT"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        return response

    @app.errorhandler(404)
    def not_found(error):
        response = jsonify({"error": "Not found"})
        response.status_code = 404
        origin = request.headers.get('Origin')
        if origin and origin in [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://publefy.com",
            "https://www.publefy.com",
        ]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    @app.errorhandler(500)
    def internal_error(error):
        response = jsonify({"error": "Internal server error"})
        response.status_code = 500
        origin = request.headers.get('Origin')
        if origin and origin in [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "https://publefy.com",
            "https://www.publefy.com",
        ]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    # ----------------------------------------------------------------

    return app


flask_app = create_app()

# Expose ASGI-compatible app for Uvicorn: `uvicorn main:app --reload`
from asgiref.wsgi import WsgiToAsgi
app = WsgiToAsgi(flask_app)
# Backward-compatible alias
asgi = app

if __name__ == "__main__": 
    port = int(os.getenv("PORT", "5000"))
    flask_app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
import logging
from flask import request, jsonify, g
from jose import JWTError
from database import db
from bson import ObjectId
import os
from functools import wraps
from auth.auth_handler import decode_access_token
from werkzeug.exceptions import Unauthorized

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"

def get_current_user():
    """
    Extract user info from Bearer token. Raises Unauthorized if invalid/missing.
    """
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise Unauthorized(description="Invalid authentication credentials (no token)")

    try:
        payload = decode_access_token(token=token)
        if payload is None or not isinstance(payload, dict):
            raise Unauthorized(description="Invalid authentication credentials (bad payload)")
        user_id = payload.get("sub")
        if not user_id:
            raise Unauthorized(description="Invalid authentication credentials (no sub)")
    except JWTError as error:
        logger.error(error)
        raise Unauthorized(description="Invalid authentication credentials (JWT error)")
    except Exception as error:
        logger.error(error)
        raise Unauthorized(description="Invalid authentication credentials (token error)")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise Unauthorized(description="Invalid authentication credentials (user not found)")

    user["_id"] = str(user["_id"])
    return user

def login_required(f):
    """
    Decorator to ensure route is only accessed by authenticated users.
    Sets g.current_user for the request.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user = get_current_user()
            g.current_user = user
        except Unauthorized as e: 
            return jsonify({"error": e.description}), 401
        return f(*args, **kwargs)
    return decorated_function
from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from core.converting import convert_objectId_to_str
from database import db
from models.platform import PlatformCreate

infrastructure_bp = Blueprint("infrastructure", __name__, url_prefix="/infrastructure")

@infrastructure_bp.route("/platforms", methods=["GET"])
def get_platforms():
    platforms_cursor = db.platforms.find()

    platforms_result = list(platforms_cursor)
    if not platforms_result:
        return jsonify({"error": "No platforms found"}), 404

    platforms_result = convert_objectId_to_str(platforms_result, is_need_del=True)

    return jsonify(platforms_result)

@infrastructure_bp.route("/platforms/create", methods=["POST"])
def create_platform():
    platform = request.get_json()
    platform = PlatformCreate(**platform)

    created_platform = platform.model_dump()

    create_result = db.platforms.insert_one(created_platform)

    if create_result.inserted_id:
        return jsonify(
            {
                "id": str(create_result.inserted_id),
            }
        )

    return BadRequest("Platform creation failed")
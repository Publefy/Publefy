import os
from flask import Blueprint, jsonify, request, g
from werkzeug.exceptions import BadRequest
from models.profile import ProfileCreate
from database import db
from bson import ObjectId
from auth.dependencies import login_required

profiles_bp = Blueprint("profiles", __name__, url_prefix="/profiles")

def _serialize_doc(doc):
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    doc.pop("user_id", None)           
    doc.pop("access_token", None)   
    return doc



@profiles_bp.route("/list", methods=["GET"])
@login_required
def profiles_list():
    user_id = g.current_user["_id"]
    allowed_profiles = db.profiles.find({"user_id": user_id})
    profiles_result = []
    for doc in allowed_profiles:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        doc.pop("user_id", None)
        doc.pop("access_token", None)
        if doc.get("ig_id"):
            doc["image"] = f"/instagram/profile-picture/{doc['ig_id']}"
        profiles_result.append(doc)
    return jsonify(profiles_result)



@profiles_bp.route("/create", methods=["POST"])
@login_required
def create_profile():
    profile_data = request.get_json()
    profile_data["user_id"] = g.current_user["_id"]
    try:
        profile = ProfileCreate(**profile_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    created_profile = profile.model_dump()
    create_result = db.profiles.insert_one(created_profile)
    if create_result.inserted_id:
        return jsonify({"id": str(create_result.inserted_id)})
    return jsonify({"error": "Profile creation failed"}), 400

@profiles_bp.route("/delete/<profile_id>", methods=["DELETE"])
@login_required
def delete_profile(profile_id):
    user_id = g.current_user["_id"]
    profile = db.profiles.find_one_and_delete({"_id": ObjectId(profile_id), "user_id": user_id})
    if not profile:
        return jsonify({"error": "Profile not found or not allowed"}), 404
    return jsonify({"message": "Profile deleted"})

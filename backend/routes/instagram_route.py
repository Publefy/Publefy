import os
import time
from urllib.parse import urlencode
from typing import Dict, Any
import tempfile
import requests
from bson import ObjectId
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, redirect, g , send_file, abort, Response, stream_with_context
from datetime import datetime
from pymongo import ReturnDocument
from core.converting import convert_objectId_to_str
from database import db
from models.posts.post import Post
from models.profile import ProfileCreate
from services.reel_service import update_post_data
from services.scheduler_service import (
    schedule_post,
    reschedule_post,
    delete_scheduled_post,
    publish_post,
    cancel_scheduled_job_only,
    resolve_video_url,
)
from services.graph_api import graph_get, debug_token, exchange_long_lived_user_token, is_token_invalid
from core.data.video_service import upload_video_to_gcloud, list_uploaded_reels_from_gcloud
from auth.auth_handler import decode_access_token
from auth.dependencies import login_required
import instaloader
from pymongo.errors import DuplicateKeyError
from bson.errors import InvalidId
from utils.time_parse import parse_to_utc_dt
import logging
from datetime import datetime, timezone
from io import BytesIO
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

load_dotenv()

FB_APP_ID = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
GRAPH_API_URL = "https://graph.facebook.com/v23.0"

instagram_bp = Blueprint("instagram", __name__, url_prefix="/instagram")

# ---- logging: prevent duplicate handlers ----
logger = logging.getLogger("publefy.instagram")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s|%(levelname)s|%(message)s"))
    logger.addHandler(_h)
logger.propagate = False
logger.setLevel(logging.INFO)



def _safe_zone(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo((tz_name or "UTC").strip() or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def _isoz(dt: datetime) -> str:
    """Return a UTC Z-terminated ISO string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def _delete_instagram_media(media_id: str | None, access_token: str | None) -> tuple[bool, str | None]:
    media_id = (media_id or "").strip()
    access_token = (access_token or "").strip()
    if not media_id or not access_token:
        return False, "missing media_id or access_token"
    try:
        resp = requests.delete(
            f"{GRAPH_API_URL}/{media_id}",
            params={"access_token": access_token},
            timeout=30,
        )
        if resp.status_code in (200, 404):
            return True, None
        payload = {}
        try:
            payload = resp.json()
        except Exception:
            payload = {}

        err = (payload.get("error") or {})
        code = err.get("code")
        subcode = err.get("error_subcode")
        msg = err.get("message") or resp.text[:300]

        # Permissions/token issues (code 10 or 190) shouldn't block local deletion; just log quietly.
        if code in (10, 190):
            logger.info(
                "Instagram media delete skipped due to token/permission issue (code=%s subcode=%s msg=%s) for %s",
                code,
                subcode,
                msg,
                media_id,
            )
            return False, msg

        logger.warning(
            "Failed to delete Instagram media %s: %s %s",
            media_id,
            resp.status_code,
            msg,
        )
        return False, msg
    except Exception as e:
        logger.warning("Exception deleting Instagram media %s: %s", media_id, e)
        return False, str(e)
    return False, "unknown_error"



def save_token(profile: Dict[str, Any]) -> None:
    try:
        db.profiles.insert_one(profile)
    except Exception as e:
        raise Exception(f"Failed to save profile: {str(e)}")

def load_profiles(user_id: str) -> list:
    try:
        return list(db.profiles.find({"user_id": user_id}))
    except Exception as e:
        raise Exception(f"Failed to load profiles: {str(e)}")

@instagram_bp.route("/login/", methods=["GET"])
@instagram_bp.route("/login", methods=["GET"])
def instagram_login():
    if not all([FB_APP_ID, REDIRECT_URI]):
        return jsonify({"error": "Missing required environment variables"}), 500

    token = request.args.get("state")  # JWT from frontend
    if not token:
        return jsonify({"error": "Missing auth token in state param"}), 400

    params = {
        "client_id": FB_APP_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_engagement,business_management,pages_read_user_content",
        "response_type": "code",
        "state": token
    }
    auth_url = f"https://www.facebook.com/v23.0/dialog/oauth?{urlencode(params)}"
    return redirect(auth_url)



@instagram_bp.route("/callback/", methods=["GET"])
@instagram_bp.route("/callback", methods=["GET"])
def instagram_callback():
    error = request.args.get("error")
    error_reason = request.args.get("error_reason")
    action = request.args.get("action")

    # If user cancelled or there's an error, redirect back to frontend
    if error == "access_denied" or error_reason == "user_denied" or action == "cancel":
        frontend_base = os.getenv("APP_WEB_REDIRECT_URI", "https://publefy.com").split(",")[0].strip()
        # Ensure we have a clean base URL without trailing slash for query param appending
        frontend_base = frontend_base.rstrip("/")
        return redirect(f"{frontend_base}/?instagram_connection=cancelled")

    code = request.args.get("code")
    token = request.args.get("state")

    if not code or not token:
        return jsonify({"error": "Missing code or state param"}), 400

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return jsonify({"error": "Invalid authentication credentials (bad token)"}), 401

    user_id = payload["sub"]

    try:
        token_res = requests.get(
            f"{GRAPH_API_URL}/oauth/access_token",
            params={
                "client_id": FB_APP_ID,
                "client_secret": FB_APP_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            },
            timeout=30,
        ).json()

        access_token = token_res.get("access_token")
        if not access_token:
            return jsonify({"error": "Failed to get access token", "details": token_res}), 400

        pages_res = requests.get(
            f"{GRAPH_API_URL}/me/accounts",
            params={"access_token": access_token},
            timeout=30,
        ).json()

        if "data" not in pages_res or not pages_res["data"]:
            return jsonify({"error": "Failed to get pages", "details": pages_res}), 400

        added_profiles = []

        for page in pages_res["data"]:
            page_token = page.get("access_token")
            page_id = page.get("id")
            if not page_token or not page_id:
                continue

            ig_res = requests.get(
                f"{GRAPH_API_URL}/{page_id}",
                params={
                    "fields": "instagram_business_account,picture{url}",
                    "access_token": page_token,
                },
                timeout=30,
            ).json()

            ig_id = (ig_res.get("instagram_business_account") or {}).get("id")
            if not ig_id:
                continue

            ig_user = requests.get(
                f"{GRAPH_API_URL}/{ig_id}",
                params={
                    "fields": "username,name,profile_picture_url",
                    "access_token": page_token,
                },
                timeout=30,
            ).json()

            channel_username = ig_user.get("username") or ""
            channel_name_fallback = ig_user.get("name") or ""
            channel_image = ig_user.get("profile_picture_url") or ""

            page_picture = ""
            try:
                page_picture = ((ig_res.get("picture") or {}).get("data") or {}).get("url", "")
            except Exception:
                page_picture = ""

            image = channel_image or page_picture

            profile = {
                "ig_id": ig_id,
                "name": channel_username or channel_name_fallback,   
                "image": image,
                "access_token": page_token,
                "platform": "instagram",
                "user_id": user_id,
            }

            profile_obj = ProfileCreate(**profile)
            created_profile = profile_obj.model_dump()
            save_token(created_profile)
            added_profiles.append(profile["name"])

        if not added_profiles:
            return jsonify({"error": "No Instagram business accounts found on any pages."}), 400

        return redirect("https://publefy.com")
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@instagram_bp.route("/profiles/", methods=["GET"])
@instagram_bp.route("/profiles", methods=["GET"])
@login_required
def get_instagram_profiles():
    try:
        user_id = g.current_user["_id"]
        profiles = load_profiles(user_id)
        profiles_result = []
        for doc in profiles:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            doc.pop("user_id", None)
            doc.pop("access_token", None)
            profiles_result.append(doc)
        return jsonify({"profiles": profiles_result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@instagram_bp.route("/logout", methods=["POST"])
@instagram_bp.route("/logout/", methods=["POST"])
@login_required
def logout_instagram():
    try:
        data = request.get_json(force=True)
        ig_id = data.get("ig_id")
        print("[/instagram/logout/] ig_id from payload:", ig_id)
        if not ig_id:
            print("No ig_id provided.")
            return jsonify({"error": "Missing ig_id"}), 400

        user_id = g.current_user.get("_id")
        print("[/instagram/logout/] User id from token:", user_id)
        if not user_id:
            print("No user_id in g.current_user!")
            return jsonify({"error": "User not authenticated."}), 401

        # Find the profile matching both ig_id and user_id
        profile = db.profiles.find_one({"ig_id": ig_id, "user_id": user_id})
        print("[/instagram/logout/] Profile found:", profile)
        if not profile:
            return jsonify({"error": "Profile not found or not allowed"}), 404

        # Delete the profile and its posts
        db.profiles.delete_one({"_id": profile["_id"], "user_id": user_id})
        db.posts.delete_many({"profile_id": str(profile["_id"])})

        print("[/instagram/logout/] Successfully deleted profile and posts.")
        return jsonify({
            "message": "Profile and associated posts have been deleted",
            "ig_id": ig_id,
            "profile_id": str(profile["_id"])
        }), 200

    except Exception as e:
        print("[/instagram/logout/] Exception:", e)
        return jsonify({"error": str(e)}), 500
    
# publish

@instagram_bp.route("/publish", methods=["POST"])
@instagram_bp.route("/publish/", methods=["POST"])
@login_required
def publish_reel():
    try:
        data = request.get_json(force=True)
        post_id = data.get("post_id")
        publish_now = bool(data.get("publish_now", True))
        move_schedule_to_now = bool(data.get("move_schedule_to_now", True))

        if not post_id:
            return jsonify({"error": "Missing post_id"}), 400

        # Allow callers to pass the scheduler job_id ("post_<id>") by stripping the prefix.
        normalized_post_id = str(post_id)
        if normalized_post_id.startswith("post_"):
            normalized_post_id = normalized_post_id.replace("post_", "", 1)

        post = db.posts.find_one({"id": normalized_post_id}) or db.posts.find_one({"_id": normalized_post_id})
        if not post:
            try:
                post = db.posts.find_one({"_id": ObjectId(normalized_post_id)})
            except Exception:
                post = None
        if not post:
            return jsonify({"error": "Post not found"}), 404

        prof = db.profiles.find_one({"_id": ObjectId(post["profile_id"]), "user_id": g.current_user["_id"]})
        if not prof:
            return jsonify({"error": "Profile not found or not allowed"}), 404

        try:
            cancel_scheduled_job_only(post.get("id") or str(post.get("_id")))
        except Exception as e:
            logger.warning("publish: failed cancelling job for %s: %s", post_id, e)

        terminal_ok = {"published", "live", "success"}
        current_status = str(post.get("status") or "").lower()

        STALE_MINUTES = 10
        cutoff_iso = (datetime.utcnow() - timedelta(minutes=STALE_MINUTES)).isoformat()
        attempted_at = str(post.get("publish_attempted_at") or "")
        is_publishing_stale = current_status == "publishing" and (attempted_at < cutoff_iso)

        if current_status in terminal_ok:
            return jsonify({"success": True,"result": {"status": post.get("status"), "id": post.get("id") or str(post.get("_id"))},"message": "Already published"}), 200
        if current_status == "publishing" and not is_publishing_stale:
            return jsonify({"success": True,"result": {"status": "publishing", "id": post.get("id") or str(post.get("_id"))},"message": "A publish is already in progress"}), 200

        # Determine client tz (from payload override -> stored on post -> default UTC)
        client_tz_name = data.get("client_tz") or post.get("client_tz") or "UTC"
        client_tz = _safe_zone(client_tz_name)

        claim_query = {
            "id": post["id"],
            "$or": [
                {"status": {"$nin": ["publishing", "published", "failed", "live", "success"]}},
                {"status": "publishing", "publish_attempted_at": {"$lt": cutoff_iso}},
            ],
        }
        now_utc = datetime.now(timezone.utc)

        claim_set = {
            "status": "publishing",
            "publish_now": publish_now,
            "publish_attempted_at": _isoz(now_utc),
            "publish_attempt_count": int(post.get("publish_attempt_count") or 0) + 1,
            "client_tz": client_tz_name,  # keep/refresh tz on the record
        }

        if move_schedule_to_now:
            claim_set.update({
                "scheduled_time": _isoz(now_utc),                           # UTC ISO (Z)
                "scheduled_unix": int(now_utc.timestamp()),                 # UTC epoch
                "scheduled_time_client": now_utc.astimezone(client_tz).isoformat(),  # local ISO with offset
            })

        claimed = db.posts.find_one_and_update(
            claim_query,
            {"$set": claim_set, "$unset": {"error": ""}},
            return_document=ReturnDocument.AFTER,
        )

        if not claimed:
            fresh = db.posts.find_one({"id": post["id"]})
            return jsonify({"success": True,"result": {"status": fresh.get("status"), "id": fresh.get("id")},"message": "Already published or in progress"}), 200

        def _publish_async(mongo_id, logical_id, scheduled_unix_value, client_tz_name_inner: str):
            client_tz_inner = _safe_zone(client_tz_name_inner)
            try:
                result, api_status = publish_post(logical_id)

                now_utc_inner = datetime.now(timezone.utc)
                now_iso = _isoz(now_utc_inner)
                now_unix = int(now_utc_inner.timestamp())
                local_iso = now_utc_inner.astimezone(client_tz_inner).isoformat()

                if api_status == 200 and str(result.get("status", "")).lower() in ("published", "success", "live"):
                    db.posts.update_one(
                        {"_id": mongo_id},
                        {"$set": {
                            "status": "published",
                            "published_at": now_iso,                # UTC Z
                            "published_unix": now_unix,             # UTC epoch
                            "published_at_client": local_iso,       # local ISO with offset
                            "published_via": "manual_now",
                            "published_early": bool(int(scheduled_unix_value or 0) and now_unix < int(scheduled_unix_value or 0)),
                        }, "$unset": {"error": ""}}
                    )
                elif api_status and api_status >= 400 or "error" in (result or {}):
                    db.posts.update_one({"_id": mongo_id},{"$set": {"status": "error", "error": result}})
                else:
                    db.posts.update_one({"_id": mongo_id},{"$set": {"status": str(result.get("status") or "publishing")}})
            except Exception as e:
                logger.exception("publish(async): exception for %s", logical_id)
                db.posts.update_one({"_id": mongo_id},{"$set": {"status": "error", "error": {"message": str(e)}}})

        threading.Thread(
            target=_publish_async,
            args=(claimed["_id"], claimed["id"], claimed.get("scheduled_unix"), client_tz_name),
            daemon=True,
        ).start()

        return jsonify({"success": True,"result": {"status": "publishing", "id": claimed["id"]},"message": "Publishing started"}), 202

    except Exception:
        logger.exception("Exception in /publish")
        return jsonify({"error": "Internal server error"}), 500



@instagram_bp.route("/schedule", methods=["POST"])
@instagram_bp.route("/schedule/", methods=["POST"])
@login_required
def schedule_post_endpoint():
    try:
        from bson import ObjectId

        data: dict = request.get_json(force=True)

        activate = bool(data.get("activate", True))
        client_tz_name = data.get("client_tz") or request.headers.get("X-Client-Timezone") or "UTC"
        client_tz = _safe_zone(client_tz_name)

        if not all([data.get("reel_id"), data.get("profile_id"), data.get("scheduled_time")]):
            return jsonify({"error": "Missing required fields"}), 400

        # Parse client-provided time to UTC
        try:
            scheduled_time_dt_utc = parse_to_utc_dt(data["scheduled_time"])
            scheduled_unix = int(scheduled_time_dt_utc.timestamp())
        except Exception as e:
            return jsonify({"error": "Invalid scheduled_time format", "details": str(e)}), 400

        # created_time & color defaults (avoid Pydantic None errors)
        ct_raw = data.get("created_time")
        if isinstance(ct_raw, str):
            try:
                created_time_dt = parse_to_utc_dt(ct_raw)
            except Exception:
                created_time_dt = datetime.now(timezone.utc)
        else:
            created_time_dt = datetime.now(timezone.utc)
        color_val = data.get("color") or ""

        # Build model (store UTC ISO in scheduled_time)
        new_oid = ObjectId()
        scheduled_post = Post(
            _id=str(new_oid),
            hashtags=data.get("hashtags", []),
            caption=data.get("caption", ""),
            scheduled_time=_isoz(scheduled_time_dt_utc),    # <-- UTC Z
            status="scheduled" if activate else "draft",
            profile_id=data["profile_id"],
            scheduled_unix=scheduled_unix,                  # <-- UTC epoch
            created_time=created_time_dt,
            color=color_val,
            reel_id=data["reel_id"],
            media_id=''
        )
        post = scheduled_post.model_dump(by_alias=True)
        post["id"] = str(new_oid)

        # Attach timezone + a convenient local string (optional but handy)
        post["client_tz"] = client_tz_name
        post["scheduled_time_client"] = scheduled_time_dt_utc.astimezone(client_tz).isoformat()

        # ownership + reel checks (unchanged)
        profile = db.profiles.find_one({"_id": ObjectId(post["profile_id"]), "user_id": g.current_user["_id"]})
        if not profile:
            return jsonify({"error": "Profile not found or not allowed"}), 404

        reel = db.reels.find_one({"reel_id": post["reel_id"]})
        if not reel:
            return jsonify({"error": "Reel not found"}), 404

        if activate:
            existing = db.posts.find_one({
                "profile_id": post["profile_id"],
                "reel_id": post["reel_id"],
                "scheduled_unix": post["scheduled_unix"],
                "status": {"$in": ["scheduled", "queued"]}
            })
            if existing:
                existing_id = existing.get("id") or str(existing.get("_id"))
                return jsonify({"status": "scheduled","id": existing_id,"message": "Already scheduled; returning existing schedule"}), 200

        db.posts.insert_one(post)

        if not activate:
            return jsonify({"status": "draft", "id": post["id"], "message": "Draft created; not scheduled yet"}), 201

        result, status_code = schedule_post({**post, "job_id": post["id"]})
        # include the post id to make publish calls easier
        return jsonify({**result, "id": post["id"]}), status_code

    except Exception as e:
        logger.exception("Exception in /schedule POST")
        return jsonify({"error": str(e)}), 500


@instagram_bp.route("/scheduled-posts/<post_id>", methods=["PATCH"])
@instagram_bp.route("/schedule", methods=["PATCH"])
@instagram_bp.route("/schedule/", methods=["PATCH"])
@login_required
def post_update(post_id=None):
    try:
        from bson import ObjectId

        data: dict = request.get_json(force=True)
        logger.info("[PATCH /instagram/schedule] Incoming data: %s", data)

        raw_id = post_id or data.get("id") or data.get("_id")
        if not raw_id:
            return jsonify({"error": "Missing post ID"}), 400

        # Handle temp IDs from frontend (explicitly state they can't be updated yet)
        if str(raw_id).startswith("temp-"):
            return jsonify({
                "error": "Cannot update a temporary post",
                "details": "The post ID provided ('{}') is a temporary frontend ID. You must first 'POST /instagram/schedule/' to create the post and obtain a permanent backend ID before attempting to 'PATCH' it.".format(raw_id)
            }), 400

        # Normalize post_id (remove 'post_' prefix if present)
        normalized_id = str(raw_id)
        if normalized_id.startswith("post_"):
            normalized_id = normalized_id.replace("post_", "", 1)

        activate = data.get("activate")  # None | True | False
        client_tz_name = data.get("client_tz") or request.headers.get("X-Client-Timezone")

        # Required time
        if not data.get("scheduled_time"):
            return jsonify({"error": "Missing scheduled_time"}), 400
        try:
            scheduled_time_dt_utc = parse_to_utc_dt(data["scheduled_time"])
            new_scheduled_unix = int(scheduled_time_dt_utc.timestamp())
        except Exception as e:
            return jsonify({"error": "Invalid scheduled_time format", "details": str(e)}), 400

        # locate post
        post = db.posts.find_one({"id": normalized_id}) or db.posts.find_one({"_id": normalized_id})
        if not post:
            try:
                post = db.posts.find_one({"_id": ObjectId(normalized_id)})
            except Exception:
                post = None
        if not post:
            return jsonify({"error": "Post not found"}), 404

        # ownership + reel
        profile = db.profiles.find_one({"_id": ObjectId(post["profile_id"]), "user_id": g.current_user["_id"]})
        if not profile:
            return jsonify({"error": "Profile not found or not allowed"}), 404
        reel = db.reels.find_one({"reel_id": post["reel_id"]})
        if not reel:
            return jsonify({"error": "Reel not found"}), 404

        # Use provided tz or keep previous
        effective_client_tz_name = client_tz_name or post.get("client_tz") or "UTC"
        client_tz = _safe_zone(effective_client_tz_name)

        allowed_keys = {"caption", "hashtags", "media_url"}
        update_data = {k: v for k, v in data.items() if k in allowed_keys}
        update_data.update({
            "scheduled_time": _isoz(scheduled_time_dt_utc),                    # <-- UTC ISO Z
            "scheduled_unix": new_scheduled_unix,
            "client_tz": effective_client_tz_name,
            "scheduled_time_client": scheduled_time_dt_utc.astimezone(client_tz).isoformat(),  # local ISO with offset
        })

        current_status = str(post.get("status") or "").lower()
        effective_id = post.get("id") or str(post.get("_id"))

        # duplicates check if becoming/being active
        if not (current_status == "draft" and activate is not True):
            dup = db.posts.find_one({
                "_id": {"$ne": post["_id"]},
                "profile_id": post["profile_id"],
                "reel_id": post["reel_id"],
                "scheduled_unix": new_scheduled_unix,
                "status": {"$in": ["scheduled", "queued"]}
            })
            if dup:
                dup_id = dup.get("id") or str(dup.get("_id"))
                return jsonify({"status": "scheduled","id": dup_id,"message": "Another schedule already exists at this time for the same reel."}), 200

        if current_status == "draft":
            if activate is True:
                db.posts.update_one({"_id": post["_id"]}, {"$set": {**update_data, "status": "scheduled"}})
                result, status_code = schedule_post({**post, **update_data, "id": effective_id, "job_id": effective_id})
                return jsonify(result), status_code
            else:
                db.posts.update_one({"_id": post["_id"]}, {"$set": update_data})
                return jsonify({"status": "draft", "id": effective_id, "message": "Draft updated"}), 200

        # active -> reschedule
        result, status_code = reschedule_post(effective_id, scheduled_time_dt_utc)
        if status_code == 200:
            db.posts.update_one({"_id": post["_id"]}, {"$set": {**update_data, "status": "scheduled"}})
        return jsonify(result), status_code

    except Exception as e:
        logger.exception("[PATCH /instagram/schedule] Exception")
        return jsonify({"error": str(e)}), 500



def update_scheduled_reel(post: dict, reel: dict, profile: dict) -> str:
    """
    Re-create the media container for this reel and (re)submit a Meta-side schedule.
    NOTE: If you prefer ONLY APScheduler-based scheduling, delete the Meta-side
    schedule part and publish immediately instead.
    """
    access_token = profile["access_token"]
    ig_id = profile["ig_id"]

    # Resolve a usable video URL (prefer post.media_url, then reel fields, coerced to public/signed)
    media_url, media_source = resolve_video_url(post, reel)
    if not media_url:
        raise Exception("No video_url available on reel or post (expected media_url/video_path/final_video_url).")
    logger.error("Resolved media_url for schedule: %s (source=%s)", media_url, media_source)
    try:
        head = requests.head(media_url, allow_redirects=True, timeout=8)
        logger.error("SCHEDULE VIDEO HEAD: %s %s content-type=%s", head.status_code, head.reason, head.headers.get("Content-Type"))
    except Exception as e:
        logger.error("SCHEDULE VIDEO HEAD failed: %s", e)

    # Clean up previous container if you have one
    old_media_id = post.get("media_id")
    if old_media_id:
        try:
            requests.delete(
                f"{GRAPH_API_URL}/{old_media_id}",
                params={"access_token": access_token},
                timeout=30,
            )
        except Exception:
            pass

    # Create a REELS container at /{ig_id}/media (NOT /feed)
    creation_res = requests.post(
        f"{GRAPH_API_URL}/{ig_id}/media",
        params={
            "media_type": "REELS",
            "video_url": media_url,
            "caption": post.get("caption", ""),
            "access_token": access_token,
            "share_to_feed": "true",
        },
        timeout=60,
    ).json()

    logger.error("\n\n====================== IG MEDIA CREATE ======================\n%s\n===============================================================", creation_res)


    creation_id = creation_res.get("id")
    if not creation_id:
        raise Exception(f"Failed to create new media container: {creation_res}")

    # Poll for processing completion
    max_attempts = 20
    for _ in range(max_attempts):
        status_res = requests.get(
            f"{GRAPH_API_URL}/{creation_id}",
            params={"fields": "status_code,status", "access_token": access_token},
            timeout=30,
        ).json()
        code = status_res.get("status_code") or status_res.get("status")
        if code == "FINISHED":
            break
        if code == "ERROR":
            raise Exception(f"Media processing failed: {status_res}")
        time.sleep(5)
    else:
        raise Exception("Media not ready after waiting")

    # Meta-side scheduling (keep only if you intend to use Meta scheduling)
    publish_res = requests.post(
        f"{GRAPH_API_URL}/{ig_id}/media_publish",
        params={
            "creation_id": creation_id,
            "access_token": access_token,
            "published": False,
            "scheduled_publish_time": int(post["scheduled_unix"]),
        },
        timeout=60,
    ).json()

    logger.error("\n\n====================== IG MEDIA PUBLISH ======================\n%s\n===============================================================", publish_res)


    if "id" not in publish_res:
        raise Exception(f"Scheduling failed: {publish_res}")

    return publish_res["id"]




@instagram_bp.route("/scheduled-posts", methods=["GET"])
@login_required
def get_scheduled_posts():
    try:
        user_id = g.current_user["_id"]
        profile_ids = [str(doc["_id"]) for doc in db.profiles.find({"user_id": user_id})]
        posts = list(db.posts.find({"profile_id": {"$in": profile_ids}}))
        posts = convert_objectId_to_str(posts)
        for post in posts:
            _attach_post_ui_fields(post)
        return jsonify(posts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def is_valid_objectid(oid):
    try:
        ObjectId(oid)
        return True
    except Exception:
        return False



@instagram_bp.route("/scheduled-posts/<post_id>", methods=["DELETE"])
@login_required
def delete_scheduled_post_endpoint(post_id):
    """
    Delete a scheduled post you own and cancel its scheduled job (if any).
    Works whether the post's id is stored in "id" (string) or "_id" (string/ObjectId).
    """
    try:
        logger.info("DELETE /instagram/scheduled-posts/%s", post_id)

        if str(post_id).startswith("temp-"):
            return jsonify({
                "error": "Cannot delete a temporary post",
                "details": "The post ID provided ('{}') is a temporary frontend ID. This post does not exist on the backend yet.".format(post_id)
            }), 400

        # Normalize post_id
        normalized_post_id = str(post_id)
        if normalized_post_id.startswith("post_"):
            normalized_post_id = normalized_post_id.replace("post_", "", 1)

        post = db.posts.find_one({"id": normalized_post_id}) or db.posts.find_one({"_id": normalized_post_id})
        if not post:
            try:
                post = db.posts.find_one({"_id": ObjectId(normalized_post_id)})
            except Exception:
                post = None

        if not post:
            logger.info("Post %s not found.", post_id)
            return jsonify({"error": "Post not found"}), 404

        try:
            profile_oid = ObjectId(post["profile_id"])
        except Exception:
            return jsonify({"error": "Invalid profile_id on post"}), 400

        user_id = g.current_user["_id"]
        profile = db.profiles.find_one({"_id": profile_oid, "user_id": user_id})
        if not profile:
            return jsonify({"error": "Not allowed"}), 403

        media_id = (post.get("media_id") or "").strip()
        if media_id:
            _delete_instagram_media(media_id, profile.get("access_token"))

        try:
            effective_id = post.get("id") or str(post.get("_id"))
            delete_scheduled_post(effective_id)
            logger.info("Scheduler job (if any) cancelled for post %s", effective_id)
        except Exception as e:
            logger.warning("Failed to cancel scheduled job for %s: %s", post_id, e)

        db.posts.delete_one({"_id": post["_id"]})
        logger.info("Deleted scheduled post %s", str(post["_id"]))

        return jsonify({"success": True, "deleted_id": str(post["_id"])}), 200

    except Exception as e:
        logger.exception("Exception in DELETE /scheduled-posts/<post_id>")
        return jsonify({"error": str(e)}), 500


@instagram_bp.route("/scheduled-posts/all", methods=["DELETE"])
@login_required
def delete_all_scheduled_posts_endpoint():
    try:
        user_id = g.current_user["_id"]
        profile_docs = list(db.profiles.find({"user_id": user_id}, {"_id": 1, "access_token": 1}))
        profile_ids = [str(doc["_id"]) for doc in profile_docs]
        token_map = {str(doc["_id"]): doc.get("access_token") for doc in profile_docs}

        if profile_ids:
            for post in db.posts.find({"profile_id": {"$in": profile_ids}}):
                profile_id = str(post.get("profile_id", ""))
                media_id = (post.get("media_id") or "").strip()
                if media_id and profile_id in token_map:
                    _delete_instagram_media(media_id, token_map.get(profile_id))

        db.posts.delete_many({"profile_id": {"$in": profile_ids}})
        return jsonify({"message": "All scheduled posts have been deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def schedule_reel_inst(post: dict, reel: dict, profile: dict) -> None:
    """
    Create a REELS container and schedule it on Meta. Use this ONLY if you are
    intentionally using Meta-side scheduling in addition to (or instead of)
    APScheduler.
    """
    access_token = profile["access_token"]
    ig_id = profile["ig_id"]

    media_url = (
        reel.get("media_url")
        or reel.get("video_path")
        or reel.get("final_video_url")
        or ""
    )
    if not media_url:
        raise Exception("No video_url available on reel (expected media_url/video_path/final_video_url).")

    creation = requests.post(
        f"{GRAPH_API_URL}/{ig_id}/media",
        params={
            "media_type": "REELS",
            "video_url": media_url,
            "caption": post.get("caption", ""),
            "access_token": access_token,
            "share_to_feed": "true",
        },
        timeout=60,
    ).json()

    creation_id = creation.get("id")
    if not creation_id:
        raise Exception(f"Media creation failed: {creation}")

    max_attempts = 100
    for _ in range(max_attempts):
        status_res = requests.get(
            f"{GRAPH_API_URL}/{creation_id}",
            params={"fields": "status_code,status", "access_token": access_token},
            timeout=30,
        ).json()
        code = status_res.get("status_code") or status_res.get("status")
        if code == "FINISHED":
            break
        if code == "ERROR":
            raise Exception(f"Media processing failed: {status_res}")
        time.sleep(5)
    else:
        raise Exception("Media not ready after waiting")

    publish = requests.post(
        f"{GRAPH_API_URL}/{ig_id}/media_publish",
        params={
            "creation_id": creation_id,
            "access_token": access_token,
            "published": False,
            "scheduled_publish_time": int(post["scheduled_unix"]),
        },
        timeout=60,
    ).json()

    if "id" not in publish:
        raise Exception(f"Scheduling failed: {publish}")

    # (Optional) if you store container id:
    # update_post_data({"id": post["id"], "media_id": creation_id, "status": "scheduled"})


@instagram_bp.route("/scheduled-posts/enriched", methods=["GET"])
@login_required
def get_enriched_scheduled_posts():
    """
    Return only the current user's schedules, enriched with profile name/image.
    window:
      - upcoming: scheduled/queued/publishing with scheduled_unix in future
      - old:     published/failed/error OR scheduled_unix in the past
      - all:     everything belonging to the user
    Optional filters: profile_id
    Pagination: page, limit
    """
    try:
        user_id = g.current_user["_id"]
        window = (request.args.get("window") or "all").lower()
        profile_filter = request.args.get("profile_id")
        page = max(int(request.args.get("page", 1)), 1)
        limit = max(min(int(request.args.get("limit", 25)), 100), 1)
        skip = (page - 1) * limit

        # collect this user's profile ids
        user_profile_docs = list(db.profiles.find({"user_id": user_id}, {"_id": 1}))
        user_profile_ids = [str(d["_id"]) for d in user_profile_docs]
        if not user_profile_ids:
            return jsonify({"posts": [], "page": page, "limit": limit, "total": 0})

        # base query: only posts for this user's profiles
        q = {"profile_id": {"$in": user_profile_ids}}

        now_unix = int(datetime.now(timezone.utc).timestamp())

        if window == "upcoming":
            q["status"] = {"$in": ["scheduled", "queued", "publishing"]}
            q["scheduled_unix"] = {"$gte": now_unix}
        elif window == "old":
            q["$or"] = [
                {"status": {"$in": ["published", "failed", "error", "live", "success"]}},
                {"scheduled_unix": {"$lt": now_unix}},
            ]
        # else "all": no extra filter

        if profile_filter:
            # ensure the requested profile belongs to the user
            if profile_filter not in user_profile_ids:
                return jsonify({"error": "Profile not found or not allowed"}), 403
            q["profile_id"] = profile_filter

        total = db.posts.count_documents(q)
        posts = list(
            db.posts.find(q)
            .sort([("scheduled_unix", 1)])
            .skip(skip)
            .limit(limit)
        )

        pmap = _profiles_map_for_user(user_id)
        enriched = _enrich_posts_with_profile_and_reel(posts, pmap)

        return jsonify({
            "posts": enriched,
            "page": page,
            "limit": limit,
            "total": total
        })
    except Exception as e:
        logger.exception("Exception in /scheduled-posts/enriched")
        return jsonify({"error": str(e)}), 500

@instagram_bp.route("/scheduled-posts/profile/<profile_id>", methods=["GET"])
@login_required
def get_scheduled_posts_for_profile(profile_id):
    """
    Return enriched schedules for a single profile owned by the current user.
    Query params: window (upcoming|old|all), page, limit
    """
    try:
        user_id = g.current_user["_id"]
        # authorize ownership
        prof = db.profiles.find_one({"_id": ObjectId(profile_id), "user_id": user_id})
        if not prof:
            return jsonify({"error": "Profile not found or not allowed"}), 404

        window = (request.args.get("window") or "all").lower()
        page = max(int(request.args.get("page", 1)), 1)
        limit = max(min(int(request.args.get("limit", 25)), 100), 1)
        skip = (page - 1) * limit

        q = {"profile_id": str(prof["_id"])}
        now_unix = int(datetime.now(timezone.utc).timestamp())

        if window == "upcoming":
            q["status"] = {"$in": ["scheduled", "queued", "publishing"]}
            q["scheduled_unix"] = {"$gte": now_unix}
        elif window == "old":
            q["$or"] = [
                {"status": {"$in": ["published", "failed", "error", "live", "success"]}},
                {"scheduled_unix": {"$lt": now_unix}},
            ]

        total = db.posts.count_documents(q)
        posts = list(
            db.posts.find(q)
            .sort([("scheduled_unix", 1)])
            .skip(skip)
            .limit(limit)
        )

        pmap = _profiles_map_for_user(user_id)
        enriched = _enrich_posts_with_profile(posts, pmap)


        return jsonify({"posts": enriched, "page": page, "limit": limit, "total": total})
    except InvalidId:
        return jsonify({"error": "Invalid profile_id"}), 400
    except Exception as e:
        logger.exception("Exception in /scheduled-posts/profile/<id>")
        return jsonify({"error": str(e)}), 500

@instagram_bp.route("/scheduled-posts/<post_id>/enriched", methods=["GET"])
@login_required
def get_single_scheduled_post_enriched(post_id):
    """
    Return one post by id (string id or _id), enriched with profile meta,
    only if it belongs to the current user.
    """
    try:
        user_id = g.current_user["_id"]

        # locate by id mirror or _id
        post = db.posts.find_one({"id": post_id}) or db.posts.find_one({"_id": post_id})
        if not post:
            try:
                post = db.posts.find_one({"_id": ObjectId(post_id)})
            except Exception:
                post = None
        if not post:
            return jsonify({"error": "Post not found"}), 404

        # authorize profile ownership
        try:
            prof_oid = ObjectId(post["profile_id"])
        except Exception:
            return jsonify({"error": "Corrupt post.profile_id"}), 500

        prof = db.profiles.find_one({"_id": prof_oid, "user_id": user_id})
        if not prof:
            return jsonify({"error": "Not allowed"}), 403

        pmap = _profiles_map_for_user(user_id)
        enriched = _enrich_posts_with_profile([post], pmap)[0]

        return jsonify({"post": enriched})
    except Exception as e:
        logger.exception("Exception in /scheduled-posts/<id>/enriched")
        return jsonify({"error": str(e)}), 500





################ helper ##############
def _profiles_map_for_user(user_id: str) -> dict:
    """
    Returns {profile_id(str): {"name":..., "image":..., "ig_id":...}} for this user.
    """
    mapping = {}
    for p in db.profiles.find({"user_id": user_id}, {"name": 1, "image": 1, "ig_id": 1}):
        mapping[str(p["_id"])] = {
            "name": p.get("name", ""),
            "image": p.get("image", ""),
            "ig_id": p.get("ig_id", ""),
        }
    return mapping


def _attach_post_ui_fields(post: dict) -> None:
    """
    Normalize fields required by the posted reels UI and FB review.
    """
    message = post.get("message") or post.get("caption") or ""
    post["message"] = message

    created = (
        post.get("media_created_time")
        or post.get("published_at")
        or post.get("created_time")
        or ""
    )
    post["created_time"] = created

    post["permalink_url"] = post.get("permalink_url") or post.get("permalink") or ""

    thumb = post.get("thumbnail") or post.get("thumbnail_url") or ""
    post["thumbnail"] = thumb


def _enrich_posts_with_profile(posts: list, pmap: dict) -> list:
    """
    Adds profile_name, profile_image, and ig_id to each post and normalizes ids.
    """
    enriched = []
    for post in posts:
        pid = str(post.get("profile_id", ""))
        meta = pmap.get(pid, {})
        # normalize ids for client
        post["id"] = post.get("id") or str(post.get("_id"))
        if "_id" in post:
            del post["_id"]
        post["profile_name"] = meta.get("name", "")
        post["profile_image"] = meta.get("image", "")
        post["ig_id"] = meta.get("ig_id", "")
        _attach_post_ui_fields(post)
        enriched.append(post)
    return enriched

def _enrich_posts_with_profile_and_reel(posts: list, pmap: dict) -> list:
    """
    Extends _enrich_posts_with_profile by also attaching reel media info.
    Adds: reel_video_url, reel_thumbnail_url.
    """
    # Build profile enrichment first (reuse your existing behavior)
    enriched = _enrich_posts_with_profile(posts, pmap)

    # Collect reel_ids in bulk
    reel_ids = {p.get("reel_id") for p in enriched if p.get("reel_id")}
    if not reel_ids:
        return enriched

    # Fetch reels once
    reels = list(db.reels.find({"reel_id": {"$in": list(reel_ids)}}))
    rmap = {r.get("reel_id"): r for r in reels}

    for p in enriched:
        rid = p.get("reel_id")
        r = rmap.get(rid) or {}
        # Prefer fields that actually exist in your DB
        # From your code: upload saves "media_url", elsewhere you sometimes reference "video_path"
        p["reel_video_url"] = r.get("media_url") or r.get("video_path") or r.get("final_video_url") or ""
        p["reel_thumbnail_url"] = r.get("thumbnail_url") or r.get("poster_url") or ""
        if not p.get("thumbnail"):
            p["thumbnail"] = p.get("reel_thumbnail_url") or ""
    return enriched




# Handle Instaloader
@instagram_bp.route("/reels/user/<username>", methods=["GET"])
@login_required
def get_instagram_reels_by_user(username):
    max_count = int(request.args.get("max_count", 10))
    try:
        reels = fetch_reels_by_username(username, max_count=max_count)
        return jsonify({"reels": reels})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@instagram_bp.route("/reels/hashtag/<hashtag>", methods=["GET"])
@login_required
def get_instagram_reels_by_hashtag(hashtag):
    max_count = int(request.args.get("max_count", 10))
    try:
        reels = fetch_reels_by_hashtag(hashtag, max_count=max_count)
        return jsonify({"reels": reels})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
def fetch_reels_by_hashtag(hashtag, max_count=10):
    L = instaloader.Instaloader(
        download_pictures=False,
        download_video_thumbnails=False,
        download_geotags=False,
        save_metadata=False,
        download_comments=False,
    )
    results = []
    try:
        hashtag_posts = instaloader.Hashtag.from_name(L.context, hashtag).get_posts()
        count = 0
        for post in hashtag_posts:
            if post.is_video:
                # Extract hashtags from caption if needed
                hashtags = []
                if post.caption:
                    hashtags = [tag.lstrip('#') for tag in post.caption.split() if tag.startswith('#')]
                results.append({
                    "shortcode": post.shortcode,
                    "caption": post.caption,
                    "media_type": "VIDEO",
                    "media_url": post.video_url,
                    "thumbnail_url": post.url,
                    "likes": post.likes,
                    "comments_count": post.comments,
                    "owner_username": post.owner_username,
                    "taken_at": post.date_utc.isoformat(),
                    "permalink": f"https://www.instagram.com/p/{post.shortcode}/",
                    "hashtags": hashtags,
                })
                count += 1
                if count >= max_count:
                    break
    except Exception as e:
        raise Exception(f"Error fetching hashtag #{hashtag}: {e}")
    return results

@instagram_bp.route("/reels/hashtag-api/<hashtag>", methods=["GET"])
@login_required
def get_reels_by_hashtag_api(hashtag):
    try:
        user_id = g.current_user["_id"]

        # Get one profile with access_token
        profile = db.profiles.find_one({"user_id": user_id})
        if not profile:
            return jsonify({"error": "No linked Instagram profile found"}), 404

        access_token = profile["access_token"]
        ig_user_id = profile["ig_id"]

        # Step 1: Get hashtag ID
        hashtag_res = requests.get(
            f"https://graph.facebook.com/v19.0/ig_hashtag_search",
            params={
                "user_id": ig_user_id,
                "q": hashtag,
                "access_token": access_token
            }
        ).json()

        hashtag_data = hashtag_res.get("data", [])
        if not hashtag_data:
            return jsonify({"error": f"No hashtag found for '{hashtag}'"}), 404

        hashtag_id = hashtag_data[0]["id"]

        # Step 2: Get recent media for hashtag
        media_res = requests.get(
            f"https://graph.facebook.com/v19.0/{hashtag_id}/recent_media",
            params={
                "user_id": ig_user_id,
                "fields": "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
                "access_token": access_token
            }
        ).json()

        if "data" not in media_res:
            return jsonify({"error": "Failed to fetch media", "details": media_res}), 500

        # Filter only REELS (media_type == VIDEO or reel-related captions)
        media_items = [
            {
                "id": item["id"],
                "caption": item.get("caption", ""),
                "media_type": item["media_type"],
                "media_url": item.get("media_url", ""),
                "thumbnail_url": item.get("thumbnail_url", ""),
                "permalink": item.get("permalink", ""),
                "timestamp": item.get("timestamp", ""),
                "like_count": item.get("like_count", 0),
                "comments_count": item.get("comments_count", 0),
            }
            for item in media_res["data"]
            if item["media_type"] == "VIDEO"
        ]

        return jsonify({"reels": media_items})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def fetch_reels_by_username(username, max_count=10):
    L = instaloader.Instaloader(
        download_pictures=False,
        download_video_thumbnails=False,
        download_geotags=False,
        save_metadata=False,
        download_comments=False,
    )
    results = []
    try:
        profile = instaloader.Profile.from_username(L.context, username)
        count = 0
        for post in profile.get_posts():
            if post.is_video:
                hashtags = []
                if post.caption:
                    hashtags = [tag.lstrip('#') for tag in post.caption.split() if tag.startswith('#')]
                results.append({
                    "shortcode": post.shortcode,
                    "caption": post.caption,
                    "media_type": "VIDEO",
                    "media_url": post.video_url,
                    "thumbnail_url": post.url,
                    "likes": post.likes,
                    "comments_count": post.comments,
                    "owner_username": post.owner_username,
                    "taken_at": post.date_utc.isoformat(),
                    "permalink": f"https://www.instagram.com/p/{post.shortcode}/",
                    "hashtags": hashtags,
                })
                count += 1
                if count >= max_count:
                    break
    except Exception as e:
        raise Exception(f"Error fetching user @{username}: {e}")
    return results

@instagram_bp.route("/reels/world-top", methods=["GET"])
@login_required
def get_world_top_reels():
    """
    Fetches top reels across several trending/popular hashtags.
    Returns reels sorted by like count, most popular first.
    """
    try:
        trending_hashtags = [
            "trending", "viral", "funny", "news", "sports", "music", "love",
            "travel", "fashion", "reels", "explore", "entertainment"
        ]
        max_per_hashtag = 5
        all_reels = []
        errors = []

        for hashtag in trending_hashtags:
            try:
                reels = fetch_reels_by_hashtag(hashtag, max_count=max_per_hashtag)
                all_reels.extend(reels)
            except Exception as e:
                errors.append(str(e))

        all_reels = sorted(
            all_reels,
            key=lambda x: (x.get("likes", 0), x.get("comments_count", 0)),
            reverse=True
        )

        top_reels = all_reels[:25]

        return jsonify({"reels": top_reels, "errors": errors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# uploading reels
@instagram_bp.route("/upload-reel", methods=["POST"])
@login_required
def upload_selected_reel_to_gcs():
    """
    Upload a single Instagram reel (selected by user) to Google Cloud Storage and save metadata.
    Expects JSON with keys like:
        id, caption, media_url, permalink, thumbnail_url, timestamp, like_count, comments_count, media_type
    Returns GCS URL and saved metadata.
    """
    try:
        data = request.get_json(force=True)
        reel_id = data.get("reel_id") or data.get("id")
        media_url = data.get("media_url")
        if not reel_id or not media_url:
            return jsonify({"error": "Missing media_url or reel_id"}), 400

        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
            temp_filename = temp_video.name
            resp = requests.get(media_url, stream=True, timeout=30)
            if resp.status_code == 200:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        temp_video.write(chunk)
            else:
                return jsonify({"error": "Failed to download video"}), 502

        destination_blob_name = f"instagram_reels/{reel_id}.mp4"
        uploaded = upload_video_to_gcloud(temp_filename, destination_blob_name)

        os.remove(temp_filename)

        if not uploaded:
            return jsonify({"error": "Failed to upload to GCloud"}), 500

        bucket_name = os.getenv("VIDEO_BUCKET_NAME")
        gcs_url = f"https://storage.googleapis.com/{bucket_name}/{destination_blob_name}"

        reel_doc = {
            "reel_id": reel_id,
            "caption": data.get("caption", ""),
            "media_url": gcs_url,
            "permalink": data.get("permalink", ""),
            "thumbnail_url": data.get("thumbnail_url", ""),
            "timestamp": data.get("timestamp", ""),
            "like_count": data.get("like_count", 0),
            "comments_count": data.get("comments_count", 0),
            "media_type": data.get("media_type", "VIDEO"),
            "uploaded_by": g.current_user.get("_id"),
        }
        from database import db
        db.reels.update_one(
            {"reel_id": reel_id},
            {"$set": reel_doc},
            upsert=True
        )

        return jsonify({
            "success": True,
            "reel": reel_doc
        })

    except Exception as e:
        try:
            if 'temp_filename' in locals() and os.path.exists(temp_filename):
                os.remove(temp_filename)
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500

@instagram_bp.route("/my-uploaded-reels", methods=["GET"])
@login_required
def list_my_uploaded_reels():
    """
    Returns all Instagram reels your backend has uploaded (with metadata), for this user,
    and includes a download_url for each reel.
    """
    try:
        from database import db
        user_id = g.current_user.get("_id")

        reels = list(db.reels.find({"uploaded_by": user_id}))

        for reel in reels:
            reel["id"] = str(reel.get("_id", ""))
            if "_id" in reel:
                del reel["_id"]
            if "filename" not in reel and "reel_id" in reel:
                reel["filename"] = f"instagram_reels/{reel['reel_id']}.mp4"
            if "filename" in reel:
                reel["download_url"] = (
                    f"/instagram/download-uploaded-reel/{reel['filename']}"
                )

        return jsonify({"reels": reels})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@instagram_bp.route("/download-uploaded-reel/<path:filename>", methods=["GET"])
@login_required
def download_uploaded_reel(filename):
    from core.data.video_service import download_video_reels_from_gcloud

    user_id = g.current_user.get("_id")
    reel_doc = db.reels.find_one({"filename": filename, "uploaded_by": user_id})

    if not reel_doc:
        possible_reel_id = filename.split('/')[-1].replace('.mp4', '')
        reel_doc = db.reels.find_one({"reel_id": possible_reel_id, "uploaded_by": user_id})

    if not reel_doc:
        print(f"[ERROR] Reel not found or unauthorized. Filename: {filename}, User: {user_id}")
        abort(403, "You are not allowed to access this reel.")

    video_bytes = download_video_reels_from_gcloud(filename)
    if not video_bytes:
        print(f"[ERROR] GCS blob not found or download failed for: {filename}")
        abort(404, "Video not found in GCS.")

    try:
        from flask import send_file
        import io

        fileobj = io.BytesIO(video_bytes)
        fileobj.seek(0)

        return send_file(
            fileobj,
            mimetype="video/mp4",
            as_attachment=False,
            download_name=filename.split("/")[-1]
        )
    except Exception as e:
        print(f"[ERROR] Failed to stream video: {e}")
        abort(500, "Failed to stream video.")


@instagram_bp.route("/reel-download-url/<reel_id>", methods=["GET"])
@login_required
def get_download_url_for_reel(reel_id):
    if reel_id.endswith(".mp4"):
        reel_id = reel_id.replace(".mp4", "")

    user_id = g.current_user.get("_id")
    reel = db.reels.find_one({"reel_id": reel_id, "uploaded_by": user_id})
    if not reel:
        return jsonify({"error": "Reel not found"}), 404

    filename = reel.get("filename") or f"instagram_reels/{reel_id}.mp4"
    download_url = f"/instagram/download-uploaded-reel/{filename}"
    return jsonify({"download_url": download_url})


@instagram_bp.route("/profile-picture/<ig_id>", methods=["GET", "OPTIONS"])
@login_required
def get_instagram_profile_picture(ig_id):
    """
    Streams the Instagram profile picture for the given ig_id as raw image bytes.
    If `?meta=1` is provided (or Accept: application/json), returns JSON:
      { ig_id, username, name, profile_picture_url }
    """
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    try:
        logger.info(f"Getting profile picture for ig_id: {ig_id}")
        
        # ---- authorize ownership ------------------------------------------------
        user_id = g.current_user["_id"]
        prof = db.profiles.find_one({"ig_id": ig_id, "user_id": user_id})
        if not prof:
            logger.warning(f"Profile not found for ig_id {ig_id} and user_id {user_id}")
            return jsonify({"error": "Profile not found or not allowed"}), 404

        access_token = prof.get("access_token")
        if not access_token:
            logger.error(f"No access token for ig_id {ig_id}")
            return jsonify({"error": "Missing page access token for this profile"}), 500

        # ---- decide response mode: JSON vs image --------------------------------
        wants_json = request.args.get("meta") == "1" or "application/json" in (request.headers.get("Accept") or "").lower()

        # ---- fetch profile metadata (username, name, picture url) ---------------
        logger.info(f"Fetching metadata from Graph API for ig_id {ig_id}")
        meta_res = requests.get(
            f"{GRAPH_API_URL}/{ig_id}",
            params={"fields": "username,name,profile_picture_url", "access_token": access_token},
            timeout=20,
        )
        
        logger.info(f"Graph API response status: {meta_res.status_code}")
        
        if meta_res.status_code != 200:
            logger.error(f"Graph API failed for ig_id {ig_id}: {meta_res.status_code} - {meta_res.text[:200]}")
            return jsonify({
                "error": "Failed to fetch profile metadata",
                "details": {"status": meta_res.status_code, "text": meta_res.text[:500]}
            }), 502

        meta_json = meta_res.json() or {}
        profile_picture_url = meta_json.get("profile_picture_url") or prof.get("image") or ""
        username = meta_json.get("username") or prof.get("username") or ""
        name = meta_json.get("name") or prof.get("name") or ""

        logger.info(f"Got profile data: username={username}, name={name}, has_picture={bool(profile_picture_url)}")

        if wants_json:
            resp = jsonify({
                "ig_id": ig_id,
                "username": username,
                "name": name,
                "profile_picture_url": profile_picture_url,
            })
            resp.headers["Cache-Control"] = "private, max-age=900"
            return resp

        # ---- no URL? ------------------------------------------------------------
        if not profile_picture_url:
            logger.warning(f"No profile picture URL for ig_id {ig_id}")
            return jsonify({"error": "No profile picture available"}), 404

        # ---- stream the image from upstream ------------------------------------
        logger.info(f"Streaming image from: {profile_picture_url}")
        
        def generate():
            try:
                with requests.get(profile_picture_url, timeout=30, stream=True) as r:
                    r.raise_for_status()
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            yield chunk
            except Exception as e:
                logger.error(f"Error streaming image for ig_id {ig_id}: {str(e)}")
                # Return an error image or empty response
                yield b''

        content_type = "image/jpeg"  # Default, Instagram usually returns JPEG
        
        # Build a streamed response
        resp = Response(stream_with_context(generate()), mimetype=content_type)
        resp.headers["Cache-Control"] = "private, max-age=3600"
        
        return resp

    except Exception as e:
        logger.exception(f"Unexpected error in /instagram/profile-picture/{ig_id}")
        return jsonify({"error": str(e), "type": type(e).__name__}), 500


def safe_json(r):
    try:
        return r.json()
    except Exception:
        return {"status": r.status_code, "text": r.text[:500]}

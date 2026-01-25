"""
=======================================================================
 analyze_route.py — Standalone Flask route for video meme generation
=======================================================================

This file handles the /video/analyze/ endpoint independently.
✅ All logic is fully self-contained in this file.
📦 Includes:
    - File handling
    - Gemini video/audio summarization
    - Meme generation (5 captions)
    - Synchronous request-response

=======================================================================
"""

import os
import re
import shutil
import mimetypes
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from google import genai
from google.genai import types
from google.auth import default as google_auth_default
from core.gemini_funny_comment_generator import generate_meme_captions
from auth.dependencies import login_required
from database import db

# --- Sentry ---
import sentry_sdk

analyze_blueprint = Blueprint("analyze", __name__, url_prefix="/video")

@analyze_blueprint.route("/analyze", methods=["POST"])
@analyze_blueprint.route("/analyze/", methods=["POST"])
@login_required
def analyze_video():
    if "file" not in request.files:
        sentry_sdk.capture_message("Analyze: Missing video!", level="warning")  # --- Sentry ---
        return jsonify({"error": "Missing video!"}), 400

    # --- Points Check: Verify user has enough points BEFORE starting generation (skip for unlimited plan) ---
    try:
        user_id = str(g.current_user["_id"])
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            return jsonify({"error": "User not found"}), 404
        
        # Check if user has unlimited plan or promo code
        sub = user_doc.get("subscription", {})
        plan = (sub.get("plan") or user_doc.get("plan") or "free").lower()
        has_unlimited_promo = sub.get("has_unlimited_promo") or sub.get("unlimited_promo_id") == "promo_1SrJ9rB7l4Z4dfAwdAO1OdBp"
        is_unlimited = plan == "unlimited" or has_unlimited_promo
        
        # Skip points check for unlimited plan
        if not is_unlimited:
            usage = user_doc.get("usage")
            
            # Lazy initialization for existing users missing usage field
            if not usage:
                usage = {
                    "points_balance": 16,
                    "points_total_limit": 16,
                    "points_used": 0,
                    "total_videos_generated": 0
                }
                db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"usage": usage}})
            
            balance = usage.get("points_balance", 0)
            
            # Analysis costs 1 point
            required_points = 1
            if balance < required_points:
                return jsonify({
                    "error": "insufficient_points",
                    "message": f"You don't have enough points to analyze this video. You need {required_points} point but only have {balance} points remaining. Please upgrade your plan to get more points.",
                    "points_balance": balance,
                    "points_required": required_points
                }), 403
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return jsonify({"error": "Failed to check points balance"}), 500

    file = request.files["file"]
    _, ext = os.path.splitext(file.filename)
    reel_id = str(ObjectId())
    industry = (request.form.get("industry") or "").strip()

    # --- Sentry: Add request context
    sentry_sdk.set_context("analyze_video_request", {
        "filename": file.filename,
        "reel_id": reel_id,
        "industry": industry or None,
    })

    os.makedirs("uploads", exist_ok=True)
    os.makedirs("temp", exist_ok=True)

    temp_path = f"temp/temp_{reel_id}{ext}"
    original_path = f"uploads/reel_{reel_id}_original{ext}"
    with open(temp_path, "wb") as f_out:
        shutil.copyfileobj(file, f_out)
    shutil.copy(temp_path, original_path)

    try:
        video_summary, audio_summary = summarize_video_and_audio(temp_path)
        meme_options = generate_meme_captions(
            video_summary=video_summary,
            audio_summary=audio_summary,
            num_options=5,
            temperature=0.3,
            keyword=industry or ""
        )

        # --- CLEANUP STEP ---
        for fpath in [temp_path, original_path]:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception as cleanup_err:
                sentry_sdk.capture_message(f"Warning: Could not clean up {fpath}: {cleanup_err}", level="warning")  # --- Sentry ---

        return jsonify({
            "reel_id": reel_id,
            "video_summary": video_summary,
            "audio_summary": audio_summary,
            "meme_options": meme_options[:5],
            "industry": industry or None
        })

    except Exception as e:
        # --- Sentry: Capture unexpected errors with context ---
        sentry_sdk.capture_exception(e)
        # --- CLEANUP EVEN ON ERROR ---
        for fpath in [temp_path, original_path]:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception as cleanup_err:
                sentry_sdk.capture_message(f"Warning: Could not clean up {fpath}: {cleanup_err}", level="warning")  # --- Sentry ---

        return jsonify({"error": str(e)}), 500


# ==============================
#  ^=^t  Summarize Video + Audio
# ==============================
def summarize_video_and_audio(video_path: str):
    credentials, project_id = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    
    gemini_project = os.getenv("GEMINI_PROJECT", "publefy-484406")
    gemini_location = os.getenv("GEMINI_LOCATION_VIDEO", "us-central1")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

    client = genai.Client(
        vertexai=True,
        project=project_id or gemini_project,
        location=gemini_location,
        credentials=credentials
    )

    mime_type = mimetypes.guess_type(video_path)[0]
    with open(video_path, "rb") as f:
        video_data = f.read()

    video_part = types.Part.from_bytes(data=video_data, mime_type=mime_type)

    prompt_text = """
You are a professional video summarizer.

Please describe the uploaded video in **two clear sections**, each limited to **2 ^`^s3 lines only**:

1. **Video Summary**: Describe what visually happens  ^`^t including scene, characters, actions, and mood. Be concise but descriptive.

2. **Audio Summary**: Describe the audio  ^`^t music style, sound effects, speech, and emotional tone. Keep it short and focused.

Use the following format exactly:

**Video:** [Your short 2 ^`^s3 line summary here]

**Audio:** [Your short 2 ^`^s3 line summary here]
"""
    prompt_part = types.Part.from_text(text=prompt_text)

    contents = [types.Content(role="user", parts=[video_part, prompt_part])]
    config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=8192,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ]
    )

    result = ""
    for chunk in client.models.generate_content_stream(
        model=gemini_model, contents=contents, config=config
    ):
        result += chunk.text

    result = result.replace("**", "")
    audio_match = re.search(r"Audio:\s*(.*)", result, re.DOTALL)
    video_match = re.search(r"(Video:|Content:)\s*(.*?)\n\s*Audio:", result, re.DOTALL)

    video_summary = video_match.group(2).strip() if video_match else ""
    audio_summary = audio_match.group(1).strip() if audio_match else ""

    return video_summary, audio_summary

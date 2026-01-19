from itertools import count
import os
import re
import random
import hashlib
import mimetypes
import cv2
import numpy as np
from moviepy import VideoFileClip, ImageSequenceClip
from tempfile import NamedTemporaryFile
import shutil 
from datetime import timedelta, datetime, timezone
from urllib.parse import quote,unquote, urlparse
import threading
from contextlib import contextmanager
from database import db
from bson import ObjectId
from flask import Blueprint, request, jsonify, Response, redirect, url_for, g, abort
from core.data.gcloud_repo import GCloudRepository
from core.data.video_service import upload_video_to_gcloud  # noqa: F401 (kept for parity)
from services.reel_service import create_reel, create_reel_for_mem, sanitize_filename
from auth.dependencies import login_required
import sentry_sdk
from uuid import uuid4 
from types import SimpleNamespace
from email.utils import formatdate
import tempfile
import subprocess
import shlex
# Gemini SDK (same style as analyze_route.py)
from google import genai
from google.genai import types
from google.auth import default as google_auth_default


def _now_iso():
    return datetime.now(timezone.utc).isoformat()

bank_memes_blueprint = Blueprint("bank_memes", __name__, url_prefix="/memes")


PROMPT_BANK = [
    # General viral/meme
    "#relatable", "#sayless", "#mood", "#facts", "#unpopularopinion", "#lowkey",
    "#highkey", "#ihadto", "#sorrynotsorry", "#cantrelate", "#sameenergy",
    "#plotwist", "#thatswild", "#tellmeimwrong", "#toosoon", "#sendhelp",
    "#adulting", "#thisyou", "#okbutwhy", "#beffr", "#maincharacter",
    "#delulu", "#ratio", "#letmecook", "#itsgiving", "#whostoppingme",
    "#viral", "#fyp", "#memes", "#funny", "#lol", "#dank", "#comedy",
    "#trending", "#explorepage", "#reels", "#reelsdaily",

    # Fitness / gym (stronger coverage; note the corrected spelling)
    "#fitness", "#gym", "#gymtok", "#workout", "#legday", "#pushpulllegs",
    "#bodybuilding", "#powerlifting", "#weightlifting", "#hypertrophy",
    "#calisthenics", "#cardio", "#health", "#wellness", "#fitspo",
    "#gymhumor", "#gymmemes", "#preworkout", "#bro", "#gymrat", "#protein",

    # Motivation / mindset
    "#grind", "#hustle", "#noexcuses", "#stayconsistent", "#mindset",
    "#discipline", "#goals", "#levelup",

    # Posting helpers
    "#caption", "#quote", "#shorts", "#edit", "#aesthetic",
]

AI_GEN_NICHE_THUMBS = False
BANK_ONLY = True
PLACEHOLDER_THUMB = os.getenv("PLACEHOLDER_THUMB", "static/placeholders/thumb.jpg")

# =========================
#  Gemini client (shared)
# =========================
GEMINI_PROJECT = os.getenv("GEMINI_PROJECT", "publefy-484406")
GEMINI_LOCATION = os.getenv("GEMINI_LOCATION_TEXT", "us-central1")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

def _gemini_client(project: str = GEMINI_PROJECT, location: str = GEMINI_LOCATION):
    credentials, detected_project = google_auth_default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    # Prefer the detected project from ADC; fall back to provided/default
    effective_project = detected_project or project
    return genai.Client(
        vertexai=True,
        project=effective_project,
        location=location,
        credentials=credentials,
    )

# ---------------- helpers ----------------
def _overlay_text_on_frame(
    frame,
    text,
    text_area,
    color=(255, 255, 255),
    base_font_scale=1,
    thickness=2,
    max_lines=3,
    line_spacing=10,
):
    x, y, w, h = text_area
    font = cv2.FONT_HERSHEY_SIMPLEX
    words = text.split()
    lines, current_line = [], ""

    for word in words:
        trial = current_line + word + " "
        if cv2.getTextSize(trial, font, base_font_scale, thickness)[0][0] < w:
            current_line = trial
        else:
            lines.append(current_line.strip())
            current_line = word + " "
    if current_line:
        lines.append(current_line.strip())
    lines = lines[:max_lines]

    while True:
        height = cv2.getTextSize("Test", font, base_font_scale, thickness)[0][1]
        if (
            height * len(lines) + line_spacing * (len(lines) - 1) <= h
            or base_font_scale < 0.5
        ):
            break
        base_font_scale *= 0.9

    overlay = frame.copy()
    y_start = y + (h - (height * len(lines) + line_spacing * (len(lines) - 1))) // 2 + height
    for i, line in enumerate(lines):
        size = cv2.getTextSize(line, font, base_font_scale, thickness)[0]
        x_text = x + (w - size[0]) // 2
        y_text = y_start + i * (height + line_spacing)
        cv2.putText(
            overlay,
            line,
            (x_text, y_text),
            font,
            base_font_scale,
            color,
            thickness,
            cv2.LINE_AA,
        )
    return overlay

def _get_top_overlay_area(frame, percent_min=0.20, percent_max=0.25):
    h, w, _ = frame.shape
    y0 = 0
    y1 = int(h * percent_max) 
    return (0, y0, w, y1 - y0)

def _make_thumbnail_from_video_path(video_path: str, out_path: str, at_seconds: float = 0.5):
    clip = VideoFileClip(video_path)
    t = max(0.0, min(at_seconds, max(0.0, (clip.duration or 1.0) - 0.05)))
    frame = clip.get_frame(t)
    clip.close()
    bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    cv2.imwrite(out_path, bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])


def _download_blob_to_temp(bucket, client, blob_name: str, suffix: str = ".mp4") -> str | None:
    try:
        src = bucket.blob(blob_name)
        if not src.exists(client):
            return None
        tmp = NamedTemporaryFile(delete=False, suffix=suffix).name
        src.download_to_filename(tmp, client=client)
        return tmp
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return None

def _render_with_caption(src_path: str, caption: str) -> tuple[str, tuple]:
    """
    Returns (final_video_path, text_area)
    """
    # detect overlay area from first frame (same as finalize)
    clip_for_overlay = VideoFileClip(src_path)
    first_frame = next(clip_for_overlay.iter_frames())
    clip_for_overlay.reader.close()
    clip_for_overlay.close()

    x, y, w, h = _get_top_overlay_area(first_frame, percent_min=0.20, percent_max=0.25)
    background_color = (0, 0, 0)
    text_color = (255, 255, 255)
    text_area = (x, y, w, h)

    # process frames
    clip = VideoFileClip(src_path)
    fps = clip.fps
    width, height = clip.w, clip.h

    output_temp = NamedTemporaryFile(delete=False, suffix=".mp4").name
    writer = cv2.VideoWriter(
        output_temp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (int(width), int(height))
    )

    for frame in clip.iter_frames():
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        cv2.rectangle(bgr, (x, y), (x + w, y + h), background_color, -1)
        overlayed = _overlay_text_on_frame(bgr, caption, text_area, color=text_color)
        writer.write(overlayed)

    writer.release()
    clip.reader.close()
    clip.close()

    # reattach original audio
    final_path = NamedTemporaryFile(delete=False, suffix=".mp4").name
    try:
        final = VideoFileClip(output_temp).with_audio(VideoFileClip(src_path).audio)
        final.write_videofile(final_path, codec="libx264", audio_codec="aac")
        final.close()
    finally:
        try:
            os.remove(output_temp)
        except Exception:
            pass

    return final_path, text_area

# ============ Gemini steps ============
def _summarize_video_local(video_path: str) -> tuple[str, str]:
    """Two short sections: Video: ...  Audio: ... (<=2 lines each)."""
    # Use GEMINI_LOCATION_VIDEO if present, otherwise default to GEMINI_LOCATION
    video_location = os.getenv("GEMINI_LOCATION_VIDEO", GEMINI_LOCATION)
    client = _gemini_client(project=GEMINI_PROJECT, location=video_location)
    mime = mimetypes.guess_type(video_path)[0] or "video/mp4"
    with open(video_path, "rb") as f:
        data = f.read()
    video_part = types.Part.from_bytes(data=data, mime_type=mime)
    prompt = (
        "You are a professional video summarizer.\n"
        "Describe in TWO short sections (<=2 lines each):\n"
        "Video: visuals/actions/mood\n"
        "Audio: speech/music/tone\n"
        "Use exactly this format:\n"
        "Video: <2 lines>\n"
        "Audio: <2 lines>\n"
    )
    cfg = types.GenerateContentConfig(
        temperature=1, top_p=0.95, max_output_tokens=8192, response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
    )
    out = ""
    for ch in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=[types.Content(role="user", parts=[video_part, types.Part.from_text(text=prompt)])],
        config=cfg,
    ):
        out += ch.text or ""
    out = out.replace("**", "")
    audio = re.search(r"Audio:\s*(.*)", out, re.DOTALL)
    video = re.search(r"(Video:|Content:)\s*(.*?)\n\s*Audio:", out, re.DOTALL)
    return (video.group(2).strip() if video else "")[:600], (audio.group(1).strip() if audio else "")[:600]

def _gemini_options_for(video_summary: str, audio_summary: str, industry: str) -> list[str]:
    """Return EXACTLY 20 short, funny, relatable one-liners (<=20 words)."""
    from core.gemini_funny_comment_generator import generate_meme_captions
    # Pass the keyword (industry param is actually the prompt_hint/keyword from user)
    return generate_meme_captions(
        video_summary=video_summary,
        audio_summary=audio_summary,
        num_options=20,
        temperature=0.35,
        keyword=industry or ""  # This is actually the user's keyword/prompt
    )

def _score_prompt(opt: str, industry: str) -> float:
    """Simple ‘best’ heuristic with tiny variety signal."""
    s = opt.lower()
    score = 0.0
    
    # NEW: Penalize generic fallback patterns to encourage variety
    if "logic, but make it fun" in s:
        score -= 5.0
    
    # contains an industry token?
    toks = [t for t in re.split(r"[^a-z0-9]+", industry.lower()) if t]
    if any(t in s for t in toks):
        score += 3.0
    # decent length
    if 6 <= len(opt) <= 90:
        score += 1.0
    # relatable wording
    if re.search(r"\b(i|me|my|you|your|we|us)\b", s):
        score += 0.5
    # small deterministic jitter to avoid identical picks across runs
    score += (abs(hash(opt)) % 11) / 100.0
    return score

def _pick_best_prompt(options: list[str], industry: str) -> str:
    if not options:
        return "That moment the plan falls apart"
    
    # Filter out obvious placeholders if we have real options
    real_options = [o for o in options if "logic, but make it fun" not in o.lower() and "placeholder" not in o.lower()]
    pool = real_options if real_options else options
    
    ranked = sorted(pool, key=lambda o: _score_prompt(o, industry), reverse=True)
    top = ranked[: min(5, len(ranked))]
    rng = random.Random(uuid4().int & ((1 << 31) - 1))
    return rng.choice(top)  # best-ish, with a touch of variety


def _fallback_prompts_for(industry: str) -> list[str]:
    """
    Domain-tilted, brand-safe fallbacks when Gemini is unavailable.
    Ensures unique templates to avoid identical results.
    """
    base_clean = re.sub(r"[^A-Za-z0-9]+", " ", (industry or "general")).strip().lower()
    key = base_clean.split(" ", 1)[0] if base_clean else "general"
    pools = {
        "fitness": [
            "When the preworkout hits mid-set",
            "Leg day optimism vs reality",
            "Me explaining rest day science",
            "That look when someone curls in the squat rack",
            "Tracking macros like it is high finance",
            "Gym buddy texts 'you coming?' at 5am",
        ],
        "gym": [
            "One more rep that turns into five",
            "Bench press PR or ER",
            "When the gym playlist knows my soul",
            "Spotter says 'I got you' but vanishes",
            "That mirror check after every set",
            "Bulk season logic explained poorly",
        ],
        "real": [  # real estate
            "Open house smile, appraisal face",
            "Client: 'We want a deal' in this market",
            "That offer gets twelve counters in an hour",
            "Staging on a coffee budget",
            "When the inspection report is a novella",
            "Location, location, location… and parking",
        ],
        "food": [
            "Meal prep on Sunday, takeout by Tuesday",
            "When the sauce finally hits right",
            "Expectation vs reality of my own recipe",
            "Chef kiss but it is just me at 2am",
            "That first bite silence",
            "Calories do not count on weekends, right",
        ],
        "marketing": [
            "Can we make the logo bigger moment",
            "Brief says 'viral by Friday'",
            "When the budget walks out of the room",
            "A/B test number 42 finally wins",
            "Client feedback: 'pop more'",
            "Rebrand because the CEO had an idea",
        ],
        "travel": [
            "Airport security speedrun attempt",
            "Window seat philosophers",
            "Packing light: myth or legend",
            "When the layover becomes a vacation",
            "Lost in translation but vibing",
            "Travel buddy with the endless itinerary",
        ],
        "finance": [
            "Market dips right after I buy",
            "Diversified until my coffee budget collapses",
            "Explaining APR at a party",
            "When the spreadsheet becomes a personality",
            "Bull, bear, or just confused",
            "Risk tolerance until the chart turns red",
        ],
        "pets": [
            "Dog after a bath: zoomies",
            "Cat schedules are non-negotiable",
            "When the treat jar opens at 2am",
            "Pet hair is an accessory now",
            "Who rescued who debate continues",
            "Zoom call interrupted by paws",
        ],
    }
    
    generic_templates = [
        "That moment the plan finally clicks",
        "POV: The deadline moved itself",
        "Expectation vs reality in real time",
        "Me vs the calendar on Monday",
        "Plot twist during the meeting",
        "When the solution was right there all along",
        "Vibing through the chaos",
        "Acting like I know exactly what's happening",
        "The universe test my patience again",
        "Everything is fine, everything is great",
        "Wait, that actually worked?",
        "My last two brain cells fighting for third place"
    ]

    if key in {"real", "estate", "real estate"}:
        key = "real"
    
    pool = pools.get(key, [])
    if not pool:
        pool = generic_templates[:6]
    
    # Ensure at least 20 options with UNIQUE templates
    idx = 0
    while len(pool) < 20:
        template = generic_templates[idx % len(generic_templates)]
        pool.append(f"{industry or 'Meme'}: {template}")
        idx += 1
        
    return pool[:20]


def _make_thumb_from_video(video_path: str, out_jpg: str, at_seconds: float = 0.6):
    clip = VideoFileClip(video_path)
    try:
        t = max(0.0, min(at_seconds, max(0.0, (clip.duration or 1.0) - 0.05)))
        frame = clip.get_frame(t)
    finally:
        clip.close()
    cv2.imwrite(out_jpg, cv2.cvtColor(frame, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 85])





def _poster_blob_for(blob_name: str, bank_prefix: str) -> str:
    """
    Flat bank: bank-mem/*.mp4 -> processed_videos/thumbs/<basename>.jpg
    """
    base = os.path.splitext(os.path.basename(blob_name))[0] + ".jpg"
    return f"processed_videos/thumbs/{base}"

def _generate_thumb_ffmpeg(
    *,
    bucket,
    client,
    src_blob_name: str,
    dst_blob_name: str,
    ss: float = 1.0,       # second to grab the frame
    width: int = 720,      # 480/720 are great for grids
    jpeg_quality: int = 3  # 2..31 (lower = better quality)
) -> bool:
    """
    Download video, extract 1 frame using ffmpeg, upload JPEG to GCS. Returns True on success.
    """
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        sentry_sdk.capture_message("ffmpeg not available on PATH")
        return False

    src = bucket.blob(src_blob_name)
    if not src.exists(client):
        return False

    dst = bucket.blob(dst_blob_name)
    try:
        if dst.exists(client):
            return True  # already present
    except Exception:
        pass

    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, "in.mp4")
        out_path = os.path.join(td, "thumb.jpg")

        try:
            src.download_to_filename(in_path, client=client)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return False

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ss),          # fast seek
            "-i", in_path,
            "-frames:v", "1",
            "-vf", f"scale={width}:-2",  # keep aspect, even height
            "-q:v", str(jpeg_quality),
            out_path
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            sentry_sdk.capture_exception(e)
            return False

        try:
            dst.cache_control = "public, max-age=31536000, immutable"
            dst.upload_from_filename(out_path, content_type="image/jpeg", client=client)
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return False

def _extract_blob_from_source_id(source_id: str) -> str:
    """
    Accepts either:
      - raw blob paths (e.g., 'bank-mem/...mp4', 'instagram_reels/generated/...mp4')
      - API media URLs (e.g., '/memes/media/<encoded-blob>' or full 'https://host/memes/media/<encoded-blob>')
    Returns the decoded blob path used in GCS.
    """
    s = (source_id or "").strip()
    if not s:
        return s

    MEDIA_PREFIX = "/memes/media/"

    if s.startswith(MEDIA_PREFIX):
        enc = s[len(MEDIA_PREFIX):]
        try:
            return unquote(enc)
        except Exception:
            return enc

    # Case 2: full URL containing /memes/media/
    if s.startswith("http://") or s.startswith("https://"):
        try:
            p = urlparse(s).path or ""
            if p.startswith(MEDIA_PREFIX):
                enc = p[len(MEDIA_PREFIX):]
                try:
                    return unquote(enc)
                except Exception:
                    return enc
        except Exception:
            pass
    return s

def _ensure_trailing_slash(p: str) -> str:
    p = (p or "").strip()
    return p if p.endswith("/") else p + "/"

def _slug_niche(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")

def _get_profile_by_ig_id(user_id: str, ig_id: str):
    """Return the profile doc for this (user_id, ig_id) pair or None."""
    return db.profiles.find_one({"user_id": user_id, "ig_id": ig_id})

def _get_profile_by_id(user_id: str, profile_id: str):
    """Return the profile doc for this (user_id, profile_id) pair or None."""
    try:
        _pid = ObjectId(profile_id)
    except Exception:
        return None
    return db.profiles.find_one({"_id": _pid, "user_id": user_id})

def _ensure_owned_ig_id(user_id: str, ig_id: str):
    """Validate that ig_id belongs to current user. Returns the profile doc or None."""
    return _get_profile_by_ig_id(user_id, ig_id)

def _norm(s: str) -> str:
    # normalize for matching: lowercase, collapse to a-z0-9 tokens
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

def _is_video(name: str, content_type: str | None) -> bool:
    n = (name or "").lower()
    ct = (content_type or "").lower() if content_type else ""
    return n.endswith((".mp4", ".mov", ".m4v", ".webm")) or ct.startswith("video/")

def _tokens_from_keyword(keyword: str) -> list[str]:
    """Turn '#reelz #joegoldberg' into ['reelz','joegoldberg']."""
    raw = (keyword or "").lower()
    tokens = re.findall(r"#?([a-z0-9][a-z0-9\-]*)", raw)
    return [_norm(t) for t in tokens if _norm(t)]

def _extract_hashtags_from_filename(filename: str) -> list[str]:
    # hashtags inside the filename; keep alphanum/dash
    return [t.lower() for t in re.findall(r"#([A-Za-z0-9\-]+)", filename)]

def _autopick_text(filename: str, keyword_tokens: list[str]) -> str:
    """
    Pick a short caption randomly:
      1) from hashtags in the filename (preferred)
      2) else from keyword tokens
      3) else from filename words (>=3 chars)
    Always returns a single tag-like string starting with '#'.
    """
    stem = os.path.basename(filename)
    pool = _extract_hashtags_from_filename(stem)
    if not pool:
        pool = [t for t in keyword_tokens if t]
    if not pool:
        stem_noext = os.path.splitext(stem)[0]
        pool = [w.lower() for w in re.split(r"[^A-Za-z0-9]+", stem_noext) if len(w) >= 3]
    choice = random.choice(pool) if pool else "meme"
    return choice if choice.startswith("#") else f"#{choice}"

def _poster_blob_for(blob_name: str, bank_prefix: str) -> str:
    base = os.path.splitext(os.path.basename(blob_name))[0] + ".jpg"
    rel = blob_name[len(bank_prefix):] if blob_name.startswith(bank_prefix) else blob_name
    niche = rel.split("/", 1)[0] if "/" in rel else "general"
    return f"processed_videos/{niche}/thumbs/{base}"

def _get_bucket_and_prefix():
    bucket_name = os.getenv("VIDEO_BUCKET_NAME")
    user_project = os.getenv("USER_PROJECT")
    if not bucket_name or not user_project:
        raise RuntimeError("Set VIDEO_BUCKET_NAME and USER_PROJECT env vars")
    # FORCE the bank prefix to live under bank-mem/ (allow env override, normalize slash)
    base_prefix = _ensure_trailing_slash(os.getenv("MEME_BANK_PREFIX", "bank-mem/"))
    return bucket_name, user_project, base_prefix

def _build_client(bucket_name: str, user_project: str):
    repo = GCloudRepository(bucket_name, user_project)
    client = repo.get_client()
    bucket = client.get_bucket(bucket_name)
    return client, bucket

def _ext_content_type(name: str) -> str | None:
    ctype, _ = mimetypes.guess_type(name)
    return ctype

def _api_media_url(blob_name: str, absolute: bool = False, bucket=None) -> str:
    if bucket:
        try:
            return bucket.blob(blob_name).generate_signed_url(
                version="v4",
                expiration=timedelta(hours=1),
                method="GET"
            )
        except Exception:
            pass

    quoted = quote(blob_name, safe="/")
    path = f"/memes/media/{quoted}"
    if absolute:
        host = os.getenv("HOST_NAME")
        if host:
            host = host.rstrip("/")
            if not host.startswith(("http://", "https://")):
                host = "https://" + host
            return f"{host}{path}"
        try:
            return url_for("bank_memes.serve_media", blob_name=blob_name, _external=True)
        except Exception:
            return path
    return path

 


def _sanitize_blob_path(blob_name: str, base_prefix: str) -> bool:
    # allow both bank-mem/ and bank-meme/ (common spelling variance)
    alt_prefix = base_prefix.replace("bank-mem/", "bank-meme/")
    if blob_name.startswith(base_prefix) or blob_name.startswith(alt_prefix):
        return True
    if blob_name.startswith("processed_videos/") and "/thumbs/" in blob_name:
        return True
    if blob_name.startswith("users/"):
        return True
    if blob_name.startswith("instagram_reels/"):
        return True
    if blob_name.startswith("reel_"):
        # Temporary backward compatibility for root-level files
        return True
    return False

# ---------------- watermark + never-repeat helpers ----------------

FREE_PLANS = {"free", "starter", "trial"}

def _get_user_plan(user_id: str) -> str:
    from bson import ObjectId
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)}, {"plan": 1, "subscription": 1}) or {}
    except Exception:
        user = db.users.find_one({"_id": user_id}, {"plan": 1, "subscription": 1}) or {}

    sub = user.get("subscription")
    if sub and isinstance(sub, dict):
        if sub.get("status") in ("active", "trialing"):
            return (sub.get("plan") or "free").lower()
    
    return (user.get("plan") or "free").lower()

def _is_unlimited_plan(user_id: str) -> bool:
    """Check if user has unlimited plan (bypasses all restrictions)"""
    from bson import ObjectId
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)}, {"subscription": 1}) or {}
    except Exception:
        user = db.users.find_one({"_id": user_id}, {"subscription": 1}) or {}
    
    sub = user.get("subscription")
    if sub and isinstance(sub, dict):
        # Check for unlimited promo code
        if sub.get("has_unlimited_promo") or sub.get("unlimited_promo_id") == "promo_1SrJ9rB7l4Z4dfAwdAO1OdBp":
            return True
        # Check for unlimited plan
        if sub.get("status") in ("active", "trialing") and sub.get("plan", "").lower() == "unlimited":
            return True
    
    plan = _get_user_plan(user_id)
    return plan == "unlimited"

def _should_watermark(user_id: str) -> bool:
    plan = _get_user_plan(user_id)
    # Unlimited plan users don't get watermarks
    if plan == "unlimited":
        return False
    return plan in FREE_PLANS

def _blob_fingerprint(blob) -> str:
    """
    Prefer strong IDs that survive copies:
     - md5_hash
     - crc32c
     - fallback: stable hash of path
    """
    try:
        if not getattr(blob, "md5_hash", None) and not getattr(blob, "crc32c", None):
            blob.reload()
    except Exception:
        pass

    if getattr(blob, "md5_hash", None):
        return f"md5:{blob.md5_hash}"
    if getattr(blob, "crc32c", None):
        return f"crc32c:{blob.crc32c}"
    return f"path:{hashlib.md5(blob.name.encode('utf-8')).hexdigest()}"


def _source_fingerprint_by_name(bucket, name: str) -> str:
    b = bucket.blob(name)
    try:
        b.reload()
    except Exception:
        pass
    return _blob_fingerprint(b)

def _used_fingerprints_for(user_id: str, profile_id: str | None) -> set[str]:
    q = {"user_id": user_id}
    if profile_id:
        q["profile_id"] = profile_id
    cur = db.meme_usage.find(q, {"fingerprint": 1})
    return {doc["fingerprint"] for doc in cur}

def _mark_used(user_id: str, profile_id: str, fingerprint: str, source_id: str, niche: str | None):
    try:
        db.meme_usage.insert_one({
            "user_id": user_id,
            "profile_id": profile_id,
            "fingerprint": fingerprint,
            "source_id": source_id,
            "niche": niche,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        # ignore dup key errors if unique index exists
        pass


def _thumb_or_fallback(
    *,
    bucket,
    client,
    video_blob: str,
    poster_blob: str,
    api_abs: bool
) -> tuple[str | None, bool]:
    """
    Returns (thumb_url, thumb_is_video).
    - If a poster jpg exists => return its API URL, thumb_is_video=False
    - Else => fall back to the video API URL, thumb_is_video=True
    """
    try:
        if bucket and bucket.blob(poster_blob).exists(client):
            return _api_media_url(poster_blob, absolute=api_abs, bucket=bucket), False
    except Exception:
        pass 
    return _api_media_url(video_blob, absolute=api_abs, bucket=bucket), True



# =======================
# Media proxy (API-domain playback with Range support or redirect to signed URL)
# =======================
@bank_memes_blueprint.route("/media/<path:blob_name>", methods=["GET", "HEAD"])
def serve_media(blob_name: str):
    try:
        blob_name = unquote(blob_name)
    except Exception:
        pass

    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError:
        return Response("Misconfigured server", status=500)

    if not _sanitize_blob_path(blob_name, base_prefix=base_prefix):
        return Response("Not found", status=404)

    client, bucket = _build_client(bucket_name, user_project)
    blob = bucket.blob(blob_name)

    # Make sure metadata (size/content_type/updated) is populated
    try:
        blob.reload()
    except Exception:
        pass

    if not blob.exists(client):
        return Response("Not found", status=404)

    content_type = blob.content_type or _ext_content_type(blob_name) or "application/octet-stream"
    size = blob.size or 0
    range_header = (request.headers.get("Range") or "").strip()

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": content_type, 
        "Cache-Control": "private, max-age=0, no-store",
    }
    try:
        if blob.updated:
            headers["Last-Modified"] = formatdate(blob.updated.timestamp(), usegmt=True)
    except Exception:
        pass

    if request.method == "HEAD":
        headers["Content-Length"] = str(size)
        return Response(status=200, headers=headers)
    if size and range_header.startswith("bytes="):
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if m:
            start_str, end_str = m.groups()
            try:
                start = int(start_str) if start_str else 0
            except ValueError:
                start = 0
            end = int(end_str) if end_str else (size - 1)
            if end >= size:
                end = size - 1
            if start > end or start < 0:
                return Response(status=416)
            try:
                data = blob.download_as_bytes(start=start, end=end + 1)  # EXCLUSIVE end
            except Exception as e:
                sentry_sdk.capture_exception(e)
                return Response("Upstream error", status=502)
            headers.update({
                "Content-Length": str(len(data)),
                "Content-Range": f"bytes {start}-{end}/{size}",
            })
            return Response(data, status=206, headers=headers)

    # Fallback: stream whole file
    def generate():
        with blob.open("rb") as fh:
            while True:
                chunk = fh.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk
    if size and size > 0:
        headers["Content-Length"] = str(size)
    headers["X-Accel-Buffering"] = "no"

    return Response(generate(), status=200, headers=headers, direct_passthrough=True)


# ---------- matching convenience ----------

def _matches_keyword(tokens: list[str], filename: str, niche_name: str) -> bool:
    """
    Looser matching:
      - filename normalized contains any token
      - OR hashtag list contains any token (without '#')
      - OR niche folder name contains any token
    """
    if not tokens:
        return True
    fname_norm = _norm(os.path.basename(filename))
    if any(t in fname_norm for t in tokens):
        return True
    tags = [t.lower() for t in _extract_hashtags_from_filename(os.path.basename(filename))]
    if any(t in tags for t in tokens):
        return True
    if niche_name and any(t in _norm(niche_name) for t in tokens):
        return True
    return False


def _infer_industry_from_blob(blob_name: str, base_prefix: str) -> str:
    """
    Heuristic to derive an industry/niche hint from the blob path.
    Priority: folder under base_prefix -> first hashtag in filename -> filename words.
    Returns '' if nothing reasonable is found.
    """
    rel = blob_name[len(base_prefix):] if blob_name.startswith(base_prefix) else blob_name
    folder = rel.split("/", 1)[0] if "/" in rel else ""
    if folder:
        return folder.replace("-", " ").strip()

    tags = _extract_hashtags_from_filename(os.path.basename(blob_name))
    if tags:
        return tags[0]

    words = [
        w for w in re.split(r"[^A-Za-z0-9]+", os.path.splitext(os.path.basename(blob_name))[0]) if len(w) >= 3
    ]
    if words:
        return " ".join(words[:2]).strip()
    return ""


# ---------------- list existing ---------------- 
def _autopick_text(filename: str, keyword_tokens: list[str]) -> str:
    """
    Pick a short caption randomly:
      1) from hashtags in the filename (preferred)
      2) else from keyword tokens
      3) else from filename words (>=3 chars)
      4) else from PROMPT_BANK
    Always returns a single tag-like string starting with '#'.
    """
    stem = os.path.basename(filename)
    pool = _extract_hashtags_from_filename(stem)
    if not pool:
        pool = [t for t in keyword_tokens if t]
    if not pool:
        stem_noext = os.path.splitext(stem)[0]
        pool = [w.lower() for w in re.split(r"[^A-Za-z0-9]+", stem_noext) if len(w) >= 3]
    if not pool:
        pool = PROMPT_BANK[:]  # final fallback

    # add a tiny bit of entropy so consecutive calls differ more often
    choice = random.choice(pool) if pool else "meme"
    # normalize: make sure it's hashtag-like
    return choice if str(choice).startswith("#") else f"#{choice}"




@bank_memes_blueprint.route("/from-bank", methods=["POST"])
@login_required
def list_from_bank():
    """
    Returns VIDEO assets from bank-mem/. If niche folder is empty/missing, falls back to root.
    If no keyword match found, falls back to most-recent videos (still no repeats).
    """
    body = request.get_json(force=True) or {}
    keyword = (body.get("keyword") or "").strip()
    count = int(body.get("count") or 10)
    niche = (body.get("niche") or "").strip()
    profile_id = (body.get("profileId") or "").strip()

    if not keyword or count <= 0:
        return jsonify({"error": "keyword and positive count are required"}), 400

    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    # Build prefixes
    niche_prefix = f"{base_prefix}{_slug_niche(niche)}/" if niche else base_prefix
    client, bucket = _build_client(bucket_name, user_project)

    # never-repeat scope
    user = getattr(g, "current_user", None)
    user_id = user["_id"] if user and user.get("_id") else None
    used = _used_fingerprints_for(user_id, profile_id or None) if user_id else set()

    tokens = _tokens_from_keyword(keyword)

    # 1) Try niche folder first
    blobs = list(bucket.list_blobs(prefix=niche_prefix))
    # 2) If niche empty or folder doesn't exist, fall back to whole bank
    if not blobs and niche:
        blobs = list(bucket.list_blobs(prefix=base_prefix))
        niche_name = ""   # don't require niche match
    else:
        niche_name = niche

    # newest first
    blobs.sort(key=lambda b: (b.updated.timestamp() if b.updated else 0), reverse=True)

    api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true")
    results = []
 
    for blob in blobs:
        name = blob.name
        if name.endswith("/") or not _is_video(name, blob.content_type):
            continue
        if not _matches_keyword(tokens, name, niche_name):
            continue
        fp = _blob_fingerprint(blob)
        if fp in used:
            continue

        poster_blob = _poster_blob_for(name, base_prefix)
        thumb_api, thumb_is_video = _thumb_or_fallback(
            bucket=bucket,
            client=client,
            video_blob=name,
            poster_blob=poster_blob,
            api_abs=api_abs
        )


        results.append({
            "id": name,
            "filename": os.path.basename(name),
            "content_type": blob.content_type,
            "size": blob.size,
            "updated": blob.updated.isoformat() if blob.updated else None,
            "assets": {"full": _api_media_url(name, absolute=api_abs, bucket=bucket), "thumb": thumb_api},
            "thumbIsVideo": thumb_is_video, 
            "fingerprint": fp
        })
        if len(results) >= count:
            break
 
    if not results:
        for blob in blobs:
            name = blob.name
            if name.endswith("/") or not _is_video(name, blob.content_type):
                continue
            fp = _blob_fingerprint(blob)
            if fp in used:
                continue

            poster_blob = _poster_blob_for(name, base_prefix)
            thumb_api, thumb_is_video = _thumb_or_fallback(
                bucket=bucket,
                client=client,
                video_blob=name,
                poster_blob=poster_blob,
                api_abs=api_abs
            )


            results.append({
                "id": name,
                "filename": os.path.basename(name),
                "content_type": blob.content_type,
                "size": blob.size,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "assets": {"full": _api_media_url(name, absolute=api_abs, bucket=bucket), "thumb": thumb_api},
                "thumbIsVideo": thumb_is_video,
                "fingerprint": fp
            })
            if len(results) >= count:
                break

    return jsonify({
        "keyword": keyword,
        "niche": niche or None,
        "countRequested": count,
        "countReturned": len(results),
        "items": results
    }), 200


# ============================================================
#        POST /memes/from-bank/generate-memes  (UPDATED)
# ============================================================
@bank_memes_blueprint.route("/from-bank/generate-memes", methods=["POST"])
@login_required
def generate_memes_from_bank():
    """
    SPEC:
      - Randomly pick 10 (or 'count') videos from the bank (ignores keyword/niche by default).
      - For each:
          summarize -> 20 Gemini options -> pick BEST -> overlay -> upload -> create reel row
      - 'summary' field (DB) is a simple tag like the upload flow (_autopick_text).

    Request JSON:
    {
      "industry": "Real Estate",     // optional (preferred hint)
      "niche": "B2B SaaS",           // optional alias/fallback for industry
      "keyword": "sales jokes",      // optional alias/fallback for industry
      "count": 10,                   // optional, default 10
      "allowRepeats": false,         // optional
      "igId": "...",                 // one of igId/profileId required
      "profileId": "..."
    }
    """
    body = request.get_json(force=True) or {}
    industry_hint = (body.get("industry") or "").strip()
    niche_hint = (body.get("niche") or "").strip()
    keyword_hint = (body.get("keyword") or "").strip()
    prompt_hint = industry_hint or niche_hint or keyword_hint

    count = max(1, int(body.get("count") or 10))
    allow_repeats = bool(body.get("allowRepeats", False))

    # user + profile
    user = getattr(g, "current_user", None)
    if not user or not user.get("_id"):
        return jsonify({"error": "Unauthorized: missing user context"}), 401
    user_id = user["_id"]

    # --- Points System: Check Balance (skip for unlimited plan) ---
    if not _is_unlimited_plan(user_id):
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            return jsonify({"error": "User not found"}), 404
        
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
        
        # Each batch generation of 5 videos costs 5 points (1 per video)
        if balance < count:
            return jsonify({
                "error": "Insufficient points",
                "message": f"You need {count} points but only have {balance}. Please upgrade to Pro."
            }), 403
    # -----------------------------------

    ig_id_input = (body.get("igId") or "").strip()
    profile_id_input = (body.get("profileId") or "").strip()
    prof_doc = None

    if ig_id_input:
        prof_doc = _ensure_owned_ig_id(user_id, ig_id_input)
        if not prof_doc:
            return jsonify({"error": "Profile (by igId) not found or not owned by user"}), 403
    elif profile_id_input:
        prof_doc = _get_profile_by_id(user_id, profile_id_input)
        if not prof_doc:
            return jsonify({"error": "Profile (by profileId) not found or not owned by user"}), 403

    profile_id_str = str(prof_doc.get("_id")) if prof_doc else None
    ig_id = prof_doc.get("ig_id") if prof_doc else None

    # GCS
    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    client, bucket = _build_client(bucket_name, user_project)

    # never-repeat + watermark
    watermark = _should_watermark(user_id)
    used = _used_fingerprints_for(user_id, profile_id_str if not allow_repeats else None) if (user_id and not allow_repeats) else set()

    # collect ALL bank videos (flat random)
    blobs = list(bucket.list_blobs(prefix=base_prefix))
    blobs = [b for b in blobs if not b.name.endswith("/") and _is_video(b.name, b.content_type)]

    # filter out used if needed
    cand = []
    for b in blobs:
        fp = _blob_fingerprint(b)
        if fp in used:
            continue
        cand.append((b, fp))

    if not cand:
        return jsonify({
            "keyword": prompt_hint or None,
            "countRequested": count,
            "countReturned": 0,
            "allowRepeats": allow_repeats,
            "items": []
        }), 200

    # randomize and take count
    rng = random.Random(uuid4().int & ((1 << 31) - 1))
    rng.shuffle(cand)
    picked = cand[:count]

    api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true")
    items = []
    applied_prompts = []
    temp_paths = []
    prompt_source = "gemini"

    try:
        for b, fp in picked:
            src_blob = b.name
            # Use user's prompt/keyword, not industry
            _, ext = os.path.splitext(src_blob.lower())
            local_src = _download_blob_to_temp(bucket, client, src_blob, suffix=ext or ".mp4")
            if not local_src:
                continue
            temp_paths.append(local_src)

            # summarize
            try:
                video_summary, audio_summary = _summarize_video_local(local_src)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                video_summary, audio_summary = "", ""

            # 20 options from Gemini
            try:
                opts = _gemini_options_for(video_summary, audio_summary, prompt_hint or "")
            except Exception as e:
                sentry_sdk.capture_exception(e)
                prompt_source = "fallback"
                opts = _fallback_prompts_for(prompt_hint or "general")

            # pick BEST (with tiny variety among top 5)
            chosen = _pick_best_prompt(opts, prompt_hint or "")

            # render overlay
            try:
                local_final, text_area = _render_with_caption(local_src, chosen)
                temp_paths.append(local_final)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                continue

            # thumb
            thumb_local = NamedTemporaryFile(delete=False, suffix=".jpg").name
            temp_paths.append(thumb_local)
            try:
                _make_thumb_from_video(local_final, thumb_local, at_seconds=0.5)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                thumb_local = None

            # upload to instagram_reels/
            reel_id = uuid4().hex
            out_ext = ext if ext in {".mp4", ".mov", ".m4v", ".webm"} else ".mp4"
            dst_blob = f"instagram_reels/{reel_id}{out_ext}"
            dst_thumb = f"instagram_reels/{reel_id}.jpg"
            try:
                vblob = bucket.blob(dst_blob)
                vblob.upload_from_filename(local_final, content_type=b.content_type or "video/mp4", client=client)
                if thumb_local:
                    tblob = bucket.blob(dst_thumb)
                    tblob.upload_from_filename(thumb_local, content_type="image/jpeg", client=client)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                continue

            # never repeat
            try:
                _mark_used(user_id, profile_id_str, fp, src_blob, niche=None)
            except Exception:
                pass

            # summary/tag just like upload flow
            try:
                summary_tag = _autopick_text(os.path.basename(src_blob), _tokens_from_keyword(os.path.basename(src_blob)))
            except Exception:
                summary_tag = "#meme"

            # DB insert
            try:
                create_reel_for_mem(
                    reel_id=reel_id,
                    text_color="#ffffff",
                    text_area=[int(text_area[0]), int(text_area[1]), int(text_area[2]), int(text_area[3])],
                    meme_options=[chosen],
                    summary=summary_tag,
                    original_path=src_blob,
                    status="draft",
                    user_id=user_id,
                    profile_id=profile_id_str,
                    ig_id=ig_id,
                    final_video_path=dst_blob,
                    error="",
                    watermark=watermark,
                    schedule_ready=True
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

            # response item
            api_url = _api_media_url(dst_blob, absolute=True, bucket=bucket)
            thumb_url = None
            thumb_is_video = False
            try:
                if bucket.blob(dst_thumb).exists(client):
                    thumb_url = _api_media_url(dst_thumb, absolute=api_abs, bucket=bucket)
                    thumb_is_video = False
            except Exception:
                pass
            if not thumb_url:
                poster_blob = _poster_blob_for(src_blob, base_prefix)
                thumb_url, thumb_is_video = _thumb_or_fallback(
                    bucket=bucket, client=client,
                    video_blob=dst_blob, poster_blob=poster_blob,
                    api_abs=api_abs
                )

            items.append({
                "reelId": reel_id,
                "sourceBlob": src_blob,
                "generatedBlob": dst_blob,
                "apiUrl": api_url,
                "thumb": thumb_url,
                "thumbIsVideo": thumb_is_video,
                "appliedPrompt": chosen,
                "promptKeyword": prompt_hint or None,
                "summary": summary_tag,
                "fingerprint": fp,
                "watermarkApplied": watermark,
                "scheduleReady": True,
            })
            applied_prompts.append(chosen)

        # --- Points System: Deduct Balance (skip for unlimited plan) ---
        if items and not _is_unlimited_plan(user_id):
            actual_count = len(items)
            db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$inc": {
                        "usage.points_balance": -actual_count,
                        "usage.points_used": actual_count,
                        "usage.total_videos_generated": actual_count
                    },
                    "$set": {"updated_at": _now_iso()}
                }
            )
        # ------------------------------------

        return jsonify({
            "keyword": prompt_hint or None,
            "countRequested": count,
            "countReturned": len(items),
            "allowRepeats": allow_repeats,
            "promptSource": prompt_source,
            "appliedPrompts": applied_prompts,
            "items": items
        }), 201

    finally:
        for p in temp_paths:
            try:
                if p and os.path.exists(p):
                    os.remove(p)
            except Exception as e:
                sentry_sdk.capture_exception(e)
# ---------------- regen ONE ----------------
@bank_memes_blueprint.route("/regen-one", methods=["POST"])
@login_required
def regen_one_from_bank():
    """
    Returns one video.
    - Niche prefix is tried first; falls back to bank root if empty.
    - If no keyword matches, falls back to any.
    - Behavior depends on 'allowRepeats':
        * allowRepeats=true  => ignore never-repeat, videos may repeat
        * allowRepeats=false => apply never-repeat filter
    """
    body = request.get_json(force=True) or {}
    keyword = (body.get("keyword") or "").strip()
    niche = (body.get("niche") or "").strip()
    current_id = (body.get("currentId") or "").strip()
    exclude_list = body.get("exclude") or []
    profile_id = (body.get("profileId") or "").strip()
    cursor = body.get("cursor") or {}
    seed = body.get("seed", cursor.get("seed"))
    index = body.get("index", cursor.get("index", 0))
    allow_repeats = bool(body.get("allowRepeats", False))

    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    niche_prefix = f"{base_prefix}{_slug_niche(niche)}/" if niche else base_prefix
    client, bucket = _build_client(bucket_name, user_project)

    tokens = _tokens_from_keyword(keyword)
    exclude = set(exclude_list or [])
    if current_id:
        exclude.add(current_id)

    # never-repeat (ignored if allowRepeats=True)
    user = getattr(g, "current_user", None)
    user_id = user["_id"] if user and user.get("_id") else None
    used = set()
    if user_id and not allow_repeats:
        used = _used_fingerprints_for(user_id, profile_id or None)

    # collect blobs from niche, else root
    blobs = list(bucket.list_blobs(prefix=niche_prefix))
    if not blobs and niche:
        blobs = list(bucket.list_blobs(prefix=base_prefix))
        niche_name = ""
    else:
        niche_name = niche
    blobs = [b for b in blobs if not b.name.endswith("/") and _is_video(b.name, b.content_type)]

    # candidates pass 1: keyword match
    candidates = []
    for b in blobs:
        if b.name in exclude:
            continue
        if not _matches_keyword(tokens, b.name, niche_name):
            continue
        fp = _blob_fingerprint(b)
        if fp in used:
            continue
        candidates.append((b, fp))

    # pass 2: fallback to any
    if not candidates:
        for b in blobs:
            if b.name in exclude:
                continue
            fp = _blob_fingerprint(b)
            if fp in used:
                continue
            candidates.append((b, fp))

    if not candidates:
        return jsonify({"item": None, "message": "No videos available (after filters)."}), 200

    # ---- PICKING STRATEGY ----
    if allow_repeats:
        # random each time
        rng = random.Random(uuid4().int & ((1 << 31) - 1))
        rng.shuffle(candidates)
        pick, fp = candidates[0]
        cursor_out = {"seed": None, "index": None}
        next_cursor = {"seed": None, "index": None}
        generated_seed = False
    else:
        # deterministic seed + index
        generated_seed = False
        if seed is None:
            seed = abs(hash(f"{keyword}|{niche or ''}")) % (2**31)
            index = 0
            generated_seed = True
        rng = random.Random(seed)
        rng.shuffle(candidates)
        pick, fp = candidates[index % len(candidates)]
        cursor_out = {"seed": seed, "index": index}
        next_cursor = {"seed": seed, "index": index + 1}

    name = pick.name

    api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true")
    poster_blob = _poster_blob_for(name, base_prefix)
    thumb_api, thumb_is_video = _thumb_or_fallback(
        bucket=bucket,
        client=client,
        video_blob=name,
        poster_blob=poster_blob,
        api_abs=api_abs
    )

    item = {
        "id": name,
        "filename": os.path.basename(name),
        "content_type": pick.content_type,
        "size": pick.size,
        "updated": pick.updated.isoformat() if pick.updated else None,
        "assets": {"full": _api_media_url(name, absolute=api_abs, bucket=bucket), "thumb": thumb_api},
        "thumbIsVideo": thumb_is_video,
        "fingerprint": fp
    }

    return jsonify({
        "item": item,
        "cursor": cursor_out,
        "nextCursor": next_cursor,
        "generatedSeed": generated_seed
    }), 200





# ---------------- generate 10 with auto text ----------------

@bank_memes_blueprint.route("/from-bank/generate", methods=["POST"])
@login_required
def generate_from_bank():
    """
    Returns up to 'count' RANDOM videos from bank-mem/.
    - Tries the niche folder first (if provided), else bank root.
    - Keyword is optional; if present it's used as a loose filter.
    - Behavior depends on 'allowRepeats':
        * allowRepeats=true  => ignore never-repeat, videos may repeat
        * allowRepeats=false => apply never-repeat filter
    """
    body = request.get_json(force=True) or {}
    keyword = (body.get("keyword") or "").strip()
    count = max(1, int(body.get("count") or 10))
    niche = (body.get("niche") or "").strip()
    allow_repeats = bool(body.get("allowRepeats", False))

    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    niche_prefix = f"{base_prefix}{_slug_niche(niche)}/" if niche else base_prefix
    client, bucket = _build_client(bucket_name, user_project)

    tokens = _tokens_from_keyword(keyword)

    # watermark + used set
    user = getattr(g, "current_user", None)
    user_id = user["_id"] if user and user.get("_id") else None
    watermark = _should_watermark(user_id) if user_id else True
    used = _used_fingerprints_for(user_id, body.get("profileId") or None) if (user_id and not allow_repeats) else set()

    # collect blobs
    blobs = list(bucket.list_blobs(prefix=niche_prefix))
    if not blobs and niche:
        blobs = list(bucket.list_blobs(prefix=base_prefix))
        niche_name = ""
    else:
        niche_name = niche

    blobs = [b for b in blobs if not b.name.endswith("/") and _is_video(b.name, b.content_type)]

    # keyword candidates
    candidates = []
    if tokens:
        for b in blobs:
            if not _matches_keyword(tokens, b.name, niche_name):
                continue
            fp = _blob_fingerprint(b)
            if fp in used:
                continue
            candidates.append((b, fp))

    # fallback: any video
    if not candidates:
        for b in blobs:
            fp = _blob_fingerprint(b)
            if fp in used:
                continue
            candidates.append((b, fp))

    if not candidates:
        return jsonify({
            "keyword": keyword,
            "niche": niche or None,
            "countRequested": count,
            "countReturned": 0,
            "items": []
        }), 200

    # shuffle randomly
    rnd = random.Random(uuid4().int & ((1 << 31) - 1))
    rnd.shuffle(candidates)
    picked = candidates[:count]

    api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true")
    items = []
    for b, fp in picked:
        name = b.name
        poster_blob = _poster_blob_for(name, base_prefix)
        thumb_api, thumb_is_video = _thumb_or_fallback(
            bucket=bucket,
            client=client,
            video_blob=name,
            poster_blob=poster_blob,
            api_abs=api_abs
        )
        text = _autopick_text(os.path.basename(name), tokens)
        items.append({
            "id": name,
            "filename": os.path.basename(name),
            "content_type": b.content_type,
            "size": b.size,
            "updated": b.updated.isoformat() if b.updated else None,
            "assets": {"full": _api_media_url(name, absolute=api_abs, bucket=bucket), "thumb": thumb_api},
            "thumbIsVideo": thumb_is_video,
            "text": text,
            "fingerprint": fp,
            "scheduleReady": True,
            "watermarkApplied": watermark,
            "source": "bank",
        })

    return jsonify({
        "keyword": keyword,
        "niche": niche or None,
        "countRequested": count,
        "countReturned": len(items),
        "allowRepeats": allow_repeats,
        "items": items
    }), 200


# ------------ Fixing Ren
@bank_memes_blueprint.route("/from-bank/regen-at", methods=["POST"])
@login_required
def regen_at_from_bank():
    """
    Replace one card inside an existing /from-bank/generate list.

    Request JSON:
    {
      "keyword": "gym",
      "niche": "gym",
      "replaceId": "bank-mem/thatgymhumour 2025-03-09T075120.mp4",
      "existingIds": ["bank-mem/...", "..."],
      "allowRepeats": false,
      "profileId": "66c...f1a"
    }
    """
    body = request.get_json(force=True) or {}
    keyword = (body.get("keyword") or "").strip()
    niche = (body.get("niche") or "").strip()
    replace_id_raw = (body.get("replaceId") or "").strip()
    existing_ids_raw = list(body.get("existingIds") or [])
    allow_repeats = bool(body.get("allowRepeats", False))
    profile_id = (body.get("profileId") or "").strip()

    if not keyword:
        return jsonify({"error": "keyword is required"}), 400
    if not replace_id_raw:
        return jsonify({"error": "replaceId is required"}), 400

    try:
        bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    # -------- helpers: normalize ids/urls to blob names --------
    def _to_blob_name(s: str) -> str:
        try:
            s = (s or "").strip()
            if not s:
                return s
            MEDIA_PREFIX = "/memes/media/"
            if s.startswith(MEDIA_PREFIX):
                enc = s[len(MEDIA_PREFIX):]
                try:
                    return unquote(enc)
                except Exception:
                    return enc
            if s.startswith("http://") or s.startswith("https://"):
                try:
                    p = urlparse(s).path or ""
                    if p.startswith(MEDIA_PREFIX):
                        enc = p[len(MEDIA_PREFIX):]
                        try:
                            return unquote(enc)
                        except Exception:
                            return enc
                except Exception:
                    pass
            try:
                s = unquote(s)
            except Exception:
                pass
            return s
        except Exception:
            return s

    def _variants(name: str) -> set[str]:
        name = name or ""
        out = {name}
        try:
            out.add(unquote(name))
        except Exception:
            pass
        if not name.startswith(base_prefix):
            out.add(f"{base_prefix}{name}")
        out.add(os.path.basename(name))
        try:
            out.add(os.path.basename(unquote(name)))
        except Exception:
            pass
        return {x for x in out if x}

    replace_id_variants = _variants(_to_blob_name(replace_id_raw))
    existing_names: set[str] = set()
    for ex in existing_ids_raw:
        existing_names |= _variants(_to_blob_name(ex))

    niche_prefix = f"{base_prefix}{_slug_niche(niche)}/" if niche else base_prefix
    client, bucket = _build_client(bucket_name, user_project)

    tokens = _tokens_from_keyword(keyword)

    # never-repeat (only if repeats disabled)
    user = getattr(g, "current_user", None)
    if not user or not user.get("_id"):
        return jsonify({"error": "Unauthorized"}), 401
    user_id = user["_id"]

    # --- Points System: Check Balance ---
    user_doc = db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        return jsonify({"error": "User not found"}), 404
    
    # --- Points System: Check Balance (skip for unlimited plan) ---
    if not _is_unlimited_plan(user_id):
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
        
        # Each regeneration costs 1 point
        if balance < 1:
            return jsonify({
                "error": "Insufficient points",
                "message": "You need at least 1 point to regenerate a video. Please upgrade to Pro."
            }), 403
    # -----------------------------------

    watermark = _should_watermark(user_id) if user_id else True
    used_fps: set[str] = set()
    if user_id and not allow_repeats:
        used_fps = _used_fingerprints_for(user_id, profile_id or None)

    # collect pool same as /from-bank/generate
    blobs = list(bucket.list_blobs(prefix=niche_prefix))
    if not blobs and niche:
        blobs = list(bucket.list_blobs(prefix=base_prefix))
        niche_name = ""
    else:
        niche_name = niche
    blobs = [b for b in blobs if not b.name.endswith("/") and _is_video(b.name, b.content_type)]

    # build candidates
    def _eligible(b) -> tuple[bool, str]:
        fp = _blob_fingerprint(b)
        # exclude rule depends on allowRepeats
        if allow_repeats:
            # only ensure we don't return the same replaceId again
            if b.name in replace_id_variants or os.path.basename(b.name) in replace_id_variants:
                return False, fp
        else:
            # exclude anything already on-screen + never-repeat
            if b.name in existing_names or os.path.basename(b.name) in existing_names:
                return False, fp
            if fp in used_fps:
                return False, fp
        return True, fp

    candidates = []
    for b in blobs:
        if not _matches_keyword(tokens, b.name, niche_name):
            continue
        ok, fp = _eligible(b)
        if ok:
            candidates.append((b, fp))

    # fallback to any if no keyword matches
    if not candidates:
        for b in blobs:
            ok, fp = _eligible(b)
            if ok:
                candidates.append((b, fp))

    if not candidates:
        return jsonify({"item": None, "message": "No alternative video available."}), 200

    # pick: random fresh each call
    rng = random.Random(uuid4().int & ((1 << 31) - 1))
    rng.shuffle(candidates)
    pick, fp = candidates[0]

    # --- Points System: Deduct 1 Point (skip for unlimited plan) ---
    if not _is_unlimited_plan(user_id):
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$inc": {
                    "usage.points_balance": -1,
                    "usage.points_used": 1
                },
                "$set": {"updated_at": _now_iso()}
            }
        )
    # -------------------------------------

    # format response item
    name = pick.name
    api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true")
    poster_blob = _poster_blob_for(name, base_prefix)
    thumb_api, thumb_is_video = _thumb_or_fallback(
        bucket=bucket, client=client, video_blob=name, poster_blob=poster_blob, api_abs=api_abs
    )
    item = {
        "id": name,
        "filename": os.path.basename(name),
        "content_type": pick.content_type,
        "size": pick.size,
        "updated": pick.updated.isoformat() if pick.updated else None,
        "assets": {"full": _api_media_url(name, absolute=api_abs, bucket=bucket), "thumb": thumb_api},
        "thumbIsVideo": thumb_is_video,
        "fingerprint": fp,
        "text": _autopick_text(os.path.basename(name), tokens),
        "scheduleReady": True,
        "watermarkApplied": watermark,
        "source": "bank",
    }
    return jsonify({"item": item}), 200



# ---------------uploading ----------------------------
@bank_memes_blueprint.route("/from-bank/upload-reel", methods=["POST"])
@login_required
def create_reel_from_bank():
    """
    Copy a meme-bank or AI-generated video into instagram_reels/ and create a Reel DB record.

    Request JSON:
    {
      "sourceId": "bank-mem/...mp4" | "/memes/media/<encoded-blob>",
      "igId": "1784...",            // optional (one of igId/profileId required)
      "profileId": "66c...f1a",     // optional
      "reelId": "optional-custom-id",
      "textColor": "#ffffff",
      "textArea": [24, 870, 1032, 210],
      "summary": "#explorepage",
      "memeOptions": ["#explorepage"]
    }
    """
    try:
        body = request.get_json(force=True) or {}
        source_id_raw = (body.get("sourceId") or body.get("source_id") or "").strip()
        ig_id = (body.get("igId") or body.get("ig_id") or "").strip()
        profile_id = (body.get("profileId") or body.get("profile_id") or "").strip()
        provided_reel_id = (body.get("reelId") or body.get("reel_id") or "").strip()

        text_color = (body.get("textColor") or body.get("text_color") or "#ffffff").strip()
        text_area = body.get("textArea") or body.get("text_area") or [24, 870, 1032, 210]
        summary = (body.get("summary") or "").strip()
        meme_options = body.get("memeOptions") or body.get("meme_options") or []

        if not source_id_raw:
            return jsonify({"error": "sourceId is required"}), 400

        # current user
        user = getattr(g, "current_user", None)
        if not user or not user.get("_id"):
            return jsonify({"error": "Unauthorized: missing user context"}), 401
        user_id = user["_id"]

        # Validate ownership for igId/profileId (optional)
        prof_doc = None
        if ig_id:
            prof_doc = _ensure_owned_ig_id(user_id, ig_id)
            if not prof_doc:
                return jsonify({"error": "Profile (by igId) not found or not owned by user"}), 403
        elif profile_id:
            prof_doc = _get_profile_by_id(user_id, profile_id)
            if not prof_doc:
                return jsonify({"error": "Profile (by profileId) not found or not owned by user"}), 403

        # GCS
        try:
            bucket_name, user_project, base_prefix = _get_bucket_and_prefix()
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500
        client, bucket = _build_client(bucket_name, user_project)

        # Normalize + validate source
        blob_name = _extract_blob_from_source_id(source_id_raw)

        # Allow bank-mem/ (standard) AND instagram_reels/ (already generated/saved)
        ALLOWED_PREFIXES = {base_prefix, "instagram_reels/"}
        if not any(blob_name.startswith(p) for p in ALLOWED_PREFIXES):
            return jsonify({
                "error": "sourceId must be within an allowed prefix",
                "allowedPrefixes": list(ALLOWED_PREFIXES),
                "got": blob_name
            }), 400

        src_blob = bucket.blob(blob_name)
        if not src_blob.exists(client):
            return jsonify({"error": "Source video not found"}), 404
        if not _is_video(blob_name, src_blob.content_type):
            return jsonify({"error": "Source is not a recognized video type"}), 400

        # Destination blob in GCS
        reel_id = provided_reel_id or uuid4().hex
        _, src_ext = os.path.splitext(blob_name.lower())
        ext = src_ext if src_ext in {".mp4", ".mov", ".m4v", ".webm"} else ".mp4"
        dst_blob_name = f"instagram_reels/{reel_id}{ext}"

        # Server-side copy (no egress)
        dst_blob = bucket.blob(dst_blob_name)
        bucket.copy_blob(src_blob, bucket, new_name=dst_blob_name, if_generation_match=None)

        # Preserve content type
        if src_blob.content_type:
            dst_blob.content_type = src_blob.content_type
            dst_blob.patch()

        # Auto-pick caption if not provided
        if not summary:
            summary = _autopick_text(
                os.path.basename(blob_name),
                _tokens_from_keyword(os.path.basename(blob_name))
            )

        # Validate text_area
        if not isinstance(text_area, (list, tuple)) or len(text_area) != 4:
            text_area = [24, 870, 1032, 210]

        profile_id_str = str(prof_doc.get("_id")) if prof_doc else None
        apply_watermark = _should_watermark(user_id)

        # Mark usage (never-repeat)
        try:
            src_fp = _source_fingerprint_by_name(bucket, blob_name)
            _mark_used(user_id, profile_id_str, src_fp, blob_name, niche=None)
        except Exception:
            pass

        # Insert reel (schema aligned with /memes/my-video)
        inserted = create_reel_for_mem(
            reel_id=reel_id,
            text_color=text_color,
            text_area=text_area,
            meme_options=meme_options,
            summary=summary,
            original_path=blob_name,
            status="draft",
            user_id=user_id,
            profile_id=profile_id_str,
            ig_id=ig_id,
            final_video_path=dst_blob_name,
            error="",
            watermark=apply_watermark,
            schedule_ready=True
        )

        # Build API-domain URL only
        api_abs = (os.getenv("MEDIA_ABSOLUTE_URLS", "true").lower() == "true") 
        api_video_url = _api_media_url(dst_blob_name, absolute=True, bucket=bucket)
        return jsonify({
            "msg": "reel created",
            "reelDbId": str(getattr(inserted, "inserted_id", "") or "") or None,
            "reelId": reel_id,
            "profile": {
                "id": profile_id_str,
                "ig_id": prof_doc.get("ig_id") if prof_doc else None,
            },
            "source": {"blob": blob_name},
            "destination": {
                "blob": dst_blob_name,
                "apiUrl": api_video_url,
            },
            "watermarkApplied": apply_watermark,
            "scheduleReady": True
        }), 201

    except Exception as e:
        sentry_sdk.capture_exception(e)
        return jsonify({"error": "Unexpected error", "detail": str(e)}), 500
    

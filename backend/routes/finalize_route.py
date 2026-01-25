import datetime
from datetime import timedelta
import os
import cv2
import numpy as np
import shutil
import pytesseract
import json
from urllib.parse import quote, urlparse

from bson import ObjectId
from flask import Blueprint, request, jsonify, g
from moviepy import VideoFileClip, ImageSequenceClip
from tempfile import NamedTemporaryFile
from database import db
from core.data.video_service import upload_video_to_gcloud
from services.reel_service import create_reel
from auth.dependencies import login_required
import sentry_sdk

finalize_blueprint = Blueprint("finalize_direct", __name__, url_prefix="/video")

# --- helpers -----------------------------------------------------------------

def _get_profile_by_ig_id(user_id: str, ig_id: str):
    """
    Return the profile doc for this (user_id, ig_id) pair or None.
    """
    return db.profiles.find_one({"user_id": user_id, "ig_id": ig_id})

def _get_profile_by_id(user_id: str, profile_id: str):
    """
    Return the profile doc for this (user_id, profile_id) pair or None.
    """
    try:
        _pid = ObjectId(profile_id)
    except Exception:
        return None
    return db.profiles.find_one({"_id": _pid, "user_id": user_id})

def _ensure_owned_ig_id(user_id: str, ig_id: str):
    """
    Validate that ig_id belongs to current user. Returns the profile doc or None.
    """
    return _get_profile_by_ig_id(user_id, ig_id)

def _make_thumbnail_from_video(video_path: str, out_path: str, at_seconds: float = 0.5):
    """
    Extract a frame at `at_seconds` from `video_path` and write a JPEG to `out_path`.
    """
    clip = VideoFileClip(video_path)
    t = max(0.0, min(at_seconds, max(0.0, (clip.duration or 1.0) - 0.05)))
    frame = clip.get_frame(t)  # RGB ndarray
    clip.close()

    bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    cv2.imwrite(out_path, bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

def _canonical_host() -> str:
    """
    Prefer PUBLIC_HOST or current request host, then cloud-run host. Avoid publefy.vercel.app fallback.
    """
    candidates = [
        (os.getenv("PUBLIC_HOST") or "").strip(),
        (getattr(request, "host_url", "") or "").strip(),
        (os.getenv("CLOUD_RUN_HOST") or "").strip(),
        (os.getenv("HOST_NAME") or "").strip(),
        "https://publefy-484406.us-central1.run.app",
    ]
    for c in candidates:
        if not c:
            continue
        host = c.rstrip("/")
        if not host.startswith(("http://", "https://")):
            host = "https://" + host
        return host
    return ""

def _abs_media_url(blob_name: str, host: str) -> str:
    blob = (blob_name or "").strip().lstrip("/")
    if not blob:
        return ""
    quoted = quote(blob, safe="/")
    path = f"/memes/media/{quoted}"
    return f"{host}{path}" if host else path

def _abs_download_url(blob_name: str, host: str) -> str:
    blob = (blob_name or "").strip().lstrip("/")
    if not blob:
        return ""
    quoted = quote(blob, safe="/")
    path = f"/memes/media/{quoted}"
    return f"{host}{path}" if host else path


def _signed_media_url(blob_name: str, hours: int = 48) -> str:
    """
    Generate a short-lived signed URL directly from GCS so it can be fetched without auth.
    """
    try:
        from core.data.gcloud_repo import GCloudRepository
    except Exception:
        return ""

    blob = (blob_name or "").strip().lstrip("/")
    bucket = (os.getenv("VIDEO_BUCKET_NAME") or "").strip()
    user_project = (os.getenv("USER_PROJECT") or "").strip()
    if not blob or not bucket:
        return ""
    try:
        repo = GCloudRepository(bucket, user_project)
        client = repo.get_client()
        b = client.bucket(bucket).blob(blob)
        return b.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=hours),
            method="GET",
        )
    except Exception:
        return ""


def _best_public_url(blob_name: str, host: str) -> str:
    """
    Prefer a signed GCS URL; fall back to the CDN /memes/media path.
    """
    return _signed_media_url(blob_name) or _abs_media_url(blob_name, host)

def _normalize_media_url(raw: str, host: str, *, blob_fallback: str | None = None, force_host: bool = False) -> str:
    """
    Return an absolute media URL from a stored value that may be:
    - an absolute URL
    - an API path (/memes/media/...)
    - a bare blob name (instagram_reels/abc.mp4)
    - empty, in which case blob_fallback is used
    """
    val = (raw or "").strip()
    if val.startswith(("http://", "https://")):
        if force_host and host:
            try:
                parsed = urlparse(val)
                q = f"?{parsed.query}" if parsed.query else ""
                return f"{host}{parsed.path}{q}"
            except Exception:
                pass
        return val
    if val:
        if val.startswith("/"):
            return f"{host}{val}" if host else val
        return _abs_media_url(val, host)
    if blob_fallback:
        return _abs_media_url(blob_fallback, host)
    return ""

def _resolve_thumb_url(reel: dict, host: str, force_host: bool = False) -> str:
    """
    Pick the best thumbnail URL for a reel, deriving one from the blob name if needed.
    """
    for key in ("thumbnail_url", "poster_url", "thumb", "thumb_url"):
        url = _normalize_media_url(reel.get(key, ""), host, force_host=force_host)
        if url:
            return url

    final_blob = (reel.get("final_video_path") or "").strip().lstrip("/")
    if final_blob:
        base, _ = os.path.splitext(final_blob)
        derived = f"{base}.jpg"
        thumb = _abs_media_url(derived, host)
        if thumb:
            return thumb

    original_blob = (reel.get("original_path") or "").strip().lstrip("/")
    if original_blob:
        base, _ = os.path.splitext(os.path.basename(original_blob))
        candidate = f"processed_videos/thumbs/{base}.jpg"
        thumb = _abs_media_url(candidate, host)
        if thumb:
            return thumb

    return ""

@finalize_blueprint.route("/finalize", methods=["POST"])
@finalize_blueprint.route("/finalize/", methods=["POST"])
@login_required
def finalize_video():
    temp_files = []
    final_path = None
    try:
        sentry_sdk.add_breadcrumb(
            category="video_finalize",
            message="Finalize video endpoint hit",
            level="info"
        )

        # Basic presence checks
        if "file" not in request.files or "caption" not in request.form:
            sentry_sdk.capture_message("Finalize: Missing video file or caption", level="warning")
            return jsonify({"error": "Missing video file or caption"}), 400

        file = request.files["file"]
        caption = request.form["caption"]
        summary = request.form.get("summary", "")

        # Ownership context
        try:
            user_id = str(g.current_user["_id"])
            sentry_sdk.set_user({"id": user_id})
        except Exception:
            sentry_sdk.capture_message("Finalize: Unauthorized user context error", level="warning")
            return jsonify({"error": "Unauthorized"}), 401

        # --- Resolve ig_id / profile_id and validate ownership
        ig_id = request.form.get("ig_id")
        profile_id = request.form.get("profile_id")

        profile_doc = None
        if ig_id:
            profile_doc = _ensure_owned_ig_id(user_id, ig_id)
            if not profile_doc:
                return jsonify({"error": "ig_id not found or not owned by user"}), 404
            profile_id = str(profile_doc["_id"])
        elif profile_id:
            profile_doc = _get_profile_by_id(user_id, profile_id)
            if not profile_doc:
                return jsonify({"error": "profile_id not found or not owned by user"}), 404
            ig_id = profile_doc.get("ig_id")
        
        # profile_id and ig_id are now optional. They will be None if not provided.

        sentry_sdk.set_context("profile_resolution", {
            "user_id": user_id,
            "profile_id": profile_id,
            "ig_id": ig_id
        })

        ext = os.path.splitext(file.filename)[-1]
        os.makedirs("outputs", exist_ok=True)

        sentry_sdk.set_context("finalize_request", {
            "filename": file.filename,
            "caption": caption,
            "summary": summary,
            "profile_id": profile_id,
            "ig_id": ig_id
        })

        # File paths for temp usage
        original_path = NamedTemporaryFile(delete=False, suffix=ext).name
        temp_files.append(original_path)
        cleaned_path = NamedTemporaryFile(delete=False, suffix=ext).name
        temp_files.append(cleaned_path)
        output_temp = NamedTemporaryFile(delete=False, suffix=".mp4").name
        temp_files.append(output_temp)
        final_path = f"outputs/processed_{os.path.basename(cleaned_path)}"

        with open(original_path, "wb") as f_out:
            shutil.copyfileobj(file, f_out)

        # Sample multiple frames to detect text that appears at different times
        try:
            clip_for_overlay = VideoFileClip(original_path)
            frames = []
            frame_count = 0
            for frame in clip_for_overlay.iter_frames():
                if frame_count >= 8:  # Sample 8 frames for better text detection
                    break
                frames.append(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
                frame_count += 1
            clip_for_overlay.reader.close()
            clip_for_overlay.close()
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Failed to read frames", level="error")
            return jsonify({"error": "Failed to read frames: " + str(e)}), 500

        # Use OCR to detect actual text regions instead of static percentage
        detected_area = detect_text_area(frames, num_frames=len(frames))
        if detected_area:
            x, y, w, h = detected_area
            # Increase padding to ensure full coverage of text
            frame_h, frame_w = frames[0].shape[:2]
            padding = 25
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(frame_w - x, w + 2 * padding)
            h = min(frame_h - y, h + 2 * padding)
            text_area = (x, y, w, h)
        else:
            # Fallback to static percentage if no text detected
            x, y, w, h = get_top_overlay_area(frames[0], percent_min=0.20, percent_max=0.30)
            text_area = (x, y, w, h)
        
        background_color = (0, 0, 0)
        text_color = (255, 255, 255)

        shutil.copyfile(original_path, cleaned_path)

        try:
            clip = VideoFileClip(cleaned_path)
            fps = clip.fps
            width, height = clip.w, clip.h
            writer = cv2.VideoWriter(
                output_temp,
                cv2.VideoWriter_fourcc(*"mp4v"),
                fps,
                (int(width), int(height)),
            )

            for frame in clip.iter_frames():
                bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                cv2.rectangle(bgr, (x, y), (x + w, y + h), background_color, -1)
                overlayed = overlay_text_on_frame(bgr, caption, text_area, color=text_color)
                overlayed = add_copyright_watermark(overlayed)
                writer.write(overlayed)

            writer.release()
            clip.reader.close()
            clip.close()
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Error during video overlay", level="error")
            return jsonify({"error": "Failed during video overlay: " + str(e)}), 500

        try:
            final = VideoFileClip(output_temp).with_audio(VideoFileClip(cleaned_path).audio)
            final.write_videofile(final_path, codec="libx264", audio_codec="aac")
            final.close()
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Error during audio muxing", level="error")
            return jsonify({"error": "Failed during audio muxing: " + str(e)}), 500

        # --- NEW: make a thumbnail JPEG from the final video
        thumb_temp = NamedTemporaryFile(delete=False, suffix=".jpg").name
        temp_files.append(thumb_temp)
        try:
            _make_thumbnail_from_video(final_path, thumb_temp, at_seconds=0.5)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Failed to create thumbnail", level="warning")
            thumb_temp = None  # continue without a thumbnail

        # Prepare blob names
        reel_id = str(ObjectId())
        blob_name = f"instagram_reels/reel_{reel_id}_option_1{ext}"
        blob_original = f"instagram_reels/reel_{reel_id}_original{ext}"
        blob_thumb = f"instagram_reels/reel_{reel_id}.jpg"  # thumbnail sits next to videos

        # Upload to cloud
        try:
            upload_video_to_gcloud(final_path, blob_name)
            upload_video_to_gcloud(original_path, blob_original)
            if thumb_temp:
                upload_video_to_gcloud(thumb_temp, blob_thumb)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Failed to upload video to GCloud", level="error")
            return jsonify({"error": "Failed to upload video to cloud: " + str(e)}), 500

        host = _canonical_host()
        # Resolve public URLs (prefer signed GCS; fall back to /memes/media)
        final_video_url = _best_public_url(blob_name, host)
        original_video_url = _best_public_url(blob_original, host)
        thumbnail_url = _best_public_url(blob_thumb, host) if thumb_temp else None

        # --- create reel with ig_id awareness + new URLs
        try:
            created = create_reel(
                reel_id=reel_id,
                text_color=text_color,
                text_area=text_area,
                meme_options=[caption],
                summary=summary,
                original_path=blob_original,
                final_video_path=blob_name,
                status="completed",
                user_id=user_id,
                profile_id=profile_id,
                ig_id=ig_id,  # keep ig_id
                # new fields (your schema can ignore extras if unknown)
                final_video_url=final_video_url,
                original_video_path=original_video_url,
                thumbnail_url=thumbnail_url,
                caption=caption
            )

            # Harden ig_id / URLs post-insert in case create_reel ignores extras
            try:
                db.reels.update_one(
                    {"reel_id": reel_id},
                    {"$set": {
                        "ig_id": ig_id,
                        "caption": caption,
                        "final_video_url": final_video_url,
                        "original_video_path": original_video_url,
                        "thumbnail_url": thumbnail_url
                    }},
                    upsert=False
                )
            except Exception as _e:
                sentry_sdk.capture_exception(_e)

        except TypeError:
            # Backward-compat: older create_reel without new params
            create_reel(
                reel_id=reel_id,
                text_color=text_color,
                text_area=text_area,
                meme_options=[caption],
                summary=summary,
                original_path=blob_original,
                final_video_path=blob_name,
                status="completed",
                user_id=user_id,
                profile_id=profile_id,
                caption=caption
            )
            try:
                db.reels.update_one(
                    {"reel_id": reel_id},
                    {"$set": {
                        "ig_id": ig_id,
                        "caption": caption,
                        "final_video_url": final_video_url,
                        "original_video_path": original_video_url,
                        "thumbnail_url": thumbnail_url
                    }},
                    upsert=False
                )
            except Exception as _e:
                sentry_sdk.capture_exception(_e)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            sentry_sdk.capture_message("Finalize: Failed to create reel DB entry", level="error")
            return jsonify({"error": "Failed to create reel in DB: " + str(e)}), 500

        sentry_sdk.add_breadcrumb(
            category="video_finalize",
            message=f"Finalize completed successfully for user {user_id}, reel_id {reel_id}, ig_id {ig_id}",
            level="info"
        )

        # Keep original response keys, add URLs for convenience
        return jsonify({
            "status": "completed",
            "download_url": os.path.basename(final_path),
            "reel_id": reel_id,
            "ig_id": ig_id,
            "final_video_url": final_video_url,
            "thumbnail_url": thumbnail_url
        })

    finally:
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                sentry_sdk.capture_message(f"Finalize: Error removing temp file {path}: {e}", level="warning")


def remove_temp_file(file_path):
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        print(f"Error removing temp file {file_path}: {e}")

def process_video(input_path, output_path):
    clip = VideoFileClip(input_path)
    fps = clip.fps

    frames = []
    for i, f in enumerate(clip.iter_frames()):
        if i >= 10:
            break
        frames.append(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))

    text_area = detect_text_area(frames)
    if not text_area:
        return None, None

    bg_color = get_background_color(frames[0], *text_area)
    processed = []
    for f in clip.iter_frames():
        frame = cv2.cvtColor(f, cv2.COLOR_RGB2BGR)
        frame = remove_text_from_frame(frame, text_area, bg_color)
        processed.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    out = ImageSequenceClip(processed, fps=fps)
    if clip.audio:
        out = out.with_audio(clip.audio)
    out.write_videofile(output_path, codec="libx264", audio_codec="aac")

    clip.reader.close()
    clip.close()
    out.close()

    return text_area, bg_color



def detect_text_area(frames, num_frames=10):
    """Detect text areas using OCR across multiple frames to catch text at different times."""
    x_min, y_min, x_max, y_max = np.inf, np.inf, 0, 0
    has_text = False

    for i in range(min(num_frames, len(frames))):
        gray = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
        d = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
        for j in range(len(d["text"])):
            try:
                if int(float(d["conf"][j])) > 30 and d["text"][j].strip():
                    has_text = True
                    x, y, w, h = d["left"][j], d["top"][j], d["width"][j], d["height"][j]
                    x_min, y_min = min(x_min, x), min(y_min, y)
                    x_max, y_max = max(x_max, x + w), max(y_max, y + h)
            except ValueError:
                continue

    if not has_text:
        return None

    # Increased padding to ensure full text coverage (handles text that extends beyond detected bounds)
    expand = 25
    return (
        max(0, x_min - expand),
        max(0, y_min - expand),
        (x_max - x_min) + 2 * expand,
        (y_max - y_min) + 2 * expand,
    )


def remove_text_from_frame(frame, text_area, background_color):
    x, y, w, h = text_area
    return cv2.rectangle(frame.copy(), (x, y), (x + w, y + h), background_color, -1)


def get_background_color(frame, x, y, w, h):
    margin = 15
    samples = [
        frame[max(0, y - margin):y, x:x + w],
        frame[y + h:min(frame.shape[0], y + h + margin), x:x + w],
        frame[y:y + h, max(0, x - margin):x],
        frame[y:y + h, x + w:min(frame.shape[1], x + w + margin)],
    ]
    pixels = np.vstack([s.reshape(-1, 3) for s in samples if s.size > 0])
    return tuple(map(int, np.mean(pixels, axis=0))) if len(pixels) else (128, 128, 128)

def get_text_color_by_contrast(background_color):
    r, g, b = background_color
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return (0, 0, 0) if luminance > 160 else (255, 255, 255)


_WATERMARK_LOGO_CACHE = {}

def _load_watermark_logo(target_height=30):
    """Load and cache the watermark logo, resized to target height."""
    cache_key = target_height
    if cache_key in _WATERMARK_LOGO_CACHE:
        return _WATERMARK_LOGO_CACHE[cache_key]

    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "watermark-logo.png")
    if not os.path.exists(logo_path):
        return None

    logo = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
    if logo is None:
        return None

    # Resize maintaining aspect ratio
    h, w = logo.shape[:2]
    scale = target_height / h
    new_w = int(w * scale)
    logo = cv2.resize(logo, (new_w, target_height), interpolation=cv2.INTER_AREA)

    _WATERMARK_LOGO_CACHE[cache_key] = logo
    return logo


def add_copyright_watermark(
    frame,
    text="Publefy",
    position="bottom-center",
    font_scale=0.8,
    thickness=2,
    color=(255, 255, 255),
    padding=30,
):
    """Adds copyright watermark with logo to the bottom of the frame."""
    height, width = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    # Calculate logo size based on frame height (roughly 3% of frame height)
    logo_height = max(25, int(height * 0.03))
    logo = _load_watermark_logo(logo_height)

    (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)

    # Calculate total width (logo + gap + text)
    gap = 8
    logo_w = logo.shape[1] if logo is not None else 0
    total_w = logo_w + gap + text_w if logo is not None else text_w

    # Position calculation
    if position == "bottom-right":
        start_x = width - total_w - padding
    elif position == "bottom-left":
        start_x = padding
    else:  # bottom-center
        start_x = (width - total_w) // 2

    text_y = height - padding

    # Draw logo if available
    if logo is not None:
        logo_x = start_x
        logo_y = text_y - logo_height + 5  # Align with text baseline

        # Handle alpha channel for transparency
        if logo.shape[2] == 4:
            alpha = logo[:, :, 3] / 255.0
            for c in range(3):
                y1, y2 = logo_y, logo_y + logo.shape[0]
                x1, x2 = logo_x, logo_x + logo.shape[1]
                if y1 >= 0 and y2 <= height and x1 >= 0 and x2 <= width:
                    frame[y1:y2, x1:x2, c] = (
                        alpha * logo[:, :, c] + (1 - alpha) * frame[y1:y2, x1:x2, c]
                    )
        else:
            y1, y2 = logo_y, logo_y + logo.shape[0]
            x1, x2 = logo_x, logo_x + logo.shape[1]
            if y1 >= 0 and y2 <= height and x1 >= 0 and x2 <= width:
                frame[y1:y2, x1:x2] = logo

        text_x = logo_x + logo_w + gap
    else:
        text_x = start_x

    # Add shadow for better visibility
    shadow_offset = 2
    cv2.putText(frame, text, (text_x + shadow_offset, text_y + shadow_offset), font, font_scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    cv2.putText(frame, text, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
    return frame


def overlay_text_on_frame(
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
    y_start = (
        y + (h - (height * len(lines) + line_spacing * (len(lines) - 1))) // 2 + height
    )
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


def get_top_overlay_area(frame, percent_min=0.20, percent_max=0.25):
    h, w, _ = frame.shape
    y0 = 0
    y1 = int(h * percent_max)  # Top 25%
    return (0, y0, w, y1 - y0)

def get_region_avg_color(frame, x, y, w, h):
    region = frame[y:y+h, x:x+w]
    pixels = region.reshape(-1, 3)
    return tuple(map(int, np.mean(pixels, axis=0))) if len(pixels) else (0, 0, 0)

@finalize_blueprint.route("/my-videos", methods=["GET"])
@login_required
def get_my_videos():
    """
    Returns reels for the current user *restricted to a specific ig_id*.
    Requires ?ig_id=... in the query string.
    """
    try:
        user_id = str(g.current_user["_id"])
        ig_id = request.args.get("ig_id")
        # ig_id is now optional to allow viewing unassigned reels

        try:
            limit = int(request.args.get("limit", 100))
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(limit, 500))

        host = _canonical_host()

        # Validate ownership of ig_id for this user (if provided)
        if ig_id and not _ensure_owned_ig_id(user_id, ig_id):
            return jsonify({"error": "ig_id not found or not owned by user"}), 404

        # Filter out "draft" items that haven't been explicitly saved
        query = {
            "user_id": user_id,
            "status": {"$ne": "draft"}
        }
        if ig_id:
            query["ig_id"] = ig_id
        else:
            # Optionally, you might want to only show reels with NO ig_id
            # or show ALL reels for the user.
            # The frontend agent's description suggests they want unassigned reels
            # when no account is selected.
            query["ig_id"] = None
        cursor = db.reels.find(query).sort("created_at", -1).limit(limit)
        videos = list(cursor)
        for v in videos:
            try:
                v["_id"] = str(v["_id"])
            except Exception:
                pass

            final_blob = (v.get("final_video_path") or v.get("final_path") or "").strip().lstrip("/")
            original_blob = (v.get("original_path") or "").strip().lstrip("/")

            download_url = _best_public_url(final_blob, host) if final_blob else ""
            if download_url:
                v["download_url"] = download_url

            preferred_video = (v.get("final_video_url") or v.get("media_url") or "").strip()
            if download_url:
                v["video_path"] = download_url
                v["final_video_url"] = download_url
            elif preferred_video:
                v["video_path"] = _normalize_media_url(
                    preferred_video,
                    host,
                    blob_fallback=final_blob or None,
                    force_host=True
                )
            else:
                v["video_path"] = _normalize_media_url(v.get("video_path", ""), host, force_host=True)
                v["final_video_url"] = v.get("video_path")

            v["original_video_path"] = _normalize_media_url(
                v.get("original_video_path", ""),
                host,
                blob_fallback=original_blob or None,
                force_host=True
            )

            thumb_url = _resolve_thumb_url(v, host, force_host=True)
            if thumb_url:
                v["thumbnail_url"] = thumb_url
                v.setdefault("thumb", thumb_url)

            # Provide a direct download URL when we can derive the blob name
            if final_blob:
                v.setdefault("download_url", download_url)
                v.setdefault("final_video_url", v.get("download_url", ""))

        return jsonify({"videos": videos})

    except Exception as e:
        print("[ERROR]", e)
        return jsonify({"error": str(e)}), 500

@finalize_blueprint.route("/delete/<video_id>", methods=["DELETE"])
@login_required
def delete_video(video_id):
    """
    Deletes a reel only if it belongs to the current user AND the specified ig_id.
    Accepts ?ig_id=... (preferred) or ?profile_id=... (will be resolved to ig_id).
    """
    try:
        user_id = str(g.current_user["_id"])

        # Resolve and verify ig_id -> must belong to this user
        ig_id = request.args.get("ig_id")
        profile_id = request.args.get("profile_id")

        profile_doc = None
        if ig_id:
            profile_doc = _ensure_owned_ig_id(user_id, ig_id)
            if not profile_doc:
                return jsonify({"error": "ig_id not found or not owned by user"}), 404
        elif profile_id:
            profile_doc = _get_profile_by_id(user_id, profile_id)
            if not profile_doc:
                return jsonify({"error": "profile_id not found or not owned by user"}), 404
            ig_id = profile_doc.get("ig_id")
            if not ig_id:
                return jsonify({"error": "Associated profile missing ig_id"}), 400
        else:
            return jsonify({"error": "Missing required query parameter: ig_id (or profile_id)"}), 400

        # Enforce (user_id, ig_id, reel_id) match
        delete_query = {
            "reel_id": video_id,
            "user_id": user_id
        }
        if ig_id:
            delete_query["ig_id"] = ig_id
        else:
            delete_query["ig_id"] = None

        reel = db.reels.find_one_and_delete(delete_query)

        if not reel:
            return jsonify({"error": "Video not found for this ig_id or user"}), 404

        # Best-effort local file cleanup (if you keep local copies)
        video_path = reel.get("video_path")
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception as e:
                # Non-fatal: return 200 but log warning
                print(f"Warning: couldn't remove file: {video_path}. Reason: {e}")

        return jsonify({"success": True}), 200

    except Exception as e:
        print("[ERROR] Failed to delete video:", e)
        return jsonify({"error": str(e)}), 500

@finalize_blueprint.route("/save-meme", methods=["POST"])
@login_required
def save_meme():
    """
    Updates a reel's status from "draft" to "completed", effectively 
    adding it to the user's visible library.
    """
    try:
        user_id = str(g.current_user["_id"])
        body = request.get_json(force=True) or {}
        reel_id = body.get("reel_id")
        ig_id = body.get("ig_id")

        if not reel_id:
            return jsonify({"error": "Missing required field: reel_id"}), 400

        # Ownership and existence check
        # Allow matching by reel_id (UUID) OR the blob path for flexibility
        query = {
            "user_id": user_id,
            "$or": [
                {"reel_id": reel_id},
                {"final_video_path": reel_id},
                {"final_video_path": {"$regex": f"{reel_id}$"}} # Match end of path if extension is missing
            ]
        }
        if ig_id:
            query["ig_id"] = ig_id

        reel = db.reels.find_one(query)
        if not reel:
            return jsonify({
                "error": "Reel not found or not owned by user",
                "details": f"Searched for reel_id: {reel_id}"
            }), 404

        # Update status to completed
        result = db.reels.update_one(
            {"_id": reel["_id"]},
            {"$set": {
                "status": "completed",
                "updated_at": datetime.datetime.utcnow()
            }}
        )

        if result.modified_count == 0:
             # Already completed or no change needed, but we treat it as success
             pass

        return jsonify({
            "success": True,
            "reel_id": reel_id,
            "status": "completed"
        }), 200

    except Exception as e:
        print("[ERROR] Failed to save meme:", e)
        return jsonify({"error": str(e)}), 500

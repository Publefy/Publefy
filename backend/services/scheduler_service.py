import os
import json
from datetime import datetime, timezone, timedelta

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from typing import Dict, Any
import time
from bson.objectid import ObjectId
from utils.time_parse import parse_to_utc_dt
from database import db
from services.reel_service import update_post_data

GRAPH_API_URL = "https://graph.facebook.com/v23.0"

# Run scheduler in UTC to match how we store scheduled_time (UTC)
scheduler = BackgroundScheduler(
    timezone=timezone.utc,
    job_defaults={
        'misfire_grace_time': 60,  # Allow jobs to run up to 60 seconds late
        'coalesce': True           # Combine multiple missed executions into one
    }
)
scheduler.start()

def process_due_posts() -> Dict[str, Any]:
    """
    Find all posts that are 'scheduled' but whose time has already passed,
    and publish them immediately.
    """
    import logging
    logger = logging.getLogger("publefy.scheduler")
    
    try:
        now_utc = datetime.now(timezone.utc)
        # Find posts that are 'scheduled' and whose scheduled_time is in the past
        # We use a small buffer (e.g. 1 minute) to avoid double-processing if a job just started
        cutoff = now_utc - timedelta(seconds=10)
        
        query = {
            "status": "scheduled",
            "scheduled_time": {"$lte": cutoff.isoformat()}
        }
        
        due_posts = list(db.posts.find(query))
        
        if not due_posts:
            return {"status": "ok", "message": "No overdue posts found"}
            
        logger.info(f"Found {len(due_posts)} overdue posts. Processing now...")
        
        results = []
        for post in due_posts:
            post_id = post.get("id") or str(post.get("_id"))
            logger.info(f"Processing overdue post: {post_id}")
            publish_scheduled_post({"id": post_id})
            results.append(post_id)
            
        return {
            "status": "ok", 
            "processed_count": len(due_posts),
            "processed_ids": results
        }
    except Exception as e:
        logger.exception("Error in process_due_posts")
        return {"status": "error", "message": str(e)}

def cancel_scheduled_job_only(post_id: str) -> None:
    """
    Remove the APScheduler job for this post id, but DO NOT touch the DB.
    Safe to call if the job doesn't exist.
    """
    job_id = f"post_{post_id}"
    job = scheduler.get_job(job_id)
    if job:
        scheduler.remove_job(job_id)

def load_scheduled_posts() -> tuple[list, int]:
    """Load all scheduled posts from the database"""
    try:
        posts = list(db.posts.find({"status": "scheduled"}))
        return posts, 200
    except Exception as e:
        return {"error": f"Failed to load scheduled posts: {str(e)}"}, 500

def schedule_post(post: Dict[str, Any]) -> tuple[Dict[str, Any], int]:
    import logging
    logger = logging.getLogger("publefy.scheduler")
    
    try:
        current_post = db.posts.find_one({"id": post["id"]})
        if current_post and current_post.get("status") in ["published", "failed", "publishing"]:
            return {"error": f"Post is already {current_post['status']}"}, 400

        scheduled_time = parse_to_utc_dt(post["scheduled_time"])
        now_utc = datetime.now(timezone.utc)

        # If the time is in the past, publish it immediately instead of scheduling
        if scheduled_time <= now_utc:
            logger.info(f"Post {post['id']} scheduled time ({scheduled_time}) is in the past. Executing immediately.")
            # We use a thread or just call it directly since this is usually called from an API endpoint
            # However, publish_scheduled_post handles the DB updates, so we'll use that.
            publish_scheduled_post({"id": post["id"]})
            return {"status": "published", "message": "Post was past due and executed immediately"}, 200

        job_id = f"post_{post['id']}"
        scheduler.add_job(
            publish_scheduled_post,
            DateTrigger(run_date=scheduled_time, timezone=timezone.utc),
            id=job_id,
            args=[{"id": post["id"]}],
            replace_existing=True
        )

        update_post_data({
            "id": post["id"],
            "status": "scheduled",
            "job_id": job_id,
        })

        return {"status": "scheduled", "job_id": job_id}, 200

    except Exception as e:
        return {"error": f"Failed to schedule post: {str(e)}"}, 500


def reschedule_post(post_id: str, new_scheduled_time: str | datetime) -> tuple[Dict[str, Any], int]:
    try:
        post = db.posts.find_one({"id": post_id})
        if not post:
            return {"error": "Post not found"}, 404

        if post.get("job_id") and scheduler.get_job(post["job_id"]):
            scheduler.remove_job(post["job_id"])

        dt = parse_to_utc_dt(new_scheduled_time)

        post["scheduled_time"] = dt.isoformat()
        return schedule_post(post)   

    except Exception as e:
        return {"error": f"Failed to reschedule post: {str(e)}"}, 500


def delete_scheduled_post(post_id: str) -> tuple[Dict[str, Any], int]:
    try:
        post = db.posts.find_one({"id": post_id})
        if not post:
            return {"error": "Post not found"}, 404

        if post.get("job_id") and scheduler.get_job(post["job_id"]):
            scheduler.remove_job(post["job_id"])

        db.posts.delete_one({"id": post_id})
        return {"status": "deleted"}, 200

    except Exception as e:
        return {"error": f"Failed to delete scheduled post: {str(e)}"}, 500


# -------- Video URL resolution helpers (ensure Meta can fetch anonymously) -------

def _host_base() -> str:
    host = (os.getenv("HOST_NAME") or "").strip()
    if not host:
        return ""
    host = host.rstrip("/")
    if not host.startswith(("http://", "https://")):
        host = "https://" + host
    return host


def _origin_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        pass
    return ""


def _blob_from_path(path: str) -> str:
    s = (path or "").strip()
    if not s:
        return ""
    # common stored shapes:
    # - https://host/memes/media/<blob>
    # - /memes/media/<blob>
    # - https://host/video/download/<blob>
    # - https://storage.googleapis.com/<bucket>/<blob>
    if "storage.googleapis.com/" in s:
        try:
            return s.split("storage.googleapis.com/", 1)[1].split("/", 1)[1].lstrip("/")
        except Exception:
            return s.lstrip("/")
    for marker in ("/memes/media/", "/video/download/"):
        if marker in s:
            return s.split(marker, 1)[1].lstrip("/")
    return s.lstrip("/")


def _gcs_public_url(blob: str) -> str | None:
    bucket = (os.getenv("VIDEO_BUCKET_NAME") or "").strip()
    blob = (blob or "").lstrip("/")
    if not bucket or not blob:
        return None
    return f"https://storage.googleapis.com/{bucket}/{blob}"


def _gcs_signed_url(blob: str) -> str | None:
    """
    Generate a short-lived signed URL so Meta can fetch private blobs.
    Falls back silently if signing fails (e.g., missing creds).
    """
    try:
        from core.data.gcloud_repo import GCloudRepository
    except Exception:
        return None

    bucket = (os.getenv("VIDEO_BUCKET_NAME") or "").strip()
    user_project = (os.getenv("USER_PROJECT") or "").strip()
    blob = (blob or "").lstrip("/")
    if not bucket or not blob:
        return None
    try:
        repo = GCloudRepository(bucket, user_project)
        client = repo.get_client()
        b = client.bucket(bucket).blob(blob)
        return b.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=4),
            method="GET",
        )
    except Exception:
        return None


def _download_url_for_blob(blob: str) -> str | None:
    blob = (blob or "").strip().lstrip("/")
    if not blob:
        return None
    host = _host_base()
    if not host:
        return None
    return f"{host}/video/download/{blob}"


def _coerce_public_url(raw: str, label: str) -> tuple[str, str]:
    """
    Try to turn a stored video path/url into a publicly fetchable URL that Meta can reach.
    Returns (url, source_label) or ("", label) if no usable URL can be derived.
    """
    val = (raw or "").strip()
    if not val:
        return "", label

    # Absolute URLs: derive blob -> signed URL -> API media path -> raw fallback
    if val.startswith(("http://", "https://")):
        blob_abs = _blob_from_path(val)
        if blob_abs:
            signed = _gcs_signed_url(blob_abs)
            if signed:
                return signed, f"{label}_abs_gcs_signed"
            host = _host_base()
            if host:
                return f"{host}/memes/media/{blob_abs}", f"{label}_abs_memes_media"
            return f"/memes/media/{blob_abs}", f"{label}_abs_memes_media_rel"
        return val, f"{label}_raw"

    # Relative / stored paths
    blob = _blob_from_path(val)
    if blob:
        signed = _gcs_signed_url(blob)
        if signed:
            return signed, f"{label}_gcs_signed"
        host = _host_base() or _origin_from_url(val)
        if host:
            return f"{host}/memes/media/{blob}", f"{label}_memes_media"
        return f"/memes/media/{blob}", f"{label}_memes_media_rel"

    return "", label


def _resolve_reel_video_url(reel: dict) -> tuple[str, str]:
    """
    Return a publicly fetchable video URL for the reel + source label.
    Priority: media_url -> final_video_url -> video_path -> final_video_path
    (each coerced to public/signed/download if needed).
    """
    for key in ("media_url", "final_video_url", "video_path", "final_video_path"):
        url, source = _coerce_public_url(reel.get(key, ""), key)
        if url:
            return url, source
    return "", "missing"


def resolve_video_url(post: dict, reel: dict) -> tuple[str, str]:
    """
    Resolve the best video URL, preferring a post-level media_url (from the client)
    before falling back to reel-derived URLs.
    """
    url, source = _coerce_public_url(post.get("media_url", ""), "post_media_url")
    if url:
        return url, source
    return _resolve_reel_video_url(reel)


def _fetch_media_meta(media_id: str, access_token: str) -> dict:
    if not media_id or not access_token:
        return {}
    try:
        res = requests.get(
            f"{GRAPH_API_URL}/{media_id}",
            params={
                "fields": "id,caption,permalink,thumbnail_url,timestamp",
                "access_token": access_token,
            },
            timeout=30,
        )
        if res.status_code != 200:
            return {}
        return res.json() or {}
    except Exception:
        return {}


def publish_post(post_id: str) -> tuple[Dict[str, Any], int]:
    """Publish a post to Instagram"""
    import logging
    logger = logging.getLogger("publefy.instagram")

    try:
        post = db.posts.find_one({"id": post_id})
        if not post:
            return {"error": "Post not found"}, 404

        profile = db.profiles.find_one({"_id": ObjectId(post["profile_id"])})

        if not profile:
            return {"error": "Profile not found"}, 404

        reel = db.reels.find_one({"reel_id": post["reel_id"]})
        if not reel:
            return {"error": "Reel not found"}, 404

        # Resolve a public, fetchable video URL (avoid auth-only /memes/media/)
        video_url, url_source = resolve_video_url(post, reel)

        if not video_url:
            return {"error": "Reel has no valid video_url", "details": {"source": url_source}}, 400

        logger.error("\n===== IG REELS PUBLISH DEBUG =====")
        logger.error("IG ID: %s", profile["ig_id"])
        logger.error("Video URL Used: %s (source=%s)", video_url, url_source)
        logger.error("Caption: %s", post.get("caption"))

        # Best-effort HEAD check for diagnostics
        try:
            head = requests.head(video_url, allow_redirects=True, timeout=8)
            logger.error("VIDEO HEAD: %s %s content-type=%s", head.status_code, head.reason, head.headers.get("Content-Type"))
        except Exception as e:
            logger.error("VIDEO HEAD failed: %s", e)

        # ---------------------- MEDIA CONTAINER CREATE ---------------------
        creation_res = requests.post(
            f"{GRAPH_API_URL}/{profile['ig_id']}/media",
            params={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": post.get("caption", ""),
                "access_token": profile["access_token"],
                "share_to_feed": "true",
            },
            timeout=60,
        ).json()

        logger.error("MEDIA CREATE RESPONSE: %s", creation_res)

        if "id" not in creation_res:
            return {"error": "Failed to create media container", "details": creation_res}, 400

        creation_id = creation_res["id"]

        # ---------------------- POLL MEDIA PROCESSING -----------------------
        max_attempts = 20
        for attempt in range(max_attempts):
            status_res = requests.get(
                f"{GRAPH_API_URL}/{creation_id}",
                params={"fields": "status_code,status", "access_token": profile["access_token"]},
                timeout=30,
            ).json()

            logger.error("MEDIA STATUS CHECK (%s): %s", attempt, status_res)

            code = status_res.get("status_code") or status_res.get("status")
            if code == "FINISHED":
                break
            if code == "ERROR":
                logger.error("MEDIA PROCESSING FAILED: %s", status_res)
                return {
                    "error": "Media processing failed",
                    "details": {
                        "message": "Instagram reported an error processing the video",
                        "response": status_res,
                    },
                }, 400

            time.sleep(5)
        else:
            return {"error": "Media not ready after waiting", "last_status": status_res}, 400

        # ---------------------- MEDIA PUBLISH -------------------------------
        publish_res = requests.post(
            f"{GRAPH_API_URL}/{profile['ig_id']}/media_publish",
            params={
                "creation_id": creation_id,
                "access_token": profile["access_token"],
                "published": True  # <-- IMPORTANT FIX for immediate posting
            },
            timeout=60,
        ).json()

        logger.error("MEDIA PUBLISH RESPONSE: %s", publish_res)
        logger.error("===== END IG REELS PUBLISH DEBUG =====\n")

        media_id = publish_res.get("id")
        if media_id:
            meta = _fetch_media_meta(media_id, profile.get("access_token", ""))
            update_payload = {"id": post_id, "media_id": media_id}

            permalink = meta.get("permalink")
            if permalink:
                update_payload["permalink_url"] = permalink

            thumb = (
                meta.get("thumbnail_url")
                or reel.get("thumbnail_url")
                or reel.get("poster_url")
            )
            if thumb:
                update_payload["thumbnail"] = thumb

            message = meta.get("caption") or post.get("message") or post.get("caption")
            if message:
                update_payload["message"] = message

            created_time = meta.get("timestamp")
            if created_time:
                update_payload["media_created_time"] = created_time

            if len(update_payload) > 1:
                update_post_data(update_payload)

        return {"status": "success", "publish_result": publish_res}, 200

    except Exception as e:
        logger.exception("EXCEPTION IN publish_post")
        return {"error": str(e)}, 500

def publish_scheduled_post(post: Dict[str, Any]) -> None:
    """Publish a scheduled post"""
    try:
        current_post = db.posts.find_one({"id": post["id"]})
        if not current_post:
            update_post_data({
                "id": post["id"],
                "status": "failed",
                "error": "Post not found"
            })
            return
            
        if current_post.get("status") in ["published", "failed"]:
            if current_post.get("job_id"):
                scheduler.remove_job(current_post["job_id"])
            return

        response, status_code = publish_post(post["id"])
        
        if status_code == 200:
            update_post_data({
                "id": post["id"],
                "status": "published",
                "published_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            error_message = "Unknown error"
            if isinstance(response, dict):
                error_message = response.get("error", "Unknown error")
            elif isinstance(response, str):
                error_message = response

            update_post_data({
                "id": post["id"],
                "status": "failed",
                "error": error_message
            })
            
    except Exception as e:
        update_post_data({
            "id": post["id"],
            "status": "failed",
            "error": str(e)
        })

def initialize_scheduler() -> tuple[Dict[str, Any], int]:
    """Initialize the scheduler with existing scheduled posts"""
    import logging
    logger = logging.getLogger("publefy.scheduler")
    
    try:
        # 1. Process anything that was missed while the server was down
        logger.info("Checking for overdue posts during startup...")
        process_due_posts()

        # 2. Load and schedule remaining future posts
        logger.info("Loading future scheduled posts...")
        posts, status = load_scheduled_posts()
        if status != 200:
            return posts, status
            
        for post in posts:
            # schedule_post now handles the past/future logic
            result, status = schedule_post(post)
            if status != 200:
                logger.error(f"Failed to schedule post {post.get('id')}: {result}")
                
        return {"status": "initialized"}, 200
    except Exception as e:
        logger.exception("Failed to initialize scheduler")
        return {"error": f"Failed to initialize scheduler: {str(e)}"}, 500

initialize_scheduler()

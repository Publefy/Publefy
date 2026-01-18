from core.logger.logs import log_info
from urllib.parse import quote
from models.reel import ReelCreate, ReelBase
from database import db
from bson import ObjectId
from datetime import datetime
import json
import os
import re







def to_object_id(id: str):
    try:
        return ObjectId(id)
    except:
        return None


def save_reel(data: dict) -> str:
    reel = ReelCreate(**data)
    result = db.reels.insert_one(reel.dict())
    return str(result.inserted_id)


async def create_reel_for_user(data: ReelCreate, user_id: str):
    data.user_id = user_id
    result = await db.reels.insert_one(data.dict())
    return {"id": str(result.inserted_id)}


async def get_reel_by_id(reel_id: str):
    _id = to_object_id(reel_id)
    if not _id:
        return None
    reel = await db.reels.find_one({"_id": _id})
    if reel:
        reel["_id"] = str(reel["_id"])
    return reel


async def get_reels_by_user(user_id: str):
    reels = await db.reels.find({"user_id": user_id}).to_list(100)
    for reel in reels:
        reel["_id"] = str(reel["_id"])
    return reels


async def update_reel_by_id(reel_id: str, data: dict):
    _id = to_object_id(reel_id)
    if not _id:
        return {"error": "Invalid ID"}
    await db.reels.update_one({"_id": _id}, {"$set": data})
    return {"msg": "updated"}


async def delete_reel_by_id(reel_id: str):
    _id = to_object_id(reel_id)
    if not _id:
        return {"error": "Invalid ID"}
    await db.reels.delete_one({"_id": _id})
    return {"msg": "deleted"}


def get_reels_with_status(status, limit=100) -> list[ReelBase]:
    db_reels = db.reels.find({"status": status}).to_list(limit)

    return db_reels

def get_all_reels(limit=100) -> list[ReelBase]:
    db_reels = db.reels.find().to_list(limit)

    return db_reels

def get_reel_detail(id: str):
    return db.reels.find_one({"_id": to_object_id(id)})

def get_reel_by_reel_id(reel_id: str):
    return db.reels.find_one({"reel_id": reel_id})

def update_post_data(post_data: dict):
    post = db.posts.find_one({"id": post_data["id"]})

    if post:
        log_info(f"Post {post['id']} updated")
        db.posts.update_one({"id": post_data["id"]}, {"$set": post_data})
        return

def create_reel(reel_id,
                text_color,
                text_area,
                meme_options,
                summary,
                original_path,
                status,
                user_id,
                profile_id,
                final_video_path,
                caption = "",
                error = ""):

    reel_details = ReelBase(
        reel_id=reel_id,
        status=status,
        text_color=text_color,
        text_coordinates={
            "x": text_area[0],
            "y": text_area[1],
            "width": text_area[2],
            "height": text_area[3],
        },
        summary=summary,
        funny_meme_options=meme_options,
        video_path=f"{os.getenv("HOST_NAME")}/video/download/{os.path.basename(final_video_path)}",
        original_video_path=f"/video/download/{os.path.basename(original_path)}",
        user_id=user_id,
        profile_id=profile_id,
        background_color=text_color,
        caption=caption,
        error=error
    )

    reel_dump = reel_details.model_dump()

    from database import db
    insert_result = db.reels.insert_one(reel_dump)

    return insert_result





def sanitize_filename(name: str) -> str:
    """
    Replaces problematic characters to ensure filename is URL-safe and GCS-safe.
    """
    name = name.strip()
    name = name.replace("’", "'") 
    name = name.replace(" ", "_") 
    name = re.sub(r"[#%?&]+", "", name)
    name = re.sub(r"[^a-zA-Z0-9_\-\.]", "", name)
    return name



def _ensure_rgb_tuple(color, default=(255, 255, 255)):
    if isinstance(color, (list, tuple)) and len(color) == 3:
        return (int(color[0]), int(color[1]), int(color[2]))
    if isinstance(color, str):
        s = color.strip().lstrip("#")
        if len(s) == 6:
            try:
                return (int(s[0:2],16), int(s[2:4],16), int(s[4:6],16))
            except Exception:
                pass
    return default


def create_reel_for_mem(
    reel_id: str,
    text_color,
    text_area,
    meme_options,
    summary: str,
    original_path: str,
    status: str,
    user_id: str,
    profile_id: str,
    ig_id: str,
    final_video_path: str,
    error: str = "",
    watermark: bool = False,
    schedule_ready: bool = True,
):
    text_color_tuple = _ensure_rgb_tuple(text_color, (255, 255, 255))
    bg_color_tuple   = text_color_tuple

    video_api_url    = f"{os.getenv('HOST_NAME')}/memes/media/{final_video_path}"
    original_api_url = f"{os.getenv('HOST_NAME')}/memes/media/{original_path}"

    now = datetime.utcnow()

    doc = {
        "reel_id": reel_id,
        "status": status,
        "text_color": list(text_color_tuple),
        "text_area": [int(text_area[0]), int(text_area[1]), int(text_area[2]), int(text_area[3])],
        "summary": summary,
        "meme_options": meme_options,
        # absolute API urls
        "video_path": video_api_url,
        "original_video_path": original_api_url,
        # raw blobs for server-side ops & thumb building
        "final_video_path": final_video_path,
        "original_path": original_path,
        "user_id": user_id,
        "profile_id": profile_id,
        "ig_id": ig_id or None,
        "caption": meme_options[0] if meme_options else summary,
        "background_color": list(bg_color_tuple),
        "error": error,
        "schedule_ready": bool(schedule_ready),
        "watermark": bool(watermark),
        "created_at": now,
        "updated_at": now,
        "source": "bank" if original_path.startswith("bank-mem/") else "ai",
    }

    return db.reels.insert_one(doc)

import os
import threading

from bson import ObjectId

from core.data.video_service import upload_video_to_gcloud
from core.gemini_video_analyzer import summarize_video
from core.video_processor import (
    add_text_to_video,
    get_text_color_by_contrast,
    process_video,
)
from services.reel_service import create_reel

final_video_paths = []


def render_option(i, comment, reel_id, cleaned_path, text_area, text_color, ext):
    global final_video_paths
    option_path = f"outputs/reel_{reel_id}_option_{i+1}{ext}"
    add_text_to_video(cleaned_path, option_path, text_area, comment, text_color)
    final_video_paths.append(option_path)


def remove_temp_file(path):
    if os.path.exists(path):
        os.remove(path)

def process_reel_task(ext, reel_id):
    global final_video_paths
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("outputs", exist_ok=True)

    original_path = f"uploads/reel_{reel_id}_original{ext}"
    cleaned_path = f"outputs/reel_{reel_id}_cleaned{ext}"

    text_area, background_color = process_video(original_path, cleaned_path)
    if text_area is None:
        create_reel(
            reel_id,
            (0, 0, 0),
            (0, 0, 0, 0),
            [],
            "",
            original_path,
            status="completed",
            error="No text area detected in video.",
        )

        return

    text_color = get_text_color_by_contrast(background_color)
    summary = summarize_video(cleaned_path)
    from core.gemini_funny_comment_generator import generate_meme_captions
    meme_options = generate_meme_captions(summary=summary, num_options=3, temperature=0.2)

    if not meme_options:
        create_reel(
            reel_id,
            text_color,
            text_area,
            [],
            summary,
            original_path,
            status="completed",
            caption="",
            error="No meme options extracted from Gemini response."
        )
        return

    threads = []
    for i, comment in enumerate(meme_options):
        t = threading.Thread(
            target=render_option,
            args=(i, comment, reel_id, cleaned_path, text_area, text_color, ext),
        )
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    from database import db
    for i, item_path in enumerate(final_video_paths):

        blob_name = f"reel_{reel_id}_option_{i+1}{ext}"

        upload_video_to_gcloud(item_path, blob_name)
        create_reel(
            reel_id,
            text_color,
            text_area,
            meme_options,
            summary,
            original_path,
            final_video_path=final_video_paths,
            status="completed",
            caption=meme_options[i] if i < len(meme_options) else summary
        )

        remove_temp_file(item_path)


    final_video_paths = []

    return
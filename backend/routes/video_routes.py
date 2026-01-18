import os
import shutil
import multiprocessing
from io import BytesIO

from bson import ObjectId

from core.data.gcloud_repo import GCloudRepository
from core.data.video_service import download_video_from_gcloud
from services.reel_service import get_reels_with_status, get_reel_by_reel_id, get_all_reels
from services.process_reel_task import process_reel_task
from flask import Blueprint, jsonify, request, send_from_directory, send_file
from werkzeug.exceptions import NotFound

video_blueprint = Blueprint("video", __name__, url_prefix="/video")


@video_blueprint.route("/process/", methods=["POST"])
def upload_video():
    if "file" not in request.files:
        return jsonify({"error": "Missing file!"})

    reel_id = str(ObjectId())
    file = request.files["file"]

    filename_base, ext = os.path.splitext(file.filename)
    original_path = f"uploads/reel_{reel_id}_original{ext}"
    with open(original_path, "wb") as f_out:
        shutil.copyfileobj(file, f_out)

    process = multiprocessing.Process(
        target=process_reel_task, args=[ext, reel_id]
    )

    process.start()
    return jsonify({"reel_id": reel_id, "status": "pending"})


@video_blueprint.route("/fetch/", methods=["GET"])
def fetch_reel_data():
    if "reel_id" not in request.form:
        return jsonify({"error": "Missing reel_id!"})

    reel_id = request.form["reel_id"]
    reel_data = get_reel_by_reel_id(reel_id)

    result = {
        "reel_id": reel_id,
        "status": reel_data["status"],
    }

    return jsonify(result)

@video_blueprint.route("/list/", methods=["GET"])
def list_processed_videos():
    """
    [DEPRECATED] Use /video/my-videos instead. 
    Returns a flat list of all reels without user-scoping.
    """

    processed_reels = get_all_reels()

    if not processed_reels:
        return jsonify({"videos": []})

    #base_url = os.environ["HOST_NAME"]

    full_urls = []
    for i, reel in enumerate(processed_reels):
        if "reel_id" not in reel:
            continue

        if "video_paths" in reel:
            continue

        full_urls.append({
            "reel_id": reel["reel_id"],
            "video_path": reel["video_path"],
        })

    return jsonify(full_urls)


@video_blueprint.route("/download/<filename>", methods=["GET"])
def download_video(filename):

    bytes_file = download_video_from_gcloud(filename)
    result_io = BytesIO(bytes_file)

    return send_file(result_io, as_attachment=False, mimetype="video/mp4")
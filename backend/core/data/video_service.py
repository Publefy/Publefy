from core.data.gcloud_repo import GCloudRepository
import os


def upload_video_to_gcloud(file_path: str, destination_blob_name: str) -> bool:
    try:
        bucket_name = os.getenv("VIDEO_BUCKET_NAME")
        user_project = os.getenv("USER_PROJECT")
        cloud_rep = GCloudRepository(bucket_name, user_project)

        client = cloud_rep.get_client()

        bucket = client.get_bucket(bucket_name)

        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(file_path)
        return True
    except Exception as e:
        print("Error uploading video to GCloud\n" + str(e))
        return False

def download_video_from_gcloud(destination_blob_name: str):
    try:
        bucket_name = os.getenv("VIDEO_BUCKET_NAME")
        user_project = os.getenv("USER_PROJECT")
        cloud_rep = GCloudRepository(bucket_name, user_project)

        client = cloud_rep.get_client()

        bucket = client.get_bucket(bucket_name)

        blob = bucket.blob(destination_blob_name)
        bytes_result = blob.download_as_bytes()
        return bytes_result

    except Exception as e:
        print("Error downloading video from GCloud\n" + str(e))
        return False


def list_uploaded_reels_from_gcloud():
    """
    List all uploaded Instagram reels from the 'instagram_reels/' folder in your GCS bucket.
    Returns a list of dicts: filename, gcloud_url, size, updated.
    """
    try:
        from google.cloud import storage

        bucket_name = os.getenv("VIDEO_BUCKET_NAME")
        user_project = os.getenv("USER_PROJECT")
        cloud_rep = GCloudRepository(bucket_name, user_project)
        client = cloud_rep.get_client()
        bucket = client.get_bucket(bucket_name)

        blobs = bucket.list_blobs(prefix="instagram_reels/")
        result = []
        for blob in blobs:
            if blob.name.endswith('.mp4'):
                result.append({
                    "filename": blob.name,
                    "gcloud_url": f"https://storage.googleapis.com/{bucket_name}/{blob.name}",
                    "size": blob.size,
                    "updated": blob.updated.isoformat() if blob.updated else None
                })
        return result
    except Exception as e:
        print("Error listing uploaded reels from GCloud\n" + str(e))
        return []


def download_video_reels_from_gcloud(blob_name: str):
    """
    Downloads a video reel by its blob name (e.g. 'instagram_reels/xxx.mp4') from GCS.
    Returns bytes or None.
    """
    try:
        import os
        from core.data.gcloud_repo import GCloudRepository

        bucket_name = os.getenv("VIDEO_BUCKET_NAME")
        user_project = os.getenv("USER_PROJECT")
        cloud_rep = GCloudRepository(bucket_name, user_project)

        client = cloud_rep.get_client()
        bucket = client.get_bucket(bucket_name)
        blob = bucket.blob(blob_name)

        if not blob.exists(client):
            print(f"[ERROR] Blob does not exist: {blob_name}")
            return None

        return blob.download_as_bytes()

    except Exception as e:
        print(f"[ERROR] Exception in download_video_reels_from_gcloud: {e}")
        return None

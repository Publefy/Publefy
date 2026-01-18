from enum import nonmember

from google.cloud import storage
from google.cloud.storage import Client

_client: storage.Client = None

class GCloudRepository:
    def __init__(self, bucket_name: str, user_project: str):
        self.bucket_name = bucket_name
        self.user_project = user_project


    def get_client(self) -> storage.Client:
        global _client

        if _client is None:
            _client = storage.Client(project=self.user_project)

        return _client


    def upload_file(self, file_path: str, destination_blob_name: str) -> None:
        bucket = _client.bucket(self.bucket_name)

        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(file_path)

        print(f"File {file_path} uploaded to {destination_blob_name}.")

    def download_file(self, file_path: str, destination_blob_name: str) -> None:
        bucket = _client.bucket(self.bucket_name)

        blob = bucket.blob(destination_blob_name)
        blob.download_to_filename(file_path)

        print(f"File {destination_blob_name} downloaded to {file_path}.")
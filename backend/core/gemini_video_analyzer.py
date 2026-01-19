from google import genai
from google.genai import types
from google.auth import default as google_auth_default
import mimetypes


def summarize_video(video_path: str) -> str:
    credentials, project_id = google_auth_default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    gemini_project = os.getenv("GEMINI_PROJECT", "publefy-484406")
    gemini_location = os.getenv("GEMINI_LOCATION_VIDEO", "us-central1")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

    client = genai.Client(
        vertexai=True,
        project=project_id or gemini_project,
        location=gemini_location,
        credentials=credentials,
    )

    mime_type = mimetypes.guess_type(video_path)[0]
    with open(video_path, "rb") as f:
        video_data = f.read()

    video_part = types.Part.from_bytes(data=video_data, mime_type=mime_type)
    prompt = types.Part.from_text(
        text="describe the content of this video and include the audio as well"
    )

    contents = [types.Content(role="user", parts=[video_part, prompt])]
    config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=8192,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(
                category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"
            ),
            types.SafetySetting(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"
            ),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
    )

    summary = ""
    for chunk in client.models.generate_content_stream(
        model="gemini-2.0-flash-001", contents=contents, config=config
    ):
        summary += chunk.text
    return summary

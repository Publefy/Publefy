from google import genai
from google.genai import types
from google.auth import default as google_auth_default
import re


def generate_meme_captions(
    video_summary: str = "",
    audio_summary: str = "",
    summary: str = "",
    num_options: int = 20,
    temperature: float = 0.35,
    keyword: str = ""
) -> list[str]:
    """
    Unified function to generate meme captions from video content.
    
    Args:
        video_summary: Video description (use with audio_summary)
        audio_summary: Audio description (use with video_summary)
        summary: Combined summary (alternative to video+audio)
        num_options: Number of captions to generate (3 or 20)
        temperature: Creativity level (0.2-0.9)
        keyword: User-provided keyword/prompt (e.g., "gym", "fitness") to guide generation
    
    Returns:
        List of caption strings
    """
    credentials, project_id = google_auth_default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    
    gemini_project = os.getenv("GEMINI_PROJECT", "publefy-484406")
    gemini_location = os.getenv("GEMINI_LOCATION_TEXT", "us-central1")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

    client = genai.Client(
        vertexai=True,
        project=project_id or gemini_project,
        location=gemini_location,
        credentials=credentials,
    )
    
    # Build summary text
    if video_summary and audio_summary:
        summary_text = f"Video: {video_summary}\nAudio: {audio_summary}"
    elif summary:
        summary_text = f"Summary: {summary}"
    else:
        summary_text = "General video content"
    
    # Add keyword context if provided
    keyword_context = ""
    if keyword and keyword.strip():
        keyword = keyword.strip()
        keyword_context = f"\n\nIMPORTANT: Focus on the keyword/theme '{keyword}'. Make sure the captions are highly relevant to {keyword} content. Use {keyword}-related terminology, scenarios, situations, and humor. The captions should feel authentic to {keyword} culture and experiences."
    
    prompt = (
        "You're a chaotic, unhinged meme lord creating viral Reels captions. "
        "Be bold, savage, and push boundaries - maximum chaos energy. No corporate safe-space BS. "
        "Write captions that DIRECTLY describe what's happening in the video, not generic quotes. "
        "Use current Instagram trends: 'POV:', 'Me when...', 'That moment when...'. "
        "Be conversational and relatable (like texting a friend), not preachy or philosophical. "
        "Reference specific actions, reactions, or situations shown in the video. "
        "5-25 words each, punchy and scannable.\n\n"
        f"Write EXACTLY {num_options} captions in this format:\n"
        + "\n".join([f"Option {i+1}: ..." for i in range(num_options)]) + "\n\n"
        f"{summary_text}{keyword_context}"
    )
    
    config = types.GenerateContentConfig(
        temperature=temperature,
        top_p=0.95,
        max_output_tokens=2048 if num_options == 20 else 1024,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
    )
    
    result = ""
    for chunk in client.models.generate_content_stream(
        model=gemini_model,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=config,
    ):
        result += chunk.text
    
    # Extract options
    opts = re.findall(r"Option\s+\d{1,2}:\s*(.+)", result)
    opts = [o.strip().strip('"').strip("'") for o in opts if o.strip()]
    
    # Pad if needed
    while len(opts) < num_options:
        opts.append(f"Funny meme placeholder #{len(opts)+1}")
    
    return opts[:num_options]


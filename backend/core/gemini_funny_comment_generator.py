from __future__ import annotations

from google import genai
from google.genai import types
from google.auth import default as google_auth_default

import os
import re
from typing import List


def _sanitize_topic(topic: str) -> str:
    return (topic or "").strip()


def _build_summary_text(video_summary: str, audio_summary: str, summary: str) -> str:
    video_summary = (video_summary or "").strip()
    audio_summary = (audio_summary or "").strip()
    summary = (summary or "").strip()

    if video_summary and audio_summary:
        return f"Video: {video_summary}\nAudio: {audio_summary}"
    if summary:
        return f"Summary: {summary}"
    return "Summary: (No summary provided.)"


def _build_prompt(summary_text: str, topic: str, num_options: int) -> str:
    """Prompt that forces specificity + reranks internally.

    - Generates MANY candidates internally
    - Scores silently
    - Outputs EXACTLY num_options lines in Option X: ... format

    NOTE: Even if you ask for 20, you can still later pick best in code.
    """

    # We keep the output format identical to your current parsing:
    # Option 1: ...
    # Option 2: ...

    # Topic can include both niche and style tags. We instruct the model to parse.
    topic_block = ""
    if topic:
        topic_block = (
            "\n\nTOPIC (user text - may include niche phrase + optional style tags):\n"
            f"{topic}\n"
        )

    # Output template lines
    out_lines = "\n".join([f"Option {i+1}: ..." for i in range(num_options)])

    return (
        "You write Instagram Reel meme captions.\n"
        "\n"
        "You will receive a VIDEO_DESCRIPTION (video+audio summary) and a TOPIC from the user.\n"
        "The TOPIC may contain a niche phrase plus optional style tags like: gen z, sarcastic, corporate, wholesome, dark humor, edgy, absurd, dry, deadpan, ironic, chaotic.\n"
        "\n"
        "Absolute rules (non-negotiable):\n"
        "- No political content. Do not reference politicians, parties, elections, wars, geopolitics, countries in political context, or political slogans.\n"
        "- Profanity: default to light profanity only. You may use stronger profanity ONLY if the TOPIC explicitly asks for edgy/dark/anything-goes energy or the video vibe is clearly aggressive/edgy. Never use slurs or hate speech.\n"
        "- Every caption must directly relate to what happens in the video (no generic quotes).\n"
        "- Every caption must reference at least 2 concrete details from the VIDEO_DESCRIPTION (actions, expressions, objects, setting, clothing, on-screen text, specific audio cue).\n"
        "- Avoid generic meme templates and banned openers: do NOT use 'No one:', 'Tell me you\'re X without telling me', 'I can\'t believe', 'This is so me', 'literally', 'POV: when you... and you\'re like...'.\n"
        "- Make it readable and punchy: 5-25 words, 1-2 lines max. Emojis optional (0-2 max).\n"
        "\n"
        "Humor requirements:\n"
        "- Each caption must have a clear punchline/turn (no flat descriptions).\n"
        "- Across all options, vary your comedic angle and opening phrasing.\n"
        "\n"
        "Internal process (do this silently):\n"
        "1) Extract a signature anchor detail + a supporting anchor detail from the video description.\n"
        "2) Generate 20 candidate captions internally with different angles.\n"
        "3) Score candidates 1-10 on: video-specificity, topic fit, funniness, originality, IG readability.\n"
        "4) Select the top candidates and rewrite once for sharpness.\n"
        "\n"
        f"Output EXACTLY {num_options} captions in this exact format (one per line):\n"
        f"{out_lines}\n"
        "\n"
        "VIDEO_DESCRIPTION:\n"
        f"{summary_text}"
        f"{topic_block}"
    )


def _extract_options(text: str, num_options: int) -> List[str]:
    # Robust extraction for multi-line + occasional formatting drift
    # 1) Prefer strict: Option N: ...
    opts = re.findall(r"^Option\s+(\d{1,2})\s*:\s*(.+?)\s*$", text, flags=re.MULTILINE)

    # Map by option number to preserve ordering if model outputs out of order
    by_n = {}
    for n_str, body in opts:
        try:
            n = int(n_str)
        except ValueError:
            continue
        body = (body or "").strip().strip('"').strip("'")
        if body:
            by_n[n] = body

    ordered = [by_n.get(i + 1, "") for i in range(num_options)]

    # 2) If too many blanks, fall back to a looser pattern
    if sum(1 for x in ordered if x) < max(1, num_options // 2):
        loose = re.findall(r"Option\s+\d{1,2}\s*:\s*(.+)", text)
        loose = [(x or "").strip().strip('"').strip("'") for x in loose if (x or "").strip()]
        ordered = loose[:num_options]

    # Pad (keep your existing behavior)
    while len(ordered) < num_options:
        ordered.append(f"Funny meme placeholder #{len(ordered) + 1}")

    # Replace any remaining blanks
    for i in range(len(ordered)):
        if not ordered[i]:
            ordered[i] = f"Funny meme placeholder #{i + 1}"

    return ordered[:num_options]


def generate_meme_captions(
    video_summary: str = "",
    audio_summary: str = "",
    summary: str = "",
    num_options: int = 20,
    temperature: float = 0.35,
    keyword: str = "",
) -> list[str]:
    """Generate meme captions from video content using Vertex AI Gemini.

    This is a drop-in upgrade of your original function:
    - Same signature + return type
    - Same streaming call
    - Same Option N: parsing

    Key changes:
    - Forces captions to reference 2+ concrete video details
    - Avoids politics
    - Controls profanity (light by default; stronger only if topic implies)
    - Adds internal reranking for higher quality

    Args:
        video_summary: Video description (use with audio_summary)
        audio_summary: Audio description (use with video_summary)
        summary: Combined summary (alternative to video+audio)
        num_options: Number of captions to return
        temperature: Creativity level
        keyword: User-provided topic prompt (may include style tags)

    Returns:
        List of caption strings
    """

    # ---- Auth / client setup (unchanged behavior) ----
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

    # ---- Build inputs ----
    summary_text = _build_summary_text(video_summary, audio_summary, summary)
    topic = _sanitize_topic(keyword)

    prompt = _build_prompt(summary_text=summary_text, topic=topic, num_options=num_options)

    # NOTE: You currently override safety to OFF.
    # Keeping it as-is to avoid breaking behavior.
    # If you later see weird edge outputs, consider setting thresholds back to default.
    config = types.GenerateContentConfig(
        temperature=temperature,
        top_p=0.95,
        max_output_tokens=2048 if num_options >= 20 else 1024,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
    )

    # ---- Generate (streaming) ----
    result_text = ""
    for chunk in client.models.generate_content_stream(
        model=gemini_model,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=config,
    ):
        # Some SDKs may return None chunks; be defensive.
        if getattr(chunk, "text", None):
            result_text += chunk.text

    # ---- Parse options ----
    opts = _extract_options(result_text, num_options=num_options)

    return opts

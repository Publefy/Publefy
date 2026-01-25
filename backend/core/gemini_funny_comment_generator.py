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
    client = genai.Client(
        vertexai=True,
        project=project_id or "publefy",
        location="us-central1",
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
        keyword_context = (
            f"\n\nNiche/Theme: '{keyword}'\n"
            f"- The captions must feel native to {keyword} culture.\n"
            f"- Use {keyword}-specific terminology, situations, and inside-jokes (without being cringe).\n"
        )

    # --- Humor-focused prompt (twist + variety) ---
    prompt = (
        "You write viral Instagram Reel meme captions.\n\n"
        "INTERNAL STEP (do not output): Identify the single funniest / most awkward moment in the video, "
        "and the implied emotion (embarrassment, ego, laziness, delusion, panic, hype, etc.).\n"
        "Then write captions that are a TWIST on that moment — not a literal description.\n\n"
        "Hard rules:\n"
        "- Each caption must have a setup + punchline twist (misdirection, escalation, or inner-monologue).\n"
        "- Be specific to what's happening (actions/reactions), no generic quotes.\n"
        "- No motivational / inspirational / preachy lines.\n"
        "- No slurs, hate, threats, or explicit sexual content.\n"
        "- 5–20 words, punchy, scannable.\n"
        "- Use at least 6 different meme formats across the list.\n\n"
        "Allowed formats to mix:\n"
        "POV:, Me when…, Nobody: / Me:, The way I…, I really thought…, "
        "Bro really…, I'm not even gonna lie…, When you…, That moment when…\n\n"
        f"Write EXACTLY {num_options} captions in this format:\n"
        + "\n".join([f"Option {i+1}: ..." for i in range(num_options)]) + "\n\n"
        "Video context:\n"
        f"{summary_text}"
        f"{keyword_context}\n"
        "Reminder: captions must feel human, like a friend roasting themselves."
    )

    # --- Temperature tuning (keep same parameter, just smarter default use) ---
    # Humor needs exploration for larger batches; keep smaller batches tighter.
    effective_temperature = temperature
    if num_options >= 10 and effective_temperature < 0.55:
        effective_temperature = 0.7
    elif num_options <= 3 and effective_temperature > 0.55:
        effective_temperature = 0.45

    config = types.GenerateContentConfig(
        temperature=effective_temperature,
        top_p=0.9,
        max_output_tokens=2048 if num_options >= 10 else 1024,
        response_modalities=["TEXT"],
        # Keep safety on; use prompt constraints for "edgy" without unsafe outputs.
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_MEDIUM_AND_ABOVE"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
        ],
    )

    result = ""
    for chunk in client.models.generate_content_stream(
        model="gemini-2.0-flash-001",
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=config,
    ):
        result += chunk.text or ""

    # Extract options (robust to small formatting deviations)
    opts = re.findall(r"Option\s+\d{1,2}:\s*(.+)", result)
    opts = [o.strip().strip('"').strip("'") for o in opts if o and o.strip()]

    # --- Lightweight quality filter (no extra model calls) ---
    # Kill the worst generic / preachy outputs and obvious formatting junk.
    banned_phrases = [
        "stay consistent", "never give up", "keep going", "hard work", "success",
        "grind", "motivation", "inspir", "hustle", "discipline", "mindset",
        "believe in", "you got this", "keep pushing"
    ]

    def looks_bad(s: str) -> bool:
        s_l = s.lower()
        if len(s.split()) > 22:  # keep short
            return True
        if any(bp in s_l for bp in banned_phrases):
            return True
        if s_l.count("...") > 2:
            return True
        if s_l.startswith("option"):
            return True
        return False

    filtered = []
    seen = set()
    for o in opts:
        norm = re.sub(r"\s+", " ", o).strip().lower()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        if looks_bad(o):
            continue
        filtered.append(o)

    # If we filtered too hard, fall back to original list (but still deduped)
    final_opts = filtered if len(filtered) >= max(3, num_options // 2) else opts

    # Pad if needed
    while len(final_opts) < num_options:
        final_opts.append(f"Funny meme placeholder #{len(final_opts)+1}")

    return final_opts[:num_options]

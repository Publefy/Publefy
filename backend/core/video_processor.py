import cv2
import numpy as np
import pytesseract
from moviepy import VideoFileClip, ImageSequenceClip, TextClip, CompositeVideoClip
import os, subprocess

from dotenv import load_dotenv

load_dotenv()
pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")


def detect_text_area(frames, num_frames=10):
    # Only scan first frame since text positioning is static - major performance optimization
    if not frames:
        return None

    x_min, y_min, x_max, y_max = np.inf, np.inf, 0, 0
    has_text = False

    # Process only the first frame instead of multiple frames
    gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    d = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
    for j in range(len(d["text"])):
        try:
            if int(float(d["conf"][j])) > 30 and d["text"][j].strip():
                has_text = True
                x, y, w, h = (
                    d["left"][j],
                    d["top"][j],
                    d["width"][j],
                    d["height"][j],
                )
                x_min, y_min = min(x_min, x), min(y_min, y)
                x_max, y_max = max(x_max, x + w), max(y_max, y + h)
        except ValueError:
            continue

    if not has_text:
        return None

    expand = 10
    return (
        max(0, x_min - expand),
        max(0, y_min - expand),
        (x_max - x_min) + 2 * expand,
        (y_max - y_min) + 2 * expand,
    )


def get_background_color(frame, x, y, w, h):
    margin = 15
    samples = [
        frame[max(0, y - margin) : y, x : x + w],
        frame[y + h : min(frame.shape[0], y + h + margin), x : x + w],
        frame[y : y + h, max(0, x - margin) : x],
        frame[y : y + h, x + w : min(frame.shape[1], x + w + margin)],
    ]
    pixels = np.vstack([s.reshape(-1, 3) for s in samples if s.size > 0])
    return tuple(map(int, np.mean(pixels, axis=0))) if len(pixels) else (128, 128, 128)


def get_text_color(video_path, x, y, w, h):
    clip = VideoFileClip(video_path)
    frame = next(clip.iter_frames())
    bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    region = bgr[y : y + h, x : x + w]
    clip.reader.close()
    clip.close()
    return (
        tuple(map(int, np.mean(region.reshape(-1, 3), axis=0)))
        if region.size
        else (255, 255, 255)
    )


def get_text_color_by_contrast(background_color):
    r, g, b = background_color
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return (0, 0, 0) if luminance > 160 else (255, 255, 255)


def remove_text_from_frame(frame, text_area, background_color):
    x, y, w, h = text_area
    return cv2.rectangle(frame.copy(), (x, y), (x + w, y + h), background_color, -1)


_WATERMARK_LOGO_CACHE = {}

def _load_watermark_logo(target_height=30):
    """Load and cache the watermark logo, resized to target height."""
    cache_key = target_height
    if cache_key in _WATERMARK_LOGO_CACHE:
        return _WATERMARK_LOGO_CACHE[cache_key]

    logo_path = os.path.join(os.path.dirname(__file__), "..", "static", "watermark-logo.png")
    if not os.path.exists(logo_path):
        return None

    logo = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
    if logo is None:
        return None

    # Resize maintaining aspect ratio
    h, w = logo.shape[:2]
    scale = target_height / h
    new_w = int(w * scale)
    logo = cv2.resize(logo, (new_w, target_height), interpolation=cv2.INTER_AREA)

    _WATERMARK_LOGO_CACHE[cache_key] = logo
    return logo


def add_copyright_watermark(
    frame,
    text="Publefy",
    position="bottom-center",
    font_scale=0.8,
    thickness=2,
    color=(255, 255, 255),
    padding=30,
):
    """Adds copyright watermark with logo to the bottom of the frame."""
    height, width = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    # Calculate logo size based on frame height (roughly 3% of frame height)
    logo_height = max(25, int(height * 0.03))
    logo = _load_watermark_logo(logo_height)

    (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)

    # Calculate total width (logo + gap + text)
    gap = 8
    logo_w = logo.shape[1] if logo is not None else 0
    total_w = logo_w + gap + text_w if logo is not None else text_w

    # Position calculation
    if position == "bottom-right":
        start_x = width - total_w - padding
    elif position == "bottom-left":
        start_x = padding
    else:  # bottom-center
        start_x = (width - total_w) // 2

    text_y = height - padding

    # Draw logo if available
    if logo is not None:
        logo_x = start_x
        logo_y = text_y - logo_height + 5  # Align with text baseline

        # Handle alpha channel for transparency
        if logo.shape[2] == 4:
            alpha = logo[:, :, 3] / 255.0
            for c in range(3):
                y1, y2 = logo_y, logo_y + logo.shape[0]
                x1, x2 = logo_x, logo_x + logo.shape[1]
                if y1 >= 0 and y2 <= height and x1 >= 0 and x2 <= width:
                    frame[y1:y2, x1:x2, c] = (
                        alpha * logo[:, :, c] + (1 - alpha) * frame[y1:y2, x1:x2, c]
                    )
        else:
            y1, y2 = logo_y, logo_y + logo.shape[0]
            x1, x2 = logo_x, logo_x + logo.shape[1]
            if y1 >= 0 and y2 <= height and x1 >= 0 and x2 <= width:
                frame[y1:y2, x1:x2] = logo

        text_x = logo_x + logo_w + gap
    else:
        text_x = start_x

    # Add shadow for better visibility
    shadow_offset = 2
    cv2.putText(frame, text, (text_x + shadow_offset, text_y + shadow_offset), font, font_scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    cv2.putText(frame, text, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
    return frame


def overlay_text_on_frame(
    frame,
    text,
    text_area,
    color=(255, 255, 255),
    base_font_scale=1,
    thickness=2,
    max_lines=3,
    line_spacing=10,
):
    x, y, w, h = text_area
    font = cv2.FONT_HERSHEY_SIMPLEX
    words = text.split()
    lines, current_line = [], ""

    for word in words:
        trial = current_line + word + " "
        if cv2.getTextSize(trial, font, base_font_scale, thickness)[0][0] < w:
            current_line = trial
        else:
            lines.append(current_line.strip())
            current_line = word + " "
    if current_line:
        lines.append(current_line.strip())
    lines = lines[:max_lines]

    while True:
        height = cv2.getTextSize("Test", font, base_font_scale, thickness)[0][1]
        if (
            height * len(lines) + line_spacing * (len(lines) - 1) <= h
            or base_font_scale < 0.5
        ):
            break
        base_font_scale *= 0.9

    overlay = frame.copy()
    y_start = (
        y + (h - (height * len(lines) + line_spacing * (len(lines) - 1))) // 2 + height
    )
    for i, line in enumerate(lines):
        size = cv2.getTextSize(line, font, base_font_scale, thickness)[0]
        x_text = x + (w - size[0]) // 2
        y_text = y_start + i * (height + line_spacing)
        cv2.putText(
            overlay,
            line,
            (x_text, y_text),
            font,
            base_font_scale,
            color,
            thickness,
            cv2.LINE_AA,
        )
    return overlay


def process_video(input_path, output_path):
    clip = VideoFileClip(input_path)
    fps = clip.fps

    # Only extract first frame for text detection since positioning is static
    frames = []
    for i, f in enumerate(clip.iter_frames()):
        if i >= 1:  # Only need first frame now
            break
        frames.append(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))

    text_area = detect_text_area(frames)
    if not text_area:
        clip.reader.close()
        clip.close()
        return None, None

    bg_color = get_background_color(frames[0], *text_area)
    del frames

    processed = []
    for f in clip.iter_frames():
        frame = cv2.cvtColor(f, cv2.COLOR_RGB2BGR)
        frame = remove_text_from_frame(frame, text_area, bg_color)
        processed.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    out = ImageSequenceClip(processed, fps=fps)
    if clip.audio:
        out = out.with_audio(clip.audio)
    out.write_videofile(output_path, codec="libx264", audio_codec="aac")

    clip.reader.close()
    clip.close()
    out.close()

    return text_area, bg_color


def add_text_to_video(
    input_path, output_path, text_area, text, text_color=(255, 255, 255)
):
    from tempfile import NamedTemporaryFile

    clip = VideoFileClip(input_path)
    fps = clip.fps
    height, width = clip.h, clip.w

    temp_output = NamedTemporaryFile(delete=False, suffix=".mp4").name

    writer = cv2.VideoWriter(
        temp_output,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )

    for frame in clip.iter_frames():
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        overlayed = overlay_text_on_frame(bgr, text, text_area, color=text_color)
        writer.write(overlayed)

    writer.release()
    clip.reader.close()
    clip.close()

    # Use moviepy to attach audio (no re-rendering of frames)
    silent = VideoFileClip(temp_output)
    original = VideoFileClip(input_path)
    final = silent.with_audio(original.audio)
    final.write_videofile(output_path, codec="libx264", audio_codec="aac")

    silent.close()
    original.close()
    final.close()
    os.remove(temp_output)

import cv2
import numpy as np
import pytesseract
from moviepy import VideoFileClip, ImageSequenceClip, TextClip, CompositeVideoClip
import os, subprocess

from dotenv import load_dotenv

load_dotenv()
pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")

# Initialize EasyOCR detector (lazy load, optional)
_EASYOCR_READER = None
_EASYOCR_AVAILABLE = None

def _get_easyocr_reader():
    """Lazy load EasyOCR reader instance for detection. Returns None if not available."""
    global _EASYOCR_READER, _EASYOCR_AVAILABLE
    if _EASYOCR_AVAILABLE is None:
        try:
            import easyocr
            _EASYOCR_READER = easyocr.Reader(['en'], gpu=False, verbose=False)
            _EASYOCR_AVAILABLE = True
        except ImportError:
            _EASYOCR_AVAILABLE = False
            print("[INFO] EasyOCR not available, falling back to pytesseract")
    return _EASYOCR_READER if _EASYOCR_AVAILABLE else None


def detect_text_area(frames, num_frames=10, debug_output_path=None):
    """
    Text detector with EasyOCR (if available) or pytesseract fallback.
    Returns (x, y, w, h) for mask area.
    """
    if not frames:
        return None

    frame_height, frame_width = frames[0].shape[:2]

    # Try EasyOCR first if available
    reader = _get_easyocr_reader()
    if reader is not None:
        # Use EasyOCR detection
        num_frames_to_sample = min(12, len(frames))
        sample_indices = list(range(min(num_frames_to_sample, len(frames))))
        y_max = 0
        boxes_detected = False

        for frame_idx in sample_indices:
            frame = frames[frame_idx]
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            try:
                results = reader.detect(frame_rgb)
                if results and results[0]:
                    boxes_detected = True
                    for box in results[0]:
                        y_coords = [point[1] for point in box]
                        bottom_y = max(y_coords)
                        y_max = max(y_max, bottom_y)
            except Exception as e:
                print(f"[EasyOCR] Detection error on frame {frame_idx}: {e}")
                continue

        if boxes_detected:
            padding = 120
            mask_end = min(frame_height, int(y_max + padding))
            print(f"[EasyOCR] Detected text bottom at y={int(y_max)}, mask_end={mask_end}px")
        else:
            mask_end = int(frame_height * 0.30)
            print(f"[EasyOCR] No text detected, using fallback mask_end={mask_end}px")
    else:
        # Fallback to pytesseract-based detection
        sample_indices = np.linspace(0, len(frames) - 1, min(num_frames, len(frames)), dtype=int)
        y_max_ocr = 0
        ocr_detected_count = 0

        for idx in sample_indices:
            gray = cv2.cvtColor(frames[int(idx)], cv2.COLOR_BGR2GRAY)
            d = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
            for j in range(len(d["text"])):
                try:
                    if int(float(d["conf"][j])) > 10 and d["text"][j].strip():
                        x, y, w, h = d["left"][j], d["top"][j], d["width"][j], d["height"][j]
                        y_max_ocr = max(y_max_ocr, y + h)
                        ocr_detected_count += 1
                except ValueError:
                    continue

        # Edge detection fallback
        y_max_edges = 0
        bottom_half_start = int(frame_height * 0.4)
        gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        row_density = []
        for y in range(bottom_half_start, frame_height):
            density = np.sum(edges[y, :]) / frame_width
            row_density.append((y, density))
        if row_density:
            row_density.sort(key=lambda x: x[1], reverse=True)
            top_rows = row_density[:max(1, len(row_density) // 10)]
            if top_rows and top_rows[0][1] > 10:
                for y, density in top_rows:
                    if density > 10:
                        y_max_edges = max(y_max_edges, y)

        y_max_detected = max(y_max_ocr, y_max_edges)
        expand_bottom = 100
        weak_detection_threshold = 5
        minimum_safe_coverage = int(frame_height * 0.80)

        if ocr_detected_count < weak_detection_threshold or y_max_detected == 0:
            mask_end = minimum_safe_coverage
        else:
            ocr_coverage = y_max_detected + expand_bottom
            mask_end = max(ocr_coverage, minimum_safe_coverage)
        
        mask_end = min(mask_end, frame_height)
        boxes_detected = ocr_detected_count >= weak_detection_threshold
        print(f"[pytesseract] Detected text bottom at y={int(y_max_detected)}, mask_end={mask_end}px")

    # Debug render - save first frame with visible mask line
    if debug_output_path and len(frames) > 0:
        debug_frame = frames[0].copy()
        # Draw bright green line at mask_end
        cv2.line(debug_frame, (0, mask_end), (frame_width, mask_end), (0, 255, 0), 3)
        # Draw text showing coverage
        coverage_pct = (mask_end / frame_height) * 100
        status = "Detected" if boxes_detected else "Fallback"
        cv2.putText(debug_frame, f"{status}: {mask_end}px ({coverage_pct:.1f}%)",
                    (10, mask_end - 10), cv2.FONT_HERSHEY_SIMPLEX,
                    1.0, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.imwrite(debug_output_path, debug_frame)
        print(f"[DEBUG] Saved debug frame to: {debug_output_path}")

    # Return full-width box from top to mask_end
    return (
        0,           # x: start at left edge
        0,           # y: start at top
        frame_width, # w: full width
        mask_end     # h: detected end point
    )


def get_background_color(frame, x, y, w, h):
    """Sample background color from BELOW the text area (not above)."""
    # Sample from area just below the masked region
    sample_y_start = y + h + 5  # Start 5px below mask
    sample_y_end = min(frame.shape[0], sample_y_start + 30)  # Sample 30px strip

    # If we're too close to bottom, sample from sides instead
    if sample_y_end >= frame.shape[0] - 10:
        margin = 15
        samples = [
            frame[y : y + h, max(0, x - margin) : x],
            frame[y : y + h, x + w : min(frame.shape[1], x + w + margin)],
        ]
    else:
        # Sample from below the text area
        samples = [
            frame[sample_y_start:sample_y_end, x : x + w],
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
    # FIX 1: VideoFileClip handles rotation metadata automatically
    # Frames are already normalized to final render orientation
    clip = VideoFileClip(input_path)
    fps = clip.fps

    # FIX 2: Extract up to 10 frames from first 2 seconds (not just first frame)
    # This catches captions that fade in after the video starts
    frames = []
    max_frames_for_detection = 10
    frames_in_2_seconds = int(fps * 2)  # ~48-60 frames for typical videos
    sample_every = max(1, frames_in_2_seconds // max_frames_for_detection)

    for i, f in enumerate(clip.iter_frames()):
        if len(frames) >= max_frames_for_detection:
            break
        if i % sample_every == 0:  # Sample evenly
            # FIX 1: Frames from VideoFileClip are already in final orientation
            frames.append(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))

    # FIX 5: Generate debug frame
    import tempfile
    debug_path = os.path.join(tempfile.gettempdir(), "text_detection_debug.png")
    text_area = detect_text_area(frames, debug_output_path=debug_path)

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

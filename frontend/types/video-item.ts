// types/video-item.ts
export class VideoItem {
  reel_id: string;
  video_path: string;

  constructor() {
    this.reel_id = "";
    this.video_path = "";
  }
}

export class VideoItemUi {
  id: string;
  reel_id?: string;

  video_url: string;
  secure_url?: string;
  poster_url?: string;
  background_color: string;
  summary: string;
  text_color: string;
  text_coordinates: string;
  user_id: string;
  original_video_path: string;
  error: string;
  status: string;
  type: string;
  selected: boolean;
  source?: string;
  schedule_ready?: boolean;
  thumb_is_video?: boolean;
  has_video?: boolean;

  constructor() {
    this.id = "";
    this.reel_id = undefined;
    this.video_url = "";
    this.type = "";
    this.selected = false;
    this.background_color = "";
    this.summary = "";
    this.text_color = "";
    this.text_coordinates = "";
    this.user_id = "";
    this.original_video_path = "";
    this.error = "";
    this.status = "";
  }
}

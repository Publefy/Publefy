export class AnalyzeResult {
    reel_id: string;
    video_summary: string;
    audio_summary: string;
    meme_options: string[];

    constructor() {
        this.reel_id = "";
        this.video_summary = "";
        this.audio_summary = "";
        this.meme_options = [];
    }
}
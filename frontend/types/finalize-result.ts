export class FinalizeResult {
    status: string;
    download_url: string;
    final_video_url?: string;
    thumbnail_url?: string;
    reel_id?: string;
    ig_id?: string;

    constructor() {
        this.status = "";
        this.download_url = "";
    }
}
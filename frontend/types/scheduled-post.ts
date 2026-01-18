

export class ScheduledPost {
    id: string
    created_time: Date
    scheduled_time: Date | string 
    color: string
    summary: string
    hashtags: string[]
    caption: string
    reel_id: string
    profile_id: string

    constructor() {
        this.id = ""
        this.reel_id = ""
        this.profile_id = ""
        this.created_time = new Date()
        this.scheduled_time = new Date()
        this.color = ""
        this.summary = ""
        this.hashtags = []
        this.caption = ""
    }
}
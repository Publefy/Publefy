from datetime import datetime

from pydantic import BaseModel, Field


#class PostType(BaseModel):
#   id: str = Field(alias="_id")
#    type: str

class Post(BaseModel):
    id: str = Field(alias="_id")
    hashtags: list[str]
    reel_id: str
    caption: str
    scheduled_time: datetime
    scheduled_unix: int
    created_time: datetime
    profile_id: str
    color: str
    status: str
    media_id: str
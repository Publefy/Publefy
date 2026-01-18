from pydantic import BaseModel, Field
from typing import List, Tuple, Dict
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

class ReelBase(BaseModel):
    reel_id: str
    user_id: str
    summary: str
    status: str
    text_coordinates: Dict[str, int]
    text_color: Tuple[int, int, int]
    background_color: Tuple[int, int, int]
    funny_meme_options: List[str]
    video_path: str
    original_video_path: str
    caption: str = ""
    error: str

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class ReelCreate(ReelBase):
    pass

class ReelOut(ReelBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

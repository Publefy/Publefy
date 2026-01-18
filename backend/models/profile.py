from pydantic import BaseModel, Field


class Profile(BaseModel):
    id: str = Field(alias="_id")
    ig_id: str = Field(alias="ig_id")
    name: str
    platform: str
    image: str
    access_token: str
    user_id: str

class ProfileCreate(BaseModel):
    name: str
    platform: str
    image: str
    ig_id: str
    access_token: str
    user_id: str
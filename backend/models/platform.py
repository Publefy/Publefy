from pydantic import BaseModel


class Platform(BaseModel):
    id: str
    name: str
    image: str

class PlatformCreate(BaseModel):
    name: str
    image: str
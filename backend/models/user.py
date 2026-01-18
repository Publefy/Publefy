from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from typing import Optional
from .subscription import SubscriptionInfo

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    subscription: Optional[SubscriptionInfo] = Field(default_factory=SubscriptionInfo)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

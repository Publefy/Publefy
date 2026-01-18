from pydantic import BaseModel
from bson import ObjectId
from uuid import uuid4

def generate_uuid():
    return str(uuid4())

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return str(v)

from typing import List
from pydantic import BaseModel

class PDFResponse(BaseModel):
    chunks: List[str]
    errors: List[str]
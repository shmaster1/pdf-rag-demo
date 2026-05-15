from pydantic import BaseModel


class QueryResponse(BaseModel):
    answer: str
    contexts: list[str] = []
    sources: list[str] = []
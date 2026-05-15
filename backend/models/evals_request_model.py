from pydantic import BaseModel


class EvaluationRequest(BaseModel):
    question: str
    answer: str
    contexts: list[str]
    ground_truth: str  # the "correct" reference answer
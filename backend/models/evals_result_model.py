from pydantic import BaseModel


class EvaluationResult(BaseModel):
    answer_relevancy: float
    faithfulness: float
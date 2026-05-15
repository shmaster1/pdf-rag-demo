from pydantic import BaseModel


class EvaluationResult(BaseModel):
    answer_correctness: float
    answer_relevancy: float
    faithfulness: float
    context_recall: float
    context_precision: float
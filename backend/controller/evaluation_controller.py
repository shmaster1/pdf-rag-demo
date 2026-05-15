from fastapi import APIRouter

from backend.models.evals_request_model import EvaluationRequest
from backend.models.evals_result_model import EvaluationResult
from backend.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/evaluation", tags=["EVALUATION"])

_evaluation_service = None

def get_evaluation_service():
    global _evaluation_service
    if _evaluation_service is None:
        _evaluation_service = EvaluationService()
    return _evaluation_service

@router.post("/")
def get_evaluations_scores(inputs: EvaluationRequest) -> EvaluationResult:
    result = get_evaluation_service().evaluate_rag(inputs.question, inputs.answer, inputs.contexts)
    return EvaluationResult(**result)
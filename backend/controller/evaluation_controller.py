from fastapi import APIRouter

from backend.models.evals_request_model import EvaluationRequest
from backend.models.evals_result_model import EvaluationResult
from backend.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/evaluation", tags=["EVALUATION"])

evaluation_service = EvaluationService()

@router.post("/")
def get_evaluations_scores(inputs: EvaluationRequest) -> EvaluationResult:
    result = evaluation_service.evaluate_rag(inputs.question, inputs.answer, inputs.contexts, inputs.ground_truth)
    return EvaluationResult(**result)
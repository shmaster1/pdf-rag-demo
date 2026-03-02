from fastapi import APIRouter
from backend.config.config import Config
from backend.models.query_request import QueryRequest
from backend.models.query_response import QueryResponse
from backend.services.rag_pipeline_service import RAGPipelineService

router = APIRouter(prefix="/rag", tags=["RAG"])

config = Config()
rag_service = RAGPipelineService(config=config)

@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    try:
        answer_text = rag_service.ask_question(request.question)
        return {"answer": answer_text, "sources": []}
    except Exception as e:
        # Log the full exception for debugging
        import traceback
        print("RAG query failed:", str(e))
        traceback.print_exc()
        return {"answer": f"Error: {str(e)}", "sources": []}
import json
from starlette import status
from fastapi.responses import StreamingResponse

from backend.config.config import Config
from fastapi import UploadFile, File, APIRouter, HTTPException
from backend.services.pdf_converter_service import PDFConverterService
from backend.services.rag_pipeline_service import RAGPipelineService

router = APIRouter(prefix="/pdf_converter", tags=["PDF_CONVERTER"])
config = Config()


@router.post("/")
def index_uploaded_pdf(file: UploadFile = File(...)) -> StreamingResponse:
    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(0)
    if size_bytes > config.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {config.MAX_FILE_SIZE_MB}MB size limit.",
        )

    def generate():
        converter = PDFConverterService(config)

        yield f"data: {json.dumps({'stage': 'converting'})}\n\n"
        pdf_res = converter.convert_pdf_to_text(file)

        if pdf_res.errors:
            yield f"data: {json.dumps({'stage': 'error', 'message': pdf_res.errors[0]})}\n\n"
            return

        rag_service = RAGPipelineService(config)

        yield f"data: {json.dumps({'stage': 'embedding'})}\n\n"
        vectors = rag_service.embed_chunks(pdf_res.chunks)

        yield f"data: {json.dumps({'stage': 'indexing'})}\n\n"
        rag_service.insert_chunks(pdf_res.chunks, vectors, file.filename)

        yield f"data: {json.dumps({'stage': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.delete("/", status_code=status.HTTP_200_OK)
def clear_pdf_data():
    cleaner = RAGPipelineService(config)
    if cleaner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return cleaner.clear_collection()

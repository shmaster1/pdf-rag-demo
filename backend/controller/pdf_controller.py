from starlette import status

from backend.config.config import Config
from backend.models.pdf_response import PDFResponse
from fastapi import UploadFile, File, BackgroundTasks, APIRouter, HTTPException
from backend.services.pdf_converter_service import PDFConverterService
from backend.services.rag_pipeline_service import RAGPipelineService

router = APIRouter(prefix="/pdf_converter", tags=["PDF_CONVERTER"])
config = Config()


@router.post("/", response_model=PDFResponse)
def index_uploaded_pdf(background_tasks: BackgroundTasks, file: UploadFile= File(...)) -> PDFResponse:
    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(0)
    if size_bytes > config.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {config.MAX_FILE_SIZE_MB}MB size limit.",
        )
    converter = PDFConverterService(config)
    pdf_res = converter.convert_pdf_to_text(file)

    if pdf_res.chunks:
        rag_service = RAGPipelineService(config)
        background_tasks.add_task(rag_service.index_chunks_in_vector_db, chunks=pdf_res.chunks, file_name=file.filename)
        # Step 3: Return PDFResponse immediately
    return pdf_res

@router.delete("/", status_code=status.HTTP_200_OK)
def clear_pdf_data():
    cleaner = RAGPipelineService(config)
    if cleaner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return cleaner.clear_collection()

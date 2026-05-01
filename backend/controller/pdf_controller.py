from backend.config.config import Config
from backend.models.pdf_response import PDFResponse
from fastapi import UploadFile, File, BackgroundTasks, APIRouter
from backend.services.pdf_converter_service import PDFConverterService
from backend.services.rag_pipeline_service import RAGPipelineService

router = APIRouter(prefix="/pdf_converter", tags=["PDF_CONVERTER"])
config = Config()


@router.post("/", response_model=PDFResponse)
def index_uploaded_pdf(background_tasks: BackgroundTasks, file: UploadFile= File(...)) -> PDFResponse:
    converter = PDFConverterService(config)
    pdf_res = converter.convert_pdf_to_text(file)

    if pdf_res.chunks:
        rag_service = RAGPipelineService(config)
        background_tasks.add_task(rag_service.index_chunks_in_vector_db, chunks=pdf_res.chunks, file_name=file.filename)
        # Step 3: Return PDFResponse immediately
    return pdf_res


# TODO 1: allow the user to update a new file that overrides the old he uploaded before, we need to replace the store at the front into db instead- infra change
# TODO 2 : create a pannel that shows thumbnail of the file that was uploaded at the left hand side
# TODO 3 : ask if the files under unchanged should be commited and make a stash to checkout to a feature branch since we are on main
from typing import List
import fitz
from backend.config.config import Config
from backend.models.pdf_response import PDFResponse


class PDFConverterService:

    def __init__(self, config: Config):
        self.config = config

    def convert_pdf_to_text(self, file_bytes: bytes, file_name: str) -> PDFResponse:
        chunked_words: List[str] = []
        errors: List[str] = []

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")

            if len(doc) >= self.config.MAX_PAGES:
                doc.close()
                raise ValueError("Too many pages")

            texts = [page.get_text() for page in doc]
            doc.close()

            full_text = "\n".join(t for t in texts if t)
            words = full_text.split()
            step = self.config.CHUNK_SIZE - self.config.CHUNK_OVERLAP

            chunked_words = [" ".join(words[i:i + self.config.CHUNK_SIZE]) for i in range(0, len(words), step)]

        except Exception as e:
            errors.append(f"{file_name}: {str(e)}")

        return PDFResponse(chunks=chunked_words, errors=errors)


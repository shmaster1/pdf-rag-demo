from typing import List
from pypdf import PdfReader
from backend.config.config import Config
from backend.models.pdf_response import PDFResponse


class PDFConverterService:

    def __init__(self, config: Config):
        self.config = config


    def convert_pdf_to_text(self, uploaded_file) -> PDFResponse:
        chunked_words: List[str] = []
        errors: List[str] = []

        try:
            pdf_reader = PdfReader(uploaded_file.file)

            if len(pdf_reader.pages) >= self.config.MAX_PAGES:
                raise ValueError("Too many pages")

            texts = []
            for p in pdf_reader.pages:
                page_text = p.extract_text()
                if page_text:
                    texts.append(page_text)
            full_text = "\n".join(texts)

            words = full_text.split()
            step = self.config.CHUNK_SIZE - self.config.CHUNK_OVERLAP

            file_chunks = [" ".join(words[i:i + self.config.CHUNK_SIZE]) for i in range(0, len(words), step)]
            chunked_words.extend(file_chunks)  # flat list

        except Exception as e:
            errors.append(f"{uploaded_file.name}: {str(e)}")

        return PDFResponse(chunks=chunked_words, errors=errors)


from fastapi import FastAPI
from backend.controller.pdf_controller import router as pdf_router
from backend.controller.rag_controller import router as rag_router

# Alternatively, we could skip creating main.py if we choose to convert PDFs
# without exposing our own API ("/pdf_converter"), since Weaviate and Hugging Face
# have their own APIs and entrypoints handled on their servers.

app = FastAPI()
app.include_router(pdf_router)
app.include_router(rag_router)
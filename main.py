import os, sys
print("Python:", sys.version)
print("CWD:", os.getcwd())
print("PYTHONPATH:", os.environ.get("PYTHONPATH"))
print("backend exists:", os.path.exists("backend"))
print("config exists:", os.path.exists("backend/config/config.py"))
print("sys.path:", sys.path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.controller.pdf_controller import router as pdf_router
from backend.controller.rag_controller import router as rag_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router)
app.include_router(rag_router)
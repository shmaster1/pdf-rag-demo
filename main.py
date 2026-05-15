from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.controller.pdf_controller import router as pdf_router
from backend.controller.rag_controller import router as rag_router
from backend.controller.evaluation_controller import router as evaluation_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "https://pdf-rag-demo.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router)
app.include_router(rag_router)
app.include_router(evaluation_router)
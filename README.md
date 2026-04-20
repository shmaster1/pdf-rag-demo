PDF RAG Demo

A minimal RAG (Retrieval-Augmented Generation) demo that allows users to upload a PDF, convert its content, and query it using an LLM. Built with **Streamlit** for the frontend and FastAPI for backend APIs.  

---

## ⚠️ Important Requirement

This demo uses the **Qwen model** hosted on Hugging Face.  

> **You must have a valid Hugging Face API key** to use the Qwen model.  
> The demo **will not work without it**.  


## 🔧 How to Configure

The demo uses a Python config file for all secrets and environment settings.

Copy config_example.py to config.py (this file is gitignored).

Fill in your real values in config.py e.g:

    HUGGING_FACE_KEY: str = "your_real_hugging_face_api_key"
    WEAVIATE_BASE_URL: str = "http://localhost:8081"
    # The following app parameters can be adjusted differently :
    TOP_K_CHUNKS: int = 3 
    MAX_PAGES: int = 5
    CHUNK_SIZE: int = 600 
    CHUNK_OVERLAP: int = 450 
    MAX_TOKENS: int = 500

Save the file. The backend will automatically use the values from config.py when running.

## 🧱 Architecture Overview
The backend consists of:
* RESTful API built with FastAPI
* AI orchestration layer integrating Hugging Face Qwen model
* Streamlit-based frontend client
* The AI layer intelligently routes:
    * PDF queries → Qwen + RAG pipeline
Note: No relational database or Redis is required for this demo. Storage is handled via in-memory vector embeddings.
—

## 💻 Tech Stack
* Python 3.10+
* Streamlit
* FastAPI
* sentence-transformers
* huggingface_hub
* weaviate-client
* pypdf
* httpx
* PDF converter package (e.g., pdfplumber or PyMuPDF)

## ⚙️ Setup Instructions / Quick Start

1️⃣ Clone Repository

git clone https://github.com/shmaster1/pdf-rag-demo.git
cd my_app

2️⃣ Configure Environment Variables
Create a config.py file inside backend/config/ or a .env file:

* backend/config/config.py
HUGGING_FACE_KEY: str ="your_valid_qwen_api_key"

* Optionally add other config variables if needed

Note: The Hugging Face API key is required for Qwen model queries.
3️⃣ Create Virtual Environment

python -m venv .venv
source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt

4️⃣ Run Backend (FastAPI)

for the backend services run -> 
```
uvicorn main:app --reload --port 8001
```

5️⃣ Run Frontend (Streamlit)

make sure the current dir in terminal is the root of the project --> 
```
python -m streamlit run frontend/Main.py 

```
5️⃣ Run Frontend (Next.js)

 cd frontend-next && npm run dev 


## Features
* Upload a single PDF file.
* Convert PDF to text and split into chunks with configurable size and overlap.
* Query chunks using RAG pipeline with the Qwen model.
* Returns answers using only the context from the uploaded PDF.

**How It Works**
1. User uploads a PDF via the Streamlit UI.
2. The PDF service converts it to text and splits it into chunks.
3. Chunks are embedded using sentence-transformers.
4. User asks a question, which is transformed into a vector and matched to the most relevant chunks.
5. The LLM generates an answer based only on retrieved chunks.

**Notes**
* Only one PDF is supported.
* No database or Redis setup is required; all storage is handled in memory via embeddings.
* Config is centralized in backend/config/config.py for easy adjustment.
* Make sure your Hugging Face API key is valid before running the frontend, otherwise queries to Qwen will fail.


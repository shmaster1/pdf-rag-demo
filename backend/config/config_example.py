from pydantic_settings import BaseSettings

class Config(BaseSettings):
    HUGGING_FACE_KEY: str = "your_api_key_here"
    WEAVIATE_BASE_URL: str = "http://your-weaviate-url-here"

    # --- App Recommended parameters ---
    TOP_K_CHUNKS: int = 3
    MAX_PAGES: int = 5
    CHUNK_SIZE: int = 600 # must be > overlap
    CHUNK_OVERLAP: int = 450
    MAX_TOKENS: int = 500
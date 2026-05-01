from pydantic_settings import BaseSettings

class Config(BaseSettings):
    HUGGING_FACE_KEY: str = ""
    WEAVIATE_BASE_URL: str = ""
    TOP_K_CHUNKS: int = 3
    MAX_PAGES: int = 5
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 450
    MAX_TOKENS: int = 500

    class Config:
        env_file = ".env"
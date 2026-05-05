from weaviate.classes.init import Auth
from huggingface_hub import InferenceClient
from backend.config.config import Config
import weaviate
import numpy as np


class RAGPipelineService:

    def __init__(self, config: Config):
        self.config = config
        # local dev fallback: if no API key is set, connect to local Weaviate instance
        if self.config.WEAVIATE_API_KEY:
            self.vector_client = weaviate.connect_to_weaviate_cloud(
                cluster_url=self.config.WEAVIATE_BASE_URL,
                auth_credentials=Auth.api_key(self.config.WEAVIATE_API_KEY),
            )
        else:
            self.vector_client = weaviate.connect_to_local(port=8081)
        self.huggingface_client = InferenceClient(token=self.config.HUGGING_FACE_KEY)

    def _ensure_collection(self):
        if not self.vector_client.collections.exists("DocumentChunk"):
            self.vector_client.collections.create(name="DocumentChunk")

    def clear_collection(self):
        try:
            if self.vector_client.collections.exists("DocumentChunk"):
                self.vector_client.collections.delete("DocumentChunk")
            return {"status": "cleared"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}
        finally:
            self.vector_client.close()

    def index_chunks_in_vector_db(self, chunks: list[str], file_name: str):
        if not chunks:
            return

        try:
            self._ensure_collection()
            collection = self.vector_client.collections.get("DocumentChunk")
            with collection.batch.dynamic() as batch:
                for chunk in chunks:
                    batch.add_object(
                        properties={"content": chunk, "source_file": file_name},
                        vector=self.embed_query(chunk)
                    )
        finally:
            self.vector_client.close()

    # Convert a user question to a vector for similarity search
    def embed_query(self, text: str):
        result = self.huggingface_client.feature_extraction(
            text,
            model="sentence-transformers/all-MiniLM-L6-v2"
        )
        arr = np.array(result).flatten()
        return arr.tolist()

    # Retrieve the top K most similar document chunks from Weaviate
    def retrieve_chunks(self, question: str, k: int = 3):
        query_vector = self.embed_query(question)
        collection = self.vector_client.collections.get("DocumentChunk")
        result = collection.query.near_vector(
            near_vector=query_vector,
            limit=k,
            return_properties=["content"]
        )
        if not result.objects:
            return []
        return [obj.properties["content"] for obj in result.objects]


    def build_context(self, question: str):
        retrieved_chunks = self.retrieve_chunks(question, self.config.TOP_K_CHUNKS)
        if not retrieved_chunks:
            return ""
        return "\n\n".join(retrieved_chunks)


    # Build the LLM prompt by combining the retrieved chunks and user question
    def build_prompt(self, question: str):
        context = self.build_context(question)
        return f"Context: {context}, Question: {question}"


    # Send the prompt to the LLM and return its generated answer
    def generate_answer(self, prompt: str):
        completion = self.huggingface_client.chat.completions.create(
            model="Qwen/Qwen2.5-7B-Instruct", # todo: move to config
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Answer only using the provided context. If the answer is not in the context, say you don't know."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ], max_tokens=self.config.MAX_TOKENS
        )

        return completion.choices[0].message["content"]

    # Orchestrate the full RAG pipeline: embed → retrieve → prompt → generate
    def ask_question(self, question: str):
        prompt = self.build_prompt(question)
        return self.generate_answer(prompt)
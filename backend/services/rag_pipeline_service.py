from huggingface_hub import InferenceClient
from backend.config.config import Config
from sentence_transformers import SentenceTransformer
import weaviate


class RAGPipelineService:

    def __init__(self, config: Config):
        self.config = config
        self.transformer = SentenceTransformer("all-MiniLM-L6-v2")
        self.vector_client= weaviate.Client(url=self.config.WEAVIATE_BASE_URL, startup_period=5, timeout_config=(5, 60))
        self.huggingface_client = InferenceClient(token=self.config.HUGGING_FACE_KEY)


    def index_chunks_in_vector_db(self, chunks: list[str], file_name: str):
        if not chunks:
            return

        with self.vector_client.batch as batch:
            for chunk in chunks:
                batch.add_data_object(
                    data_object={"content": chunk, "source_file": file_name},
                    class_name="DocumentChunk",
                    vector=self.embed_query(chunk)
                )

    # Convert a user question to a vector for similarity search
    def embed_query(self, text: str):
        return self.transformer.encode(text).tolist()

    # Retrieve the top K most similar document chunks from Weaviate
    def retrieve_chunks(self, question: str, k: int = 3):
        query_vector = self.embed_query(question)
        result = (
            self.vector_client.query
            .get("DocumentChunk", ["content"])
            .with_near_vector({"vector": query_vector})
            .with_limit(k)
            .do()
        )
        if "data" not in result or not result["data"]["Get"]["DocumentChunk"]:
            return []
        return [item["content"] for item in result["data"]["Get"]["DocumentChunk"]]


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
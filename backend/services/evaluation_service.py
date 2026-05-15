from typing import List
import ragas
from datasets  import Dataset
from ragas.metrics import answer_relevancy, faithfulness
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_huggingface import HuggingFaceEndpoint, HuggingFaceEmbeddings
from backend.config.config import Config


class EvaluationService:

    def __init__(self):
        self.config = Config()
        self.hf_llm = HuggingFaceEndpoint(model="Qwen/Qwen2.5-7B-Instruct", huggingfacehub_api_token=self.config.HUGGING_FACE_KEY)
        self.langchain_llm_wrapper = LangchainLLMWrapper(self.hf_llm)
        self.hf_embeddings = LangchainEmbeddingsWrapper(
            HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        )

    def evaluate_rag(self, question: str, answer: str, contexts: List[str]):
        shaped_dataset = self._build_dataset(question, answer, contexts)
        return self._run_evaluate(shaped_dataset)

    def _build_dataset(self, question, answer, contexts):
        shaped_dict = {
            "question": [question],
            "answer": [answer],
            "contexts": [contexts],
        }
        return Dataset.from_dict(shaped_dict)

    def _run_evaluate(self, dataset: Dataset):
        metrics = [answer_relevancy, faithfulness]
        for metric in metrics:
            metric.llm = self.langchain_llm_wrapper
            if hasattr(metric, "embeddings"):
                metric.embeddings = self.hf_embeddings
        result = ragas.evaluate(dataset, metrics)
        return result.to_pandas().iloc[0].to_dict()


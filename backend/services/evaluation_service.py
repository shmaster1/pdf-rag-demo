from typing import List
from backend.config.config import Config


class EvaluationService:

    def __init__(self):
        # TODO: ragas + langchain + HuggingFaceEmbeddings exceed Render free tier 512MB RAM limit.
        # Uncomment once upgraded to a paid plan (1GB+). All logic is intact.
        # import ragas  # noqa: F401
        # from ragas.llms import LangchainLLMWrapper
        # from ragas.embeddings import LangchainEmbeddingsWrapper
        # from langchain_huggingface import HuggingFaceEndpoint, HuggingFaceEmbeddings

        # self.config = Config()
        # self.hf_llm = HuggingFaceEndpoint(model="Qwen/Qwen2.5-7B-Instruct", huggingfacehub_api_token=self.config.HUGGING_FACE_KEY)
        # self.langchain_llm_wrapper = LangchainLLMWrapper(self.hf_llm)
        # self.hf_embeddings = LangchainEmbeddingsWrapper(
        #     HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        # )
        pass

    def evaluate_rag(self, question: str, answer: str, contexts: List[str]):
        shaped_dataset = self._build_dataset(question, answer, contexts)
        return self._run_evaluate(shaped_dataset)

    def _build_dataset(self, question, answer, contexts):
        # from datasets import Dataset
        shaped_dict = {
            "question": [question],
            "answer": [answer],
            "contexts": [contexts],
        }
        # TODO: uncomment when ragas is re-enabled (upgrade Render to 1GB+)
        # return Dataset.from_dict(shaped_dict)
        return shaped_dict

    def _run_evaluate(self, dataset):
        # TODO: uncomment when ragas is re-enabled (upgrade Render to 1GB+)
        # import ragas
        # from ragas.metrics import answer_relevancy, faithfulness
        # metrics = [answer_relevancy, faithfulness]
        # for metric in metrics:
        #     metric.llm = self.langchain_llm_wrapper
        #     if hasattr(metric, "embeddings"):
        #         metric.embeddings = self.hf_embeddings
        # result = ragas.evaluate(dataset, metrics)
        # return result.to_pandas().iloc[0].to_dict()
        return {}

import os
import uuid
import chromadb
from typing import List, Dict, Any
from chromadb.utils import embedding_functions
from rank_bm25 import BM25Okapi
from core.config import settings

class HybridRAG:
    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        self.collection = self.chroma_client.get_or_create_collection(
            name="plixor_rag",
            embedding_function=self.embedding_fn
        )

    def index_document(self, doc_id: str, text: str, metadata: Dict[str, Any]):
        self.collection.upsert(
            ids=[doc_id],
            documents=[text],
            metadatas=[metadata],
        )

    def dense_search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
        )

        outputs = []
        if not results or not results["ids"] or not results["ids"][0]:
            return outputs

        for i in range(len(results["ids"][0])):
            outputs.append(
                {
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": float(results["distances"][0][i]),
                }
            )
        return outputs

    def bm25_search(self, query: str, corpus: List[Dict[str, Any]], top_k: int = 10) -> List[Dict[str, Any]]:
        if not corpus:
            return []

        tokenized_corpus = [doc["text"].lower().split() for doc in corpus]
        bm25 = BM25Okapi(tokenized_corpus)
        tokenized_query = query.lower().split()
        scores = bm25.get_scores(tokenized_query)

        scored_docs = []
        for idx, score in enumerate(scores):
            scored_docs.append((score, corpus[idx]))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_docs = scored_docs[:top_k]

        outputs = []
        for score, doc in top_docs:
            doc_copy = doc.copy()
            doc_copy["score"] = float(score)
            outputs.append(doc_copy)
        return outputs

    def reciprocal_rank_fusion(
        self, dense: List[Dict[str, Any]], bm25: List[Dict[str, Any]], k: int = 60
    ) -> List[Dict[str, Any]]:
        rrf_scores = {}
        doc_map = {}

        for rank, doc in enumerate(dense):
            doc_id = doc["id"]
            doc_map[doc_id] = doc
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + (rank + 1))

        for rank, doc in enumerate(bm25):
            doc_id = doc["id"]
            doc_map[doc_id] = doc
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + (rank + 1))

        sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        outputs = []
        for doc_id, score in sorted_docs:
            doc_copy = doc_map[doc_id].copy()
            doc_copy["rrf_score"] = score
            outputs.append(doc_copy)
        return outputs

    def hybrid_search(self, query: str, corpus: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        dense_results = self.dense_search(query, top_k=10)
        bm25_results = self.bm25_search(query, corpus, top_k=10)
        fused = self.reciprocal_rank_fusion(dense_results, bm25_results, k=60)
        return fused[:top_k]

    def index_model_answer(self, question_id: uuid.UUID, model_answer: str, criteria: List[Any]):
        self.index_document(
            doc_id=f"model_{question_id}",
            text=model_answer,
            metadata={"question_id": str(question_id), "type": "model_answer"},
        )
        for crit in criteria:
            self.index_document(
                doc_id=f"crit_{crit.id}",
                text=f"{crit.criterion_name}: {crit.description} Keywords: {crit.keywords}",
                metadata={
                    "question_id": str(question_id),
                    "type": "criterion",
                    "criterion_id": str(crit.id),
                },
            )

    def retrieve_for_evaluation(self, student_answer: str, question_id: uuid.UUID) -> List[Dict[str, Any]]:
        results = self.collection.get(where={"question_id": str(question_id)})
        if not results or not results["ids"]:
            return []

        corpus = []
        for i in range(len(results["ids"])):
            corpus.append(
                {
                    "id": results["ids"][i],
                    "text": results["documents"][i],
                    "metadata": results["metadatas"][i],
                }
            )

        return self.hybrid_search(query=student_answer, corpus=corpus, top_k=5)


hybrid_rag = HybridRAG()

"""
LECSTU Research — Semantic Similarity Calculator

Cosine similarity between texts using a multilingual sentence embedding model (RO-3).

Usage:
    from similarity_calculator import SimilarityCalculator
    calc = SimilarityCalculator()
    score = calc.cosine("hello world", "hello there")
"""

from __future__ import annotations

from typing import Optional


class SimilarityCalculator:
    """Multilingual semantic similarity via sentence-transformers."""

    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"):
        self.model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def cosine(self, reference: str, hypothesis: str) -> float:
        """Cosine similarity in [0, 1] between reference and hypothesis embeddings."""
        ref = (reference or "").strip()
        hyp = (hypothesis or "").strip()
        if not ref or not hyp:
            return 0.0

        model = self._get_model()
        ref_emb, hyp_emb = model.encode([ref, hyp])
        dot = float((ref_emb * hyp_emb).sum())
        ref_norm = float((ref_emb**2).sum() ** 0.5)
        hyp_norm = float((hyp_emb**2).sum() ** 0.5)
        if ref_norm == 0 or hyp_norm == 0:
            return 0.0
        return round(dot / (ref_norm * hyp_norm), 4)


if __name__ == "__main__":
    calc = SimilarityCalculator()
    pairs = [
        ("Your next class is Data Structures", "Your next class is Data Structures"),
        ("Your next class is Data Structures", "Next class: data structures"),
        ("hello world", "completely unrelated text"),
    ]
    for a, b in pairs:
        print(f"  '{a}' vs '{b}' -> {calc.cosine(a, b):.4f}")

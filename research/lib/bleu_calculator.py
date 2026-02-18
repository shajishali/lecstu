"""
LECSTU Research — BLEU Score Calculator

Computes BLEU score for translation evaluation (RO-3).
Implements standard BLEU with n-gram precision and brevity penalty.

Usage:
    from bleu_calculator import BLEUCalculator
    calc = BLEUCalculator()
    score = calc.compute("the cat sat on the mat", "the cat is on the mat")
"""

import math
from collections import Counter
from typing import Optional


class BLEUCalculator:
    """BLEU score computation (1-gram to 4-gram) with brevity penalty."""

    @staticmethod
    def tokenize(text: str) -> list[str]:
        return text.lower().strip().split()

    @staticmethod
    def ngrams(tokens: list[str], n: int) -> list[tuple]:
        return [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]

    def modified_precision(self, reference: list[str], hypothesis: list[str], n: int) -> tuple[int, int]:
        """Compute clipped n-gram precision counts."""
        ref_ngrams = Counter(self.ngrams(reference, n))
        hyp_ngrams = Counter(self.ngrams(hypothesis, n))

        clipped = 0
        total = 0
        for ng, count in hyp_ngrams.items():
            clipped += min(count, ref_ngrams.get(ng, 0))
            total += count

        return clipped, total

    def brevity_penalty(self, ref_len: int, hyp_len: int) -> float:
        if hyp_len == 0:
            return 0.0
        if hyp_len >= ref_len:
            return 1.0
        return math.exp(1 - ref_len / hyp_len)

    def compute(
        self,
        reference: str,
        hypothesis: str,
        max_n: int = 4,
        weights: Optional[list[float]] = None
    ) -> dict:
        """
        Compute BLEU score for a single reference-hypothesis pair.

        Args:
            reference: reference translation text
            hypothesis: candidate translation text
            max_n: maximum n-gram order (default 4 = BLEU-4)
            weights: n-gram weights (default: uniform)

        Returns:
            dict with bleu, precisions, brevity_penalty, ref_len, hyp_len
        """
        if weights is None:
            weights = [1.0 / max_n] * max_n

        ref_tokens = self.tokenize(reference)
        hyp_tokens = self.tokenize(hypothesis)

        if len(hyp_tokens) == 0:
            return {"bleu": 0.0, "precisions": [0.0] * max_n,
                    "brevity_penalty": 0.0, "ref_len": len(ref_tokens), "hyp_len": 0}

        precisions = []
        log_avg = 0.0

        for n in range(1, max_n + 1):
            clipped, total = self.modified_precision(ref_tokens, hyp_tokens, n)
            p = clipped / total if total > 0 else 0.0
            precisions.append(round(p, 4))

            if p > 0:
                log_avg += weights[n - 1] * math.log(p)
            else:
                # If any precision is 0, BLEU = 0
                return {"bleu": 0.0, "precisions": precisions + [0.0] * (max_n - n),
                        "brevity_penalty": self.brevity_penalty(len(ref_tokens), len(hyp_tokens)),
                        "ref_len": len(ref_tokens), "hyp_len": len(hyp_tokens)}

        bp = self.brevity_penalty(len(ref_tokens), len(hyp_tokens))
        bleu = bp * math.exp(log_avg)

        return {
            "bleu": round(bleu, 4),
            "precisions": precisions,
            "brevity_penalty": round(bp, 4),
            "ref_len": len(ref_tokens),
            "hyp_len": len(hyp_tokens),
        }

    def compute_corpus(
        self,
        references: list[str],
        hypotheses: list[str],
        max_n: int = 4
    ) -> dict:
        """Compute corpus-level BLEU and per-sentence results."""
        results = []
        bleu_scores = []

        for ref, hyp in zip(references, hypotheses):
            r = self.compute(ref, hyp, max_n)
            results.append(r)
            bleu_scores.append(r["bleu"])

        def stats(values):
            n = len(values)
            if n == 0:
                return {}
            mean = sum(values) / n
            sorted_v = sorted(values)
            median = sorted_v[n // 2] if n % 2 else (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2
            variance = sum((v - mean) ** 2 for v in values) / n
            return {
                "mean": round(mean, 4),
                "median": round(median, 4),
                "std_dev": round(variance ** 0.5, 4),
                "min": round(min(values), 4),
                "max": round(max(values), 4),
                "count": n,
            }

        return {
            "results": results,
            "bleu_stats": stats(bleu_scores),
        }


if __name__ == "__main__":
    calc = BLEUCalculator()

    print("=== BLEU Calculator Test ===\n")
    test_pairs = [
        ("the cat sat on the mat", "the cat sat on the mat"),
        ("the cat sat on the mat", "the cat is on the mat"),
        ("the lecture will be in hall a", "lecture is in hall a"),
        ("your next class is data structures", "your next class data structures"),
    ]

    for ref, hyp in test_pairs:
        result = calc.compute(ref, hyp)
        print(f"  REF: '{ref}'")
        print(f"  HYP: '{hyp}'")
        print(f"  BLEU: {result['bleu']:.4f}  BP: {result['brevity_penalty']:.4f}")
        print(f"  Precisions: {result['precisions']}")
        print()

    refs = [p[0] for p in test_pairs]
    hyps = [p[1] for p in test_pairs]
    corpus = calc.compute_corpus(refs, hyps)
    print(f"Corpus BLEU stats: {corpus['bleu_stats']}")

"""
LECSTU Research — Word Error Rate (WER) Calculator

Computes WER and CER for ASR benchmark evaluation (RO-1).

WER = (Substitutions + Insertions + Deletions) / Reference Length

Usage:
    from wer_calculator import WERCalculator
    calc = WERCalculator()
    result = calc.compute("this is a test", "this is test")
    # result = { wer: 0.25, cer: 0.071, ... }
"""

import re
from typing import Optional


class WERCalculator:
    """Computes Word Error Rate and Character Error Rate using edit distance."""

    @staticmethod
    def normalize(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r'[^\w\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text

    @staticmethod
    def edit_distance(ref_tokens: list, hyp_tokens: list) -> dict:
        """Levenshtein distance with backtracking for S/I/D counts."""
        n = len(ref_tokens)
        m = len(hyp_tokens)

        dp = [[0] * (m + 1) for _ in range(n + 1)]
        for i in range(n + 1):
            dp[i][0] = i
        for j in range(m + 1):
            dp[0][j] = j

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if ref_tokens[i - 1] == hyp_tokens[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = 1 + min(
                        dp[i - 1][j],       # deletion
                        dp[i][j - 1],       # insertion
                        dp[i - 1][j - 1]    # substitution
                    )

        # Backtrack to count S, I, D
        i, j = n, m
        substitutions = insertions = deletions = 0
        while i > 0 or j > 0:
            if i > 0 and j > 0 and ref_tokens[i - 1] == hyp_tokens[j - 1]:
                i -= 1
                j -= 1
            elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
                substitutions += 1
                i -= 1
                j -= 1
            elif j > 0 and dp[i][j] == dp[i][j - 1] + 1:
                insertions += 1
                j -= 1
            else:
                deletions += 1
                i -= 1

        return {
            "distance": dp[n][m],
            "substitutions": substitutions,
            "insertions": insertions,
            "deletions": deletions,
        }

    def compute(self, reference: str, hypothesis: str, normalize: bool = True) -> dict:
        """
        Compute WER and CER between reference and hypothesis text.

        Returns:
            dict with wer, cer, substitutions, insertions, deletions,
            ref_length, hyp_length
        """
        if normalize:
            reference = self.normalize(reference)
            hypothesis = self.normalize(hypothesis)

        ref_words = reference.split()
        hyp_words = hypothesis.split()

        if len(ref_words) == 0:
            return {"wer": 0.0 if len(hyp_words) == 0 else float('inf'),
                    "cer": 0.0, "ref_length": 0, "hyp_length": len(hyp_words)}

        word_result = self.edit_distance(ref_words, hyp_words)
        wer = word_result["distance"] / len(ref_words)

        ref_chars = list(reference.replace(" ", ""))
        hyp_chars = list(hypothesis.replace(" ", ""))
        char_result = self.edit_distance(ref_chars, hyp_chars)
        cer = char_result["distance"] / max(len(ref_chars), 1)

        return {
            "wer": round(wer, 4),
            "cer": round(cer, 4),
            "substitutions": word_result["substitutions"],
            "insertions": word_result["insertions"],
            "deletions": word_result["deletions"],
            "ref_length": len(ref_words),
            "hyp_length": len(hyp_words),
        }

    def compute_batch(self, pairs: list[tuple[str, str]], normalize: bool = True) -> dict:
        """
        Compute WER/CER for a batch of (reference, hypothesis) pairs.

        Returns:
            dict with per-pair results and aggregate statistics.
        """
        results = []
        wer_values = []
        cer_values = []

        for ref, hyp in pairs:
            r = self.compute(ref, hyp, normalize)
            results.append(r)
            wer_values.append(r["wer"])
            cer_values.append(r["cer"])

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
            "wer_stats": stats(wer_values),
            "cer_stats": stats(cer_values),
        }


if __name__ == "__main__":
    calc = WERCalculator()

    print("=== WER Calculator Test ===\n")
    test_pairs = [
        ("this is a test", "this is a test"),
        ("this is a test", "this is test"),
        ("when is my next lecture", "when is my next lectur"),
        ("is hall b free at two pm", "is hall be free at to pm"),
    ]

    for ref, hyp in test_pairs:
        result = calc.compute(ref, hyp)
        print(f"  REF: '{ref}'")
        print(f"  HYP: '{hyp}'")
        print(f"  WER: {result['wer']:.2%}  CER: {result['cer']:.2%}")
        print()

    batch = calc.compute_batch(test_pairs)
    print(f"Batch WER stats: {batch['wer_stats']}")
    print(f"Batch CER stats: {batch['cer_stats']}")

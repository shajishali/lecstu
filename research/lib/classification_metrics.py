"""
LECSTU Research — Classification Metrics Calculator

Computes Precision, Recall, F1 Score for NLP chatbot evaluation (RO-2).
Generates confusion matrices and per-class reports.

Usage:
    from classification_metrics import ClassificationMetrics
    metrics = ClassificationMetrics()
    report = metrics.compute(y_true, y_pred, labels)
"""

from collections import Counter
from typing import Optional
import json


class ClassificationMetrics:
    """Computes classification metrics without external dependencies."""

    def precision_recall_f1(self, tp: int, fp: int, fn: int) -> dict:
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        }

    def confusion_matrix(self, y_true: list, y_pred: list, labels: list) -> list[list[int]]:
        """Row = true label, Column = predicted label."""
        label_to_idx = {label: i for i, label in enumerate(labels)}
        n = len(labels)
        matrix = [[0] * n for _ in range(n)]

        for true, pred in zip(y_true, y_pred):
            if true in label_to_idx and pred in label_to_idx:
                matrix[label_to_idx[true]][label_to_idx[pred]] += 1

        return matrix

    def compute(self, y_true: list, y_pred: list, labels: Optional[list] = None) -> dict:
        """
        Compute per-class and overall classification metrics.

        Returns:
            dict with per_class metrics, overall weighted/macro averages,
            confusion_matrix, and accuracy.
        """
        if labels is None:
            labels = sorted(set(y_true + y_pred))

        cm = self.confusion_matrix(y_true, y_pred, labels)
        label_to_idx = {label: i for i, label in enumerate(labels)}

        per_class = {}
        total_tp = total_fp = total_fn = 0
        total_support = 0

        for label in labels:
            idx = label_to_idx[label]
            tp = cm[idx][idx]
            fp = sum(cm[row][idx] for row in range(len(labels))) - tp
            fn = sum(cm[idx]) - tp
            support = sum(cm[idx])

            prf = self.precision_recall_f1(tp, fp, fn)
            prf["support"] = support
            per_class[label] = prf

            total_tp += tp
            total_fp += fp
            total_fn += fn
            total_support += support

        # Macro average (unweighted mean of per-class)
        macro_p = sum(c["precision"] for c in per_class.values()) / max(len(labels), 1)
        macro_r = sum(c["recall"] for c in per_class.values()) / max(len(labels), 1)
        macro_f1 = sum(c["f1_score"] for c in per_class.values()) / max(len(labels), 1)

        # Weighted average (weighted by support)
        weighted_p = sum(c["precision"] * c["support"] for c in per_class.values()) / max(total_support, 1)
        weighted_r = sum(c["recall"] * c["support"] for c in per_class.values()) / max(total_support, 1)
        weighted_f1 = sum(c["f1_score"] * c["support"] for c in per_class.values()) / max(total_support, 1)

        accuracy = total_tp / max(total_support, 1)

        return {
            "per_class": per_class,
            "macro_avg": {
                "precision": round(macro_p, 4),
                "recall": round(macro_r, 4),
                "f1_score": round(macro_f1, 4),
            },
            "weighted_avg": {
                "precision": round(weighted_p, 4),
                "recall": round(weighted_r, 4),
                "f1_score": round(weighted_f1, 4),
            },
            "accuracy": round(accuracy, 4),
            "total_samples": total_support,
            "confusion_matrix": cm,
            "labels": labels,
        }

    def format_report(self, result: dict) -> str:
        """Format the result as a readable classification report string."""
        lines = []
        lines.append(f"{'Label':<30} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Support':>10}")
        lines.append("-" * 72)

        for label in result["labels"]:
            c = result["per_class"][label]
            lines.append(
                f"{label:<30} {c['precision']:>10.4f} {c['recall']:>10.4f} "
                f"{c['f1_score']:>10.4f} {c['support']:>10d}"
            )

        lines.append("-" * 72)
        m = result["macro_avg"]
        lines.append(f"{'Macro Avg':<30} {m['precision']:>10.4f} {m['recall']:>10.4f} {m['f1_score']:>10.4f}")
        w = result["weighted_avg"]
        lines.append(f"{'Weighted Avg':<30} {w['precision']:>10.4f} {w['recall']:>10.4f} {w['f1_score']:>10.4f}")
        lines.append(f"\nAccuracy: {result['accuracy']:.4f}  |  Total samples: {result['total_samples']}")

        return "\n".join(lines)


if __name__ == "__main__":
    metrics = ClassificationMetrics()

    y_true = ["ask_timetable", "ask_timetable", "ask_hall", "ask_hall",
              "book_appointment", "greeting", "greeting", "fallback",
              "ask_timetable", "ask_hall"]
    y_pred = ["ask_timetable", "ask_hall", "ask_hall", "ask_hall",
              "book_appointment", "greeting", "fallback", "fallback",
              "ask_timetable", "ask_timetable"]

    result = metrics.compute(y_true, y_pred)

    print("=== Classification Metrics Test ===\n")
    print(metrics.format_report(result))
    print("\nConfusion Matrix:")
    for i, row in enumerate(result["confusion_matrix"]):
        print(f"  {result['labels'][i]:<20} {row}")

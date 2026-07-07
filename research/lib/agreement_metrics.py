"""
LECSTU Research — Inter-Rater Agreement Metrics (Phase 9.4)

Computes inter-rater reliability for human translation evaluation:
  - Krippendorff's alpha (ordinal / interval) — multi-rater, handles missing data
  - Cohen's kappa (pairwise, nominal + linear/quadratic weighted)
  - Fleiss' kappa (multi-rater, nominal, complete data)
  - Percentage agreement (exact + within-1 tolerance)

Pure-Python (no external dependencies) so it can run anywhere the other
research libs run.

Usage:
    from agreement_metrics import (
        krippendorff_alpha, cohens_kappa, fleiss_kappa, percent_agreement,
    )

Data model for Krippendorff's alpha:
    reliability_data = {
        rater_id: {item_id: rating, ...},
        ...
    }
    Missing ratings are simply omitted from a rater's dict.
"""

from __future__ import annotations

from collections import Counter
from itertools import combinations
from typing import Iterable, Optional


# ────────────────────────────────────────────────────────────────
# Krippendorff's alpha (ordinal / interval)
# ────────────────────────────────────────────────────────────────
def _ordinal_metric(labels: list) -> dict:
    """
    Build an ordinal difference function δ² per Krippendorff.
    For ordered categories c1..ck with marginal frequencies n_c, the ordinal
    distance between values a and b is:
        δ²(a,b) = ( Σ_{g=a..b} n_g  −  (n_a + n_b) / 2 )²
    Returns a lookup dict keyed by (a, b).
    """
    return {"__labels__": labels}


def _interval_diff(a: float, b: float) -> float:
    return (float(a) - float(b)) ** 2


def krippendorff_alpha(
    reliability_data: dict,
    level: str = "ordinal",
    value_domain: Optional[list] = None,
) -> Optional[float]:
    """
    Compute Krippendorff's alpha across raters.

    Args:
        reliability_data: {rater_id: {item_id: value}}
        level: "interval" | "ordinal" | "nominal"
        value_domain: ordered list of possible values (required for ordinal;
                      inferred from observed values if omitted)

    Returns:
        alpha in (-inf, 1], or None if it cannot be computed
        (e.g. fewer than 2 ratings, or no variance in a degenerate way).
    """
    # Build per-item list of observed values (units of analysis).
    units: dict = {}
    for rater, ratings in reliability_data.items():
        for item_id, value in ratings.items():
            if value is None:
                continue
            units.setdefault(item_id, []).append(value)

    # Only units with >= 2 ratings contribute to alpha.
    units = {u: vals for u, vals in units.items() if len(vals) >= 2}
    if not units:
        return None

    all_values = [v for vals in units.values() for v in vals]
    if not all_values:
        return None

    if value_domain is None:
        value_domain = sorted(set(all_values))

    labels = list(value_domain)
    marginal = Counter(all_values)

    def delta(a, b) -> float:
        if level == "interval":
            return _interval_diff(a, b)
        if level == "nominal":
            return 0.0 if a == b else 1.0
        # ordinal
        if a == b:
            return 0.0
        ia, ib = labels.index(a), labels.index(b)
        lo, hi = (ia, ib) if ia <= ib else (ib, ia)
        between = sum(marginal[labels[g]] for g in range(lo, hi + 1))
        correction = (marginal[labels[ia]] + marginal[labels[ib]]) / 2.0
        return (between - correction) ** 2

    # Observed disagreement Do
    observed_num = 0.0
    total_pairable = 0
    for vals in units.values():
        m_u = len(vals)
        if m_u < 2:
            continue
        pair_sum = 0.0
        for a, b in combinations(vals, 2):
            pair_sum += delta(a, b)
        # each unordered pair counted once; Krippendorff normalises by (m_u - 1)
        observed_num += pair_sum / (m_u - 1)
        total_pairable += m_u

    if total_pairable == 0:
        return None

    Do = observed_num / (total_pairable / 2.0) if total_pairable else 0.0

    # Expected disagreement De across all values pooled
    expected_sum = 0.0
    value_list = all_values
    n = len(value_list)
    if n < 2:
        return None
    freq = Counter(value_list)
    keys = list(freq.keys())
    for i in range(len(keys)):
        for j in range(len(keys)):
            a, b = keys[i], keys[j]
            if a == b:
                # pairs of identical value: freq[a] * (freq[a]) but exclude self-pair handled below
                expected_sum += freq[a] * (freq[a] - 1) * delta(a, b)
            else:
                expected_sum += freq[a] * freq[b] * delta(a, b)
    De = expected_sum / (n * (n - 1))

    if De == 0:
        # No expected disagreement → perfect agreement iff Do == 0
        return 1.0 if Do == 0 else 0.0

    return 1.0 - (Do / De)


# ────────────────────────────────────────────────────────────────
# Cohen's kappa (pairwise)
# ────────────────────────────────────────────────────────────────
def cohens_kappa(
    rater_a: list,
    rater_b: list,
    labels: Optional[list] = None,
    weights: Optional[str] = None,
) -> Optional[float]:
    """
    Cohen's kappa between two raters over paired ratings.

    Args:
        rater_a, rater_b: equal-length lists of ratings (aligned by item)
        labels: ordered category list (inferred if omitted)
        weights: None (unweighted) | "linear" | "quadratic"

    Returns:
        kappa, or None if undefined.
    """
    paired = [(a, b) for a, b in zip(rater_a, rater_b) if a is not None and b is not None]
    if len(paired) < 1:
        return None

    a_vals = [a for a, _ in paired]
    b_vals = [b for _, b in paired]
    if labels is None:
        labels = sorted(set(a_vals) | set(b_vals))
    k = len(labels)
    if k < 2:
        return 1.0 if a_vals == b_vals else 0.0

    idx = {lab: i for i, lab in enumerate(labels)}
    n = len(paired)

    observed = [[0.0] * k for _ in range(k)]
    for a, b in paired:
        observed[idx[a]][idx[b]] += 1

    row_marg = [sum(observed[i]) for i in range(k)]
    col_marg = [sum(observed[i][j] for i in range(k)) for j in range(k)]

    def w(i: int, j: int) -> float:
        if weights == "linear":
            return abs(i - j) / (k - 1)
        if weights == "quadratic":
            return ((i - j) / (k - 1)) ** 2
        return 0.0 if i == j else 1.0

    po = sum((1 - w(i, j)) * observed[i][j] for i in range(k) for j in range(k)) / n
    pe = sum((1 - w(i, j)) * (row_marg[i] * col_marg[j]) / (n * n) for i in range(k) for j in range(k))

    if pe == 1:
        return 1.0 if po == 1 else 0.0
    return (po - pe) / (1 - pe)


def mean_pairwise_kappa(
    reliability_data: dict,
    labels: Optional[list] = None,
    weights: Optional[str] = "quadratic",
) -> dict:
    """
    Average Cohen's kappa over all rater pairs, using items both rated.

    Returns:
        {"mean_kappa": float|None, "pairs": {"raterA|raterB": kappa}, "n_pairs": int}
    """
    raters = list(reliability_data.keys())
    pair_scores: dict = {}
    for ra, rb in combinations(raters, 2):
        common = set(reliability_data[ra]) & set(reliability_data[rb])
        if not common:
            continue
        ordered = sorted(common)
        a_vals = [reliability_data[ra][i] for i in ordered]
        b_vals = [reliability_data[rb][i] for i in ordered]
        kappa = cohens_kappa(a_vals, b_vals, labels=labels, weights=weights)
        if kappa is not None:
            pair_scores[f"{ra}|{rb}"] = round(kappa, 4)

    if not pair_scores:
        return {"mean_kappa": None, "pairs": {}, "n_pairs": 0}
    mean_k = sum(pair_scores.values()) / len(pair_scores)
    return {"mean_kappa": round(mean_k, 4), "pairs": pair_scores, "n_pairs": len(pair_scores)}


# ────────────────────────────────────────────────────────────────
# Fleiss' kappa (multi-rater, nominal, complete data)
# ────────────────────────────────────────────────────────────────
def fleiss_kappa(item_ratings: list[list], labels: Optional[list] = None) -> Optional[float]:
    """
    Fleiss' kappa for N items each rated by the same number of raters.

    Args:
        item_ratings: list of per-item rating lists, e.g. [[5,4,5],[3,3,2],...]
        labels: category list (inferred if omitted)

    Returns:
        kappa, or None if undefined.
    """
    items = [r for r in item_ratings if r]
    if not items:
        return None
    n_raters = len(items[0])
    if any(len(r) != n_raters for r in items) or n_raters < 2:
        return None

    if labels is None:
        labels = sorted({v for r in items for v in r})
    k = len(labels)
    idx = {lab: i for i, lab in enumerate(labels)}
    N = len(items)

    counts = [[0] * k for _ in range(N)]
    for i, r in enumerate(items):
        for v in r:
            counts[i][idx[v]] += 1

    p_j = [sum(counts[i][j] for i in range(N)) / (N * n_raters) for j in range(k)]
    P_i = [
        (sum(counts[i][j] ** 2 for j in range(k)) - n_raters) / (n_raters * (n_raters - 1))
        for i in range(N)
    ]
    P_bar = sum(P_i) / N
    P_e = sum(p * p for p in p_j)

    if P_e == 1:
        return 1.0 if P_bar == 1 else 0.0
    return (P_bar - P_e) / (1 - P_e)


# ────────────────────────────────────────────────────────────────
# Percentage agreement
# ────────────────────────────────────────────────────────────────
def percent_agreement(reliability_data: dict, tolerance: int = 0) -> dict:
    """
    Average pairwise percentage agreement across raters.

    Args:
        reliability_data: {rater_id: {item_id: value}}
        tolerance: max absolute difference still counted as agreement
                   (0 = exact match, 1 = within one Likert point)

    Returns:
        {"agreement": float|None, "n_comparisons": int}
    """
    raters = list(reliability_data.keys())
    agree = 0
    total = 0
    for ra, rb in combinations(raters, 2):
        common = set(reliability_data[ra]) & set(reliability_data[rb])
        for item in common:
            a = reliability_data[ra][item]
            b = reliability_data[rb][item]
            if a is None or b is None:
                continue
            total += 1
            try:
                if abs(float(a) - float(b)) <= tolerance:
                    agree += 1
            except (TypeError, ValueError):
                if a == b:
                    agree += 1
    if total == 0:
        return {"agreement": None, "n_comparisons": 0}
    return {"agreement": round(agree / total, 4), "n_comparisons": total}


def interpret_kappa(value: Optional[float]) -> str:
    """Landis & Koch (1977) interpretation bands."""
    if value is None:
        return "undefined"
    if value < 0:
        return "poor (worse than chance)"
    if value < 0.20:
        return "slight"
    if value < 0.40:
        return "fair"
    if value < 0.60:
        return "moderate"
    if value < 0.80:
        return "substantial"
    return "almost perfect"


if __name__ == "__main__":
    # Self-test with a small synthetic 3-rater dataset.
    demo = {
        "r1": {"i1": 5, "i2": 4, "i3": 3, "i4": 5, "i5": 2},
        "r2": {"i1": 5, "i2": 4, "i3": 4, "i4": 4, "i5": 2},
        "r3": {"i1": 4, "i2": 4, "i3": 3, "i4": 5, "i5": 1},
    }
    print("=== Agreement Metrics Self-Test ===")
    alpha = krippendorff_alpha(demo, level="ordinal", value_domain=[1, 2, 3, 4, 5])
    print(f"Krippendorff alpha (ordinal): {alpha:.4f}" if alpha is not None else "alpha: None")
    mpk = mean_pairwise_kappa(demo, labels=[1, 2, 3, 4, 5], weights="quadratic")
    print(f"Mean pairwise weighted kappa: {mpk['mean_kappa']} ({interpret_kappa(mpk['mean_kappa'])})")
    print(f"Percent agreement (within-1): {percent_agreement(demo, tolerance=1)}")
    fk = fleiss_kappa([[5, 5, 4], [4, 4, 4], [3, 4, 3], [5, 4, 5], [2, 2, 1]], labels=[1, 2, 3, 4, 5])
    print(f"Fleiss kappa: {fk:.4f}" if fk is not None else "Fleiss: None")

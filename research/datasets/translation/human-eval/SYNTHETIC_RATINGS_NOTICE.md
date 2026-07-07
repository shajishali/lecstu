# Synthetic human evaluation ratings

The files `ratings_archchika.csv`, `ratings_shakiththiyan.csv`, `ratings_kanusan.csv`, `ratings_sanjeevan.csv`, `ratings_faslan.csv`, and `ratings_sanseevan.csv` were **generated automatically** for pipeline testing. Scores are derived from Marian benchmark semantic similarity with per-rater noise — they are **not** from real independent human judges.

**For thesis submission:** either collect real bilingual evaluator ratings and replace these files, or state explicitly in the methodology that human scores are simulated placeholders.

Regenerate: `python research/translation-eval/scripts/generate_sample_ratings.py`

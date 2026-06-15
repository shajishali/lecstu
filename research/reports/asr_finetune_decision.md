# ASR Finetuning Decision (Phase 7.5)

**Research Objective (RO-1)**: Develop and evaluate an ASR pipeline supporting English, Tamil, and Sinhala for academic voice queries.

**Document Type**: Decision Rationale & Scope  
**Phase**: 7.5 — Decision: Finetune Whisper  
**Date**: 2026-02-27

---

## 1. Decision Summary

**Decision**: Proceed with finetuning OpenAI Whisper (base or small) on academic domain data for English, Tamil, and Sinhala.

**Rationale**: Finetuning offers the best balance of effort vs. improvement for domain-specific WER reduction, given constraints on cloud API access and the infeasibility of training from scratch.

---

## 2. Why Finetune

The LECSTU platform requires accurate ASR for academic voice queries across three languages (En/Ta/Si). The Phase 7.2–7.4 benchmark experiments evaluated baseline Whisper and cloud engines. To improve recognition for the **academic domain**—specifically:

- **Timetable** queries (e.g., "When is my next Data Structures lecture?")
- **Hall availability** (e.g., "Is Hall B free at 2pm?")
- **Appointments** (e.g., "I want to meet Dr. Rajapaksha on Monday")
- **Directions** (e.g., "Where is the CS building?")

—we need an ASR model better adapted to this vocabulary and phrasing. Finetuning Whisper on domain-relevant data is the most practical path to achieve this.

---

## 3. Alternatives Considered

| Alternative | Assessment | Outcome |
|-------------|------------|---------|
| **Cloud APIs (Google, Azure)** | Google: Working; Azure: Blocked on Azure for Students subscription. Both offer strong multilingual support. | **Retained** for future use. Not removed from ASR service. Available for comparison and fallback. |
| **Train from scratch** | Requires 100s–1000s of hours of labeled audio per language. Prohibitive for this project. | **Rejected** — not feasible. |
| **Finetune Whisper** | Moderate effort; can leverage public datasets + Phase 7.2 academic utterances. Proven approach for domain adaptation. | **Selected** — best balance of effort vs. improvement. |

---

## 4. Scope

- **Model**: Whisper `base` or `small` (configurable; small preferred if GPU allows)
- **Languages**: English, Tamil, Sinhala
- **Training data**:
  - Public datasets (e.g., LibriSpeech, Mozilla Common Voice for En; IISc-MILE Tamil, Sinhala ASR datasets for Ta/Si)
  - Phase 7.2 academic utterances (150 utterances) merged into training/validation
- **Domain focus**: Academic vocabulary (timetable, halls, appointments, directions) in En/Ta/Si

---

## 5. Success Criteria

| Criterion | Target |
|-----------|--------|
| **WER improvement** | ≥10% relative reduction over base Whisper on Phase 7.2 benchmark |
| **Latency** | Acceptable for real-time voice input (<5s for typical utterance) |

---

## 6. Cloud Engines Retention

**Cloud engines (Google, Azure) remain in the ASR service** — they are not removed. They are retained for:

- Future comparison and benchmarking
- Fallback when finetuned model is unavailable or underperforms
- A/B testing and validation

---

## 7. Artifacts & Next Steps

| Phase | Artifact | Status |
|-------|----------|--------|
| 7.5 | This decision document | ✅ |
| 7.6 | Finetuning dataset acquisition & preparation | Pending |
| 7.7 | Whisper finetuning implementation | Pending |
| 7.8 | Finetuned model evaluation & integration | Pending |

*Generated for LECSTU Phase 7.5 — Decision: Finetune Whisper*

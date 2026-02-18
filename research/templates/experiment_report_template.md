# Experiment Report: [TITLE]

**Experiment ID**: [auto-generated]
**Date**: [YYYY-MM-DD]
**Researcher**: [Name]
**Research Objective**: [RO-1 / RO-2 / RO-3 / RO-4]
**Research Question**: [RQ-X]
**Hypothesis Tested**: [HX]

---

## 1. Objective

[Briefly state what this experiment aims to measure/compare.]

## 2. Methodology

### 2.1 Experimental Setup
- **Models/Systems Compared**: [e.g., Whisper medium vs. Google Speech API]
- **Dataset**: [Name, size, location in /research/datasets/]
- **Languages**: [e.g., English, Tamil, Sinhala]
- **Hardware**: [Auto-populated from experiment logger]
- **Software Versions**: [From research-config.yaml]

### 2.2 Variables
| Type | Variable | Details |
|------|----------|---------|
| Independent | | |
| Dependent | | |
| Controlled | | |

### 2.3 Procedure
1. [Step-by-step procedure]
2. ...
3. ...

### 2.4 Repetitions
- Number of runs: 3 (seeds: 42, 123, 456)
- Randomization: [Yes/No]

## 3. Results

### 3.1 Summary Table

| Metric | Model A | Model B | Difference |
|--------|---------|---------|------------|
| | | | |

### 3.2 Detailed Results

[Insert per-configuration results tables here]

### 3.3 Visualizations

[Reference charts/plots stored in results directory]
- Figure 1: [Description] — `results/[filename].png`
- Figure 2: [Description] — `results/[filename].png`

## 4. Statistical Analysis

### 4.1 Descriptive Statistics
| Metric | Mean | Median | Std Dev | Min | Max | N |
|--------|------|--------|---------|-----|-----|---|
| | | | | | | |

### 4.2 Inferential Statistics
| Comparison | Test Used | Test Statistic | p-value | Effect Size (Cohen's d) | Significant? |
|-----------|-----------|---------------|---------|------------------------|--------------|
| | | | | | |

### 4.3 Confidence Intervals
| Metric | 95% CI Lower | 95% CI Upper |
|--------|-------------|-------------|
| | | |

## 5. Discussion

### 5.1 Key Findings
- [Finding 1]
- [Finding 2]
- [Finding 3]

### 5.2 Comparison with Expected Results
[How do results compare with hypothesis HX?]

### 5.3 Limitations
- [Limitation 1]
- [Limitation 2]

## 6. Conclusion

**Hypothesis [HX]**: [ACCEPTED / REJECTED]

[1-2 sentence conclusion based on evidence.]

## 7. Artifacts

| File | Description | Path |
|------|-------------|------|
| | | |

## 8. Reproducibility

To reproduce this experiment:
```
cd research/[experiment-dir]
python scripts/run_benchmark.py --config ../research-config.yaml --seed 42
```

---
*Generated from LECSTU experiment report template v1.0*

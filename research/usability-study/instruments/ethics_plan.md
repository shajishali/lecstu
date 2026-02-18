# Data Collection Ethics Plan

**Project**: LECSTU — AI-Integrated Academic Platform
**Date**: 2026-02-18

---

## 1. Purpose of Data Collection

This research collects data from human participants to evaluate:
1. ASR system accuracy (voice recordings)
2. Chatbot interaction quality
3. Translation quality (human evaluation scores)
4. Usability of the AI-integrated platform (task times, questionnaires)

## 2. Types of Data Collected

| Data Type | Source | Contains PII? | Storage |
|-----------|--------|---------------|---------|
| Voice audio recordings | ASR dataset creation | Possible (voice is biometric) | /research/datasets/asr/ |
| Chat interaction logs | Chatbot testing | Possible (typed queries) | /research/datasets/nlp/ |
| Translation evaluation scores | Human evaluators | No (only rating scores) | /research/datasets/translation/ |
| Task completion times | Usability study | No (only timestamps) | /research/usability-study/raw-data/ |
| Questionnaire responses | Usability study | Possible (demographic info) | /research/usability-study/raw-data/ |

## 3. Participant Recruitment

- **Target**: University students, lecturers, and admin staff
- **Method**: Voluntary participation, convenience sampling
- **Minimum**: 20 participants for usability study, 3-5 speakers for ASR
- **Compensation**: None (voluntary) or [specify if applicable]
- **Exclusion**: No vulnerable populations targeted

## 4. Informed Consent

All participants MUST:
- [ ] Receive a participant information sheet explaining the study
- [ ] Sign an informed consent form before any data collection
- [ ] Be informed of their right to withdraw at any time without penalty
- [ ] Be informed about what data is collected and how it is used

### Consent Form Must Include:
1. Study title and researcher contact information
2. Purpose of the study
3. What participation involves (tasks, duration)
4. Types of data collected
5. How data will be stored and protected
6. Who will have access to the data
7. Right to withdraw
8. Signature and date

## 5. Data Protection

| Measure | Implementation |
|---------|---------------|
| Anonymization | All participant IDs are codes (P01, P02...), no real names in data files |
| Audio storage | Audio files named by ID, not by speaker name |
| Access control | Data accessible only to research team |
| Storage location | Local encrypted storage, not uploaded to public repos |
| Retention period | Data retained for duration of research + 1 year, then deleted |
| .gitignore | All raw participant data excluded from version control |

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Voice data misuse | Low | Anonymized IDs, secure storage, access control |
| Participant discomfort | Low | Voluntary, can withdraw anytime |
| Data breach | Low | Local storage, not cloud, .gitignore excludes data |

## 7. University Ethics Approval

- [ ] Check if university requires formal ethics board approval
- [ ] Submit ethics application if required
- [ ] Obtain approval reference number: _______________
- [ ] Store approval document in this directory

## 8. Consent Form Template

> (To be placed in /research/usability-study/instruments/consent_form.pdf)

Key text:

"I understand that my participation in this study is voluntary. I can
withdraw at any time without giving a reason and without penalty.
I understand that my data will be anonymized and used only for the
purposes of this research. I consent to participate in this study."

Signature: ________________  Date: ________________

## 9. Contact

For ethics-related concerns:
- Researcher: [Your name and email]
- Supervisor: [Supervisor name and email]
- Ethics Board: [University ethics board contact, if applicable]

---
*LECSTU Ethics Plan v1.0*

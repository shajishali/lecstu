# ASR Dataset Curation Methodology (Phase 7.2)

## Overview

This document describes the methodology for curating the LECSTU ASR benchmark dataset used in RO-1 (Phase 7) experiments. The dataset supports evaluation of Whisper and Google Speech API for English, Tamil, and Sinhala academic voice queries.

---

## 1. Dataset Requirements

| Requirement | Specification |
|-------------|---------------|
| **Utterances per language** | 50 |
| **Total utterances** | 150 (50 × 3 languages) |
| **Languages** | English (en), Tamil (ta), Sinhala (si) |
| **Categories** | Timetable, Halls, Appointments, Directions, General |
| **Utterances per category** | ~10 per language |
| **Format** | 16 kHz WAV mono, PCM_16 |

---

## 2. Utterance Categories

### 2.1 Timetable
Queries about lecture schedules, weekly timetables, and class times.
- *Example (en):* "When is my next Data Structures lecture?"
- *Example (ta):* "என் அடுத்த தரவு கட்டமைப்பு வகுப்பு எப்போது?"
- *Example (si):* "මගේ ඊළඟ දත්ත ව්යුහ පංතිය කවදාද?"

### 2.2 Halls
Queries about hall availability, equipment, and capacity.
- *Example (en):* "Is Hall B available at 2pm?"
- *Example (ta):* "மண்டபம் பி மணி இரண்டுக்கு கிடைக்குமா?"
- *Example (si):* "හෝල් බී පයින් දෙකට ලබා ගත හැකිද?"

### 2.3 Appointments
Queries about booking, cancelling, or rescheduling lecturer meetings.
- *Example (en):* "I want to book an appointment with Dr. Dias"
- *Example (ta):* "டாக்டர் குமாரிடம் சந்திப்பு பதிவு செய்ய விரும்புகிறேன்"
- *Example (si):* "මට ඩොක්ටර් කුමාර් සමඟ හමුවීමක් කළ යුතුයි"

### 2.4 Directions
Queries about locations, buildings, rooms, and navigation.
- *Example (en):* "Where is the Computer Science building?"
- *Example (ta):* "கணினி அறிவியல் கட்டிடம் எங்கே?"
- *Example (si):* "පරිගණක විද්යා ගොඩනැගිල්ල කොහෙද?"

### 2.5 General
Other academic queries and platform features.
- *Example (en):* "What are today's lectures for Group B?"
- *Example (ta):* "இன்று குழு பிக்கான வகுப்புகள் என்ன?"
- *Example (si):* "අද කණ්ඩායම බී සඳහා පන්ති මොනවාද?"

---

## 3. Recording Conditions

### 3.1 Noise Levels
- **Clean (baseline):** Studio or quiet room, minimal background noise
- **Moderate:** Classroom ambient (40–50 dB), cafeteria, hallway

### 3.2 Speakers
- **3–5 speakers per language** (target)
- Diverse accents where applicable (Sri Lankan English, regional Tamil/Sinhala)
- Mix of male and female speakers recommended

### 3.3 Equipment
- Microphone: Condenser or lapel mic preferred
- Recording software: Audacity, OBS, or equivalent
- Sample rate: 16 kHz (downsample if recorded at higher rate)
- Channels: Mono

---

## 4. Transcription Methodology

1. **Primary transcription:** Native speaker transcribes audio verbatim
2. **Double-verification:** Second transcriber reviews and corrects
3. **Normalisation:** Preserve semantic content; punctuation optional for WER
4. **Discrepancy resolution:** Third reviewer for unresolved differences

### Normalisation Rules (for WER)
- Convert to lowercase
- Remove punctuation
- Collapse multiple spaces
- Preserve numbers as spoken (e.g. "2pm" vs "two pm" — pick one convention)

---

## 5. Manifest Schema

Each utterance entry in `dataset_manifest.json`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (e.g. `en_timetable_001`) |
| `speaker_id` | string | Speaker identifier (S01–S05, etc.) |
| `language` | string | `en`, `ta`, or `si` |
| `category` | string | `timetable`, `halls`, `appointments`, `directions`, `general` |
| `text` | string | Ground truth transcription |
| `audio_path` | string | Relative path to WAV file |
| `noise_level` | string | `clean` or `moderate` |
| `duration_sec` | number | Audio duration in seconds |
| `notes` | string | Optional notes (accent, equipment, etc.) |

---

## 6. Directory Structure

```
research/datasets/asr/
├── utterances.yaml       # Prompt list (50 per language)
├── dataset_manifest.json # Full manifest with ground truth
├── METHODOLOGY.md        # This document
├── README.md             # Quick start
├── audio/                # Recorded WAV files
│   ├── en/
│   │   ├── S01/
│   │   ├── S02/
│   │   └── ...
│   ├── ta/
│   └── si/
└── ground_truth/         # Optional: text-only backup of transcriptions
```

---

## 7. Ethics & Consent

- Obtain informed consent from all speakers
- Do not share raw audio outside research team without permission
- Follow university ethics approval guidelines (see `research/usability-study/instruments/ethics_plan.md`)

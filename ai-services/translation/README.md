# LECSTU Translation Service (Phase 9.1)

Unified translation for English ↔ Tamil ↔ Sinhala. Supports cloud (Google/Azure) and local MarianMT.

## Setup

```bash
cd ai-services/translation
pip install -r requirements.txt
```

## Engines

| Engine | Requirements | Pairs |
|--------|--------------|-------|
| **google** | `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path) | All 6 |
| **azure** | `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION` | All 6 |
| **marian** | transformers, torch (no API key) | All 6 (Ta↔Si via pivot) |
| **mbart** | transformers, torch (no API key) | All 6 (Ta↔Si via pivot) |

## CLI

```bash
python run_translate.py --text "Hello" --src en --tgt ta --engine google
# Output: {"translated_text": "...", "latency_ms": 123, "engine": "google"}
```

## API

`POST /api/ai/translation/translate` (authenticated)

```json
{
  "text": "Your next class is Data Structures",
  "src": "en",
  "tgt": "ta",
  "engine": "google"
}
```

## Platform Integration

- **Language switcher**: Navbar (English / Tamil / Sinhala)
- **Chatbot**: Bot responses translated when UI language is ta/si
- **Timetable**: Day labels translated
- **Notifications**: Title and message translated

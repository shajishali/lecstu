# LECSTU NLP Dataset — Phase 8.2

Train/test split for Rasa chatbot NLU evaluation.

## Contents

- `training_data.yml` — 80% of NLU examples (stratified by intent)
- `test_data.yml` — 20% held-out test set

## Source

Generated from `ai-services/chatbot/data/nlu.yml` using:

```bash
cd ai-services/chatbot
rasa data split nlu --nlu data/nlu.yml --training-fraction 0.8 --out research/datasets/nlp
```

Then copied to `research/datasets/nlp/` for Phase 8.3 evaluation.

## Intents

11 intents: ask_timetable, ask_hall_availability, ask_lecturer_availability, book_appointment, cancel_appointment, ask_directions, ask_office_location, greeting, goodbye, fallback, out_of_scope.

## Entities

course_name, lecturer_name, hall_name, day, time, building

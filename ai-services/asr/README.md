# ASR Service (Phase 7.1)

Automatic Speech Recognition service supporting **Whisper**, **Google Cloud Speech**, and **Azure Speech** for English, Tamil, and Sinhala.

## Setup

1. **Create virtual environment** (recommended):
   ```bash
   cd ai-services/asr
   python -m venv venv
   # Windows: venv\Scripts\activate
   # Unix: source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Google Speech** (optional): Use either:
   - **Service account**: Set `GOOGLE_APPLICATION_CREDENTIALS` to your service account JSON path.
   - **Application Default Credentials (ADC)**: Run `gcloud auth application-default login` and `gcloud auth application-default set-quota-project PROJECT_ID`. No env var needed.

4. **Azure Speech** (optional): See [Azure Activation Guide](#azure-speech-activation-guide) below.

## Usage

### Via Node server (default)

The Express server spawns the Python script. No extra process needed. Ensure `python` (or `python3`) is on PATH.

### Via HTTP service (optional)

For faster repeated requests (avoids model reload):

```bash
uvicorn server:app --host 0.0.0.0 --port 8001
```

Then set `ASR_USE_HTTP=true` and `ASR_SERVICE_URL=http://localhost:8001` in server `.env`.

### CLI

```bash
python run_transcribe.py --file audio.wav --language en --engine whisper --model base
python run_transcribe.py --file audio.wav --language en --engine google
python run_transcribe.py --file audio.wav --language en --engine azure
```

Output: JSON `{ "text", "confidence", "latency_ms", "engine" }`.

---

## Azure Speech Activation Guide

To use the **Azure Speech** engine in the Voice Assistant, benchmark, or CLI:

### Step 1: Create an Azure Speech resource

1. Go to [Azure Portal](https://portal.azure.com) and sign in.
2. Click **Create a resource** → search for **Speech**.
3. Select **Speech** (by Microsoft) → **Create**.
4. Fill in:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or use existing

   - **Region**: Choose a region (e.g. `East US`, `West Europe`)
   - **Name**: e.g. `lecstu-asr`
   - **Pricing tier**: Free (F0) or Standard (S0)
5. Click **Review + create** → **Create**.

### Step 2: Get credentials

1. Open your Speech resource.
2. Go to **Keys and Endpoint** (under Resource Management).
3. Copy:
   - **KEY 1** (or KEY 2)
   - **Location/Region** (e.g. `eastus`)

### Step 3: Set environment variables

Add to your **server `.env`** file (or system environment):

```env
AZURE_SPEECH_KEY=your-key-here
AZURE_SPEECH_REGION=eastus
```

Replace `your-key-here` with your key and `eastus` with your region.

### Step 4: Verify

- **Voice Assistant**: Go to `/assistant`, select **Azure Speech** in the Engine dropdown, then record.
- **CLI**: `python run_transcribe.py --file test.wav --engine azure`
- **Benchmark**: `python research/asr-benchmark/scripts/run_benchmark.py --engine azure --limit 2`

### Supported languages

| Code | Language |
|------|----------|
| en   | English  |
| ta   | Tamil    |
| si   | Sinhala  |

---

## Chat Widget Voice (Tamil/Sinhala)

- **English**: Uses browser Web Speech API — instant, no ASR server needed.
- **Tamil/Sinhala**: Uses ASR (Whisper). For best speed:
  1. Run the HTTP service: `uvicorn server:app --port 8001`
  2. Set `ASR_USE_HTTP=true` in server `.env`
  3. Use `tiny` model (default in chat) for faster transcription

**WebM/Opus**: Browser recordings need `pydub` and `ffmpeg`. Install ffmpeg and ensure it's on PATH. On Windows: `winget install Gyan.FFmpeg`.

---

## Voice not working? (Chat widget shows "Voice service unavailable")

1. **English (instant)**: Use **Chrome** or **Edge**. Firefox does not support Web Speech API.
2. **Tamil/Sinhala** (or English when Web Speech unavailable):
   - Ensure Python is on PATH: `python --version`
   - Install deps: `cd ai-services/asr && pip install -r requirements.txt`
   - Test: `python run_transcribe.py --help` (should print usage)
   - If using a venv, set `PYTHON_PATH` in server `.env` to the venv Python (e.g. `PYTHON_PATH=ai-services/asr/venv/Scripts/python.exe`)
3. **Optional (faster)**: Run the HTTP service and set `ASR_USE_HTTP=true`:
   ```bash
   cd ai-services/asr && uvicorn server:app --port 8001
   ```

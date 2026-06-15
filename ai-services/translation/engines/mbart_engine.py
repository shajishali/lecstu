"""
mBART-50 translation engine — Facebook's multilingual BART.
Supports En↔Ta, En↔Si; Ta↔Si uses pivot via English.
Model: facebook/mbart-large-50-many-to-many-mmt
"""
import time
from typing import Optional

MBART_MODEL = "facebook/mbart-large-50-many-to-many-mmt"

# LECSTU codes (en, ta, si) -> mBART-50 codes
LANG_TO_MBART = {"en": "en_XX", "ta": "ta_IN", "si": "si_LK"}


def _get_device() -> str:
    """Auto-detect GPU/CPU."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


_model_cache: Optional[object] = None
_tokenizer_cache: Optional[object] = None


def _load_mbart():
    """Lazy-load mBART model and tokenizer."""
    global _model_cache, _tokenizer_cache
    if _model_cache is not None and _tokenizer_cache is not None:
        return _model_cache, _tokenizer_cache
    from transformers import MBartForConditionalGeneration, MBart50TokenizerFast
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = MBart50TokenizerFast.from_pretrained(MBART_MODEL)
    model = MBartForConditionalGeneration.from_pretrained(MBART_MODEL).to(device)
    _model_cache, _tokenizer_cache = model, tokenizer
    return model, tokenizer


def translate_mbart(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate via mBART-50.
    Returns: { translated_text, latency_ms, engine [, error] }
    """
    src = src_lang.lower()[:2]
    tgt = tgt_lang.lower()[:2]
    pair = (src, tgt)

    supported = {("en", "si"), ("si", "en"), ("en", "ta"), ("ta", "en"), ("ta", "si"), ("si", "ta")}
    if pair not in supported:
        return {"translated_text": "", "latency_ms": 0, "engine": "mbart", "error": f"Unsupported pair: {src}->{tgt}"}

    try:
        import torch
        model, tokenizer = _load_mbart()
        device = next(model.parameters()).device

        total_latency = 0.0

        if pair in (("ta", "si"), ("si", "ta")):
            # Pivot via English
            src_code = LANG_TO_MBART[src]
            tgt_code = LANG_TO_MBART["en"]
            tokenizer.src_lang = src_code
            encoded = tokenizer(text, return_tensors="pt").to(device)
            forced_id = tokenizer.lang_code_to_id[tgt_code]
            start = time.perf_counter()
            generated = model.generate(**encoded, forced_bos_token_id=forced_id, max_length=512)
            total_latency += (time.perf_counter() - start) * 1000
            en_text = tokenizer.decode(generated[0], skip_special_tokens=True)

            src_code = "en_XX"
            tgt_code = LANG_TO_MBART[tgt]
            tokenizer.src_lang = src_code
            encoded = tokenizer(en_text, return_tensors="pt").to(device)
            forced_id = tokenizer.lang_code_to_id[tgt_code]
            start = time.perf_counter()
            generated = model.generate(**encoded, forced_bos_token_id=forced_id, max_length=512)
            total_latency += (time.perf_counter() - start) * 1000
            translated = tokenizer.decode(generated[0], skip_special_tokens=True)
        else:
            src_code = LANG_TO_MBART[src]
            tgt_code = LANG_TO_MBART[tgt]
            tokenizer.src_lang = src_code
            encoded = tokenizer(text, return_tensors="pt").to(device)
            forced_id = tokenizer.lang_code_to_id[tgt_code]
            start = time.perf_counter()
            generated = model.generate(**encoded, forced_bos_token_id=forced_id, max_length=512)
            total_latency = (time.perf_counter() - start) * 1000
            translated = tokenizer.decode(generated[0], skip_special_tokens=True)

        return {"translated_text": translated, "latency_ms": round(total_latency, 2), "engine": "mbart"}
    except Exception as e:
        return {"translated_text": "", "latency_ms": 0, "engine": "mbart", "error": str(e)}

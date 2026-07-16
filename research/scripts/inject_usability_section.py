"""Inject final usability results into thesisWriting.md section 4.7."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THESIS = ROOT / "thesisWriting.md"
PASTE = ROOT / "research" / "reports" / "usability_paste_into_word.md"

text = THESIS.read_text(encoding="utf-8")
paste = PASTE.read_text(encoding="utf-8")

# Use paste content but remap heading levels to match thesis (### 4.7 already exists)
body = paste.split("## 4.7 Usability Results", 1)[1].strip()
# Match thesis heading depth (#### for 4.7.x subsections)
import re
body = re.sub(r"^### (4\.7\.\d+)", r"#### \1", body, flags=re.MULTILINE)

new_section = "### 4.7 Usability Results\n\n" + body + "\n\n"

start = text.index("### 4.7 Usability Results")
end = text.index("### 4.8 Chapter Summary")
THESIS.write_text(text[:start] + new_section + text[end:], encoding="utf-8")
print(f"Updated {THESIS} — section 4.7 now {len(new_section)} chars")

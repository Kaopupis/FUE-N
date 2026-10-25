"""Parse script.txt into a structured list of sections/beats/lines."""
import re

def parse(path="script.txt"):
    sections = []
    cur = None
    beat = None
    for raw in open(path, encoding="utf8"):
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if line.startswith("# "):
            label, title, emoji = [x.strip() for x in line[2:].split("|")]
            cur = {"kind": "section", "label": label, "title": title, "emoji": emoji, "beats": []}
            sections.append(cur)
            beat = None
        elif line.startswith("## "):
            head, emoji = [x.strip() for x in line[3:].split("|")]
            beat = {"head": head, "emoji": emoji, "lines": []}
            cur["beats"].append(beat)
        elif line.startswith("@ "):
            num, title = [x.strip() for x in line[2:].split("|")]
            cur = {"kind": "insert", "num": int(num), "title": title, "lines": []}
            sections.append(cur)
            beat = None
        elif line.startswith("- "):
            text = line[2:].strip()
            if cur["kind"] == "insert":
                cur["lines"].append(text)
            else:
                beat["lines"].append(text)
    return sections

# English / symbols -> Thai pronunciation for TTS only (subtitles keep original)
SPEAK = [
    ("AI Agent", "เอไอเอเจนต์"), ("ChatGPT", "แชทจีพีที"), ("Claude", "คลอด"), ("Gemini", "เจมิไน"),
    ("n8n", "เอ็นเอทเอ็น"), ("Make", "เมค"), ("Zapier", "แซปเปียร์"), ("LLM", "แอลแอลเอ็ม"),
    ("API", "เอพีไอ"), ("MCP", "เอ็มซีพี"), ("CRM", "ซีอาร์เอ็ม"), ("PDPA", "พีดีพีเอ"),
    ("Agent", "เอเจนต์"), ("AI", "เอไอ"),
]

def to_speech(text):
    from pythainlp.tokenize import word_tokenize
    from pythainlp.util import num_to_thaiword
    import unicodedata
    for a, b in SPEAK:
        text = text.replace(a, b)
    text = re.sub(r"\d+", lambda m: num_to_thaiword(int(m.group())), text)
    # expand repetition mark ๆ by repeating the previous word
    if "ๆ" in text:
        toks = word_tokenize(text.replace("ๆ", " ๆ "), keep_whitespace=True)
        out = []
        last = ""
        for t in toks:
            if t == "ๆ":
                out.append(last)
            else:
                out.append(t)
                if t.strip():
                    last = t
        text = "".join(out)
    if re.search(r"[A-Za-z]", text):
        raise ValueError("untransliterated latin: " + text)
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

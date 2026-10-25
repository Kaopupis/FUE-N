"""Build the master timeline (segments, subtitle lines, sfx events) targeting a fixed length."""
import json
from parse import parse

TARGET = 30 * 60.0
HOOK = 4.0          # opening title card
SEC_CARD = 4.2      # chapter title card
BEAT_LEAD = 0.7     # beat card animates in before narration starts
INS_STING = 2.4     # insert intro stinger
INS_TAIL = 1.0
END_CARD = 9.0
TAIL = 0.15         # subtitle stays a bit after the voice


def build():
    secs = parse()
    meta = json.load(open("vo/meta.json", encoding="utf8"))["lines"]
    n = len(meta)
    nbeats = sum(len(s["beats"]) for s in secs if s["kind"] == "section")
    nsec = sum(1 for s in secs if s["kind"] == "section")
    nins = sum(1 for s in secs if s["kind"] == "insert")
    speech = sum(m["dur"] for m in meta)
    fixed = HOOK + (nsec - 1) * SEC_CARD + nbeats * BEAT_LEAD + nins * (INS_STING + INS_TAIL) + END_CARD
    gap = (TARGET - fixed - speech) / n
    assert 0.2 < gap < 1.2, gap

    t = 0.0
    segs, lines, sfx = [], [], []
    li = 0
    sfx.append({"t": 0.0, "kind": "riser"})
    sfx.append({"t": HOOK - 0.9, "kind": "impact"})
    segs.append({"type": "hook", "start": 0.0, "end": HOOK})
    t = HOOK
    chap = 0
    for si, s in enumerate(secs):
        if s["kind"] == "section":
            seg = {"type": "section", "label": s["label"], "title": s["title"], "emoji": s["emoji"],
                   "accent": chap, "start": t, "beats": [], "card": 0.0 if si == 0 else SEC_CARD}
            chap += 1
            if si != 0:
                sfx.append({"t": t, "kind": "whoosh"})
                sfx.append({"t": t + 0.35, "kind": "impact_soft"})
                t += SEC_CARD
            for b in s["beats"]:
                beat = {"head": b["head"], "emoji": b["emoji"], "start": t, "lines": []}
                sfx.append({"t": t + 0.05, "kind": "pop"})
                t += BEAT_LEAD
                for txt in b["lines"]:
                    m = meta[li]
                    lines.append({"i": li, "text": txt, "start": t, "dur": m["dur"],
                                  "color": "yellow" if li % 2 == 0 else "white"})
                    beat["lines"].append(li)
                    t += m["dur"] + gap
                    li += 1
                beat["end"] = t
                seg["beats"].append(beat)
            seg["end"] = t
            segs.append(seg)
        else:
            seg = {"type": "insert", "num": s["num"], "title": s["title"], "start": t, "lines": []}
            sfx.append({"t": t, "kind": "glitch"})
            sfx.append({"t": t + 0.6, "kind": "whoosh"})
            t += INS_STING
            for txt in s["lines"]:
                m = meta[li]
                lines.append({"i": li, "text": txt, "start": t, "dur": m["dur"],
                              "color": "yellow" if li % 2 == 0 else "white"})
                seg["lines"].append(li)
                t += m["dur"] + gap
                li += 1
            t += INS_TAIL
            seg["end"] = t
            segs.append(seg)
            sfx.append({"t": t - 0.4, "kind": "whoosh_rev"})
    segs.append({"type": "end", "start": t, "end": t + END_CARD})
    sfx.append({"t": t + 0.2, "kind": "chime"})
    t += END_CARD
    tl = {"total": t, "gap": gap, "segments": segs, "lines": lines, "sfx": sfx}
    json.dump(tl, open("timeline.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
    return tl


if __name__ == "__main__":
    tl = build()
    print("total", tl["total"], "gap", tl["gap"], "segments", len(tl["segments"]))

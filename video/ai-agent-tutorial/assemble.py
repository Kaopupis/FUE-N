"""Concat rendered segments, mux the soundtrack, export SRT and the 8 standalone insert clips."""
import json, os, subprocess

TL = json.load(open("timeline.json", encoding="utf8"))
OUT = "out"
os.makedirs(OUT, exist_ok=True)


def ts(t):
    ms = int(round(t * 1000))
    return "%02d:%02d:%02d,%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)


def srt(lines, offset=0.0, path=None):
    out = []
    for n, L in enumerate(lines, 1):
        a, b = L["start"] - offset, L["start"] + L["dur"] + 0.15 - offset
        col = "#FFE600" if L["color"] == "yellow" else "#FFFFFF"
        out.append("%d\n%s --> %s\n<font color=\"%s\">%s</font>\n" % (n, ts(a), ts(b), col, L["text"]))
    open(path, "w", encoding="utf8").write("\n".join(out))


def run(cmd):
    subprocess.run(cmd, check=True)


segs = TL["segments"]
with open("segs/list.txt", "w") as f:
    for i in range(len(segs)):
        f.write("file 'seg_%02d.mp4'\n" % i)
run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "segs/list.txt", "-c", "copy",
     "segs/video.mp4"])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "segs/video.mp4", "-i", "audio/mix.wav", "-map", "0:v", "-map", "1:a",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
     f"{OUT}/AI_Agent_Tutorial_30min_vertical.mp4"])
srt(TL["lines"], 0, f"{OUT}/AI_Agent_Tutorial_30min_TH.srt")

for i, s in enumerate(segs):
    if s["type"] != "insert":
        continue
    name = f"{OUT}/Insert_{s['num']:02d}.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", "segs/seg_%02d.mp4" % i, "-ss", "%.3f" % s["start"],
         "-t", "%.3f" % (s["end"] - s["start"]), "-i", "audio/mix.wav", "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", name])
print("assembled")

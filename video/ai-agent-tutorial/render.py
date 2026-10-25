"""Render the video segment by segment (one ffmpeg per segment, run in parallel)."""
import json, math, os, subprocess, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from gfx import *
import inserts

TL = json.load(open("timeline.json", encoding="utf8"))
LINES = TL["lines"]
TOTAL = TL["total"]
ENV = np.load("audio/env.npy") if os.path.exists("audio/env.npy") else None
SUB_Y = 1530
TAIL = 0.15

BG = [((10, 16, 40), (34, 14, 64)), ((8, 22, 44), (14, 40, 70)), ((26, 10, 40), (52, 16, 58)),
      ((12, 18, 36), (46, 30, 14)), ((6, 26, 30), (12, 48, 44)), ((10, 14, 44), (24, 30, 86)),
      ((30, 14, 20), (60, 26, 18))]


# ---------------------------------------------------------------- shared layers
class Ctx:
    def __init__(self):
        self.sub_cache = {}

    def sub_img(self, li):
        if li not in self.sub_cache:
            L = LINES[li]
            f = font("Bold", 66)
            rows = wrap_thai(L["text"], f, 960, 8)
            col = YELLOW if L["color"] == "yellow" else WHITE
            self.sub_cache[li] = multiline_img(rows, f, col, stroke=8, shadow=6, spacing=-6)
        return self.sub_cache[li]


def active_line(t):
    lo, hi = 0, len(LINES) - 1
    best = None
    while lo <= hi:
        m = (lo + hi) // 2
        if LINES[m]["start"] <= t:
            best = m
            lo = m + 1
        else:
            hi = m - 1
    if best is None:
        return None
    L = LINES[best]
    if t <= L["start"] + L["dur"] + TAIL:
        return best
    return None


def draw_subtitle(img, ctx, t):
    li = active_line(t)
    if li is None:
        return
    L = LINES[li]
    s = ctx.sub_img(li)
    a = t - L["start"]
    sc = 0.86 + 0.14 * ease_out_back(a / 0.18)
    al = clamp01(a / 0.08) * clamp01((L["start"] + L["dur"] + TAIL - t) / 0.08)
    paste_center(img, s, W // 2, SUB_Y, alpha=al, scale=sc if a < 0.2 else 1.0)


def draw_voicebars(img, t, color, y=1730):
    if ENV is None:
        return
    fi = min(int(t * FPS), len(ENV) - 1)
    e = float(ENV[fi])
    lay = Image.new("RGBA", (W, 200), (0, 0, 0, 0))
    ov = ImageDraw.Draw(lay)
    y0 = y
    y = 100
    n = 23
    for k in range(n):
        ph = math.sin(t * 9 + k * 0.9) * 0.5 + 0.5
        dist = 1 - abs(k - n // 2) / (n / 2)
        h = 6 + e * 70 * (0.35 + 0.65 * ph) * (0.4 + 0.6 * dist)
        x = W // 2 + (k - n // 2) * 22
        ov.rounded_rectangle([x - 6, y - h / 2, x + 6, y + h / 2], 6, fill=color + (230,))
    img.alpha_composite(lay, (0, y0 - 100))


def draw_progress(img, t, color):
    lay = Image.new("RGBA", (W, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([60, 5, W - 60, 15], 5, fill=(255, 255, 255, 50))
    x = 60 + (W - 120) * clamp01(t / TOTAL)
    d.rounded_rectangle([60, 5, max(70, x), 15], 5, fill=color + (255,))
    img.alpha_composite(lay, (0, 41))


def moving_bg(t, acc_i, seed=0):
    c1, c2 = BG[acc_i % len(BG)]
    img = gradient_bg(c1, c2).copy()
    acc = ACCENTS[acc_i % len(ACCENTS)]
    for k in range(3):
        r = 360 + 60 * k
        spr = glow_sprite(r, acc if k != 1 else ACCENTS[(acc_i + 2) % len(ACCENTS)], 70)
        cx = W / 2 + math.sin(t * 0.21 + k * 2.1 + seed) * 380
        cy = 700 + k * 380 + math.cos(t * 0.17 + k * 1.7 + seed) * 260
        paste_at(img, spr, int(cx - r), int(cy - r))
    # particles
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    rnd = random.Random(42 + seed)
    for k in range(38):
        px = rnd.random() * W
        sp = 18 + rnd.random() * 40
        py = (rnd.random() * H - t * sp) % H
        rr = 2 + rnd.random() * 3
        al = int(60 + 120 * (0.5 + 0.5 * math.sin(t * 2 + k)))
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(255, 255, 255, al))
    img.alpha_composite(ov)
    return img


# ---------------------------------------------------------------- hook / end
def render_hook(seg, t, ctx):
    lt = t - seg["start"]
    img = moving_bg(t, 0)
    acc = ACCENTS[0]
    # zoom-in rings
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for k in range(6):
        r = ((lt * 260 + k * 160) % 960)
        al = int(120 * (1 - r / 960))
        d.ellipse([W / 2 - r, 820 - r, W / 2 + r, 820 + r], outline=acc + (al,), width=4)
    img.alpha_composite(ov)
    e = emoji_img("🤖", 320)
    paste_center(img, e, W / 2, 640 + math.sin(lt * 3) * 12, alpha=clamp01(lt / 0.4),
                 scale=0.4 + 0.6 * ease_out_back(lt / 0.7))
    t1 = ctx.cache("hook1", lambda: text_img("วิธีใช้", font("Bold", 110), WHITE, 0, shadow=8))
    t2 = ctx.cache("hook2", lambda: text_img("AI AGENT", font("ExtraBold", 190), YELLOW, 10, shadow=10))
    t3 = ctx.cache("hook3", lambda: text_img("ฉบับเข้าใจง่าย ทำได้จริง", font("Medium", 64), WHITE, 0, shadow=6))
    p = ease_out_cubic((lt - 0.5) / 0.6)
    paste_center(img, t1, W / 2 - 400 * (1 - p), 960, alpha=p)
    p2 = ease_out_back((lt - 0.9) / 0.6)
    paste_center(img, t2, W / 2, 1130, alpha=clamp01((lt - 0.9) / 0.2), scale=max(0.05, 0.6 + 0.4 * p2))
    p3 = ease_out_cubic((lt - 1.6) / 0.6)
    paste_center(img, t3, W / 2, 1300 + 60 * (1 - p3), alpha=p3)
    # flash on impact
    fl = 1 - clamp01((lt - 3.1) / 0.5) if lt > 3.1 else 0
    if fl > 0:
        img.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(200 * fl))))
    draw_progress(img, t, acc)
    return img


def render_end(seg, t, ctx):
    lt = t - seg["start"]
    img = moving_bg(t, 5, seed=3)
    acc = ACCENTS[3]
    t1 = ctx.cache("end1", lambda: text_img("ขอบคุณที่รับชม", font("ExtraBold", 110), YELLOW, 8, shadow=8))
    t2 = ctx.cache("end2", lambda: text_img("เริ่มใช้ AI Agent ได้ตั้งแต่วันนี้", font("Medium", 58), WHITE, 0, shadow=6))
    paste_center(img, t1, W / 2, 520, alpha=clamp01(lt / 0.3), scale=0.7 + 0.3 * ease_out_back(lt / 0.6))
    paste_center(img, t2, W / 2, 660, alpha=clamp01((lt - 0.4) / 0.4))
    items = [("👍", "กดไลก์"), ("🔁", "แชร์"), ("🔔", "ติดตาม"), ("💬", "คอมเมนต์")]
    for k, (e, lab) in enumerate(items):
        st = 0.9 + k * 0.35
        p = ease_out_back((lt - st) / 0.5)
        if lt < st:
            continue
        cx = 180 + k * 240
        cy = 960
        card = ctx.cache("endc", lambda: rounded((200, 250), 40, (255, 255, 255, 30), acc + (200,), 4))
        paste_center(img, card, cx, cy, scale=max(0.05, p))
        paste_center(img, emoji_img(e, 110), cx, cy - 30 + math.sin(lt * 4 + k) * 6, scale=max(0.05, p))
        lb = ctx.cache("endl" + lab, lambda: text_img(lab, font("Bold", 40), WHITE))
        paste_center(img, lb, cx, cy + 80, alpha=clamp01((lt - st) / 0.3))
    t3 = ctx.cache("end3", lambda: text_img("แล้วพบกันใหม่คลิปหน้า", font("Bold", 72), WHITE, 6, shadow=6))
    paste_center(img, t3, W / 2, 1250, alpha=clamp01((lt - 2.6) / 0.5))
    fade = clamp01((seg["end"] - t) / 1.5)
    if fade < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - fade)))))
    draw_progress(img, t, acc)
    return img


# ---------------------------------------------------------------- chapter sections
def section_assets(seg, ctx):
    key = "sec%.2f" % seg["start"]
    if key in ctx.sub_cache:
        return ctx.sub_cache[key]
    acc = ACCENTS[seg["accent"] % len(ACCENTS)]
    A = {}
    pill_t = text_img(seg["label"], font("Bold", 40), (15, 15, 30))
    pill = rounded((pill_t.width + 30, 70), 35, acc + (255,))
    pill.alpha_composite(pill_t, (15, (70 - pill_t.height) // 2))
    A["pill"] = pill
    rows = wrap_thai(seg["title"], font("Bold", 58), 900)
    A["title"] = multiline_img(rows, font("Bold", 58), WHITE, 0, shadow=5, spacing=-8)
    # chapter card
    A["big_label"] = text_img(seg["label"], font("ExtraBold", 150), acc, 0, shadow=10)
    rows = wrap_thai(seg["title"], font("Bold", 92), 940, 6)
    A["big_title"] = multiline_img(rows, font("Bold", 92), WHITE, 6, shadow=8, spacing=-14)
    A["card"] = rounded((940, 560), 56, (255, 255, 255, 26), acc + (140,), 4)
    A["beats"] = []
    for b in seg["beats"]:
        rows = wrap_thai(b["head"], font("Bold", 64), 840)
        A["beats"].append({
            "head": multiline_img(rows, font("Bold", 64), WHITE, 0, shadow=6, spacing=-10),
            "emoji": emoji_img(b["emoji"], 220),
            "row": text_img(b["head"] if len(b["head"]) < 34 else b["head"][:32] + "…", font("Medium", 36), WHITE),
        })
    ctx.sub_cache[key] = A
    return A


def render_section(seg, t, ctx):
    lt = t - seg["start"]
    ai = seg["accent"]
    acc = ACCENTS[ai % len(ACCENTS)]
    img = moving_bg(t, ai, seed=ai)
    A = section_assets(seg, ctx)
    card_t = seg["card"]
    if lt < card_t:
        # chapter title card
        p = ease_out_cubic(lt / 0.6)
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        bw = W * ease_out_cubic(lt / 0.45)
        d.rectangle([0, 600, bw, 618], fill=acc + (255,))
        d.rectangle([W - bw, 1240, W, 1258], fill=acc + (255,))
        img.alpha_composite(ov)
        paste_center(img, emoji_img(seg["emoji"], 260), W / 2, 440 + math.sin(lt * 3) * 10,
                     scale=max(0.05, ease_out_back((lt - 0.2) / 0.6)), alpha=clamp01((lt - 0.2) / 0.2))
        paste_center(img, A["big_label"], W / 2 - 300 * (1 - p), 760, alpha=p)
        p2 = ease_out_back((lt - 0.45) / 0.6)
        paste_center(img, A["big_title"], W / 2, 1050, alpha=clamp01((lt - 0.45) / 0.25),
                     scale=max(0.05, 0.8 + 0.2 * p2))
        out = clamp01((card_t - lt) / 0.35)
        if out < 1:
            img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(140 * (1 - out)))))
        draw_progress(img, t, acc)
        return img

    # header
    hp = ease_out_cubic((lt - card_t) / 0.5)
    paste_at(img, A["pill"], 70 - int(200 * (1 - hp)), 100, alpha=hp)
    paste_at(img, A["title"], 60, 185, alpha=hp)
    # current beat
    beats = seg["beats"]
    bi = 0
    for k, b in enumerate(beats):
        if t >= b["start"]:
            bi = k
    b = beats[bi]
    bt = t - b["start"]
    BA = A["beats"][bi]
    cy = 650 + A["title"].height // 3
    p = ease_out_back(bt / 0.55)
    al = clamp01(bt / 0.25)
    paste_center(img, A["card"], W / 2, cy + 80 * (1 - ease_out_cubic(bt / 0.5)), alpha=al,
                 scale=max(0.05, 0.9 + 0.1 * p) if bt < 0.6 else 1.0)
    # glow behind emoji
    g = glow_sprite(170, acc, 110)
    paste_center(img, g, W / 2, cy - 110)
    bob = math.sin(t * 2.4) * 10
    paste_center(img, BA["emoji"], W / 2, cy - 110 + bob, alpha=al,
                 scale=max(0.05, ease_out_back((bt - 0.1) / 0.5)) if bt < 0.65 else 1.0)
    hp2 = ease_out_cubic((bt - 0.2) / 0.4)
    paste_center(img, BA["head"], W / 2, cy + 150 + 30 * (1 - hp2), alpha=hp2)
    # checklist of beats
    n = len(beats)
    row_h = 54
    y0 = 1000 + A["title"].height // 3
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    pend = []
    for k in range(n):
        y = y0 + k * row_h
        if y > 1390:
            break
        x = 120
        if k < bi:
            d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=(52, 211, 153, 255))
            d.line([(x - 8, y), (x - 2, y + 7), (x + 9, y - 7)], fill=(10, 30, 20, 255), width=5)
            pend.append((A["beats"][k]["row"], x + 34, y, 0.75))
        elif k == bi:
            pulse = 0.5 + 0.5 * math.sin(t * 5)
            d.rounded_rectangle([x - 34, y - 26, W - 90, y + 26], 26, fill=acc + (int(40 + 30 * pulse),))
            d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=acc + (255,))
            pend.append((A["beats"][k]["row"], x + 34, y, 1.0))
        else:
            d.ellipse([x - 16, y - 16, x + 16, y + 16], outline=(255, 255, 255, 110), width=3)
            pend.append((A["beats"][k]["row"], x + 34, y, 0.4))
    img.alpha_composite(ov)
    for im, x, y, a in pend:
        paste_at(img, im, x, int(y - im.height / 2), alpha=a)
    draw_voicebars(img, t, acc)
    draw_subtitle(img, ctx, t)
    draw_progress(img, t, acc)
    # quick fade from the chapter card
    if card_t and lt - card_t < 0.3:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(140 * (1 - (lt - card_t) / 0.3)))))
    return img


def ctx_cache(self, key, fn):
    if key not in self.sub_cache:
        self.sub_cache[key] = fn()
    return self.sub_cache[key]


Ctx.cache = ctx_cache


def render_insert(seg, t, ctx):
    img = inserts.render(seg, t, ctx, LINES)
    draw_subtitle(img, ctx, t)
    draw_progress(img, t, ACCENTS[(seg["num"] + 1) % len(ACCENTS)])
    return img


RENDER = {"hook": render_hook, "end": render_end, "section": render_section, "insert": render_insert}


def frame_range(seg):
    return int(round(seg["start"] * FPS)), int(round(seg["end"] * FPS))


def render_segment(i, out_dir="segs", preview=False):
    seg = TL["segments"][i]
    f0, f1 = frame_range(seg)
    out = f"{out_dir}/seg_{i:02d}.mp4"
    if os.path.exists(out) and not preview:
        return out
    ctx = Ctx()
    tmp = out + ".part.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
           "-pix_fmt", "yuv420p", "-threads", "2", "-g", "60", tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    fn = RENDER[seg["type"]]
    for fi in range(f0, f1):
        im = fn(seg, fi / FPS, ctx)
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()
    os.rename(tmp, out)
    return out


def still(t, path):
    for seg in TL["segments"]:
        if seg["start"] <= t < seg["end"]:
            RENDER[seg["type"]](seg, t, Ctx()).convert("RGB").save(path)
            return


if __name__ == "__main__":
    if sys.argv[1] == "still":
        still(float(sys.argv[2]), sys.argv[3])
    elif sys.argv[1] == "all":
        from multiprocessing import Pool
        os.makedirs("segs", exist_ok=True)
        n = len(TL["segments"])
        # longest first for better packing
        order = sorted(range(n), key=lambda i: -(TL["segments"][i]["end"] - TL["segments"][i]["start"]))
        with Pool(int(sys.argv[2]) if len(sys.argv) > 2 else 4) as pool:
            for r in pool.imap_unordered(render_segment, order):
                print("done", r, flush=True)
    else:
        os.makedirs("segs", exist_ok=True)
        print(render_segment(int(sys.argv[1])))

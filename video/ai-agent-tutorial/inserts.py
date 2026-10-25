"""The 8 insert clips: procedural motion-graphics B-roll scenes."""
import math, random
import numpy as np
from PIL import Image, ImageDraw
from gfx import *

STING = 2.4
CY0 = 330          # content area top
DARK = (9, 12, 24)


def bg(t, acc):
    img = gradient_bg((6, 9, 20), (16, 18, 40)).copy()
    for k in range(2):
        r = 420
        spr = glow_sprite(r, acc if k == 0 else (120, 90, 255), 55)
        cx = W / 2 + math.sin(t * 0.3 + k * 3) * 360
        cy = 800 + k * 500 + math.cos(t * 0.25 + k) * 200
        paste_at(img, spr, int(cx - r), int(cy - r))
    return img


class Clock:
    """Relative times of the insert's narration lines."""

    def __init__(self, seg, t, LINES):
        self.n0 = seg["start"] + STING
        self.lt = t - self.n0
        self.starts = [LINES[i]["start"] - self.n0 for i in seg["lines"]]
        self.durs = [LINES[i]["dur"] for i in seg["lines"]]

    def since(self, k):
        k = min(k, len(self.starts) - 1)
        return self.lt - self.starts[k]

    def prog(self, k, dur=None):
        k = min(k, len(self.starts) - 1)
        return clamp01(self.since(k) / (dur or self.durs[k]))

    @property
    def line(self):
        k = 0
        for i, s in enumerate(self.starts):
            if self.lt >= s:
                k = i
        return k


def typed(txt, p):
    n = int(len(txt) * clamp01(p))
    return txt[:n]


def header(img, ctx, seg, acc):
    key = "ih%d" % seg["num"]
    if key not in ctx.sub_cache:
        badge_t = text_img("INSERT %02d" % seg["num"], font("Bold", 34), DARK)
        badge = rounded((badge_t.width + 28, 58), 29, acc + (255,))
        badge.alpha_composite(badge_t, (14, (58 - badge_t.height) // 2))
        title = text_img(seg["title"], font("Bold", 54), WHITE, 0, shadow=5)
        ctx.sub_cache[key] = (badge, title)
    badge, title = ctx.sub_cache[key]
    paste_at(img, badge, 70, 100)
    paste_at(img, title, 64, 170)


def stinger(img, ctx, seg, lt, acc):
    """Glitchy 'INSERT' intro over the scene for the first STING seconds."""
    if lt >= STING:
        return img
    key = "is%d" % seg["num"]
    if key not in ctx.sub_cache:
        a = text_img("INSERT", font("ExtraBold", 170), WHITE, 0, shadow=10)
        b = text_img("%02d / 08" % seg["num"], font("Bold", 80), acc, 0, shadow=6)
        rows = wrap_thai(seg["title"], font("Bold", 70), 940, 5)
        c = multiline_img(rows, font("Bold", 70), YELLOW, 5, shadow=6, spacing=-10)
        ctx.sub_cache[key] = (a, b, c)
    a, b, c = ctx.sub_cache[key]
    cover = 1.0 if lt < STING - 0.5 else clamp01((STING - lt) / 0.5)
    ov = Image.new("RGBA", (W, H), DARK + (int(235 * cover),))
    d = ImageDraw.Draw(ov)
    # sliding stripes
    for k in range(7):
        y = 300 + k * 200
        x = (lt * 1600 * (1 if k % 2 else -1) + k * 300) % (W + 600) - 300
        d.rectangle([x, y, x + 260, y + 14], fill=acc + (int(120 * cover),))
    img.alpha_composite(ov)
    p = ease_out_back(lt / 0.5)
    jit = (random.Random(int(lt * 30)).randint(-14, 14) if lt < 0.45 else 0)
    if lt < 0.45:
        # RGB split glitch
        r = a.copy()
        paste_center(img, r, W / 2 - 12 + jit, 760, alpha=0.5 * cover)
        paste_center(img, r, W / 2 + 12 - jit, 760, alpha=0.5 * cover)
    paste_center(img, a, W / 2 + jit, 760, alpha=cover, scale=max(0.05, 0.7 + 0.3 * p))
    paste_center(img, b, W / 2, 900, alpha=cover * clamp01((lt - 0.3) / 0.3))
    paste_center(img, c, W / 2, 1060 + 40 * (1 - ease_out_cubic((lt - 0.5) / 0.5)),
                 alpha=cover * clamp01((lt - 0.5) / 0.3))
    return img


def glass(size, acc=None, r=36, alpha=28, outline=110, width=3):
    return rounded(size, r, (255, 255, 255, alpha), (acc or (255, 255, 255)) + (outline,), width)


def rich(txt, size, weight="Bold", col=WHITE, stroke=0):
    """Text that may start with an emoji: emoji drawn with the color-emoji font."""
    head, _, rest = txt.partition(" ")
    if rest and head and not any(ch.isalnum() for ch in head) and not head.startswith("["):
        t = text_img(rest, font(weight, size), col, stroke)
        e = emoji_img(head, int(size * 1.05))
        out = Image.new("RGBA", (e.width + 14 + t.width, max(e.height, t.height)), (0, 0, 0, 0))
        out.alpha_composite(e, (0, (out.height - e.height) // 2))
        out.alpha_composite(t, (e.width + 14, (out.height - t.height) // 2))
        return out
    return text_img(txt, font(weight, size), col, stroke)


def label(ctx, txt, size=40, weight="Bold", col=WHITE, stroke=0):
    key = ("lab", txt, size, weight, col, stroke)
    if key not in ctx.sub_cache:
        ctx.sub_cache[key] = rich(txt, size, weight, col, stroke)
    return ctx.sub_cache[key]


def pop(x):
    return max(0.05, ease_out_back(x / 0.45))


# ------------------------------------------------------------------ 1 agent loop
def s1(img, ctx, c, t, acc):
    cx, cy, R = W / 2, 820, 320
    nodes = [("🎯", "รับเป้าหมาย"), ("🧠", "คิด / วางแผน"), ("🛠️", "ลงมือทำ"), ("🔍", "ตรวจผลลัพธ์")]
    ang = [-90, 0, 90, 180]
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    vis = clamp01(c.since(1) / 0.6)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(255, 255, 255, int(60 * vis)), width=6)
    # lit arc up to current stage
    lit = 0
    for k in range(4):
        if c.since(2 + k) >= 0:
            lit = k + 1
    if lit > 1:
        d.arc([cx - R, cy - R, cx + R, cy + R], -90, -90 + 90 * (lit - 1) * 1.0, fill=acc + (255,), width=10)
    looping = c.since(6) >= 0
    img.alpha_composite(ov)
    # traveling dot
    if looping:
        a = math.radians(-90 + (c.since(6) * 110) % 360)
    else:
        a = math.radians(-90 + 90 * max(0, lit - 1))
    if vis > 0:
        paste_center(img, glow_sprite(60, acc, 255), cx + R * math.cos(a), cy + R * math.sin(a))
    for k, (e, lab) in enumerate(nodes):
        x = cx + R * math.cos(math.radians(ang[k]))
        y = cy + R * math.sin(math.radians(ang[k]))
        s = c.since(2 + k)
        on = s >= 0
        sc = pop(s) if on else 0.8
        active = on and (lit == k + 1 and not looping or looping and int(((c.since(6) * 110) % 360) // 90) == k)
        card = ctx.cache("n1" + str(active), lambda: rounded((230, 230), 115, (255, 255, 255, 40 if active else 20),
                                                             (acc if active else (255, 255, 255)) + (255 if active else 90,), 5))
        paste_center(img, card, x, y, scale=sc, alpha=1 if on else 0.35 * vis)
        if active:
            paste_center(img, glow_sprite(150, acc, 90), x, y)
        paste_center(img, emoji_img(e, 100), x, y - 20, scale=sc, alpha=1 if on else 0.3 * vis)
        lb = label(ctx, lab, 34)
        paste_center(img, lb, x, y + 62, alpha=1 if on else 0.3 * vis)
    # center
    loops = int(max(0, c.since(6)) * 110 // 360) + 1 if looping else 1
    title = label(ctx, "AGENT LOOP", 64, "ExtraBold", YELLOW)
    paste_center(img, title, cx, cy - 30, alpha=vis)
    sub = label(ctx, "รอบที่ %d" % loops, 42, "Medium")
    paste_center(img, sub, cx, cy + 40, alpha=vis)
    if c.since(7) > 0:
        done = label(ctx, "✅ งานสำเร็จ", 70, "ExtraBold", (52, 211, 153), 4)
        paste_center(img, done, cx, 1300, scale=pop(c.since(7)))
    if c.since(8) > 0:
        tag = label(ctx, "แชทบอท = ตอบ   |   เอเจนต์ = ลงมือทำ + ตรวจงาน", 38, "Medium")
        paste_center(img, tag, cx, 1390, alpha=clamp01(c.since(8) / 0.4))


# ------------------------------------------------------------------ 2 tools hub
def s2(img, ctx, c, t, acc):
    cx, cy, R = W / 2, 760, 340
    tools = [("📧", "อีเมล"), ("📅", "ปฏิทิน"), ("📊", "ตาราง"), ("🌐", "เว็บ"), ("💬", "แชท"), ("📁", "ไฟล์")]
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    pos = []
    for k in range(6):
        a = math.radians(-90 + k * 60)
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        s = c.since(2) - k * 0.45
        pos.append((x, y, s))
        if s > 0:
            pe = ease_out_cubic(s / 0.5)
            d.line([(cx, cy), (cx + (x - cx) * pe, cy + (y - cy) * pe)], fill=acc + (150,), width=5)
    img.alpha_composite(ov)
    # pulses
    for k, (x, y, s) in enumerate(pos):
        if s > 0.6:
            ph = ((t * 0.7 + k * 0.37) % 1.0)
            out = int(t * 0.7 + k * 0.37) % 2 == 0
            q = ph if out else 1 - ph
            col = acc if out else (251, 191, 36)
            paste_center(img, glow_sprite(26, col, 255), cx + (x - cx) * q, cy + (y - cy) * q)
    paste_center(img, glow_sprite(220, acc, 120), cx, cy)
    hub = ctx.cache("hub", lambda: rounded((260, 260), 130, (20, 24, 50, 255), acc + (255,), 6))
    paste_center(img, hub, cx, cy, scale=pop(c.since(1)) if c.since(1) > 0 else 0.05)
    if c.since(1) > 0:
        paste_center(img, emoji_img("🧠", 130), cx, cy - 15 + math.sin(t * 3) * 6, scale=pop(c.since(1)))
        paste_center(img, label(ctx, "AGENT", 36, "ExtraBold", YELLOW), cx, cy + 85)
    for k, (x, y, s) in enumerate(pos):
        if s <= 0:
            continue
        card = ctx.cache("tc", lambda: glass((190, 190), acc, 95, 35, 160, 4))
        paste_center(img, card, x, y, scale=pop(s))
        paste_center(img, emoji_img(tools[k][0], 84), x, y - 22, scale=pop(s))
        paste_center(img, label(ctx, tools[k][1], 34), x, y + 52, alpha=clamp01(s / 0.3))
    for k, (txt, col) in enumerate([("API", (96, 165, 250)), ("MCP", (244, 114, 182))]):
        s = c.since(6 + k)
        if s > 0:
            chip = ctx.cache("chip" + txt, lambda: rounded((220, 90), 45, col + (255,)))
            x = cx - 140 + 280 * k
            paste_center(img, chip, x, 1230, scale=pop(s))
            paste_center(img, label(ctx, txt, 54, "ExtraBold", DARK), x, 1228, scale=pop(s))
    if c.since(9) > 0:
        btn = ctx.cache("conn", lambda: rounded((560, 100), 50, (52, 211, 153, 255)))
        paste_center(img, btn, cx, 1350, scale=pop(c.since(9)))
        paste_center(img, label(ctx, "✅ เชื่อมต่อบัญชีแล้ว", 46, "Bold", DARK), cx, 1348, scale=pop(c.since(9)))


# ------------------------------------------------------------------ 3 chat demo
def s3(img, ctx, c, t, acc):
    x0, y0, pw, ph = 90, 290, 900, 1110
    phone = ctx.cache("phone", lambda: rounded((pw, ph), 60, (14, 18, 34, 245), (255, 255, 255, 60), 3))
    paste_at(img, phone, x0, y0)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([x0 + 40, y0 + 40, x0 + 100, y0 + 100], fill=acc + (255,))
    d.ellipse([x0 + 88, y0 + 88, x0 + 104, y0 + 104], fill=(52, 211, 153, 255))
    d.line([(x0 + 30, y0 + 130), (x0 + pw - 30, y0 + 130)], fill=(255, 255, 255, 40), width=2)
    img.alpha_composite(ov)
    paste_center(img, emoji_img("🤖", 40), x0 + 70, y0 + 70)
    paste_at(img, label(ctx, "AI Agent", 40, "Bold"), x0 + 120, y0 + 38)
    paste_at(img, label(ctx, "ออนไลน์ · พร้อมทำงาน", 26, "Regular", (150, 255, 200)), x0 + 122, y0 + 86)
    y = y0 + 160
    # user bubble typed during line 1
    msg = "ช่วยหาข้อมูลคู่แข่ง 3 ราย แล้วสรุปเป็นตารางให้หน่อย"
    s = c.since(1)
    if s > 0:
        txt = typed(msg, s / 2.6)
        rows = wrap_thai(txt, font("Medium", 38), 560) if txt else [""]
        bub = multiline_img(rows, font("Medium", 38), DARK, spacing=-8, align="left")
        bw, bh = bub.width + 50, bub.height + 30
        b = rounded((bw, bh), 34, acc + (255,))
        b.alpha_composite(bub, (25, 15))
        paste_at(img, b, x0 + pw - 40 - bw, y)
        if s < 2.8 and int(t * 4) % 2 == 0:
            ImageDraw.Draw(img).rectangle([x0 + pw - 50, y + bh - 50, x0 + pw - 46, y + bh - 20], fill=DARK + (255,))
        y += bh + 30
    # agent thinking
    s = c.since(2)
    steps = ["ค้นหาข้อมูลบริษัทคู่แข่ง", "เก็บราคา จุดเด่น กลุ่มลูกค้า", "เปรียบเทียบ + ทำตาราง"]
    if s > 0:
        if c.since(4) < 0:
            dots = ctx.cache("think", lambda: glass((300, 90), None, 34, 30, 60, 2))
            paste_at(img, dots, x0 + 40, y)
            dd = ImageDraw.Draw(img)
            for k in range(3):
                yy = y + 45 + math.sin(t * 8 - k) * 8
                dd.ellipse([x0 + 90 + k * 50 - 10, yy - 10, x0 + 90 + k * 50 + 10, yy + 10], fill=(255, 255, 255, 255))
            paste_at(img, label(ctx, "กำลังวางแผน", 30, "Regular", (200, 200, 220)), x0 + 260, y + 26)
            y += 120
        else:
            plan = ctx.cache("plan", lambda: glass((700, 420), acc, 34, 30, 120, 2))
            paste_at(img, plan, x0 + 40, y)
            paste_at(img, label(ctx, "📋 แผนการทำงาน", 38, "Bold", YELLOW), x0 + 80, y + 20)
            for k, st in enumerate(steps):
                yy = y + 110 + k * 95
                sk = c.since(4 + k)
                done = c.since(5 + k) > 0 if k < 2 else c.since(7) > 0.6
                dd = ImageDraw.Draw(img)
                cxk, cyk = x0 + 105, yy + 28
                if done:
                    dd.ellipse([cxk - 22, cyk - 22, cxk + 22, cyk + 22], fill=(52, 211, 153, 255))
                    dd.line([(cxk - 10, cyk), (cxk - 2, cyk + 9), (cxk + 12, cyk - 9)], fill=DARK + (255,), width=5)
                elif sk > 0:
                    a0 = (t * 400) % 360
                    dd.arc([cxk - 22, cyk - 22, cxk + 22, cyk + 22], a0, a0 + 270, fill=acc + (255,), width=6)
                else:
                    dd.ellipse([cxk - 22, cyk - 22, cxk + 22, cyk + 22], outline=(255, 255, 255, 255), width=3)
                paste_at(img, label(ctx, st, 36, "Medium"), x0 + 150, yy, alpha=1 if sk > 0 or done else 0.5)
            y += 450
    s = c.since(8)
    if s > 0:
        tb = ctx.cache("table", lambda: make_table(acc))
        paste_at(img, tb, x0 + 40, int(y + 60 * (1 - ease_out_cubic(s / 0.5))), alpha=clamp01(s / 0.3))
    s = c.since(9)
    if s > 0:
        bd = ctx.cache("bdg", lambda: rounded((330, 80), 40, (251, 191, 36, 255)))
        paste_center(img, bd, x0 + pw - 210, y0 + 70, scale=pop(s))
        paste_center(img, label(ctx, "⏱ เสร็จใน 3 นาที", 34, "Bold", DARK), x0 + pw - 210, y0 + 68, scale=pop(s))


def make_table(acc):
    rows = [("คู่แข่ง", "ราคา", "จุดเด่น"), ("บริษัท A", "฿990", "ส่งไว"), ("บริษัท B", "฿1,290", "บริการดี"),
            ("บริษัท C", "฿850", "ราคาถูก")]
    im = rounded((820, 290), 30, (255, 255, 255, 235))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, 819, 70], 30, fill=acc + (255,))
    d.rectangle([0, 40, 819, 70], fill=acc + (255,))
    for r, row in enumerate(rows):
        for k, cell in enumerate(row):
            f = font("Bold" if r == 0 else "Medium", 34)
            d.text((30 + k * 270, 12 + r * 70), cell, font=f, fill=DARK)
        if r:
            d.line([(20, r * 70 + 2), (800, r * 70 + 2)], fill=(200, 200, 210), width=2)
    return im


# ------------------------------------------------------------------ 4 prompt template
def s4(img, ctx, c, t, acc):
    fields = [("🎭", "บทบาท", "ผู้ช่วยฝ่ายการตลาด ประสบการณ์ 10 ปี"),
              ("🎯", "เป้าหมาย", "สรุปยอดขายไตรมาส 3 เพื่อเสนอผู้บริหาร"),
              ("📎", "ข้อมูลประกอบ", "แนบไฟล์ ยอดขาย_Q3.xlsx"),
              ("🚧", "ขั้นตอน / ข้อจำกัด", "ห้ามแต่งตัวเลขเอง ถ้าไม่แน่ใจให้ถามก่อน"),
              ("📄", "รูปแบบผลลัพธ์", "ตาราง + สรุป 5 ข้อ ภาษาทางการ")]
    y = 290
    for k, (e, lab, val) in enumerate(fields):
        s = c.since(1 + k)
        active = s >= 0 and (c.since(2 + k) < 0 if k < 4 else c.since(6) < 0)
        box = ctx.cache("fb%d" % active, lambda: glass((940, 186), acc if active else None, 30,
                                                       40 if active else 22, 230 if active else 70, 4 if active else 2))
        appear = clamp01((c.lt + 0.3 - k * 0.15) / 0.4)
        paste_at(img, box, 70, y, alpha=appear)
        paste_center(img, emoji_img(e, 60), 130, y + 52, alpha=appear)
        paste_at(img, label(ctx, "%d. %s" % (k + 1, lab), 40, "Bold", YELLOW if active else WHITE), 175, y + 22, alpha=appear)
        inp = ctx.cache("inp", lambda: rounded((860, 76), 20, (0, 0, 0, 120)))
        paste_at(img, inp, 110, y + 100, alpha=appear)
        if s > 0:
            txt = typed(val, s / 2.2)
            if txt:
                paste_at(img, text_img(txt, font("Medium", 36), WHITE), 130, y + 108)
            if active and int(t * 3) % 2 == 0:
                w = text_size(txt, font("Medium", 36))[0] if txt else 0
                ImageDraw.Draw(img).rectangle([140 + w, y + 118, 144 + w, y + 160], fill=acc + (255,))
        y += 202
    s = c.since(6)
    if s > 0:
        btn = ctx.cache("save", lambda: rounded((520, 100), 50, (52, 211, 153, 255)))
        g = 0.5 + 0.5 * math.sin(t * 5)
        paste_center(img, glow_sprite(160, (52, 211, 153), int(80 * g)), W / 2, 1365)
        paste_center(img, btn, W / 2, 1365, scale=pop(s))
        paste_center(img, label(ctx, "💾 บันทึกเทมเพลต", 46, "Bold", DARK), W / 2, 1363, scale=pop(s))


# ------------------------------------------------------------------ 5 inbox triage
def s5(img, ctx, c, t, acc):
    mails = [("ลูกค้า ABC", "ด่วน! ขอใบเสนอราคาภายในวันนี้", 0), ("ฝ่ายบัญชี", "ขออนุมัติเอกสารเบิกจ่าย", 1),
             ("โปรโมชัน", "ลดราคา 70% เฉพาะวันนี้", 3), ("หัวหน้าทีม", "สรุปประชุมเมื่อวาน", 2),
             ("ซัพพลายเออร์", "ยืนยันวันส่งสินค้า?", 1), ("ระบบเซิร์ฟเวอร์", "แจ้งเตือน: พื้นที่ใกล้เต็ม", 0),
             ("พาร์ตเนอร์", "นัดคุยโปรเจกต์ใหม่ได้ไหม", 1)]
    tags = [("ด่วน", (239, 68, 68)), ("รอตอบ", (251, 191, 36)), ("รับทราบ", (52, 211, 153)), ("โฆษณา", (148, 163, 184))]
    paste_at(img, label(ctx, "📥 กล่องจดหมาย  (7 ฉบับใหม่)", 42, "Bold"), 80, 290)
    y0 = 370
    for k, (who, sub, tg) in enumerate(mails):
        s = c.since(1) - k * 0.25
        if s <= -0.2 and c.lt < 0:
            s = c.lt + 1.5 - k * 0.15
        if s <= 0:
            continue
        y = y0 + k * 128
        x = 70 + int(700 * (1 - ease_out_cubic(s / 0.5)))
        card = ctx.cache("mc", lambda: glass((940, 116), None, 26, 26, 70, 2))
        paste_at(img, card, x, y)
        ImageDraw.Draw(img).ellipse([x + 26, y + 32, x + 86, y + 92], fill=ACCENTS[k % 7] + (255,))
        paste_center(img, label(ctx, who[0], 34, "Bold", DARK), x + 56, y + 60)
        paste_at(img, label(ctx, who, 34, "Bold"), x + 110, y + 12)
        paste_at(img, label(ctx, sub, 30, "Regular", (210, 214, 230)), x + 110, y + 64)
        # tag
        st = c.since(2) - k * 0.55
        if st > 0:
            name, col = tags[tg]
            if c.since(3) < 0 and tg in (0, 1) or c.since(3) >= 0:
                pass
            pill = ctx.cache("tag" + name, lambda: rounded((150, 56), 28, col + (255,)))
            paste_center(img, pill, x + 850, y + 34, scale=pop(st))
            paste_center(img, label(ctx, name, 30, "Bold", DARK), x + 850, y + 32, scale=pop(st))
        sd = c.since(5) - k * 0.3
        if tg == 1 and sd > 0:
            dr = ctx.cache("draft", lambda: rounded((180, 46), 23, (96, 165, 250, 255)))
            paste_center(img, dr, x + 840, y + 86, scale=pop(sd))
            paste_center(img, label(ctx, "✍️ ร่างแล้ว", 26, "Bold", DARK), x + 840, y + 84, scale=pop(sd))
    s = c.since(6)
    if s > 0:
        y = 1330 + int(300 * (1 - ease_out_cubic(s / 0.6)))
        sm = ctx.cache("sum", lambda: make_summary(acc, tags))
        paste_center(img, sm, W / 2, y)


def make_summary(acc, tags):
    im = rounded((940, 200), 34, (255, 255, 255, 240))
    d = ImageDraw.Draw(im)
    im.alpha_composite(rich("☀️ สรุปประจำวัน · อ่าน 1 นาที", 40, "Bold", DARK), (40, 14))
    nums = [2, 3, 1, 1]
    for k, (name, col) in enumerate(tags):
        x = 40 + k * 225
        d.rounded_rectangle([x, 100, x + 205, 176], 22, fill=col)
        d.text((x + 20, 108), "%s %d" % (name, nums[k]), font=font("Bold", 38), fill=DARK)
    return im


# ------------------------------------------------------------------ 6 research
def s6(img, ctx, c, t, acc):
    bar = ctx.cache("sbar", lambda: rounded((940, 100), 50, (255, 255, 255, 240)))
    paste_at(img, bar, 70, 290)
    paste_center(img, emoji_img("🔎", 50), 130, 340)
    q = "แนวโน้มตลาด AI Agent ในไทย 2026"
    s = c.since(1)
    txt = typed(q, s / 2.4) if s > 0 else ""
    if txt:
        paste_at(img, text_img(txt, font("Medium", 38), DARK), 170, 310)
    srcs = [("news-tech.th", "รายงานตลาด AI"), ("research.org", "สถิติการใช้งาน"), ("bizthai.com", "กรณีศึกษาองค์กร"),
            ("gov.go.th", "นโยบายดิจิทัล"), ("global-ai.net", "เทรนด์ทั่วโลก"), ("survey.co", "ผลสำรวจผู้ใช้")]
    for k, (dom, ttl) in enumerate(srcs):
        sk = c.since(2) - k * 0.3
        if sk <= 0:
            continue
        col, row = k % 2, k // 2
        x, y = 70 + col * 480, 430 + row * 230
        card = ctx.cache("src", lambda: glass((460, 210), acc, 26, 30, 120, 2))
        paste_at(img, card, x, y + int(40 * (1 - ease_out_cubic(sk / 0.4))), alpha=clamp01(sk / 0.3))
        paste_at(img, label(ctx, "🌐 " + dom, 28, "Regular", (170, 210, 255)), x + 24, y + 12)
        paste_at(img, label(ctx, ttl, 36, "Bold"), x + 24, y + 62)
        d = ImageDraw.Draw(img)
        for j in range(2):
            hl = c.since(3) - k * 0.25 - j * 0.2
            w = 400 if j == 0 else 300
            fill = (251, 191, 36, 255) if hl > 0 and j == 0 else (255, 255, 255, 70)
            d.rounded_rectangle([x + 24, y + 128 + j * 34, x + 24 + w, y + 146 + j * 34], 9, fill=fill)
        badge = ctx.cache("num%d" % k, lambda: rounded((60, 44), 22, acc + (255,)))
        paste_at(img, badge, x + 380, y + 14)
        paste_center(img, label(ctx, "[%d]" % (k + 1), 26, "Bold", DARK), x + 410, y + 34)
        # flying snippet
        fs = c.since(4) - k * 0.35
        if 0 < fs < 1.2:
            p = ease_in_out(fs / 1.2)
            sx, sy = x + 220, y + 140
            tx, ty = W / 2, 1220
            paste_center(img, glow_sprite(34, (251, 191, 36), 255), sx + (tx - sx) * p, sy + (ty - sy) * p - math.sin(p * math.pi) * 120)
    s = c.since(4)
    if s > 0:
        doc = ctx.cache("doc", lambda: rounded((940, 330), 30, (255, 255, 255, 245)))
        paste_at(img, doc, 70, 1110, alpha=clamp01(s / 0.4))
        paste_at(img, label(ctx, "📄 รายงานสรุป", 40, "Bold", DARK), 110, 1130, alpha=clamp01(s / 0.4))
        paras = ["ตลาด AI Agent โตต่อเนื่อง [1][2]", "องค์กรไทยเริ่มใช้งานจริงมากขึ้น [3]",
                 "ภาครัฐสนับสนุนดิจิทัล [4]  ผู้ใช้พอใจสูง [6]"]
        for j, ptxt in enumerate(paras):
            pj = c.since(4) - 0.8 - j * 1.2
            if pj > 0:
                tt = typed(ptxt, pj / 1.0)
                if tt:
                    paste_at(img, text_img(tt, font("Medium", 36), (40, 44, 70)), 110, 1205 + j * 62)
        if c.since(5) > 0:
            g = 0.5 + 0.5 * math.sin(t * 6)
            d = ImageDraw.Draw(img)
            d.rounded_rectangle([70, 1110, 1009, 1439], 30, outline=(251, 191, 36, 255), width=int(3 + 4 * g))


# ------------------------------------------------------------------ 7 workflow
def s7(img, ctx, c, t, acc):
    N = {"trig": (W / 2, 400, "📝", "ฟอร์มใหม่เข้ามา", 1), "ai": (W / 2, 600, "🤖", "AI ให้คะแนนลูกค้า", 2),
         "sw": (W / 2, 800, "🔀", "แยกตามคะแนน", 3), "sales": (290, 1010, "💼", "ส่งทีมขาย", 3),
         "mail": (790, 1010, "📧", "ส่งอีเมลข้อมูล", 4), "sheet": (W / 2, 1220, "📊", "บันทึกลงตาราง", 5)}
    E = [("trig", "ai", 1), ("ai", "sw", 2), ("sw", "sales", 3), ("sw", "mail", 4), ("sales", "sheet", 5), ("mail", "sheet", 5)]
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for a, b, k in E:
        xa, ya = N[a][:2]
        xb, yb = N[b][:2]
        on = c.since(k) > 0
        d.line([(xa, ya), (xb, yb)], fill=(acc + (220,)) if on else (255, 255, 255, 50), width=6 if on else 4)
    img.alpha_composite(ov)
    for j, (a, b, k) in enumerate(E):
        if c.since(k) > 0:
            xa, ya = N[a][:2]
            xb, yb = N[b][:2]
            for m in range(2):
                q = (t * 0.6 + j * 0.21 + m * 0.5) % 1.0
                paste_center(img, glow_sprite(24, (251, 191, 36), 255), xa + (xb - xa) * q, ya + (yb - ya) * q)
    for key, (x, y, e, lab, k) in N.items():
        s = c.since(k) if key != "trig" else max(c.since(1), -0.5 + clamp01(c.lt + 1))
        on = c.since(k) > 0
        box = ctx.cache("wn%d" % on, lambda: rounded((420, 150), 34, (22, 26, 52, 255), (acc if on else (255, 255, 255)) + (255 if on else 80,), 5 if on else 2))
        sc = pop(c.since(k)) if on and c.since(k) < 0.5 else 1.0
        paste_center(img, box, x, y, scale=sc, alpha=1 if on else 0.55)
        paste_center(img, emoji_img(e, 64), x - 140, y, scale=sc, alpha=1 if on else 0.5)
        lb = label(ctx, lab, 32 if len(lab) > 10 else 36, "Bold")
        paste_at(img, lb, int(x - 95), int(y - lb.height / 2), alpha=1 if on else 0.5)
        if key == "ai" and c.since(2) > 0.5:
            n = int(min(87, (c.since(2) - 0.5) * 60))
            sc_lab = text_img("คะแนน %d" % n, font("ExtraBold", 34), DARK)
            pill = rounded((sc_lab.width + 30, 54), 27, (251, 191, 36, 255))
            pill.alpha_composite(sc_lab, (15, (54 - sc_lab.height) // 2))
            paste_center(img, pill, x + 260, y - 70)
    if c.since(6) > 0:
        pl = label(ctx, "⚡ ทำงานอัตโนมัติ 24/7", 48, "ExtraBold", YELLOW, 4)
        paste_center(img, pl, W / 2, 1360, scale=pop(c.since(6)))


# ------------------------------------------------------------------ 8 dashboard
def s8(img, ctx, c, t, acc):
    kpis = [("งานที่เสร็จ", 128, "", "✅", 1), ("ชั่วโมงที่ประหยัด", 46, " ชม.", "⏱️", 2), ("ผ่านโดยไม่ต้องแก้", 92, "%", "🎯", 3)]
    for k, (lab, val, unit, e, li) in enumerate(kpis):
        x, y = 70 + k * 320, 300
        card = ctx.cache("kpi", lambda: glass((300, 300), acc, 30, 32, 140, 3))
        appear = clamp01((c.lt + 1.2 - k * 0.2) / 0.4)
        paste_at(img, card, x, y, alpha=appear)
        paste_center(img, emoji_img(e, 60), x + 150, y + 60, alpha=appear)
        s = c.since(li)
        v = int(val * ease_out_cubic(s / 1.6)) if s > 0 else 0
        paste_center(img, text_img("%d%s" % (v, unit), font("ExtraBold", 66 if not unit.strip() == "ชม." else 58), YELLOW), x + 150, y + 165, alpha=appear)
        paste_center(img, label(ctx, lab, 30, "Medium"), x + 150, y + 245, alpha=appear)
    # line chart
    cx0, cy0, cw, ch = 70, 660, 940, 520
    panel = ctx.cache("panel", lambda: glass((cw, ch), None, 30, 24, 70, 2))
    paste_at(img, panel, cx0, cy0)
    paste_at(img, label(ctx, "📈 คุณภาพงานรายสัปดาห์", 38, "Bold"), cx0 + 30, cy0 + 20)
    vals = [58, 63, 61, 70, 76, 81, 86, 92]
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    gx0, gy0, gx1, gy1 = cx0 + 60, cy0 + 110, cx0 + cw - 50, cy0 + ch - 70
    for j in range(5):
        yy = gy0 + (gy1 - gy0) * j / 4
        d.line([(gx0, yy), (gx1, yy)], fill=(255, 255, 255, 30), width=2)
    p = clamp01(c.since(4) / 4.0)
    pts = [(gx0 + (gx1 - gx0) * j / (len(vals) - 1), gy1 - (gy1 - gy0) * (v - 50) / 50) for j, v in enumerate(vals)]
    m = p * (len(pts) - 1)
    show = pts[:int(m) + 1]
    if p > 0 and int(m) < len(pts) - 1:
        a, b = pts[int(m)], pts[int(m) + 1]
        f = m - int(m)
        show = show + [(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)]
    if len(show) > 1:
        poly = show + [(show[-1][0], gy1), (show[0][0], gy1)]
        d.polygon(poly, fill=acc + (50,))
        d.line(show, fill=acc + (255,), width=8, joint="curve")
        for q in show[:-1]:
            d.ellipse([q[0] - 9, q[1] - 9, q[0] + 9, q[1] + 9], fill=(255, 255, 255, 255))
    img.alpha_composite(ov)
    if len(show) > 1:
        paste_center(img, glow_sprite(40, acc, 255), *show[-1])
    for j in range(len(vals)):
        if j % 2 == 0:
            paste_center(img, label(ctx, "W%d" % (j + 1), 26, "Regular", (180, 186, 210)), pts[j][0], gy1 + 34)
    # bars: prompt revisions
    bx0, by0 = 70, 1220
    panel2 = ctx.cache("panel2", lambda: glass((940, 230), None, 30, 24, 70, 2))
    paste_at(img, panel2, bx0, by0)
    paste_at(img, label(ctx, "🔧 จำนวนครั้งที่ปรับคำสั่ง", 34, "Bold"), bx0 + 30, by0 + 16)
    bars = [2, 3, 5, 4, 6, 7, 6, 8]
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for j, bv in enumerate(bars):
        q = ease_out_cubic((c.since(4) - j * 0.15) / 0.6)
        if q <= 0:
            continue
        x = bx0 + 70 + j * 105
        hh = 120 * bv / 8 * q
        d.rounded_rectangle([x, by0 + 205 - hh, x + 60, by0 + 205], 10, fill=(251, 191, 36, 255))
    img.alpha_composite(ov)
    if c.since(6) > 0:
        tag = label(ctx, "ยิ่งปรับคำสั่ง → งานยิ่งดีขึ้น", 46, "ExtraBold", YELLOW, 4)
        paste_center(img, tag, W / 2, 620, scale=pop(c.since(6)))


SCENES = {1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8}


def render(seg, t, ctx, LINES):
    acc = ACCENTS[(seg["num"] + 1) % len(ACCENTS)]
    img = bg(t, acc)
    c = Clock(seg, t, LINES)
    lt = t - seg["start"]
    SCENES[seg["num"]](img, ctx, c, t, acc)
    header(img, ctx, seg, acc)
    # fade out at the end of the insert
    out = clamp01((seg["end"] - t) / 0.5)
    stinger(img, ctx, seg, lt, acc)
    if out < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), DARK + (int(255 * (1 - out)),)))
    return img

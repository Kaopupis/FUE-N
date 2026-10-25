"""Drawing helpers shared by the renderer."""
import math
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
FONTS = "../fonts/"
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"

YELLOW = (255, 230, 0)
WHITE = (255, 255, 255)
ACCENTS = [(34, 211, 238), (167, 139, 250), (244, 114, 182), (251, 191, 36),
           (52, 211, 153), (96, 165, 250), (251, 146, 60)]


@lru_cache(maxsize=64)
def font(weight="Bold", size=60):
    if weight == "Mono":
        return ImageFont.truetype(FONTS + "JetBrainsMono.ttf", size)
    return ImageFont.truetype(FONTS + f"Kanit-{weight}.ttf", size, layout_engine=ImageFont.Layout.RAQM)


def ease_out_cubic(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_out_back(x, s=1.70158):
    x = min(max(x, 0.0), 1.0)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def ease_in_out(x):
    x = min(max(x, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * x)


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def text_size(txt, f, stroke=0):
    l, t, r, b = f.getbbox(txt, stroke_width=stroke)
    return r - l, b - t, l, t


def text_img(txt, f, fill=WHITE, stroke=0, stroke_fill=(0, 0, 0), shadow=0, pad=10):
    """Render text to a tight RGBA image (with optional stroke and soft shadow)."""
    w, h, l, t = text_size(txt, f, stroke)
    asc, desc = f.getmetrics()
    hh = max(h, asc + desc) + 2 * pad + shadow * 2
    img = Image.new("RGBA", (w + 2 * pad + shadow * 2, hh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = pad - l, pad + (hh - 2 * pad - shadow * 2 - (asc + desc)) // 2
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((ox + shadow, oy + shadow), txt, font=f, fill=(0, 0, 0, 170),
                                stroke_width=stroke, stroke_fill=(0, 0, 0, 170))
        sh = sh.filter(ImageFilter.GaussianBlur(shadow / 2))
        img.alpha_composite(sh)
    d.text((ox, oy), txt, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return img


def wrap_thai(txt, f, max_w, stroke=0):
    """Word-wrap Thai text using pythainlp tokens."""
    from pythainlp.tokenize import word_tokenize
    toks = word_tokenize(txt, keep_whitespace=True)
    lines, cur = [], ""
    for tk in toks:
        cand = cur + tk
        if cur and text_size(cand.strip(), f, stroke)[0] > max_w:
            lines.append(cur.strip())
            cur = tk.lstrip()
        else:
            cur = cand
    if cur.strip():
        lines.append(cur.strip())
    # balance two lines: move tokens from long first line when the last is tiny
    if len(lines) == 2 and text_size(lines[1], f)[0] < 0.35 * text_size(lines[0], f)[0]:
        toks = word_tokenize(txt, keep_whitespace=True)
        best = None
        for i in range(1, len(toks)):
            a, b = "".join(toks[:i]).strip(), "".join(toks[i:]).strip()
            wa, wb = text_size(a, f, stroke)[0], text_size(b, f, stroke)[0]
            if wa <= max_w and wb <= max_w:
                sc = abs(wa - wb)
                if best is None or sc < best[0]:
                    best = (sc, [a, b])
        if best:
            lines = best[1]
    return lines


def multiline_img(lines, f, fill=WHITE, stroke=0, shadow=0, spacing=0, align="center"):
    imgs = [text_img(l, f, fill, stroke, shadow=shadow) for l in lines]
    w = max(i.width for i in imgs)
    asc, desc = f.getmetrics()
    step = asc + desc + spacing
    h = imgs[0].height + step * (len(imgs) - 1)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for k, im in enumerate(imgs):
        x = (w - im.width) // 2 if align == "center" else 0
        out.alpha_composite(im, (x, k * step))
    return out


@lru_cache(maxsize=256)
def emoji_img(e, size=200):
    f = ImageFont.truetype(EMOJI_FONT, 109, layout_engine=ImageFont.Layout.RAQM)
    img = Image.new("RGBA", (260, 180), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((10, 10), e, font=f, embedded_color=True)
    bb = img.getbbox()
    img = img.crop(bb)
    s = size / max(img.size)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)


def rounded(size, r, fill, outline=None, width=0):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=fill,
                                          outline=outline, width=width)
    return img


@lru_cache(maxsize=32)
def glow_sprite(radius, color, alpha=255):
    s = radius * 2
    y, x = np.mgrid[0:s, 0:s]
    d = np.sqrt((x - radius) ** 2 + (y - radius) ** 2) / radius
    a = np.clip(1 - d, 0, 1) ** 2 * alpha
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def paste_center(dst, src, cx, cy, alpha=1.0, scale=1.0):
    if scale != 1.0:
        nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
        src = src.resize((nw, nh), Image.BILINEAR)
    if alpha < 1.0:
        src = src.copy()
        a = src.getchannel("A").point(lambda v: int(v * alpha))
        src.putalpha(a)
    x, y = int(cx - src.width / 2), int(cy - src.height / 2)
    paste_at(dst, src, x, y)


def paste_at(dst, src, x, y, alpha=1.0):
    if alpha <= 0:
        return
    if alpha < 1.0:
        src = src.copy()
        src.putalpha(src.getchannel("A").point(lambda v: int(v * alpha)))
    # clip to destination
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.width, x + src.width), min(dst.height, y + src.height)
    if x1 <= x0 or y1 <= y0:
        return
    if (x0, y0, x1, y1) != (x, y, x + src.width, y + src.height):
        src = src.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    dst.alpha_composite(src, (x0, y0))


@lru_cache(maxsize=16)
def gradient_bg(c1, c2, angle_seed=0):
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    t = np.clip(0.75 * y + 0.25 * x, 0, 1)
    arr = np.zeros((H, W, 4), np.uint8)
    for i in range(3):
        arr[..., i] = (c1[i] * (1 - t) + c2[i] * t).astype(np.uint8)
    arr[..., 3] = 255
    img = Image.fromarray(arr, "RGBA")
    # subtle grid
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for gx in range(0, W, 90):
        d.line([(gx, 0), (gx, H)], fill=(255, 255, 255, 14), width=1)
    for gy in range(0, H, 90):
        d.line([(0, gy), (W, gy)], fill=(255, 255, 255, 14), width=1)
    img.alpha_composite(ov)
    return img


def mix(c1, c2, t):
    return tuple(int(a * (1 - t) + b * t) for a, b in zip(c1, c2))

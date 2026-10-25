"""Build the soundtrack: Thai voiceover + procedural music (ducked) + synthesized SFX."""
import json, os, wave
import numpy as np
from scipy.signal import resample_poly, butter, sosfilt

SR = 48000
FPS = 30
rng = np.random.default_rng(7)
TL = json.load(open("timeline.json", encoding="utf8"))
N = int(TL["total"] * SR) + SR
os.makedirs("audio", exist_ok=True)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def tt(d):
    return np.arange(int(d * SR)) / SR


# ------------------------------------------------------------------ voice
def build_voice():
    vo = np.zeros(N, np.float32)
    meta = json.load(open("vo/meta.json", encoding="utf8"))
    for L in TL["lines"]:
        x = np.load("vo/%04d.npy" % L["i"]).astype(np.float64)
        x = resample_poly(x, 3, 1)
        x = hp(x, 80)
        # gentle presence lift
        x = x + 0.25 * bp(x, 2500, 6000)
        rms = np.sqrt(np.mean(x ** 2)) + 1e-9
        x *= 0.12 / rms
        # soft clip to tame peaks
        x = np.tanh(x * 1.4) / 1.4
        fade = np.minimum(1, np.arange(len(x)) / 240)
        x *= fade * fade[::-1]
        s = int(L["start"] * SR)
        vo[s:s + len(x)] += x[:N - s].astype(np.float32)
    return vo


# ------------------------------------------------------------------ music
BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)

PROGS = {
    "A": [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]],   # Am7 Fmaj7 Cmaj7 G
    "B": [[50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64]],   # Dm7 Gm7 C7 Fmaj7
    "C": [[52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 60], [47, 50, 54, 57]],   # Em7 Cmaj7 D7 Bm7
    "D": [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]],   # Fmaj7 G7 Em7 Am7
}


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def pad_note(f, d):
    t = tt(d)
    x = sum(saw(f * (1 + dt), t + ph) for dt, ph in [(-0.004, 0), (0.0, 0.3), (0.005, 0.6)]) / 3
    env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.3)
    return lp(x, 1400) * env


def pluck(f, d=0.45):
    t = tt(d)
    x = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    return x * np.exp(-t * 9) * np.minimum(1, t / 0.003)


def kick():
    t = tt(0.4)
    f = 45 + 110 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * 1.0


def snare():
    t = tt(0.25)
    n = bp(rng.standard_normal(len(t)), 900, 6000) * np.exp(-t * 18)
    return n * 0.5 + 0.25 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)


def hat(open_=False):
    t = tt(0.18 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 60)) * 0.22


KICK, SNARE, HAT, OHAT = kick(), snare(), hat(), hat(True)


def add(buf, x, pos):
    s = int(pos * SR)
    e = min(len(buf), s + len(x))
    if s < len(buf):
        buf[s:e] += x[:e - s]


def make_loop(name, drums="full"):
    prog = PROGS[name]
    L = np.zeros(int(4 * BAR * SR) + SR)
    R = np.zeros_like(L)
    for b, ch in enumerate(prog):
        t0 = b * BAR
        for k, m in enumerate(ch):
            p = pad_note(NOTE(m), BAR + 0.25) * 0.11
            pan = 0.35 + 0.1 * k
            add(L, p * (1 - pan), t0)
            add(R, p * pan, t0)
        root = NOTE(ch[0] - 24)
        for bt, ln in [(0, 1.4), (1.5, 0.45), (2, 1.4), (3.5, 0.45)]:
            t = tt(ln * BEAT)
            x = np.tanh(1.6 * np.sin(2 * np.pi * root * t)) * np.exp(-t * 2.2) * 0.3
            add(L, x, t0 + bt * BEAT)
            add(R, x, t0 + bt * BEAT)
        # arpeggio eighths
        arp = ch + [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]
        for e in range(8):
            if name == "A" and e % 2:
                continue
            m = arp[(e * 3 + b) % len(arp)] + 12
            x = pluck(NOTE(m)) * (0.07 if drums != "none" else 0.09)
            pos = t0 + e * BEAT / 2
            add(L, x * (0.7 if e % 2 else 0.3), pos)
            add(R, x * (0.3 if e % 2 else 0.7), pos + 0.012)
        if drums == "none":
            continue
        for beat in range(4):
            bt = t0 + beat * BEAT
            if beat in (0, 2) or (drums == "full" and beat == 3 and b % 2):
                add(L, KICK * 0.55, bt + (BEAT / 2 if beat == 3 else 0))
                add(R, KICK * 0.55, bt + (BEAT / 2 if beat == 3 else 0))
            if beat in (1, 3):
                add(L, SNARE * 0.35, bt)
                add(R, SNARE * 0.35, bt)
            for h in range(2):
                hx = (OHAT if (h == 1 and beat == 3) else HAT) * (0.8 if h else 0.5)
                add(L, hx * 0.8, bt + h * BEAT / 2)
                add(R, hx, bt + h * BEAT / 2 + 0.004)
    n = int(4 * BAR * SR)
    # wrap tails around for seamless looping
    L[:SR] += L[n:n + SR]
    R[:SR] += R[n:n + SR]
    return np.stack([L[:n], R[:n]])


def build_music():
    loops = {
        "hook": make_loop("A", "full"),
        "secB": make_loop("B", "light"),
        "secD": make_loop("D", "light"),
        "insert": make_loop("C", "full"),
        "end": make_loop("A", "full"),
        "card": make_loop("D", "full"),
    }
    n_loop = loops["hook"].shape[1]
    bar_n = n_loop // 4
    out = np.zeros((2, N))
    segs = TL["segments"]

    def kind_at(t):
        for s in segs:
            if s["start"] <= t < s["end"]:
                if s["type"] == "section":
                    return "secB" if s["accent"] % 2 else "secD"
                return s["type"]
        return "end"

    nb = N // bar_n + 1
    xf = int(0.03 * SR)
    for b in range(nb):
        k = kind_at(b * BAR)
        src = loops[k]
        i = b % 4
        seg = src[:, i * bar_n:(i + 1) * bar_n].copy()
        s = b * bar_n
        e = min(N, s + bar_n)
        out[:, s:e] += seg[:, :e - s]
    # fade in/out
    fi = np.minimum(1, np.arange(N) / (1.0 * SR))
    fo = np.clip((TL["total"] * SR - np.arange(N)) / (3 * SR), 0, 1)
    out *= fi * fo
    out /= np.max(np.abs(out)) + 1e-9
    return out


# ------------------------------------------------------------------ sfx
def noise(d):
    return rng.standard_normal(int(d * SR))


def sfx_whoosh(d=0.8, rev=False):
    t = tt(d)
    x = noise(d)
    # sweep a band-pass by mixing filtered bands with moving weights
    lo, hi = lp(x, 900), bp(x, 1500, 7000)
    w = t / d
    if rev:
        w = 1 - w
    y = lo * (1 - w) + hi * w
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return y * env * 0.9


def sfx_riser(d=3.2):
    t = tt(d)
    f = 200 + 1400 * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    y = bp(noise(d), 800, 8000) * 0.6 + tone
    return y * (t / d) ** 2


def sfx_impact(soft=False):
    d = 1.6 if not soft else 0.9
    t = tt(d)
    f = 40 + 80 * np.exp(-t * 12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (2.5 if not soft else 5))
    click = lp(noise(d), 3000) * np.exp(-t * 30) * 0.6
    return (boom + click) * (1.0 if not soft else 0.55)


def sfx_pop():
    t = tt(0.12)
    f = 500 + 900 * (t / 0.12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.6


def sfx_blip():
    t = tt(0.09)
    return np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 50) * 0.35


def sfx_glitch():
    d = 0.5
    x = noise(d)
    x = np.round(x * 3) / 3
    gate = (np.floor(tt(d) * 40) % 3 != 0).astype(float)
    tone = np.sign(np.sin(2 * np.pi * 180 * tt(d)))
    return bp(x * 0.5 + tone * 0.3, 300, 6000) * gate * np.exp(-tt(d) * 3) * 0.8


def sfx_chime():
    t = tt(2.5)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, a, dcy in
            [(880, 0.5, 2), (1320, 0.3, 2.5), (1760, 0.2, 3), (2640, 0.1, 4)])
    return y * 0.6


def sfx_key():
    t = tt(0.035)
    return hp(noise(0.035), 2000) * np.exp(-t * 160) * 0.35


SFX = {"whoosh": lambda: sfx_whoosh(), "whoosh_rev": lambda: sfx_whoosh(0.7, True), "riser": sfx_riser,
       "impact": sfx_impact, "impact_soft": lambda: sfx_impact(True), "pop": sfx_pop, "glitch": sfx_glitch,
       "chime": sfx_chime, "blip": sfx_blip}


def typing_events():
    """Key clicks that match the typewriter animations in inserts 3, 4 and 6."""
    ev = []
    L = TL["lines"]
    for s in TL["segments"]:
        if s["type"] != "insert":
            continue
        li = s["lines"]
        spans = []
        if s["num"] == 3:
            spans = [(L[li[1]]["start"], 2.6)]
        elif s["num"] == 4:
            spans = [(L[li[k]]["start"], 2.2) for k in range(1, 6)]
        elif s["num"] == 6:
            spans = [(L[li[1]]["start"], 2.4)]
        for st, d in spans:
            t = st
            while t < st + d:
                ev.append(t)
                t += 0.06 + rng.random() * 0.07
        for k in li[1:]:
            ev_b = L[k]["start"]
            TL["sfx"].append({"t": ev_b, "kind": "blip"})
    return ev


def build_sfx():
    out = np.zeros(N)
    keys = typing_events()
    for e in TL["sfx"]:
        x = SFX[e["kind"]]()
        add(out, x * 0.5, max(0, e["t"]))
    for t in keys:
        add(out, sfx_key() * (0.7 + 0.6 * rng.random()), t)
    return out


def main():
    vo = build_voice().astype(np.float64)
    music = build_music()
    fx = build_sfx()
    # ducking envelope from voice activity
    act = np.abs(vo) > 0.01
    k = int(0.02 * SR)
    blocks = act[:len(act) // k * k].reshape(-1, k).any(axis=1).astype(float)
    # smooth: hold 0.3 s, attack/release
    sm = np.zeros_like(blocks)
    v = 0.0
    hold = 0
    for i, b in enumerate(blocks):
        if b:
            hold = 15
        target = 1.0 if hold > 0 else 0.0
        hold -= 1
        v += (target - v) * (0.35 if target > v else 0.06)
        sm[i] = v
    duck = np.repeat(sm, k)
    duck = np.pad(duck, (0, N - len(duck)), constant_values=0)
    mgain = 0.30 - 0.19 * duck
    mix_l = vo + music[0] * mgain + fx * 0.9
    mix_r = vo + music[1] * mgain + fx * 0.9
    mix = np.stack([mix_l, mix_r])
    mix = np.tanh(mix * 1.1) / 1.1
    mix *= 0.89 / np.max(np.abs(mix))
    n = int(round(TL["total"] * SR))
    mix = mix[:, :n]
    pcm = (mix.T * 32767).astype(np.int16)
    w = wave.open("audio/mix.wav", "wb")
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
    w.close()
    # per-frame voice envelope for the on-screen voice bars
    hop = SR // FPS
    nf = n // hop
    e = np.sqrt(np.mean(vo[:nf * hop].reshape(nf, hop) ** 2, axis=1))
    e = np.clip(e / (np.percentile(e[e > 0.005], 95) + 1e-9), 0, 1)
    np.save("audio/env.npy", e.astype(np.float32))
    # separate stems for reference
    for name, x in [("music", music * 0.3), ("voice", vo)]:
        xx = x if x.ndim == 2 else np.stack([x, x])
        p = (np.clip(xx[:, :n].T, -1, 1) * 32767).astype(np.int16)
        ww = wave.open("audio/%s.wav" % name, "wb")
        ww.setnchannels(2); ww.setsampwidth(2); ww.setframerate(SR); ww.writeframes(p.tobytes()); ww.close()
    print("mix done", n / SR)


if __name__ == "__main__":
    main()

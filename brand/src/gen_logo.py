# -*- coding: utf-8 -*-
"""Generate AEDostepni logo SVGs. Text is converted to outlines (Manrope, SIL OFL)."""
import os, io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
LOGO = os.path.join(BRAND, "logo")
FONTS = os.path.join(HERE, "fonts")

GREEN, NAVY, RED, MINT, WHITE = "#007A3D", "#0B2A3C", "#D7262E", "#E6F4EC", "#FFFFFF"

# ---------------------------------------------------------------- fonts
_fonts = {}
def font(wght):
    if wght in _fonts:
        return _fonts[wght]
    path = os.path.join(FONTS, f"Manrope-{wght}.ttf")
    if not os.path.exists(path):
        vf = TTFont(os.path.join(FONTS, "Manrope-VF.ttf"))
        st = instancer.instantiateVariableFont(vf, {"wght": wght})
        st.save(path)
    tt = TTFont(path)
    data = open(path, "rb").read()
    hbf = hb.Font(hb.Face(data))
    _fonts[wght] = (tt, hbf)
    return _fonts[wght]

def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s

def text_path(text, wght, size, x, y, tracking=0.0):
    """Return (svg path d, advance width) for text with baseline at y."""
    tt, hbf = font(wght)
    upem = tt["head"].unitsPerEm
    s = size / upem
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbf, buf, {"kern": True, "liga": True})
    gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
    pen = SVGPathPen(gs, ntos=fmt)
    pos = 0.0
    n = len(buf.glyph_infos)
    for i, (info, p) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        tp = TransformPen(pen, (s, 0, 0, -s, x + (pos + p.x_offset) * s, y - p.y_offset * s))
        gs[name].draw(tp)
        pos += p.x_advance + (tracking * upem if i < n - 1 else 0)
    return pen.getCommands(), pos * s

def cap_height(wght):
    tt, _ = font(wght)
    return tt["OS/2"].sCapHeight / tt["head"].unitsPerEm

# ---------------------------------------------------------------- symbol
# Symbol drawn in a 100 x 118 box. Pin = circle r44 centred (50,44) + tangents to a tip at (50,118).
PIN = "M14.63 70.17A44 44 0 1 1 85.37 70.17L52.97 113.98Q50 118 47.03 113.98Z"
HEART_C = (50, 46)
HEART_K = 1.12
HEART_REL = ("M0 21C-6 16-25 2-25-9C-25-17.5-18.5-23-12-23C-6-23-2-19.5 0-15.5"
             "C2-19.5 6-23 12-23C18.5-23 25-17.5 25-9C25 2 6 16 0 21Z")
# ECG / pulse line in heart coordinates: baseline, small P wave, then a lightning-bolt spike.
PULSE_REL = "M-19.5-3H-11L-7.5-9.5L-4-3H-1.5L2.5-14.5L5.5 5L9.5-3H19.5"
PULSE_W = 5.0
SYM_W, SYM_H = 100, 118
# heart height in symbol units (= clear-space unit x)
HEART_H = 44 * HEART_K

def heart_tf():
    return f"translate({HEART_C[0]} {HEART_C[1]}) scale({HEART_K})"

_MID = 0
def symbol_group(pin, heart_fill, pulse, ox=0, oy=0, k=1.0):
    """pin colour; heart_fill None => transparent cut-out; pulse colour."""
    tf = f"translate({fmt(ox)} {fmt(oy)}) scale({fmt(k)})"
    if heart_fill is None:
        # true cut-out via mask so it works on any background
        global _MID
        _MID += 1
        mid = f"aedcut{_MID}"
        return (f'<g transform="{tf}"><mask id="{mid}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="142">'
                f'<rect x="-10" y="-10" width="120" height="142" fill="#fff"/>'
                f'<path transform="{heart_tf()}" d="{HEART_REL}" fill="#000"/></mask>'
                f'<path d="{PIN}" fill="{pin}" mask="url(#{mid})"/>'
                f'<path transform="{heart_tf()}" d="{PULSE_REL}" fill="none" stroke="{pulse}" stroke-width="{PULSE_W}" '
                f'stroke-linecap="round" stroke-linejoin="round"/></g>')
    return (f'<g transform="{tf}"><path d="{PIN}" fill="{pin}"/>'
            f'<path transform="{heart_tf()}" d="{HEART_REL}" fill="{heart_fill}"/>'
            f'<path transform="{heart_tf()}" d="{PULSE_REL}" fill="none" stroke="{pulse}" stroke-width="{PULSE_W}" '
            f'stroke-linecap="round" stroke-linejoin="round"/></g>')

SCHEMES = {
    # name: (pin, heart, pulse, AED, ostepni, tagline1, tagline2)
    "color": (GREEN, WHITE, RED, GREEN, NAVY, NAVY, RED),
    "white": (WHITE, None, WHITE, WHITE, WHITE, WHITE, WHITE),
    "mono":  (NAVY, None, NAVY, NAVY, NAVY, NAVY, NAVY),
}

WM_W = 800      # weight of wordmark
TAG_W = 600
CAP = 46        # wordmark cap height in symbol units

def wordmark(x, baseline, scheme, size=None):
    s = SCHEMES[scheme]
    size = size or CAP / cap_height(WM_W)
    d1, w1 = text_path("AED", WM_W, size, x, baseline, tracking=-0.01)
    d2, w2 = text_path("ostępni", WM_W, size, x + w1 - size * 0.01, baseline, tracking=-0.01)
    svg = f'<path d="{d1}" fill="{s[3]}"/><path d="{d2}" fill="{s[4]}"/>'
    return svg, w1 + w2 - size * 0.01

def tagline(x, baseline, scheme, size):
    s = SCHEMES[scheme]
    d1, w1 = text_path("Udostępnij dane. ", TAG_W, size, x, baseline)
    d2, w2 = text_path("Daj komuś czas.", TAG_W, size, x + w1, baseline)
    return f'<path d="{d1}" fill="{s[5]}"/><path d="{d2}" fill="{s[6]}"/>', w1 + w2

def measure_wordmark():
    size = CAP / cap_height(WM_W)
    _, w = wordmark(0, 0, "color", size)
    return w

def svg_doc(w, h, body, title, pad=0):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(-pad)} {fmt(-pad)} {fmt(w + 2*pad)} {fmt(h + 2*pad)}" '
            f'width="{fmt(w + 2*pad)}" height="{fmt(h + 2*pad)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

def horizontal(scheme, with_tag=False):
    p = SCHEMES[scheme]
    gap = 24
    x0 = SYM_W + gap
    base = 44 + CAP / 2        # wordmark cap centred on pin circle centre
    wm, ww = wordmark(x0, base, scheme)
    body = symbol_group(p[0], p[1], p[2]) + wm
    width = x0 + ww
    if with_tag:
        tsize = 17.5
        tg, tw = tagline(x0 + 1.5, base + 34, scheme, tsize)
        body += tg
        width = max(width, x0 + tw)
    return svg_doc(width, SYM_H, body, "AEDostępni – Udostępnij dane. Daj komuś czas.")

def vertical(scheme, with_tag=True):
    p = SCHEMES[scheme]
    ww = measure_wordmark()
    tsize = 17.5
    _, tw = tagline(0, 0, scheme, tsize)
    W = max(ww, tw)
    k = 1.0
    sym_x = (W - SYM_W) / 2
    body = symbol_group(p[0], p[1], p[2], sym_x, 0)
    base = SYM_H + 20 + CAP
    wm, _ = wordmark((W - ww) / 2, base, scheme)
    body += wm
    H = base + 10
    if with_tag:
        tg, _ = tagline((W - tw) / 2, base + 34, scheme, tsize)
        body += tg
        H = base + 38
    return svg_doc(W, H, body, "AEDostępni – Udostępnij dane. Daj komuś czas.")

def symbol(scheme, pad=0):
    p = SCHEMES[scheme]
    return svg_doc(SYM_W, SYM_H, symbol_group(p[0], p[1], p[2]), "AEDostępni – znak", pad)

def favicon():
    # square, symbol centred, scaled to fill height
    k = 30 / SYM_H
    ox = (32 - SYM_W * k) / 2
    p = SCHEMES["color"]
    body = symbol_group(p[0], p[1], p[2], ox, 1, k * 0.97)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><title>AEDostępni</title>{body}</svg>\n'

def app_icon(kind):
    """kind: 'full' = green rounded square with white symbol; 'fg' = symbol within central 66% safe zone."""
    S = 1024
    if kind == "full":
        h = S * 0.62; k = h / SYM_H
        ox = (S - SYM_W * k) / 2; oy = (S - h) / 2
        body = (f'<rect width="{S}" height="{S}" rx="{S*0.2237}" fill="{GREEN}"/>'
                + symbol_group(WHITE, None, WHITE, ox, oy, k))
    else:
        safe = S * 0.66
        h = safe * 0.92; k = h / SYM_H
        ox = (S - SYM_W * k) / 2; oy = (S - h) / 2
        body = symbol_group(GREEN, WHITE, RED, ox, oy, k)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">{body}</svg>\n'

def write(name, content, folder=LOGO):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n' + content)

if __name__ == "__main__":
    write("aedostepni-logo.svg", horizontal("color"))
    write("aedostepni-logo-slogan.svg", horizontal("color", True))
    write("aedostepni-logo-vertical.svg", vertical("color"))
    write("aedostepni-symbol.svg", symbol("color"))
    write("aedostepni-logo-white.svg", horizontal("white"))
    write("aedostepni-logo-white-slogan.svg", horizontal("white", True))
    write("aedostepni-logo-vertical-white.svg", vertical("white"))
    write("aedostepni-symbol-white.svg", symbol("white"))
    write("aedostepni-logo-mono.svg", horizontal("mono"))
    write("aedostepni-logo-vertical-mono.svg", vertical("mono"))
    write("aedostepni-symbol-mono.svg", symbol("mono"))
    ai = os.path.join(BRAND, "app-icon")
    write("favicon.svg", favicon(), ai)
    write("icon-1024.svg", app_icon("full"), ai)
    write("icon-foreground-1024.svg", app_icon("fg"), ai)
    print("ok, cap ratio", cap_height(WM_W), "wordmark w", measure_wordmark())

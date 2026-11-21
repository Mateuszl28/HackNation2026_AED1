# -*- coding: utf-8 -*-
"""Render SVGs to PNG/JPG and HTML to PDF with headless Edge."""
import os, sys, subprocess, re, tempfile, shutil
from PIL import Image

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
TMP = os.path.join(HERE, "_render")
os.makedirs(TMP, exist_ok=True)
PROFILE = os.path.join(TMP, "edge-profile")

def edge(args):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
           f"--user-data-dir={PROFILE}"] + args
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)

def svg_size(svg):
    m = re.search(r'viewBox="([-\d. ]+)"', svg)
    x, y, w, h = map(float, m.group(1).split())
    return w, h

def render_svg(svg_file, out_png, width=None, height=None, bg=None, pad=0.0):
    out_png = os.path.abspath(out_png)
    svg = open(svg_file, encoding="utf-8").read()
    svg = re.sub(r"^<\?xml[^>]*>\s*", "", svg)
    vw, vh = svg_size(svg)
    if width and not height:
        height = round(width * vh / vw)
    if height and not width:
        width = round(height * vw / vh)
    background = bg or "transparent"
    inner_w, inner_h = width * (1 - 2 * pad), height * (1 - 2 * pad)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;background:{background}}}
.w{{position:absolute;left:{width*pad}px;top:{height*pad}px;width:{inner_w}px;height:{inner_h}px}}
.w svg{{width:100%;height:100%;display:block}}</style></head><body><div class="w">{svg}</div></body></html>"""
    h = os.path.join(TMP, "r_" + os.path.basename(out_png) + ".html")
    open(h, "w", encoding="utf-8").write(html)
    bgarg = "--default-background-color=00000000" if not bg else "--default-background-color=FFFFFFFF"
    edge([f"--screenshot={out_png}", f"--window-size={width},{height}", bgarg, "file:///" + h.replace("\\", "/")])
    im = Image.open(out_png)
    if im.size != (width, height):
        print("WARN size", out_png, im.size, (width, height))
    return out_png

def to_jpg(png, jpg):
    im = Image.open(png).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(jpg, quality=95, subsampling=0)

def svg_to_pdf(svg_file, out_pdf, mm_width=200, pad_mm=10):
    svg = open(svg_file, encoding="utf-8").read()
    svg = re.sub(r"^<\?xml[^>]*>\s*", "", svg)
    vw, vh = svg_size(svg)
    mm_h = mm_width * vh / vw
    pw, ph = mm_width + 2 * pad_mm, mm_h + 2 * pad_mm
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page{{size:{pw:.2f}mm {ph:.2f}mm;margin:0}}html,body{{margin:0;padding:0}}
.w{{padding:{pad_mm}mm;width:{mm_width}mm;height:{mm_h:.2f}mm}}.w svg{{width:100%;height:100%;display:block}}
</style></head><body><div class="w">{svg}</div></body></html>"""
    h = os.path.join(TMP, "p_" + os.path.basename(out_pdf) + ".html")
    open(h, "w", encoding="utf-8").write(html)
    html_to_pdf(h, out_pdf)

def html_to_pdf(html_file, out_pdf):
    out_pdf = os.path.abspath(out_pdf)
    edge(["--no-pdf-header-footer", "--print-to-pdf-no-header", f"--print-to-pdf={out_pdf}",
          "file:///" + os.path.abspath(html_file).replace("\\", "/")])

if __name__ == "__main__":
    L = os.path.join(BRAND, "logo"); A = os.path.join(BRAND, "app-icon")
    j = lambda *p: os.path.join(*p)
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "logo"):
        for name in ["aedostepni-logo", "aedostepni-logo-slogan", "aedostepni-logo-white", "aedostepni-logo-mono"]:
            render_svg(j(L, name + ".svg"), j(L, name + ".png"), width=2000)
        for name in ["aedostepni-logo-vertical", "aedostepni-logo-vertical-white", "aedostepni-logo-vertical-mono"]:
            render_svg(j(L, name + ".svg"), j(L, name + ".png"), width=1200)
        for name in ["aedostepni-symbol", "aedostepni-symbol-white", "aedostepni-symbol-mono"]:
            render_svg(j(L, name + ".svg"), j(L, name + ".png"), 1024, 1024, pad=0.06)
        # JPG on white (primary + symbol + vertical + mono)
        for name in ["aedostepni-logo", "aedostepni-logo-slogan", "aedostepni-logo-vertical", "aedostepni-symbol", "aedostepni-logo-mono"]:
            to_jpg(j(L, name + ".png"), j(L, name + ".jpg"))
        svg_to_pdf(j(L, "aedostepni-logo.svg"), j(L, "aedostepni-logo.pdf"), 200, 12)
        svg_to_pdf(j(L, "aedostepni-logo-slogan.svg"), j(L, "aedostepni-logo-slogan.pdf"), 200, 12)
        svg_to_pdf(j(L, "aedostepni-symbol.svg"), j(L, "aedostepni-symbol.pdf"), 80, 10)
    if what in ("all", "icon"):
        render_svg(j(A, "icon-1024.svg"), j(A, "icon-1024.png"), 1024, 1024)
        render_svg(j(A, "icon-foreground-1024.svg"), j(A, "icon-foreground-1024.png"), 1024, 1024)
        for s in (512, 192, 180, 48, 32, 16):
            Image.open(j(A, "icon-1024.png")).resize((s, s), Image.LANCZOS).save(j(A, f"icon-{s}.png"))
        render_svg(j(A, "favicon.svg"), j(A, "favicon-256.png"), 256, 256)
        fav = Image.open(j(A, "favicon-256.png"))
        fav.save(j(A, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    if what in ("all", "book"):
        html_to_pdf(j(HERE, "ksiega-znaku.html"), j(BRAND, "ksiega-znaku.pdf"))
    print("done")

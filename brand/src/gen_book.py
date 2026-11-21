# -*- coding: utf-8 -*-
"""Generate ksiega-znaku.html (brand book, A4 landscape) with inline SVG."""
import os, re
import gen_logo as G
from gen_logo import GREEN, NAVY, RED, MINT, WHITE

HERE = os.path.dirname(os.path.abspath(__file__))

def strip(svg):
    return re.sub(r"<title>.*?</title>", "", svg)

def H(scheme="color", tag=False):
    return strip(G.horizontal(scheme, tag))

def V(scheme="color", tag=True):
    return strip(G.vertical(scheme, tag))

def S(scheme="color"):
    return strip(G.symbol(scheme))

def sym_custom(pin, heart, pulse):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 118">{G.symbol_group(pin, heart, pulse)}</svg>'

def horiz_custom(pin, heart, pulse, c1, c2, wm_scale=1.0, wm_dy=0):
    gap = 24; x0 = G.SYM_W + gap
    size = G.CAP / G.cap_height(G.WM_W) * wm_scale
    base = 44 + G.CAP * wm_scale / 2 + wm_dy
    d1, w1 = G.text_path("AED", G.WM_W, size, x0, base, -0.01)
    d2, w2 = G.text_path("ostępni", G.WM_W, size, x0 + w1 - size * .01, base, -0.01)
    W = x0 + w1 + w2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} 118">'
            f'{G.symbol_group(pin, heart, pulse)}<path d="{d1}" fill="{c1}"/><path d="{d2}" fill="{c2}"/></svg>')

XU = G.HEART_H  # clear-space unit x in symbol units (heart height)
HW = 124 + G.measure_wordmark()  # horizontal logo width in units

# ------------------------------------------------------------------ construction drawing
def construction_svg():
    hk = G.HEART_K; cx, cy = G.HEART_C
    top = cy - 23 * hk; bot = cy + 21 * hk
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -16 192 150">')
    # grid
    for gx in range(-40, 150, 10):
        o.append(f'<line x1="{gx}" y1="-16" x2="{gx}" y2="134" stroke="#cfe3d7" stroke-width=".25"/>')
    for gy in range(-10, 134, 10):
        o.append(f'<line x1="-46" y1="{gy}" x2="146" y2="{gy}" stroke="#cfe3d7" stroke-width=".25"/>')
    o.append(f'<g opacity=".92">{G.symbol_group(GREEN, WHITE, RED)}</g>')
    d = 'stroke="#0B2A3C" stroke-width=".45" fill="none"'
    o.append(f'<circle cx="50" cy="44" r="44" {d} stroke-dasharray="2 1.5"/>')
    o.append(f'<circle cx="50" cy="44" r="1.2" fill="{NAVY}"/>')
    o.append(f'<line x1="50" y1="44" x2="{50+44*0.7071:.2f}" y2="{44-44*0.7071:.2f}" {d}/>')
    o.append(f'<text x="62" y="15" font-size="7" fill="#fff" font-family="Manrope" font-weight="800">R</text>')
    # tangents
    o.append(f'<line x1="50" y1="118" x2="{50-35.37*1.35:.2f}" y2="{118-47.83*1.35:.2f}" {d} stroke-dasharray="1 1"/>')
    o.append(f'<line x1="50" y1="118" x2="{50+35.37*1.35:.2f}" y2="{118-47.83*1.35:.2f}" {d} stroke-dasharray="1 1"/>')
    # horizontal guide lines
    for y, lab in ((0, "0"), (44, "środek okręgu"), (top, ""), (bot, ""), (118, "wierzchołek")):
        o.append(f'<line x1="-40" y1="{y:.2f}" x2="140" y2="{y:.2f}" stroke="{GREEN}" stroke-width=".3" stroke-dasharray="3 2"/>')
    # x dimension (heart height) on the right
    o.append(f'<line x1="112" y1="{top:.2f}" x2="112" y2="{bot:.2f}" stroke="{RED}" stroke-width=".6"/>')
    for y in (top, bot):
        o.append(f'<line x1="109" y1="{y:.2f}" x2="115" y2="{y:.2f}" stroke="{RED}" stroke-width=".6"/>')
    o.append(f'<text x="118" y="{(top+bot)/2+2:.2f}" font-size="7" fill="{RED}" font-family="Manrope" font-weight="800">x</text>')
    # pin height dimension on left
    o.append(f'<line x1="-12" y1="0" x2="-12" y2="118" stroke="{NAVY}" stroke-width=".45"/>')
    for y in (0, 118):
        o.append(f'<line x1="-15" y1="{y}" x2="-9" y2="{y}" stroke="{NAVY}" stroke-width=".45"/>')
    o.append(f'<text x="-15" y="61" font-size="5" fill="{NAVY}" font-family="Manrope" font-weight="700" text-anchor="end">2,4x</text>')
    # width
    o.append(f'<line x1="6" y1="128" x2="94" y2="128" stroke="{NAVY}" stroke-width=".45"/>')
    for x in (6, 94):
        o.append(f'<line x1="{x}" y1="125" x2="{x}" y2="131" stroke="{NAVY}" stroke-width=".45"/>')
    o.append(f'<text x="50" y="125" font-size="5" fill="{NAVY}" font-family="Manrope" font-weight="700" text-anchor="middle">2R ≈ 1,8x</text>')
    o.append('</svg>')
    return "".join(o)

def wordmark_construction_svg():
    W = HW
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 {W+112:.1f} 146">']
    o.append(f'<rect x="100" y="0" width="24" height="118" fill="{RED}" opacity=".13"/>')
    o.append(G.symbol_group(GREEN, WHITE, RED))
    wm, ww = G.wordmark(124, 44 + G.CAP / 2, "color")
    o.append(wm)
    base = 44 + G.CAP / 2; capt = base - G.CAP
    for y, c, lab in ((capt, GREEN, "wersaliki"), (44, RED, "środek okręgu"), (base, GREEN, "linia bazowa")):
        o.append(f'<line x1="-4" y1="{y:.2f}" x2="{W+8:.1f}" y2="{y:.2f}" stroke="{c}" stroke-width=".7" stroke-dasharray="3 2"/>')
        o.append(f'<text x="{W+11:.1f}" y="{y+4:.1f}" font-size="11" font-family="Manrope" font-weight="700" fill="{c}">{lab}</text>')
    o.append(f'<text x="112" y="136" font-size="14" font-family="Manrope" font-weight="800" fill="{RED}" text-anchor="middle">½x</text>')
    o.append('</svg>')
    return "".join(o)

def clearspace_sym_svg():
    x = XU
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-x-4:.1f} {-x-4:.1f} {100+2*x+8:.1f} {118+2*x+8:.1f}">']
    o.append(f'<rect x="{-x:.1f}" y="{-x:.1f}" width="{100+2*x:.1f}" height="{118+2*x:.1f}" fill="{MINT}" stroke="{GREEN}" stroke-width="1" stroke-dasharray="5 4"/>')
    o.append(f'<rect x="0" y="0" width="100" height="118" fill="#fff" stroke="{NAVY}" stroke-width=".6" stroke-dasharray="2 2"/>')
    o.append(G.symbol_group(GREEN, WHITE, RED))
    o.append('</svg>')
    return "".join(o)

def clearspace_svg():
    x = XU
    W = HW
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-x-8:.1f} {-x-8:.1f} {W+2*x+16:.1f} {118+2*x+16:.1f}">']
    o.append(f'<rect x="{-x:.1f}" y="{-x:.1f}" width="{W+2*x:.1f}" height="{118+2*x:.1f}" fill="{MINT}" stroke="{GREEN}" stroke-width="1" stroke-dasharray="5 4"/>')
    o.append(f'<rect x="0" y="0" width="{W:.1f}" height="118" fill="#fff" stroke="{NAVY}" stroke-width=".6" stroke-dasharray="2 2"/>')
    o.append(H("color").replace("<svg ", f'<svg x="0" y="0" width="{W:.1f}" height="118" ', 1))
    # x markers: small hearts
    heart = G.HEART_REL
    def xh(px, py):
        k = x / 44
        return (f'<g transform="translate({px:.1f} {py:.1f}) scale({k:.3f})"><path d="{heart}" transform="translate(0 1)" fill="{RED}" opacity=".85"/></g>'
                f'<text x="{px:.1f}" y="{py+5:.1f}" font-size="18" font-family="Manrope" font-weight="800" fill="#fff" text-anchor="middle">x</text>')
    o.append(xh(-x/2, 59)); o.append(xh(W + x/2, 59)); o.append(xh(W/2, -x/2)); o.append(xh(W/2, 118 + x/2))
    o.append('</svg>')
    return "".join(o)

# ------------------------------------------------------------------ applications
def sticker_html():
    return f'''<div class="sticker">
  <div class="st-sym">{S("white")}</div>
  <div class="st-big">Tu jest AED</div>
  <div class="st-sub">defibrylator dostępny dla każdego</div>
  <div class="st-line"></div>
  <div class="st-data">Lokalizacja tego urządzenia jest w&nbsp;otwartych danych<br><b>dane.gov.pl</b></div>
  <div class="st-tag">#AEDostępni</div>
</div>'''

def social_html():
    return f'''<div class="social">
  <div class="so-top">{H("color")}</div>
  <div class="so-num">−10%</div>
  <div class="so-txt">o tyle mogą spadać szanse przeżycia z&nbsp;każdą minutą bez defibrylacji przy nagłym zatrzymaniu krążenia.</div>
  <div class="so-cta">Masz AED? <b>Udostępnij jego lokalizację na dane.gov.pl</b> – niech pokaże go każda mapa.</div>
  <div class="so-foot"><span>Udostępnij dane. <i>Daj komuś czas.</i></span><span class="so-hash">#AEDostępni</span></div>
</div>'''

def splash_html():
    return f'''<div class="phone"><div class="screen">
  <div class="notch"></div>
  <div class="sp-logo">{V("white", False)}</div>
  <div class="sp-tag">Udostępnij dane.<br>Daj komuś czas.</div>
  <div class="sp-load"><span></span></div>
  <div class="sp-foot">Dane: dane.gov.pl</div>
</div></div>'''

# ------------------------------------------------------------------ misuse
def misuse_cells():
    base = H("color")
    cells = []
    cells.append(("Nie rozciągaj ani nie ściskaj znaku",
                  f'<div class="mu-stretch">{base.replace("<svg ", "<svg preserveAspectRatio=\"none\" ", 1)}</div>'))
    cells.append(("Nie obracaj znaku", f'<div style="transform:rotate(-14deg);width:80%">{base}</div>'))
    cells.append(("Nie zmieniaj kolorów", horiz_custom("#E67E22", "#FFFFFF", "#6C3483", "#2E86C1", "#E67E22")))
    cells.append(("Nie dodawaj cieni, poświat ani gradientów",
                  f'<div style="filter:drop-shadow(3px 4px 2px rgba(0,0,0,.55)) saturate(1.6) blur(.2px)">{base}</div>'))
    cells.append(("Nie umieszczaj na tle bez kontrastu",
                  f'<div class="mu-busy">{base}</div>'))
    cells.append(("Nie zmieniaj proporcji sygnetu i logotypu",
                  horiz_custom(GREEN, WHITE, RED, GREEN, NAVY, wm_scale=0.55, wm_dy=26)))
    cells.append(("Nie stosuj samego konturu",
                  f'<div class="mu-outline">{base}</div>'))
    cells.append(("Nie zmieniaj kroju pisma",
                  f'<svg viewBox="0 0 485 118" xmlns="http://www.w3.org/2000/svg">{G.symbol_group(GREEN, WHITE, RED)}'
                  f'<text x="124" y="80" font-family="Georgia, Times New Roman, serif" font-style="italic" font-size="66">'
                  f'<tspan fill="{GREEN}">AED</tspan><tspan fill="{NAVY}">ostępni</tspan></text></svg>'))
    return cells

# ------------------------------------------------------------------ pages
def page(n, kicker, title, body, cls=""):
    return f'''<section class="page {cls}">
  <header><span class="num">{n:02d}</span><span class="kick">{kicker}</span></header>
  <h1>{title}</h1>
  {body}
  <footer><span class="fsym">{S("color")}</span><span>AEDostępni · Księga znaku · v1.0</span><span class="pg">{n}</span></footer>
</section>'''

def build():
    pages = []
    # 1 cover
    pages.append(f'''<section class="page cover">
  <div class="cv-logo">{V("white", False)}</div>
  <div class="cv-right">
    <div class="cv-kick">Księga znaku</div>
    <div class="cv-title">Udostępnij dane.<br><span>Daj komuś czas.</span></div>
    <div class="cv-meta">Kampania na rzecz publikacji danych o&nbsp;lokalizacji defibrylatorów AED w&nbsp;portalu <b>dane.gov.pl</b></div>
  </div>
  <div class="cv-foot">HackNation 2026 · Misja AED – Dane na ratunek · wersja 1.0 · listopad 2026</div>
  <div class="cv-pulse"><svg viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 70H520L545 40L570 70H600L630 10L650 105L680 70H1200" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg></div>
</section>''')
    # 2 concept
    pages.append(page(2, "Koncepcja", "Lokalizacja + życie + dane", f'''
<div class="cols">
  <div class="col-text">
    <p class="lead">Nazwa <b>AEDostępni</b> łączy skrót <b>AED</b> ze słowem <b>„dostępni”</b> i&nbsp;przywołuje wezwanie <b>„udostępnij”</b>. Mówi wprost, o&nbsp;co prosimy właścicieli defibrylatorów: żeby ich urządzenia były dostępne nie tylko fizycznie, ale także w&nbsp;danych.</p>
    <p>Sygnet to pinezka z&nbsp;mapy – symbol lokalizacji – w&nbsp;której wycięto serce, znak życia. Przez serce biegnie linia EKG zakończona impulsem przypominającym wyładowanie: to moment, w&nbsp;którym AED ratuje człowieka, i&nbsp;zarazem sygnał danych płynących do&nbsp;portalu dane.gov.pl.</p>
    <p>Zieleń nawiązuje do oznakowania ratunkowego i&nbsp;bezpieczeństwa, czerwień pulsu – do&nbsp;serca i&nbsp;pilności, a&nbsp;granat – do rzetelności danych publicznych. Hasło <b>„Udostępnij dane. Daj komuś czas.”</b> przypomina, że w&nbsp;nagłym zatrzymaniu krążenia każda minuta zmniejsza szanse przeżycia, a&nbsp;opublikowana lokalizacja AED skraca drogę do&nbsp;pomocy.</p>
  </div>
  <div class="col-vis">
    <div class="eq">
      <div class="eq-i"><svg viewBox="0 0 100 118"><path d="{G.PIN}" fill="{GREEN}"/></svg><span>lokalizacja</span></div>
      <div class="eq-op">+</div>
      <div class="eq-i"><svg viewBox="-28 -26 56 50"><path d="{G.HEART_REL}" fill="{RED}"/></svg><span>życie</span></div>
      <div class="eq-op">+</div>
      <div class="eq-i"><svg viewBox="-24 -20 48 30"><path d="{G.PULSE_REL}" fill="none" stroke="{NAVY}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>impuls / dane</span></div>
    </div>
    <div class="eq-res">{S("color")}</div>
  </div>
</div>'''))
    # 3 construction
    pages.append(page(3, "Konstrukcja znaku", "Geometria sygnetu i logotypu", f'''
<div class="cols">
  <div class="constr">{construction_svg()}</div>
  <div class="col-text small">
    <p>Sygnet zbudowano na okręgu o&nbsp;promieniu <b>R</b>, z&nbsp;którego dwie styczne zbiegają się w&nbsp;zaokrąglonym wierzchołku pinezki. Serce jest wycięciem w&nbsp;korpusie pinezki (w&nbsp;wersji podstawowej wypełnionym bielą), a&nbsp;jego środek leży nieco poniżej środka okręgu, co optycznie równoważy ciężar wierzchołka.</p>
    <p>Jednostką modułową całego systemu jest <b class="red">x</b> – wysokość serca. Wysokość sygnetu to ok.&nbsp;2,4x, szerokość ok.&nbsp;1,8x.</p>
    <div class="wmc">{wordmark_construction_svg()}</div>
    <p>Logotyp złożono krojem <b>Manrope ExtraBold</b> i&nbsp;zamieniono na krzywe. Wysokość wersalików odpowiada ok.&nbsp;0,93x, a&nbsp;ich środek leży na wysokości środka okręgu sygnetu. Odstęp między sygnetem a&nbsp;logotypem wynosi <b class="red">½x</b>.</p>
  </div>
</div>''', "p-constr"))
    # 4 versions
    pages.append(page(4, "Wersje znaku", "Wersje i warianty", f'''
<div class="vgrid">
  <div class="v v-main"><div class="vb">{H("color")}</div><div class="cap"><b>Wersja podstawowa – pozioma.</b> Stosuj zawsze, gdy to możliwe, na białym lub miętowym tle.</div></div>
  <div class="v v-vert"><div class="vb">{V("color")}</div><div class="cap"><b>Wersja pionowa</b> ze sloganem – plakaty, formaty wąskie.</div></div>
  <div class="v v-sym"><div class="vb">{S("color")}</div><div class="cap"><b>Sygnet</b> – ikona aplikacji, favicon, awatar.</div></div>
  <div class="v v-slog"><div class="vb">{H("color", True)}</div><div class="cap"><b>Wersja pozioma ze sloganem</b> – materiały kampanii.</div></div>
  <div class="v v-mono"><div class="vb">{H("mono")}</div><div class="cap"><b>Wersja achromatyczna</b> – druk jednobarwny, grawer, faks.</div></div>
  <div class="v v-neg g"><div class="vb">{H("white")}</div><div class="cap"><b>Negatyw</b> na zieleni AED.</div></div>
  <div class="v v-neg n"><div class="vb">{H("white")}</div><div class="cap"><b>Negatyw</b> na granacie.</div></div>
</div>'''))
    # 5 colours
    sw = [
        ("AED Green", GREEN, "0 / 122 / 61", "ok. 100 / 0 / 90 / 35", "ok. 356 C", "kolor główny", True),
        ("Deep Navy", NAVY, "11 / 42 / 60", "ok. 88 / 60 / 40 / 62", "ok. 296 C", "tekst, logotyp", True),
        ("Pulse Red", RED, "215 / 38 / 46", "ok. 0 / 95 / 85 / 5", "ok. 1795 C", "akcent, puls", True),
        ("Mint", MINT, "230 / 244 / 236", "ok. 10 / 0 / 8 / 0", "ok. 9520 C", "tła, pola", False),
        ("Biel", WHITE, "255 / 255 / 255", "0 / 0 / 0 / 0", "– (papier)", "tła, negatyw", False),
    ]
    sws = "".join(f'''<div class="sw"><div class="chip{' light' if not dark else ''}" style="background:{h}"><span>{n}</span><small>{role}</small></div>
<table><tr><td>HEX</td><td>{h}</td></tr><tr><td>RGB</td><td>{rgb}</td></tr><tr><td>CMYK</td><td>{cmyk}</td></tr><tr><td>Pantone</td><td>{pms}</td></tr></table></div>''' for n, h, rgb, cmyk, pms, role, dark in sw)
    pages.append(page(5, "Kolorystyka", "Paleta barw", f'''
<div class="swatches">{sws}</div>
<div class="prop"><div style="flex:38;background:{GREEN}"></div><div style="flex:28;background:{WHITE};border:1px solid #d9e6de"></div><div style="flex:18;background:{NAVY}"></div><div style="flex:11;background:{MINT}"></div><div style="flex:5;background:{RED}"></div></div>
<div class="notes"><p><b>Proporcje:</b> zieleń prowadzi, biel i&nbsp;mięta dają oddech, granat niesie treść, czerwień jest wyłącznie akcentem (puls, wyróżnienia, wezwania do działania).</p>
<p><b>Dostępność (WCAG 2.1):</b> biel na AED Green – 5,45:1 (AA), biel na Deep Navy – 14,9:1 (AAA), Deep Navy na Mint – 13,1:1 (AAA), AED Green na Mint – 4,8:1 (AA). Wartości CMYK i&nbsp;Pantone oznaczone „ok.” są przybliżeniami – przed drukiem należy wykonać proof.</p></div>'''))
    # 6 typography
    pages.append(page(6, "Typografia", "Krój pisma", f'''
<div class="typo">
  <div class="t-spec">
    <div class="t-name">Manrope</div>
    <div class="t-meta">Krój główny · licencja SIL Open Font License · Google Fonts</div>
    <div class="t-big">Aa Ąą Ęę</div>
    <div class="t-chars">AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ<br>aąbcćdeęfghijklłmnńoóprsśtuwyzźż<br>0123456789 · , ; : ! ? – „ ” % #</div>
  </div>
  <div class="t-weights">
    <div style="font-weight:800">ExtraBold 800 – logotyp, nagłówki</div>
    <div style="font-weight:700">Bold 700 – wyróżnienia, przyciski</div>
    <div style="font-weight:600">SemiBold 600 – slogan, śródtytuły</div>
    <div style="font-weight:400">Regular 400 – tekst ciągły</div>
    <div class="t-sample">
      <div class="ts-h">Gdzie jest najbliższy AED?</div>
      <div class="ts-p">Właściciele defibrylatorów – szkoły, urzędy, firmy, galerie, dworce – mogą w&nbsp;kilka minut opublikować ich lokalizację w&nbsp;portalu dane.gov.pl. Dzięki temu każda aplikacja i&nbsp;mapa pokaże drogę do&nbsp;urządzenia.</div>
    </div>
    <div class="t-fb"><b>Krój zastępczy (systemowy):</b> <span style="font-family:'Segoe UI',Arial,sans-serif">Segoe UI, Arial, sans-serif – dokumenty biurowe i&nbsp;e-maile, gdy Manrope jest niedostępny. Zażółć gęślą jaźń.</span></div>
  </div>
</div>'''))
    # 7 clear space + min size
    hmm = 30; smm = 8
    pages.append(page(7, "Pole ochronne i minimalna wielkość", "Przestrzeń i skala", f'''
<div class="cols cs">
  <div class="cs-draw">{clearspace_svg()}<div class="cs-sym">{clearspace_sym_svg()}<span>Pole ochronne sygnetu: <b class="red">x</b> z każdej strony. Wewnętrzna ramka wyznacza obrys znaku, zewnętrzna – granicę pola ochronnego.</span></div></div>
  <div class="col-text small">
    <p><b>Pole ochronne</b> to obszar wokół znaku, w&nbsp;który nie mogą wchodzić inne elementy graficzne, teksty ani krawędzie formatu. Jego szerokość wynosi <b class="red">x</b> – wysokość serca w&nbsp;sygnecie – z&nbsp;każdej strony.</p>
    <p>Pole ochronne obowiązuje dla wszystkich wersji znaku, również dla samego sygnetu.</p>
    <h3>Minimalna wielkość</h3>
    <div class="mins">
      <div class="min"><div class="minv"><div style="width:{hmm}mm">{H("color")}</div></div><span><b>{hmm} mm</b> druk · <b>120 px</b> ekran<br>(szerokość wersji poziomej)</span></div>
      <div class="min"><div class="minv"><div style="height:{smm}mm;width:{smm*100/118:.2f}mm">{S("color")}</div></div><span><b>{smm} mm</b> druk · <b>24 px</b> ekran<br>(wysokość sygnetu)</span></div>
    </div>
    <p class="tiny">Wzory powyżej pokazano w&nbsp;skali 1:1 (wydruk A4 bez skalowania). Poniżej tych wartości używaj samego sygnetu.</p>
  </div>
</div>'''))
    # 8 misuse
    cells = "".join(f'<div class="mu"><div class="mu-b">{c}<svg class="x" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="4" y1="4" x2="96" y2="96"/><line x1="96" y1="4" x2="4" y2="96"/></svg></div><div class="cap"><span class="no">✕</span>{t}</div></div>' for t, c in misuse_cells())
    pages.append(page(8, "Niedozwolone użycie", "Czego nie robić ze znakiem", f'<div class="mugrid">{cells}</div>'))
    # 9 applications
    pages.append(page(9, "Przykładowe zastosowania", "Znak w działaniu", f'''
<div class="apps">
  <div class="app"><div class="door">{sticker_html()}</div><div class="cap"><b>Naklejka na drzwi</b> – 150×150 mm, folia samoprzylepna. Oznacza miejsce, którego AED jest już w&nbsp;dane.gov.pl.</div></div>
  <div class="app"><div class="sowrap">{social_html()}</div><div class="cap"><b>Post w mediach społecznościowych</b> – 1080×1080 px.</div></div>
  <div class="app"><div class="spwrap">{splash_html()}</div><div class="cap"><b>Ekran startowy aplikacji</b> – negatyw na zieleni AED.</div></div>
</div>'''))
    # 10 back
    pages.append(f'''<section class="page back">
  <div class="bk-logo">{H("white", True)}</div>
  <div class="bk-txt"><span class="bk-hash">#AEDostępni</span><span>Pliki znaku: SVG · PNG · JPG · PDF – katalog <b>brand/</b></span><span>Krój Manrope © The Manrope Project Authors, SIL Open Font License 1.1</span></div>
</section>''')
    return pages

CSS = open(os.path.join(HERE, "book.css"), encoding="utf-8").read()

if __name__ == "__main__":
    html = ('<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>AEDostępni – Księga znaku</title>'
            f'<style>{CSS}</style></head><body>' + "\n".join(build()) + "</body></html>")
    open(os.path.join(HERE, "ksiega-znaku.html"), "w", encoding="utf-8").write(html)
    print("ok")

# AEDostępni – identyfikacja wizualna

**Hasło:** „Udostępnij dane. Daj komuś czas.” · **Hashtag:** #AEDostępni

## Koncepcja

Nazwa **AEDostępni** łączy skrót AED ze słowem „dostępni” i przywołuje wezwanie „udostępnij”. Mówi wprost, o co prosimy właścicieli defibrylatorów: żeby ich urządzenia były dostępne nie tylko fizycznie, ale także w danych. Sygnet to pinezka z mapy (symbol lokalizacji), w której wycięto serce (znak życia). Przez serce biegnie linia EKG zakończona impulsem przypominającym wyładowanie: to moment, w którym AED ratuje człowieka, i zarazem sygnał danych płynących do portalu dane.gov.pl. Zieleń nawiązuje do oznakowania ratunkowego, czerwień pulsu do serca i pilności, a granat do rzetelności danych publicznych.

## Kolory

| Nazwa | HEX | RGB | CMYK (ok.) | Pantone (ok.) |
|---|---|---|---|---|
| AED Green | #007A3D | 0/122/61 | 100/0/90/35 | 356 C |
| Deep Navy | #0B2A3C | 11/42/60 | 88/60/40/62 | 296 C |
| Pulse Red | #D7262E | 215/38/46 | 0/95/85/5 | 1795 C |
| Mint | #E6F4EC | 230/244/236 | 10/0/8/0 | 9520 C |
| Biel | #FFFFFF | 255/255/255 | 0/0/0/0 | – |

Krój: **Manrope** (SIL OFL 1.1, Google Fonts): ExtraBold 800 w logotypie, SemiBold 600 w haśle. W plikach SVG tekst jest zamieniony na krzywe, więc znak nie wymaga instalacji fontu. Krój zastępczy: Segoe UI, Arial.

## Pliki

```
ksiega-znaku.pdf                    księga znaku, A4 poziomo, 10 stron
logo/
  aedostepni-logo.svg|png|jpg|pdf          wersja podstawowa pozioma (PNG 2000 px, przezroczyste tło; JPG na białym)
  aedostepni-logo-slogan.svg|png|jpg|pdf   pozioma z hasłem
  aedostepni-logo-vertical.svg|png|jpg     pionowa z hasłem
  aedostepni-symbol.svg|png|jpg|pdf        sygnet (PNG 1024×1024)
  aedostepni-logo-white.svg|png            negatyw (na zieleń/granat)
  aedostepni-logo-white-slogan.svg         negatyw z hasłem
  aedostepni-logo-vertical-white.svg|png   negatyw pionowy
  aedostepni-symbol-white.svg|png          sygnet w negatywie
  aedostepni-logo-mono.svg|png|jpg         achromatyczna (granat)
  aedostepni-logo-vertical-mono.svg|png
  aedostepni-symbol-mono.svg|png
app-icon/
  icon-1024.svg|png                 ikona aplikacji: biały sygnet na zielonym zaokrąglonym kwadracie
  icon-512/192/180/48/32/16.png     skalowane wersje ikony
  icon-foreground-1024.svg|png      pierwszy plan ikony adaptacyjnej Android (sygnet w centralnych 66%, tło przezroczyste)
  favicon.svg, favicon.ico, favicon-256.png
src/                                źródła: gen_logo.py (SVG), gen_book.py + book.css (księga), render.py (PNG/JPG/PDF przez Edge headless)
src/fonts/                          Manrope (OFL.txt – licencja)
```

## Zasady w skrócie

- Pole ochronne: **x** (wysokość serca w sygnecie) z każdej strony.
- Minimalna wielkość: wersja pozioma 30 mm / 120 px szerokości; sygnet 8 mm / 24 px wysokości.
- Nie rozciągać, nie obracać, nie zmieniać kolorów ani kroju, bez cieni i konturów, zawsze na kontrastowym tle.

## Odtworzenie plików

```
cd src
python gen_logo.py      # SVG
python render.py        # PNG/JPG/PDF + ikony (wymaga Edge, Pillow)
python gen_book.py && python render.py book
```
Wymagania: Python 3, fontTools, uharfbuzz, Pillow, Microsoft Edge.

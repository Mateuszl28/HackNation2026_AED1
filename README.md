# AEDostępni — Udostępnij dane. Daj komuś czas.

Rozwiązanie na HackNation 2026, wyzwanie **„Misja AED — Dane na ratunek”** (Ministerstwo Cyfryzacji, dane.gov.pl).

AEDostępni to otwarty mechanizm zbierania, ujednolicania i udostępniania danych o defibrylatorach AED w portalu dane.gov.pl, połączony z akcją promocyjną zachęcającą dysponentów AED do publikowania danych. Składa się z:

| Element | Gdzie | Co robi |
|---|---|---|
| **Wzorcowy zakres danych** | `standard/` | 35 pól (lokalizacja, dostępność, stan techniczny, dysponent) zgodnych z TERYT, WGS84, ISO 8601 i OpenStreetMap. XLSX z opisem pól, słownikami, szablonem z listami rozwijanymi i przykładem + `datapackage.json` (Table Schema). |
| **Wykrywanie zbiorów** | `pipeline/discover.ts` | Przeszukuje API dane.gov.pl (zbiory **i pojedyncze zasoby** w ogólnych zbiorach), wybiera zasób odczytywalny maszynowo, sprawdza, czy link prowadzi do danych, a nie do strony WWW, pobiera dysponenta i REGON z metadanych instytucji. |
| **Pipeline integracji** | `pipeline/` | Integruje wykryte zbiory i OpenStreetMap/OpenAEDMap, automatycznie mapuje kolumny, naprawia typowe błędy, waliduje (także na poziomie całego pliku), deduplikuje (promień 35 m), wskazuje źródło referencyjne, przypisuje województwo. Wynik: CSV, XLSX, JSON, GeoJSON, **metadane DCAT-AP (XML)**, raport źródeł, statystyki regionów. |
| **Automatyzacja** | `.github/workflows/` | CI przy każdym pushu + **nocna aktualizacja danych** (wykrycie → pobranie → integracja → commit). |
| **Aplikacja web (PWA)** | `web/` | Mapa AED z filtrem „dostępne teraz”; **tryb ratunkowy** (najbliższy dostępny AED, „wyślij kogoś po AED”, metronom RKO 110/min z dźwiękiem i wibracją); walidator/konwerter dla dysponentów z eksportem DCAT-AP; **mapa luk w danych** (kartogram i ranking województw); otwarte dane; zgłoszenia obywateli. |
| **Aplikacja Android** | `web/android/` | Ta sama aplikacja opakowana w Capacitor (natywna lokalizacja, ikona, splash). |
| **Identyfikacja wizualna** | `brand/` | Logotyp (SVG/PNG/JPG/PDF), ikony aplikacji, księga znaku `brand/ksiega-znaku.pdf`. |

## Wynik integracji (stan na 2026-11-21)

- **18 318 AED** w zbiorze krajowym z 5 źródeł, 52 potwierdzone w ≥ 2 źródłach.
- Źródła dysponentów z dane.gov.pl: UM Krosno (CSV), UM Przemyśl (CSV/JSON), UM Marki (CSV), UM Legionowo (CSV z TERYT) + OpenStreetMap (eksport OpenAEDMap, ODbL).
- Wykryte i naprawione automatycznie problemy w realnych danych:
  - Marki: każdy wiersz CSV ujęty w cudzysłów, zamienione kolumny szerokości/długości, **rekord ze współrzędnymi skopiowanymi z pliku Krosna (293 km od Marek)** → odrzucony, zduplikowane współrzędne dla dwóch adresów → ostrzeżenie;
  - Przemyśl: niestandardowa geometria `{"lat","long"}` zamiast GeoJSON `[lon, lat]`;
  - Krosno/Marki: kolumna „Nazwa” stała („Defibrylator”), adres w jednym polu → rozbijany na ulicę, numer, kod, miejscowość;
  - Legionowo: kod TERC 6-cyfrowy zamiast 7-cyfrowego.
  - Warszawa: zasób opisany jako JSON prowadzi do strony WWW katalogu, a nie do pliku z danymi → wykryty i oznaczony jako niemożliwy do pobrania maszynowo;
  - Legionowo: AED opublikowane jako zasób ogólnego zbioru „Zdrowie” — znalezione dzięki wyszukiwaniu po zasobach.
- Luki, które pokazują wartość danych od dysponentów: ~60% AED bez godzin dostępności, ~2/3 bez daty kontroli, **tylko 0,3% AED potwierdzonych w danych dysponentów** (mapa luk: `#/ranking`).

## Uruchomienie

Wymagania: Node.js 24+ (pipeline uruchamia pliki `.ts` natywnie), dla Androida JDK 17 + Android SDK 34.

```bash
npm install                 # zależności pipeline (exceljs)
npm run standard            # generuje standard/ (XLSX, CSV, datapackage.json)
npm run data                # integracja danych z pipeline/raw → data/ i web/public/data
npm run data:fetch          # wykrywa zbiory w API dane.gov.pl, pobiera je + OpenAEDMap, integruje
node pipeline/discover.ts   # samo wykrywanie → pipeline/sources.auto.json

cd web
npm install
npm run dev                 # http://localhost:5173
npm run build               # wersja produkcyjna w web/dist (statyczna, dowolny hosting)
npm run android             # build + synchronizacja z projektem Android
cd android && ./gradlew assembleDebug   # APK: android/app/build/outputs/apk/debug/
```

## Architektura

```
shared/schema.ts   ← jedno źródło prawdy: definicja 35 pól standardu
shared/mapper.ts   ← parsowanie CSV/JSON/GeoJSON, auto-mapowanie kolumn, normalizacja, walidacja, kontrole zbioru
shared/hours.ts    ← interpreter godzin (opening_hours) → „dostępny teraz”
shared/dcat.ts     ← generator metadanych DCAT-AP (RDF/XML)
pipeline/discover.ts ← wykrywanie zbiorów i zasobów o AED w API dane.gov.pl
pipeline/regions.ts  ← województwa (point-in-polygon) i indeks gotowości danych
        │
        ├── standard/build-standard.ts → XLSX / CSV / datapackage.json
        ├── pipeline/build.ts          → zbiór krajowy + raport źródeł
        └── web/ (React + Leaflet)     → walidator w przeglądarce używa tego samego kodu co pipeline
```

Ten sam silnik walidacji działa w pipeline i w przeglądarce dysponenta. Plik dysponenta nie opuszcza jego komputera.

## Zgodność z dane.gov.pl

- Formaty odczytywalne maszynowo: CSV (UTF-8, RFC 4180), XLSX, JSON, GeoJSON (RFC 7946); bez PDF/DOC.
- Metadane zbioru generowane w walidatorze (tytuł, opis, słowa kluczowe z tagiem **AEDostępni**, kategoria „Zdrowie”, licencja, częstotliwość aktualizacji), także w profilu **DCAT-AP (RDF/XML)** do automatycznego importu (harvestingu) w dane.gov.pl; DCAT-AP dla zbioru krajowego: `data/dcat.xml`.
- Automatyczne wykrywanie zbiorów przez API `api.dane.gov.pl/1.4` (`/datasets`, `/search`, `/resources`, `include=institution`) — codziennie w GitHub Actions.
- Standard opisany maszynowo (Frictionless Table Schema) i w XLSX dla ludzi.
- WCAG 2.2 AA: kontrast, nawigacja klawiaturą, skip-link, etykiety ARIA, status nie tylko kolorem (✓ ✕ ?), tryb ciemny, `prefers-reduced-motion`; responsywność od 320 px.

## Ograniczenia

- Zgłoszenia obywateli są w prototypie zapisywane lokalnie na urządzeniu; produkcyjnie potrzebny jest backend z kolejką weryfikacji dla dysponentów.
- Dane OSM są na licencji ODbL. Część zbioru pochodząca z OSM musi zachować tę licencję.
- Interpreter godzin obsługuje najczęstsze reguły `opening_hours`; reguły nietypowe dają status „godziny nieznane”.
- Czas dojścia jest szacunkowy (odległość w linii prostej × 1,3, szybki marsz).
- Kody TERYT są uzupełniane tylko z danych źródłowych; geokodowanie wsteczne to kolejny krok.

## Wykorzystanie AI

Zgodnie z §2 ust. 8 regulaminu: przy tworzeniu części kodu i materiałów graficznych zespół korzystał z asystenta AI. Analiza źródeł, projekt standardu danych, decyzje projektowe, weryfikacja i testy są pracą zespołu.

## Licencje

Kod: MIT. Standard danych i materiały akcji: CC BY 4.0. Dane: zgodnie z licencjami źródeł (dane.gov.pl, © współtwórcy OpenStreetMap — ODbL 1.0). Krój Manrope: SIL OFL 1.1.

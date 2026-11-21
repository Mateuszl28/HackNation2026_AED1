// Wzorcowy zakres danych o defibrylatorach AED — jedno źródło prawdy.
// Z tego pliku generowane są: arkusz XLSX ze standardem, Table Schema (datapackage.json),
// walidator w aplikacji oraz pipeline integrujący dane z wielu źródeł.
// Plik używa wyłącznie składni TS „wymazywalnej” — działa bezpośrednio w Node 24 i w Vite.

export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'enum' | 'url' | 'email' | 'phone';
export type Requirement = 'O' | 'Z' | 'F'; // Obowiązkowe / Zalecane / Fakultatywne

export interface FieldDef {
  name: string;          // nazwa kolumny (snake_case, ASCII — zgodnie z dobrymi praktykami dane.gov.pl)
  label: string;         // etykieta po polsku
  group: string;         // grupa pól
  type: FieldType;
  req: Requirement;
  description: string;
  format?: string;
  example: string;
  enumValues?: string[];
  pattern?: string;
  min?: number;
  max?: number;
  osm?: string;          // odpowiednik tagu OpenStreetMap (interoperacyjność)
  aliases?: string[];    // nazwy kolumn spotykane u dysponentów (auto-mapowanie)
}

export const SCHEMA_VERSION = '1.0.0';
export const SCHEMA_NAME = 'AEDostępni — wzorcowy zakres danych o defibrylatorach AED';

export const ACCESS_VALUES = ['publiczny', 'dla_klientow', 'ograniczony', 'prywatny', 'nieznany'];
export const SECURITY_VALUES = ['brak', 'szafka_otwarta', 'szafka_z_alarmem', 'szafka_na_kod', 'zamkniete_na_klucz', 'u_personelu', 'nieznane'];
export const STATUS_VALUES = ['sprawny', 'niesprawny', 'w_serwisie', 'wycofany', 'nieznany'];
export const YESNO = ['TAK', 'NIE'];

export const FIELDS: FieldDef[] = [
  // --- Identyfikacja ---
  { name: 'id', label: 'Identyfikator AED u dysponenta', group: 'Identyfikacja', type: 'string', req: 'O',
    description: 'Unikalny i stały identyfikator urządzenia w zbiorze dysponenta. Nie zmienia się przy aktualizacjach.',
    example: 'UMBDG-AED-0012', osm: 'ref', aliases: ['id', 'numer id', 'numer_id', 'nr', 'lp', 'identyfikator', 'ref', 'kod'] },
  { name: 'nazwa', label: 'Nazwa miejsca / obiektu', group: 'Identyfikacja', type: 'string', req: 'O',
    description: 'Nazwa obiektu, w którym znajduje się AED — tak, jak rozpozna ją świadek zdarzenia.',
    example: 'Urząd Miasta Bydgoszczy — Ratusz', osm: 'name', aliases: ['nazwa', 'name', 'obiekt', 'nazwa obiektu', 'lokalizacja', 'miejsce', 'instytucja'] },

  // --- Położenie ---
  { name: 'szerokosc_geograficzna', label: 'Szerokość geograficzna (WGS84)', group: 'Położenie', type: 'number', req: 'O',
    description: 'Szerokość geograficzna w układzie WGS84 (EPSG:4326), stopnie dziesiętne, min. 6 miejsc po przecinku, separator dziesiętny: kropka.',
    format: 'EPSG:4326, np. 53.123456', example: '53.121965', min: 49.0, max: 54.9, osm: 'lat',
    aliases: ['szerokosc_geograficzna', 'szerokość geograficzna', 'szerokosc', 'lat', 'latitude', 'y', 'wsp_y', 'n'] },
  { name: 'dlugosc_geograficzna', label: 'Długość geograficzna (WGS84)', group: 'Położenie', type: 'number', req: 'O',
    description: 'Długość geograficzna w układzie WGS84 (EPSG:4326), stopnie dziesiętne, min. 6 miejsc po przecinku.',
    format: 'EPSG:4326, np. 18.004321', example: '18.000447', min: 14.1, max: 24.2, osm: 'lon',
    aliases: ['dlugosc_geograficzna', 'długość geograficzna', 'dlugosc', 'lon', 'lng', 'longitude', 'x', 'wsp_x', 'e'] },
  { name: 'opis_lokalizacji', label: 'Dokładne miejsce w obiekcie', group: 'Położenie', type: 'string', req: 'O',
    description: 'Gdzie dokładnie wisi AED: wejście, piętro, przy czym. Najważniejsza informacja dla świadka zdarzenia.',
    example: 'Parter, hol główny, na ścianie obok portierni', osm: 'defibrillator:location',
    aliases: ['opis_lokalizacji', 'opis lokalizacji', 'miejsce zawieszenia', 'umiejscowienie', 'defibrillator:location', 'gdzie'] },
  { name: 'kondygnacja', label: 'Kondygnacja', group: 'Położenie', type: 'integer', req: 'Z',
    description: 'Numer kondygnacji: 0 = parter, -1 = piwnica/podziemie, 1 = I piętro.', example: '0', osm: 'level',
    aliases: ['kondygnacja', 'pietro', 'piętro', 'level'] },
  { name: 'wewnatrz_budynku', label: 'Wewnątrz budynku', group: 'Położenie', type: 'enum', req: 'Z', enumValues: YESNO,
    description: 'TAK — AED wewnątrz budynku; NIE — na zewnątrz (np. kapsuła na elewacji).', example: 'TAK', osm: 'indoor',
    aliases: ['wewnatrz_budynku', 'wewnątrz', 'indoor'] },

  // --- Adres (zgodnie z ustawą o PRG / standardem adresowym) ---
  { name: 'cecha_ulicy', label: 'Cecha ulicy', group: 'Adres', type: 'enum', req: 'Z',
    enumValues: ['ulica', 'aleja', 'plac', 'skwer', 'rondo', 'osiedle', 'bulwar', 'droga', 'park', 'inne'],
    description: 'Cecha z rejestru TERYT ULIC.', example: 'ulica', aliases: ['cecha_ulicy', 'cecha', 'typ ulicy'] },
  { name: 'nazwa_ulicy', label: 'Nazwa ulicy', group: 'Adres', type: 'string', req: 'O',
    description: 'Nazwa ulicy bez cechy (bez „ul.”). Dla miejscowości bez ulic — pozostaw puste i podaj numer porządkowy.',
    example: 'Jezuicka', osm: 'addr:street', aliases: ['nazwa_ulicy', 'ulica', 'street', 'addr:street'] },
  { name: 'nr_budynku', label: 'Numer porządkowy budynku', group: 'Adres', type: 'string', req: 'O',
    description: 'Numer porządkowy budynku wraz z literą.', example: '1', osm: 'addr:housenumber',
    aliases: ['nr_budynku', 'numer budynku', 'home_number', 'nr domu', 'housenumber', 'addr:housenumber', 'numer'] },
  { name: 'nr_lokalu', label: 'Numer lokalu', group: 'Adres', type: 'string', req: 'F',
    description: 'Numer lokalu, jeśli dotyczy.', example: '', aliases: ['nr_lokalu', 'numer lokalu'] },
  { name: 'kod_pocztowy', label: 'Kod pocztowy', group: 'Adres', type: 'string', req: 'O', pattern: '^\\d{2}-\\d{3}$',
    description: 'Kod pocztowy w formacie NN-NNN.', example: '85-102', osm: 'addr:postcode',
    aliases: ['kod_pocztowy', 'kod pocztowy', 'postcode', 'kod', 'addr:postcode'] },
  { name: 'miejscowosc', label: 'Miejscowość', group: 'Adres', type: 'string', req: 'O',
    description: 'Nazwa miejscowości zgodna z TERYT SIMC.', example: 'Bydgoszcz', osm: 'addr:city',
    aliases: ['miejscowosc', 'miejscowość', 'miasto', 'city', 'addr:city'] },
  { name: 'kod_terc', label: 'Kod TERC gminy', group: 'Adres', type: 'string', req: 'Z', pattern: '^\\d{7}$',
    description: '7-cyfrowy identyfikator gminy z rejestru TERYT TERC (z rodzajem gminy).', example: '0461011',
    aliases: ['kod_terc', 'terc', 'teryt'] },
  { name: 'kod_simc', label: 'Kod SIMC miejscowości', group: 'Adres', type: 'string', req: 'Z', pattern: '^\\d{7}$',
    description: '7-cyfrowy identyfikator miejscowości z rejestru TERYT SIMC.', example: '0928943', aliases: ['kod_simc', 'simc'] },
  { name: 'wojewodztwo', label: 'Województwo', group: 'Adres', type: 'string', req: 'Z',
    description: 'Nazwa województwa małymi literami.', example: 'kujawsko-pomorskie', aliases: ['wojewodztwo', 'województwo'] },

  // --- Dostępność ---
  { name: 'dostep', label: 'Kto ma dostęp', group: 'Dostępność', type: 'enum', req: 'O', enumValues: ACCESS_VALUES,
    description: 'publiczny — każdy; dla_klientow — w godzinach otwarcia obiektu; ograniczony — np. tylko pracownicy/teren zamknięty; prywatny.',
    example: 'publiczny', osm: 'access', aliases: ['dostep', 'dostęp', 'access', 'dostepnosc'] },
  { name: 'godziny_dostepnosci', label: 'Godziny dostępności', group: 'Dostępność', type: 'string', req: 'O',
    description: 'Godziny, w których AED jest dostępny, w składni opening_hours (OpenStreetMap). „24/7” = całodobowo.',
    format: 'opening_hours, np. „Mo-Fr 07:30-15:30; Sa 08:00-12:00”', example: '24/7', osm: 'opening_hours',
    aliases: ['godziny_dostepnosci', 'godziny', 'godziny otwarcia', 'opening_hours', 'dostępność godzinowa'] },
  { name: 'zabezpieczenie', label: 'Sposób zabezpieczenia', group: 'Dostępność', type: 'enum', req: 'O', enumValues: SECURITY_VALUES,
    description: 'Czy świadek zdarzenia może wyjąć AED samodzielnie. „zamkniete_na_klucz” oznacza konieczność znalezienia osoby z kluczem.',
    example: 'szafka_z_alarmem', aliases: ['zabezpieczenie', 'szafka', 'kapsula'] },
  { name: 'instrukcja_dostepu', label: 'Instrukcja dostępu', group: 'Dostępność', type: 'string', req: 'Z',
    description: 'Co zrobić, żeby otworzyć szafkę (np. „kod podaje dyspozytor 112”, „klucz w portierni”). Nie publikuj kodów!',
    example: 'Szafka otwierana bez klucza, uruchamia alarm', aliases: ['instrukcja_dostepu', 'instrukcja'] },
  { name: 'elektrody_dzieciece', label: 'Elektrody/tryb pediatryczny', group: 'Dostępność', type: 'enum', req: 'Z', enumValues: YESNO,
    description: 'Czy AED posiada elektrody pediatryczne lub tryb dziecięcy.', example: 'TAK', aliases: ['elektrody_dzieciece', 'pediatryczne'] },
  { name: 'dostepny_dla_wozkow', label: 'Dostępny dla osób na wózkach', group: 'Dostępność', type: 'enum', req: 'F', enumValues: YESNO,
    description: 'Czy AED można zdjąć z poziomu wózka (wysokość uchwytu ≤ 120 cm, brak barier).', example: 'TAK', osm: 'wheelchair',
    aliases: ['dostepny_dla_wozkow', 'wheelchair'] },

  // --- Stan techniczny ---
  { name: 'stan', label: 'Stan urządzenia', group: 'Stan techniczny', type: 'enum', req: 'O', enumValues: STATUS_VALUES,
    description: 'Stan według ostatniej kontroli.', example: 'sprawny', aliases: ['stan', 'status', 'sprawnosc'] },
  { name: 'data_ostatniej_kontroli', label: 'Data ostatniej kontroli', group: 'Stan techniczny', type: 'date', req: 'O',
    description: 'Data ostatniej kontroli sprawności (RRRR-MM-DD, ISO 8601).', format: 'RRRR-MM-DD', example: '2026-10-15', osm: 'check_date',
    aliases: ['data_ostatniej_kontroli', 'data kontroli', 'przeglad', 'check_date'] },
  { name: 'data_waznosci_elektrod', label: 'Data ważności elektrod', group: 'Stan techniczny', type: 'date', req: 'Z',
    description: 'RRRR-MM-DD.', format: 'RRRR-MM-DD', example: '2028-03-31', aliases: ['data_waznosci_elektrod', 'elektrody'] },
  { name: 'data_waznosci_baterii', label: 'Data ważności baterii', group: 'Stan techniczny', type: 'date', req: 'Z',
    description: 'RRRR-MM-DD.', format: 'RRRR-MM-DD', example: '2029-06-30', aliases: ['data_waznosci_baterii', 'bateria'] },
  { name: 'producent', label: 'Producent', group: 'Stan techniczny', type: 'string', req: 'F', description: 'Producent urządzenia.',
    example: 'Philips', osm: 'manufacturer', aliases: ['producent', 'manufacturer'] },
  { name: 'model', label: 'Model', group: 'Stan techniczny', type: 'string', req: 'F', description: 'Model urządzenia.',
    example: 'HeartStart FRx', osm: 'model', aliases: ['model'] },

  // --- Dysponent ---
  { name: 'dysponent', label: 'Dysponent (właściciel/zarządca)', group: 'Dysponent', type: 'string', req: 'O',
    description: 'Podmiot odpowiedzialny za urządzenie.', example: 'Urząd Miasta Bydgoszczy', osm: 'operator',
    aliases: ['dysponent', 'operator', 'wlasciciel', 'właściciel', 'zarzadca'] },
  { name: 'dysponent_regon', label: 'REGON dysponenta', group: 'Dysponent', type: 'string', req: 'Z', pattern: '^(\\d{9}|\\d{14})$',
    description: 'REGON (9 lub 14 cyfr) — umożliwia jednoznaczne powiązanie z instytucją na dane.gov.pl.', example: '000515590',
    aliases: ['dysponent_regon', 'regon'] },
  { name: 'telefon_kontaktowy', label: 'Telefon kontaktowy', group: 'Dysponent', type: 'phone', req: 'Z',
    description: 'Telefon do obiektu (np. portiernia), format +48 NNN NNN NNN.', example: '+48 52 585 88 00', osm: 'phone',
    aliases: ['telefon_kontaktowy', 'telefon', 'phone', 'tel'] },
  { name: 'email_kontaktowy', label: 'E-mail kontaktowy', group: 'Dysponent', type: 'email', req: 'F',
    description: 'Adres do zgłaszania usterek.', example: 'aed@um.bydgoszcz.pl', osm: 'email', aliases: ['email_kontaktowy', 'email', 'e-mail'] },

  // --- Metadane rekordu ---
  { name: 'zdjecie_url', label: 'Zdjęcie (URL)', group: 'Metadane rekordu', type: 'url', req: 'F',
    description: 'Link do zdjęcia miejsca zawieszenia — bardzo pomaga w znalezieniu AED.', example: 'https://example.org/aed/12.jpg', osm: 'image',
    aliases: ['zdjecie_url', 'zdjecie', 'image', 'gallery'] },
  { name: 'data_aktualizacji', label: 'Data aktualizacji rekordu', group: 'Metadane rekordu', type: 'date', req: 'O',
    description: 'Data ostatniej zmiany danych tego AED (RRRR-MM-DD).', format: 'RRRR-MM-DD', example: '2026-11-21',
    aliases: ['data_aktualizacji', 'aktualizacja', 'modified'] },
  { name: 'uwagi', label: 'Uwagi', group: 'Metadane rekordu', type: 'string', req: 'F', description: 'Dodatkowe informacje.',
    example: '', osm: 'note', aliases: ['uwagi', 'opis', 'description', 'note'] },
];

export const FIELD_BY_NAME: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.name, f]));
export const REQUIRED_FIELDS = FIELDS.filter((f) => f.req === 'O').map((f) => f.name);

export type AedRecord = Record<string, string>;

/** Rekord w zbiorze zintegrowanym = rekord standardu + pochodzenie (provenance). */
export interface IntegratedRecord extends AedRecord {
  aed_uid: string;            // globalny identyfikator w zbiorze krajowym
  zrodla: string;             // lista identyfikatorów źródeł (rozdzielona „|”)
  zrodlo_glowne: string;
  jakosc: string;             // 0-100 wskaźnik kompletności/jakości
}

export const INTEGRATED_EXTRA_FIELDS = [
  { name: 'aed_uid', label: 'Identyfikator w zbiorze krajowym', description: 'Stabilny identyfikator nadawany przy integracji (źródło:id).' },
  { name: 'zrodla', label: 'Źródła danych', description: 'Identyfikatory wszystkich źródeł, które opisują ten AED, rozdzielone „|”.' },
  { name: 'zrodlo_glowne', label: 'Źródło referencyjne', description: 'Źródło, którego wartości mają pierwszeństwo (dysponent > rejestr publiczny > społeczność).' },
  { name: 'jakosc', label: 'Wskaźnik jakości (0–100)', description: 'Kompletność pól obowiązkowych i zalecanych oraz aktualność kontroli.' },
];

// Rejestr źródeł danych o AED. Każde źródło = dysponent + format + (opcjonalnie) ręczne poprawki mapowania.
// Nowe źródła z dane.gov.pl są wykrywane automatycznie (discover.ts) i trafiają tu jako wpisy „auto”.

export type SourceKind = 'dysponent' | 'rejestr' | 'spolecznosc';

export interface SourceDef {
  id: string;
  title: string;
  kind: SourceKind;              // dysponent > rejestr > społeczność (priorytet przy scalaniu)
  publisher: string;
  license: string;
  url: string;                   // strona zbioru (referencja)
  downloadUrl?: string;
  file: string;                  // plik w pipeline/raw
  format: 'csv' | 'json' | 'geojson-osm';
  mappingOverrides?: Record<string, string>;  // kolumna źródła → pole standardu ('' = pomiń)
  defaults?: Record<string, string>;
  bbox?: [number, number, number, number];   // [minLon, minLat, maxLon, maxLat] — do raportu zasięgu
}

export const SOURCES: SourceDef[] = [
  {
    id: 'dgp-54632', title: 'Defibrylatory zlokalizowane w Mieście Krosno', kind: 'dysponent',
    publisher: 'Urząd Miasta Krosna', license: 'CC0 / dane.gov.pl',
    url: 'https://dane.gov.pl/pl/dataset/3624', downloadUrl: 'https://api.dane.gov.pl/resources/54632/file',
    file: 'krosno.csv', format: 'csv',
    defaults: { miejscowosc: 'Krosno', dysponent: 'Gmina Miasto Krosno', wojewodztwo: 'podkarpackie' },
  },
  {
    id: 'dgp-62095', title: 'Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu', kind: 'dysponent',
    publisher: 'Urząd Miejski w Przemyślu', license: 'CC0 / dane.gov.pl',
    url: 'https://dane.gov.pl/pl/dataset/4581', downloadUrl: 'https://api.dane.gov.pl/resources/62095/file',
    file: 'przemysl.csv', format: 'csv',
    mappingOverrides: { description: '', category: '', gallery: '', attachments: '', links: '', youtube_url: '', panorama_url: '', www: '' },
    defaults: { miejscowosc: 'Przemyśl', dysponent: 'Gmina Miejska Przemyśl', wojewodztwo: 'podkarpackie' },
  },
  {
    id: 'dgp-68353', title: 'Defibrylatory zlokalizowane na terenie Miasta Marki', kind: 'dysponent',
    publisher: 'Urząd Miasta Marki', license: 'CC0 / dane.gov.pl',
    url: 'https://dane.gov.pl/pl/dataset/4955', downloadUrl: 'https://api.dane.gov.pl/resources/68353/file',
    file: 'marki.csv', format: 'csv',
    defaults: { miejscowosc: 'Marki', dysponent: 'Gmina Miasto Marki', wojewodztwo: 'mazowieckie' },
  },
  {
    id: 'dgp-2625221', title: 'Wykaz defibrylatorów AED wraz z ich lokalizacją w Legionowie', kind: 'dysponent',
    publisher: 'Urząd Miasta Legionowo', license: 'CC0 / dane.gov.pl',
    url: 'https://dane.gov.pl/pl/dataset/resource/2625221', downloadUrl: 'https://api.dane.gov.pl/media/resources/20260914/aed.csv',
    file: 'legionowo.csv', format: 'csv',
    defaults: { dysponent: 'Gmina Miejska Legionowo', wojewodztwo: 'mazowieckie' },
  },
  {
    id: 'osm', title: 'OpenStreetMap — defibrylatory (eksport OpenAEDMap)', kind: 'spolecznosc',
    publisher: 'Społeczność OpenStreetMap / OpenAEDMap', license: 'ODbL 1.0 (© współtwórcy OpenStreetMap)',
    url: 'https://openaedmap.org/pl/', downloadUrl: 'https://openaedmap.org/api/v1/countries/PL.geojson',
    file: 'openaedmap_pl.geojson', format: 'geojson-osm',
  },
];

export const KIND_PRIORITY: Record<SourceKind, number> = { dysponent: 3, rejestr: 2, spolecznosc: 1 };

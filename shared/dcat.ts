// Generator metadanych zbioru w formacie DCAT-AP (RDF/XML) — profil używany przez dane.gov.pl
// do automatycznego importu (harvestingu) zbiorów z katalogów instytucji.
// Ten sam kod działa w pipeline (zbiór krajowy) i w walidatorze (zbiór pojedynczego dysponenta).

export interface DcatDistribution { title: string; url: string; format: 'CSV' | 'XLSX' | 'JSON' | 'GEOJSON'; mediaType: string; }
export interface DcatDataset {
  id: string;                // stały identyfikator zbioru (URI lub slug)
  title: string;
  description: string;
  publisher: string;
  publisherRegon?: string;
  keywords: string[];
  modified: string;          // RRRR-MM-DD
  accrualPeriodicity: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'IRREG';
  license: string;           // URI licencji
  landingPage?: string;
  spatial?: string;          // np. nazwa gminy
  conformsTo?: string;       // URI standardu (Table Schema)
  distributions: DcatDistribution[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EU = 'http://publications.europa.eu/resource/authority';

export const MEDIA: Record<DcatDistribution['format'], string> = {
  CSV: 'text/csv', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', JSON: 'application/json', GEOJSON: 'application/geo+json',
};

export function dcatXml(d: DcatDataset): string {
  const base = d.id.startsWith('http') || d.id.startsWith('urn:') ? d.id : `urn:aedostepni:${encodeURIComponent(d.id)}`;
  const dists = d.distributions.map((x, i) => `
    <dcat:distribution>
      <dcat:Distribution rdf:about="${esc(base)}/zasob/${i + 1}">
        <dct:title xml:lang="pl">${esc(x.title)}</dct:title>
        <dcat:accessURL rdf:resource="${esc(x.url)}"/>
        <dcat:downloadURL rdf:resource="${esc(x.url)}"/>
        <dct:format rdf:resource="${EU}/file-type/${x.format === 'GEOJSON' ? 'GEOJSON' : x.format}"/>
        <dcat:mediaType>${esc(x.mediaType)}</dcat:mediaType>
        <dct:license rdf:resource="${esc(d.license)}"/>
        <dct:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${esc(d.modified)}</dct:modified>${d.conformsTo ? `
        <dct:conformsTo rdf:resource="${esc(d.conformsTo)}"/>` : ''}
      </dcat:Distribution>
    </dcat:distribution>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Metadane zbioru w profilu DCAT-AP do importu w portalu dane.gov.pl. Wygenerowano: AEDostępni -->
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dcat="http://www.w3.org/ns/dcat#"
         xmlns:dct="http://purl.org/dc/terms/"
         xmlns:foaf="http://xmlns.com/foaf/0.1/"
         xmlns:vcard="http://www.w3.org/2006/vcard/ns#"
         xmlns:adms="http://www.w3.org/ns/adms#">
  <dcat:Catalog rdf:about="${esc(base)}/katalog">
    <dct:title xml:lang="pl">Katalog danych o defibrylatorach AED — ${esc(d.publisher)}</dct:title>
    <dct:publisher rdf:resource="${esc(base)}/wydawca"/>
    <dcat:dataset>
      <dcat:Dataset rdf:about="${esc(base)}">
        <dct:identifier>${esc(d.id)}</dct:identifier>
        <dct:title xml:lang="pl">${esc(d.title)}</dct:title>
        <dct:description xml:lang="pl">${esc(d.description)}</dct:description>
${d.keywords.map((k) => `        <dcat:keyword xml:lang="pl">${esc(k)}</dcat:keyword>`).join('\n')}
        <dcat:theme rdf:resource="${EU}/data-theme/HEAL"/>
        <dct:language rdf:resource="${EU}/language/POL"/>
        <dct:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${esc(d.modified)}</dct:modified>
        <dct:accrualPeriodicity rdf:resource="${EU}/frequency/${d.accrualPeriodicity}"/>${d.landingPage ? `
        <dcat:landingPage rdf:resource="${esc(d.landingPage)}"/>` : ''}${d.spatial ? `
        <dct:spatial><dct:Location><dct:title xml:lang="pl">${esc(d.spatial)}</dct:title></dct:Location></dct:spatial>` : ''}
        <dct:publisher>
          <foaf:Agent rdf:about="${esc(base)}/wydawca">
            <foaf:name xml:lang="pl">${esc(d.publisher)}</foaf:name>${d.publisherRegon ? `
            <adms:identifier><adms:Identifier><skos:notation xmlns:skos="http://www.w3.org/2004/02/skos/core#">REGON:${esc(d.publisherRegon)}</skos:notation></adms:Identifier></adms:identifier>` : ''}
          </foaf:Agent>
        </dct:publisher>${dists}
      </dcat:Dataset>
    </dcat:dataset>
  </dcat:Catalog>
</rdf:RDF>
`;
}

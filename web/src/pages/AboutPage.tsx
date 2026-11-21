export default function AboutPage() {
  return (
    <div className="page">
      <header className="page-head hero">
        <img className="hero-logo" src="./brand/aedostepni-logo-slogan.svg" alt="AEDostępni — Udostępnij dane. Daj komuś czas." />
        <p className="lead">Akcja, która zachęca każdego właściciela defibrylatora do opublikowania danych o nim w portalu dane.gov.pl, w jednym, wspólnym standardzie.</p>
        <p className="btn-row">
          <a className="btn btn-primary" href="#/dysponenci">Udostępnij dane swoich AED</a>
          <a className="btn" href="./brand/ksiega-znaku.pdf" target="_blank" rel="noopener">Księga znaku (PDF)</a>
        </p>
      </header>

      <section className="card">
        <h2>Dlaczego</h2>
        <p>Przy nagłym zatrzymaniu krążenia każda minuta bez defibrylacji zmniejsza szanse przeżycia. AED może użyć każdy, ale trzeba wiedzieć, <b>gdzie jest najbliższy, czy jest dostępny teraz i czy działa</b>. Dziś te informacje są rozproszone w kilku bazach, często niepełne i niezweryfikowane. W portalu dane.gov.pl jest zaledwie kilka zbiorów o AED, każdy w innym formacie.</p>
      </section>

      <section className="card">
        <h2>Koncepcja znaku</h2>
        <p>Nazwa <b>AEDostępni</b> łączy skrót AED ze słowem „dostępni” i przywołuje wezwanie „udostępnij”. Mówi wprost, o co prosimy właścicieli defibrylatorów: żeby ich urządzenia były dostępne nie tylko fizycznie, ale także w danych. Sygnet to pinezka z mapy, w której wycięto serce. Przez serce biegnie linia EKG zakończona impulsem: to moment, w którym AED ratuje człowieka, i zarazem sygnał danych płynących do dane.gov.pl. Zieleń nawiązuje do oznakowania ratunkowego, czerwień do serca i pilności, granat do rzetelności danych publicznych.</p>
        <p><b>#AEDostępni</b> · „Udostępnij dane. Daj komuś czas.”</p>
      </section>

      <section className="card">
        <h2>Jak to działa</h2>
        <ol className="flow">
          <li><b>Standard.</b> Wzorcowy zakres danych (35 pól: lokalizacja, dostępność, stan techniczny, dysponent) zgodny z TERYT, WGS84, ISO 8601 i OpenStreetMap.</li>
          <li><b>Publikacja.</b> Dysponent wgrywa swój plik w dowolnym formacie. Walidator dopasowuje kolumny, naprawia błędy i generuje CSV/XLSX/JSON gotowe do dane.gov.pl.</li>
          <li><b>Integracja.</b> Pipeline zbiera zbiory z dane.gov.pl (słowo kluczowe AEDostępni) i z innych źródeł (OpenStreetMap), deduplikuje je i wskazuje źródło referencyjne każdego rekordu.</li>
          <li><b>Ratunek.</b> Aplikacja (web i Android) wskazuje najbliższy AED dostępny <em>teraz</em> oraz czas dojścia tam i z powrotem.</li>
          <li><b>Pętla jakości.</b> Obywatele zgłaszają błędy, a dysponent poprawia dane u źródła, czyli w swoim zbiorze na dane.gov.pl.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Ograniczenia prototypu</h2>
        <ul>
          <li>Zgłoszenia obywateli są zapisywane lokalnie na urządzeniu. Wersja produkcyjna wymaga backendu z kolejką weryfikacji dla dysponentów.</li>
          <li>Dane OpenStreetMap są na licencji ODbL. Publikacja zbioru zintegrowanego musi zachować tę licencję dla części pochodzącej z OSM albo rozdzielać warstwy.</li>
          <li>Interpreter godzin obsługuje najczęstsze reguły <code>opening_hours</code>. Dla reguł nietypowych status pokazujemy jako „godziny nieznane”.</li>
          <li>Czas dojścia jest szacunkowy (odległość w linii prostej × 1,3, szybki marsz).</li>
          <li>Kody TERC/SIMC są uzupełniane tylko tam, gdzie podaje je źródło. Geokodowanie wsteczne do TERYT jest kolejnym krokiem.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Wykorzystanie sztucznej inteligencji</h2>
        <p>Zgodnie z §2 ust. 8 regulaminu: zespół korzystał z asystenta AI przy generowaniu części kodu (aplikacja, pipeline, walidator), przy szkicach znaku graficznego i składzie księgi znaku. Analizę źródeł danych, projekt wzorcowego zakresu danych, decyzje projektowe, weryfikację i testy wykonał zespół.</p>
      </section>

      <footer className="muted small-print">
        Dane mapy: © współtwórcy OpenStreetMap (ODbL), OpenAEDMap, zbiory dysponentów z dane.gov.pl. Projekt na HackNation 2026 — wyzwanie „Misja AED — Dane na ratunek”.
      </footer>
    </div>
  );
}

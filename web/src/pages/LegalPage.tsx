const REPO = 'https://github.com/Mateuszl28/HackNation2026_AED1';
const UPDATED = '2026-11-21';

/** Deklaracja dostępności (ustawa z 4 kwietnia 2019 r. o dostępności cyfrowej) i polityka prywatności. */
export default function LegalPage({ kind }: { kind: 'dostepnosc' | 'prywatnosc' }) {
  return kind === 'dostepnosc' ? <Accessibility /> : <Privacy />;
}

function Accessibility() {
  return (
    <div className="page legal">
      <header className="page-head">
        <p className="eyebrow">Deklaracja dostępności</p>
        <h1>Deklaracja dostępności AEDostępni</h1>
        <p className="lead">Zespół AEDostępni zobowiązuje się zapewnić dostępność serwisu i aplikacji mobilnej zgodnie z ustawą z dnia 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych.</p>
      </header>
      <section className="card">
        <h2>Zakres i daty</h2>
        <ul>
          <li>Serwis: <a href="https://mateuszl28.github.io/HackNation2026_AED1/">mateuszl28.github.io/HackNation2026_AED1</a> oraz aplikacja AEDostępni na Androida.</li>
          <li>Data publikacji: 2026-11-21. Data ostatniej aktualizacji deklaracji: {UPDATED}.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Stan dostępności</h2>
        <p>Serwis jest <b>częściowo zgodny</b> z WCAG 2.2 na poziomie AA z powodu niezgodności wymienionych poniżej.</p>
        <h3>Treści niedostępne</h3>
        <ul>
          <li><b>Mapa interaktywna:</b> przy dużym zagęszczeniu defibrylatorów znaczniki na mapie mogą na siebie nachodzić (kryterium 2.5.8 „Rozmiar celu”). Te same informacje i funkcje są dostępne bez mapy: lista „Najbliższe AED”, wyszukiwarka oraz tryb ratunkowy.</li>
          <li><b>Treści zewnętrzne:</b> podkład mapy (OpenStreetMap) jest obrazem rastrowym — nazwy ulic na mapie nie są odczytywane przez czytniki ekranu.</li>
          <li><b>Pliki do pobrania</b> (księga znaku PDF, plakat) są materiałami graficznymi i mogą nie być w pełni dostępne.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Przygotowanie deklaracji</h2>
        <p>Deklarację sporządzono {UPDATED} na podstawie samooceny oraz automatycznego audytu narzędziem axe-core 4.10 (reguły WCAG 2.0, 2.1 i 2.2, poziomy A i AA) na 9 ekranach serwisu: 0 naruszeń na 8 ekranach, na mapie jedno ostrzeżenie opisane wyżej.</p>
        <h3>Rozwiązania ułatwiające korzystanie</h3>
        <ul>
          <li>obsługa klawiaturą i widoczny fokus, link „Przejdź do treści”;</li>
          <li>status AED przekazywany tekstem i znakiem (✓ / ✕ / ?), nie tylko kolorem;</li>
          <li>kontrast zgodny z WCAG AA, tryb ciemny, poszanowanie ustawienia „ogranicz ruch”;</li>
          <li>tabele zamieniane na czytelne karty na małych ekranach; tryb ratunkowy w językach polskim, angielskim i ukraińskim.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Informacje zwrotne i kontakt</h2>
        <p>W przypadku problemów z dostępnością serwisu prosimy o kontakt przez <a href={`${REPO}/issues`} target="_blank" rel="noopener">zgłoszenie w repozytorium projektu</a>. Tą samą drogą można złożyć wniosek o udostępnienie informacji niedostępnej oraz żądanie zapewnienia dostępności. Odpowiemy niezwłocznie, nie później niż w ciągu 7 dni.</p>
        <p>Jeżeli zapewnienie dostępności nie będzie możliwe, zaproponujemy alternatywny sposób dostępu do informacji. W przypadku odmowy można złożyć skargę na zasadach ustawy, a następnie zawiadomić Rzecznika Praw Obywatelskich: <a href="https://bip.brpo.gov.pl/" target="_blank" rel="noopener">bip.brpo.gov.pl</a>.</p>
      </section>
      <section className="card">
        <h2>Aplikacja mobilna</h2>
        <p>Aplikacja AEDostępni na Androida korzysta z tego samego interfejsu co serwis i ma ten sam stan dostępności. Obsługuje systemowe powiększenie tekstu i czytnik ekranu TalkBack.</p>
      </section>
    </div>
  );
}

function Privacy() {
  return (
    <div className="page legal">
      <header className="page-head">
        <p className="eyebrow">Polityka prywatności</p>
        <h1>Prywatność w AEDostępni</h1>
        <p className="lead">Nie zbieramy danych osobowych, nie zakładamy kont, nie używamy plików cookies ani narzędzi analitycznych.</p>
      </header>
      <section className="card">
        <h2>Lokalizacja</h2>
        <p>Lokalizacja jest pobierana <b>tylko wtedy, gdy o to poprosisz</b> (przyciski „Najbliższy AED”, „SOS”, „Użyj mojej lokalizacji”) i używana wyłącznie na Twoim urządzeniu do obliczenia odległości do defibrylatorów. Nie zapisujemy jej i nie wysyłamy na żaden serwer.</p>
      </section>
      <section className="card">
        <h2>Dane zapisywane na urządzeniu</h2>
        <ul>
          <li>ustawienia (np. wybrany język trybu ratunkowego, informacja, że widziałeś ekran powitalny);</li>
          <li>historia Twoich zgłoszeń i potwierdzeń stanu AED;</li>
          <li>przybliżone adresy AED pobrane wcześniej (pamięć podręczna).</li>
        </ul>
        <p>Dane te pozostają w pamięci przeglądarki lub aplikacji i możesz je usunąć, czyszcząc dane przeglądarki lub aplikacji.</p>
      </section>
      <section className="card">
        <h2>Usługi zewnętrzne</h2>
        <ul>
          <li><b>Mapa (OpenStreetMap):</b> pobieranie fragmentów mapy ujawnia serwerom OpenStreetMap adres IP urządzenia i oglądany obszar (<a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener">polityka prywatności OSMF</a>).</li>
          <li><b>Przybliżony adres (Nominatim):</b> przy otwarciu karty AED bez adresu wysyłamy do Nominatim współrzędne <i>tego AED</i> — nie Twoje położenie.</li>
          <li><b>Zgłoszenia do OpenStreetMap:</b> tylko gdy zaznaczysz tę opcję; notatka jest publiczna i anonimowa (zawiera położenie AED i treść zgłoszenia). Nie wpisuj w niej danych osobowych.</li>
          <li><b>Hosting (GitHub Pages)</b> może przetwarzać adres IP w dziennikach serwera.</li>
          <li><b>Udostępnianie i nawigacja</b> przekazują link do wybranej przez Ciebie aplikacji (np. SMS, Mapy Google).</li>
        </ul>
      </section>
      <section className="card">
        <h2>Kontakt</h2>
        <p>Pytania dotyczące prywatności: <a href={`${REPO}/issues`} target="_blank" rel="noopener">zgłoszenie w repozytorium projektu</a>. Ostatnia aktualizacja: {UPDATED}.</p>
      </section>
    </div>
  );
}

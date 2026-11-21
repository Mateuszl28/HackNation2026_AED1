import { useState } from 'react';
import { Link } from 'react-router-dom';
import SocialCard from '../components/SocialCard';

interface Q { q: string; a: string[]; ok: number; why: string; }

// Treść zgodna z wytycznymi ERC 2021 (resuscytacja krążeniowo-oddechowa u dorosłych) i polskim prawem.
const QUESTIONS: Q[] = [
  { q: 'Ktoś upadł, nie reaguje i nie oddycha prawidłowo. Co robisz najpierw?',
    a: ['Szukam pulsu na szyi przez minutę', 'Dzwonię pod 112 (na głośniku) i proszę kogoś o przyniesienie AED', 'Podaję wodę i czekam, aż się ocknie'], ok: 1,
    why: 'Wezwanie pomocy i AED to pierwszy krok. Laik nie bada tętna — wystarczy brak reakcji i brak prawidłowego oddechu. Dyspozytor 112 poprowadzi Cię krok po kroku.' },
  { q: 'W jakim tempie uciskać klatkę piersiową?',
    a: ['60–80 razy na minutę', '100–120 razy na minutę', 'Jak najszybciej, bez rytmu'], ok: 1,
    why: '100–120 uciśnięć na minutę — mniej więcej rytm piosenki „Stayin’ Alive”. Metronom w trybie ratunkowym AEDostępni podaje tempo 110/min.' },
  { q: 'Jak głęboko uciskać klatkę piersiową dorosłego?',
    a: ['1–2 cm', '5–6 cm', 'Ile się da, nawet 10 cm'], ok: 1,
    why: 'Na głębokość 5–6 cm, na środku klatki piersiowej, z wyprostowanymi rękami. Po każdym uciśnięciu pozwól klatce wrócić do pozycji wyjściowej.' },
  { q: 'Czy AED może „porazić” kogoś, komu wyładowanie nie jest potrzebne?',
    a: ['Tak, dlatego tylko lekarz może go użyć', 'Nie — AED sam analizuje rytm serca i zaleci wyładowanie tylko wtedy, gdy jest potrzebne', 'Tak, jeśli źle naklei się elektrody'], ok: 1,
    why: 'Automatyczny defibrylator sam ocenia rytm serca i prowadzi głosem. Może go bezpiecznie użyć każdy, także bez przeszkolenia.' },
  { q: 'Co robisz, gdy AED analizuje rytm albo wykonuje wyładowanie?',
    a: ['Nadal uciskam klatkę piersiową', 'Nikt nie dotyka poszkodowanego', 'Trzymam poszkodowanego za rękę'], ok: 1,
    why: 'Podczas analizy i wyładowania nikt nie dotyka poszkodowanego. Zaraz po wyładowaniu (lub komunikacie „wyładowanie niezalecane”) wróć do uciśnięć.' },
  { q: 'O ile spada szansa przeżycia z każdą minutą bez defibrylacji?',
    a: ['O ok. 1%', 'O ok. 7–10%', 'Nie spada, jeśli ktoś uciska'], ok: 1,
    why: 'Każda minuta bez defibrylacji zmniejsza szansę przeżycia o ok. 7–10% (uciskanie klatki spowalnia ten spadek). Dlatego tak ważne jest, by wiedzieć, gdzie jest najbliższy dostępny AED.' },
  { q: 'Czy w Polsce grozi Ci odpowiedzialność za użycie AED u nieznajomego?',
    a: ['Tak, jeśli poszkodowany nie przeżyje', 'Nie — udzielający pierwszej pomocy jest chroniony prawem; karalne jest jej nieudzielenie', 'Tylko wtedy, gdy nie mam kursu'], ok: 1,
    why: 'Osoba udzielająca pierwszej pomocy korzysta z ochrony prawnej przewidzianej dla funkcjonariuszy publicznych (ustawa o Państwowym Ratownictwie Medycznym). Karalne jest nieudzielenie pomocy (art. 162 Kodeksu karnego).' },
];

export default function QuizPage() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = i >= QUESTIONS.length;
  const q = QUESTIONS[i];

  function pick(k: number) {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.ok) setScore((s) => s + 1);
  }
  function next() { setPicked(null); setI((n) => n + 1); }
  function restart() { setI(0); setPicked(null); setScore(0); }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">#AEDostępni · 60 sekund</p>
        <h1>Czy wiesz, jak użyć AED?</h1>
        <p className="lead">{QUESTIONS.length} pytań, które mogą komuś uratować życie. Na końcu — grafika do udostępnienia.</p>
      </header>

      {!done ? (
        <section className="card quiz" aria-labelledby="quiz-q">
          <div className="quiz-progress" aria-hidden="true"><span style={{ width: `${(i / QUESTIONS.length) * 100}%` }} /></div>
          <p className="muted small">Pytanie {i + 1} z {QUESTIONS.length}</p>
          <h2 id="quiz-q">{q.q}</h2>
          <div className="quiz-answers" role="group" aria-labelledby="quiz-q">
            {q.a.map((t, k) => {
              const state = picked === null ? '' : k === q.ok ? 'ok' : k === picked ? 'bad' : 'dim';
              return (
                <button key={t} className={`quiz-a ${state}`} onClick={() => pick(k)} aria-disabled={picked !== null} aria-pressed={picked === k}>
                  <span aria-hidden="true">{state === 'ok' ? '✓' : state === 'bad' ? '✕' : String.fromCharCode(65 + k)}</span>{t}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={`notice ${picked === q.ok ? 'notice-ok' : 'notice-warn'}`} role="status">
              <b>{picked === q.ok ? 'Dobrze!' : 'Niezupełnie.'}</b> {q.why}
            </div>
          )}
          {picked !== null && <button className="btn btn-primary" onClick={next} autoFocus>{i + 1 < QUESTIONS.length ? 'Dalej' : 'Zobacz wynik'}</button>}
        </section>
      ) : (
        <>
          <section className="card" role="status">
            <h2>Twój wynik: {score}/{QUESTIONS.length}</h2>
            <p>{score === QUESTIONS.length ? 'Świetnie — wiesz, co robić. Teraz sprawdź, gdzie jest najbliższy AED w Twojej okolicy.' : 'Dobrze, że sprawdzasz! Przeczytaj wyjaśnienia jeszcze raz — w nagłym wypadku tryb ratunkowy AEDostępni poprowadzi Cię krok po kroku.'}</p>
            <p className="btn-row">
              <Link className="btn btn-primary" to="/">Gdzie jest najbliższy AED?</Link>
              <Link className="btn" to="/ratunek">Zobacz tryb ratunkowy</Link>
              <button className="btn" onClick={restart}>Jeszcze raz</button>
            </p>
          </section>
          <section className="card">
            <h2>Zaproś innych do quizu</h2>
            <SocialCard fileName={`aedostepni-quiz-${score}`} stats={{
              title: 'Wiem, jak użyć AED. A Ty?',
              subtitle: 'Quiz #AEDostępni — 60 sekund, które mogą uratować życie',
              big: `${score}/${QUESTIONS.length}`,
              bigLabel: 'poprawnych odpowiedzi w quizie o defibrylatorach AED',
              items: [
                { v: '112', l: 'zadzwoń, włącz głośnik' },
                { v: '100–120', l: 'uciśnięć na minutę' },
                { v: '5–6 cm', l: 'głębokość uciśnięć' },
              ],
            }} />
          </section>
        </>
      )}
      <p className="muted small">Quiz ma charakter edukacyjny i nie zastępuje kursu pierwszej pomocy. Treść na podstawie wytycznych Europejskiej Rady Resuscytacji (ERC 2021).</p>
    </div>
  );
}

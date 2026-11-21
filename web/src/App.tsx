import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Symbol, Wordmark } from './Logo';
// Mapa i tryb ratunkowy w głównej paczce (muszą działać natychmiast i offline);
// pozostałe ekrany ładowane na żądanie — m.in. obsługa XLSX i generator QR nie spowalniają startu.
import MapPage from './pages/MapPage';
import RescuePage from './pages/RescuePage';
import Onboarding from './components/Onboarding';
import { APK_URL, isNativeApp } from './config';
const DataPage = lazy(() => import('./pages/DataPage'));
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const RankingPage = lazy(() => import('./pages/RankingPage'));
const DevPage = lazy(() => import('./pages/DevPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const StickersPage = lazy(() => import('./pages/StickersPage'));
const CampaignPage = lazy(() => import('./pages/CampaignPage'));
const ReportCountyPage = lazy(() => import('./pages/ReportCountyPage'));

/** Po wyświetleniu mapy, w wolnej chwili, dociągamy pozostałe ekrany — trafiają do pamięci offline (service worker). */
function prefetchPages() {
  const load = () => {
    for (const p of [() => import('./pages/DataPage'), () => import('./pages/ReportPage'), () => import('./pages/AboutPage'), () => import('./pages/RankingPage'),
      () => import('./pages/DevPage'), () => import('./pages/LegalPage'), () => import('./pages/CampaignPage'), () => import('./pages/StickersPage'), () => import('./pages/ProvidersPage'), () => import('./pages/ReportCountyPage')]) p().catch(() => {});
  };
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
  window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(load, { timeout: 5000 }) : load()), 4000);
}

const NAV = [
  { to: '/', label: 'Mapa AED', icon: 'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z' },
  { to: '/dysponenci', label: 'Dla dysponentów', short: 'Dysponenci', icon: 'M4 4h16v4H4zM4 10h10v4H4zM4 16h16v4H4z' },
  { to: '/dane', label: 'Otwarte dane', short: 'Dane', icon: 'M4 19h16v2H4zM6 10h3v7H6zM11 6h3v11h-3zM16 13h3v4h-3z' },
  { to: '/ranking', label: 'Mapa luk', hideTab: true, icon: '' },
  { to: '/kampania', label: 'Kampania', hideTab: true, icon: '' },
  { to: '/zglos', label: 'Zgłoś', icon: 'M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z' },
  { to: '/akcja', label: 'O akcji', icon: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z' },
];

export default function App() {
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => { prefetchPages(); }, []);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const t = NAV.find((n) => n.to === loc.pathname)?.label ?? ({ '/ratunek': 'Tryb ratunkowy', '/ranking': 'Mapa luk w danych', '/naklejki': 'Naklejki QR', '/kampania': 'Zestaw kampanii', '/api': 'Dla deweloperów', '/raport': 'Raport dla samorządu', '/dostepnosc': 'Deklaracja dostępności', '/prywatnosc': 'Polityka prywatności' } as Record<string, string>)[loc.pathname] ?? (loc.pathname.startsWith('/aed/') ? 'Karta AED' : loc.pathname.startsWith('/raport/') ? `Raport: ${decodeURIComponent(loc.pathname.slice(8))}` : 'AEDostępni');
    document.title = `${t} — AEDostępni`;
    if (loc.pathname !== '/' && !loc.pathname.startsWith('/aed/')) main.current?.focus();
  }, [loc.pathname]);

  return (
    <div className={`app ${loc.pathname === '/' || loc.pathname.startsWith('/aed/') ? 'is-map' : ''} ${loc.pathname === '/ratunek' ? 'is-rescue' : ''} ${loc.pathname === '/naklejki' || loc.pathname.startsWith('/raport') ? 'is-print' : ''}`}>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="AEDostępni — strona główna">
          <Symbol size={34} />
          <Wordmark />
        </NavLink>
        <nav className="topnav" aria-label="Główna nawigacja">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
          ))}
        </nav>
        {!isNativeApp() && (
          <a className="topbar-apk" href={APK_URL} aria-label="Pobierz aplikację AEDostępni na Androida">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" /></svg>
            <span>Aplikacja</span>
          </a>
        )}
        <a className="btn-112" href="tel:112" aria-label="Zadzwoń pod numer alarmowy 112">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" /></svg>
          112
        </a>
      </header>

      {offline && (
        <div className="offline-bar" role="status">
          <b>Jesteś offline.</b> Pokazujemy zapisane dane AED; mapa może być niepełna. Numer <a href="tel:112">112</a> działa bez internetu.
        </div>
      )}

      <Onboarding />
      <main id="main" ref={main} tabIndex={-1}>
        <Suspense fallback={<p className="page-loading" role="status">Wczytywanie…</p>}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/dysponenci" element={<ProvidersPage />} />
          <Route path="/dane" element={<DataPage />} />
          <Route path="/zglos" element={<ReportPage />} />
          <Route path="/akcja" element={<AboutPage />} />
          <Route path="/ratunek" element={<RescuePage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/aed/:uid" element={<MapPage />} />
          <Route path="/naklejki" element={<StickersPage />} />
          <Route path="/kampania" element={<CampaignPage />} />
          <Route path="/api" element={<DevPage />} />
          <Route path="/raport" element={<ReportCountyPage />} />
          <Route path="/raport/:county" element={<ReportCountyPage />} />
          <Route path="/dostepnosc" element={<LegalPage kind="dostepnosc" />} />
          <Route path="/prywatnosc" element={<LegalPage kind="prywatnosc" />} />
        </Routes>
        </Suspense>
      </main>

      <nav className="tabbar" aria-label="Nawigacja dolna">
        {NAV.filter((n) => !(n as { hideTab?: boolean }).hideTab).map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={n.icon} /></svg>
            <span>{(n as { short?: string }).short ?? n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

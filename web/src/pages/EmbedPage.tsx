import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import { loadAeds, availability, displayName, subLine } from '../data';
import type { Aed, Availability } from '../data';
import { aedLink, PUBLIC_URL } from '../config';

const COLOR: Record<Availability, string> = { open: '#007a3d', closed: '#6b7680', unknown: '#c27a00' };
const LABEL: Record<Availability, string> = { open: 'dostępny teraz', closed: 'teraz niedostępny', unknown: 'godziny nieznane' };

/**
 * Widżet do osadzenia (iframe) na stronach gmin, szkół, firm: mapa AED powiatu albo okolicy punktu.
 * Parametry: ?powiat=<etykieta> | ?lat=&lon=&z=  (opcjonalnie &tytul=)
 */
export default function EmbedPage() {
  const [p] = useSearchParams();
  const el = useRef<HTMLDivElement>(null);
  const [aeds, setAeds] = useState<Aed[]>([]);
  useEffect(() => { loadAeds().then(setAeds); }, []);

  const powiat = p.get('powiat') || '';
  const lat = Number(p.get('lat')), lon = Number(p.get('lon')), z = Number(p.get('z')) || 14;
  const title = p.get('tytul') || (powiat ? `Defibrylatory AED — ${powiat.replace(/^powiat /, '')}` : 'Defibrylatory AED w okolicy');
  const shown = useMemo(() => (powiat ? aeds.filter((a) => a.powiat === powiat) : aeds), [aeds, powiat]);
  const now = useMemo(() => new Date(), [aeds]);
  const openCount = shown.filter((a) => availability(a, now) === 'open').length;

  useEffect(() => {
    if (!el.current || !aeds.length) return;
    const map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© współtwórcy OpenStreetMap' }).addTo(map);
    const group = L.markerClusterGroup({ maxClusterRadius: 40, showCoverageOnHover: false });
    for (const a of shown) {
      const av = availability(a, now);
      const m = L.circleMarker([a.lat, a.lon], { radius: 8, color: '#fff', weight: 2, fillColor: COLOR[av], fillOpacity: 1 });
      const sub = subLine(a);
      m.bindPopup(`<b>${displayName(a).replace(/</g, '&lt;')}</b><br>${sub && !sub.startsWith('brak opisu') ? `${sub.replace(/</g, '&lt;')}<br>` : ''}<span style="color:${COLOR[av]};font-weight:700">${LABEL[av]}</span><br><a href="${aedLink(a.aed_uid)}" target="_blank" rel="noopener">Otwórz w AEDostępni →</a>`);
      group.addLayer(m);
    }
    group.addTo(map);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat && lon) map.setView([lat, lon], z);
    else if (shown.length) map.fitBounds(L.latLngBounds(shown.map((a) => [a.lat, a.lon] as [number, number])).pad(0.05));
    else map.setView([52, 19.3], 6);
    return () => { map.remove(); };
  }, [aeds, shown]);

  return (
    <div className="embed">
      <header className="embed-head">
        <img src="./brand/aedostepni-symbol.svg" alt="" width="26" height="26" />
        <div><b>{title}</b><span>{shown.length.toLocaleString('pl-PL')} AED · {openCount} dostępnych teraz</span></div>
        <a className="embed-sos" href={`${PUBLIC_URL}#/ratunek`} target="_blank" rel="noopener">SOS</a>
      </header>
      <div ref={el} className="embed-map" role="region" aria-label={`Mapa: ${title}`} />
      <footer className="embed-foot">
        <span><i style={{ background: COLOR.open }} /> dostępny teraz <i style={{ background: COLOR.unknown }} /> godziny nieznane <i style={{ background: COLOR.closed }} /> niedostępny</span>
        <a href={PUBLIC_URL} target="_blank" rel="noopener">AEDostępni · dane: dane.gov.pl, OSM</a>
      </footer>
    </div>
  );
}

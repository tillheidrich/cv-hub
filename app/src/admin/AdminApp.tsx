import { useCallback, useEffect, useState } from 'react';
import { BRAND } from '../landing/brand.js';
import AdminVouchers from '../screens/AdminVouchers';
import { adminFetch, setLoggedOutHandler, type Overview as OverviewData, type SessionInfo } from './api';
import Login from './Login';
import Access from './pages/Access';
import CustomerDetail from './pages/CustomerDetail';
import Customers from './pages/Customers';
import Declarations from './pages/Declarations';
import Invoices from './pages/Invoices';
import Overview from './pages/Overview';
import Payments from './pages/Payments';
import System from './pages/System';
import Trends from './pages/Trends';
import Usage from './pages/Usage';
import { PageHead } from './ui';

type Route = { page: string; id?: number };
const PAGES: [string, string][] = [
  ['ueberblick', 'Überblick'],
  ['verlauf', 'Verlauf'],
  ['nutzung', 'Nutzung'],
  ['kunden', 'Kunden'],
  ['zahlungen', 'Zahlungen'],
  ['rechnungen', 'Rechnungen'],
  ['erklaerungen', 'Widerrufe'],
  ['gutscheine', 'Gutscheine'],
  ['zugang', 'Einladungen'],
  ['system', 'System'],
];

function parseHash(): Route {
  const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  const [page, id] = h.split('/');
  if (page === 'kunden' && id && /^\d+$/.test(id)) return { page, id: Number(id) };
  return { page: PAGES.some(([p]) => p === page) ? page : 'ueberblick' };
}

/* Hell/dunkel: folgt dem System, lässt sich umschalten. Gemerkt im Browser
 * (nur Bequemlichkeit, darf fehlen). */
function readTheme(): 'auto' | 'light' | 'dark' {
  try { const v = localStorage.getItem('cv-admin-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}
function applyTheme(t: 'auto' | 'light' | 'dark') {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { if (t === 'auto') localStorage.removeItem('cv-admin-theme'); else localStorage.setItem('cv-admin-theme', t); } catch { /* egal */ }
}

export default function AdminApp() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [route, setRoute] = useState<Route>(parseHash);
  const [theme, setTheme] = useState(readTheme);
  const [badges, setBadges] = useState<{ declarations: number; requests: number }>({ declarations: 0, requests: 0 });

  const check = useCallback(async () => {
    try { setSession(await adminFetch<SessionInfo>('/api/admin/auth/session')); }
    catch { setSession(null); }
    finally { setChecked(true); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); }, [check]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    setLoggedOutHandler(() => setSession(s => (s ? { ...s, authenticated: false } : s)));
    return () => setLoggedOutHandler(null);
  }, []);
  useEffect(() => {
    const label = PAGES.find(([p]) => p === route.page)?.[1] || 'Admin';
    document.title = `${route.id ? `Kunde #${route.id}` : label} · Admin · ${BRAND.name}`;
    window.scrollTo(0, 0);
  }, [route]);
  // Zähler für die Navigation, einmal nach der Anmeldung.
  useEffect(() => {
    if (!session?.authenticated) return;
    adminFetch<OverviewData>('/api/admin/overview')
      .then(o => setBadges({ declarations: o.declarations.manual, requests: o.accessRequestsPending }))
      .catch(() => {});
  }, [session?.authenticated]);

  if (!checked) return <main className="adm-login" aria-busy="true"><p className="adm-hint">Lädt …</p></main>;
  if (!session?.authenticated) return <Login session={session} onDone={() => void check()} />;

  async function logout() {
    try { await adminFetch('/api/admin/auth/logout', { body: {} }); } catch { /* trotzdem raus */ }
    await check();
  }
  const [brandA, brandB] = BRAND.name.split('/');
  const nextTheme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
  const themeLabel = theme === 'auto' ? 'Farbschema: wie System' : theme === 'dark' ? 'Farbschema: dunkel' : 'Farbschema: hell';

  let page;
  switch (route.page) {
    case 'verlauf': page = <Trends />; break;
    case 'nutzung': page = <Usage />; break;
    case 'kunden': page = route.id ? <CustomerDetail id={route.id} /> : <Customers />; break;
    case 'zahlungen': page = <Payments />; break;
    case 'rechnungen': page = <Invoices />; break;
    case 'erklaerungen': page = <Declarations />; break;
    case 'gutscheine': page = (<><PageHead title="Gutscheine und Kampagnen" sub="Anlegen, Einlösungen je Kampagne, deaktivieren." /><AdminVouchers /></>); break;
    case 'zugang': page = <Access />; break;
    case 'system': page = <System />; break;
    default: page = <Overview />;
  }

  return (
    <div className="adm-shell">
      <a href="#adm-main" className="adm-sr">Zum Inhalt</a>
      <aside className="adm-side">
        <div className="adm-side-top">
          <div className="adm-brand">{brandA}{brandB !== undefined && <span>/{brandB}</span>}<small>Admin · {session.user?.username}</small></div>
          <span className="adm-row adm-only-mobile" style={{ gap: 4 }}>
            <button type="button" className="adm-btn" data-kind="ghost" onClick={() => setTheme(nextTheme)} aria-label={themeLabel} title={themeLabel}>◐</button>
            <button type="button" className="adm-btn" onClick={() => void logout()}>Abmelden</button>
          </span>
        </div>
        <nav className="adm-nav" aria-label="Bereiche">
          {PAGES.map(([p, label]) => {
            const n = p === 'erklaerungen' ? badges.declarations : p === 'zugang' ? badges.requests : 0;
            return (
              <a key={p} href={`#/${p}`} aria-current={route.page === p ? 'page' : undefined}>
                <span>{label}</span>{n > 0 && <span className="adm-badge" aria-label={`${n} offen`}>{n}</span>}
              </a>
            );
          })}
        </nav>
        <div className="adm-side-foot">
          {session.mainUrl && <a href={session.mainUrl}>Zur App</a>}
          <button type="button" className="adm-btn" data-kind="ghost" onClick={() => setTheme(nextTheme)} style={{ justifyContent: 'flex-start', padding: '6px 0' }}>{themeLabel}</button>
          <button type="button" className="adm-btn" onClick={() => void logout()}>Abmelden</button>
          {session.mode === 'legacy' && <p className="adm-hint">Ohne eigene Admin-Adresse (ADMIN_HOST fehlt).</p>}
        </div>
      </aside>
      <main id="adm-main" className="adm-main" tabIndex={-1}>{page}</main>
    </div>
  );
}

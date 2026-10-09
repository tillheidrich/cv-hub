// ── Weitere Abschnitte: Projekte, Zertifikate, Ehrenamt, Publikationen, frei ──
//
// Wettbewerbsbericht vom 08.10.2026, Lücke 2: „feste 7 Abschnitte, ‚Weiteres'
// nur Stringliste". Hier entstehen die übrigen — als feste Liste, weil Parser
// bekannte Überschriften besser zuordnen, plus beliebig viele freie Abschnitte
// mit eigener Überschrift für alles andere.
//
// Eingebunden ist der Editor als Leiste am Fuß des Inhalt-Paneels. Ein Klick
// legt ein Blatt genau über das Paneel; die Vorschau daneben bleibt sichtbar
// und zeigt jede Eingabe sofort. Das Blatt ist nicht modal: Wer nachsehen
// will, wie ein Projekt in der Vorlage steht, klickt daneben ins Dokument.
//
// Leere Einträge erscheinen nirgends (data/extraSections.ts). Deshalb legt
// „+ Abschnitt" sofort einen leeren Eintrag an, statt erst zu fragen — und
// ein angefangener, nicht ausgefüllter Abschnitt stört das Dokument nicht.

import { useEffect, useId, useRef, useState, useLayoutEffect } from 'react';
import type {
  CVData, ProjectEntry, CertificateEntry, VolunteerEntry, PublicationEntry,
  CustomSection, CustomEntry,
} from '../data/types';
import type { UiLang } from '../ui/i18n';
import { Portal } from '../ui/Overlay';
import { sectionHeading, newExtraId, hasExtra, FIXED_EXTRA_KEYS, type FixedExtraKey } from '../data/extraSections';
import { EXTRA_UI, type ExtraStrings as Strings } from './extraSectionsText';
import { EXTRA_SECTION_LABELS } from '../data/labels';

// ── Bausteine ───────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: '13.5px', color: 'var(--ink)', background: '#ffffff',
  border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', color: 'var(--ink-2)', marginBottom: '5px',
};
const smallBtn: React.CSSProperties = {
  minWidth: 32, minHeight: 32, padding: '0 8px', background: 'none', border: 'none', borderRadius: 8,
  cursor: 'pointer', fontSize: '14px', color: 'var(--ink-2)', fontFamily: 'inherit',
};
const addBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: 32, padding: '0 12px',
  background: 'oklch(0.96 0.03 264)', border: '1px solid var(--hair)', borderRadius: '8px',
  fontSize: '12px', fontWeight: 600, color: 'var(--accent-ink)', cursor: 'pointer', fontFamily: 'inherit',
};

function Field({ label, value, onChange, placeholder, hint, focusKey }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; focusKey?: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div style={{ marginBottom: '12px', minWidth: 0 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} type="text" value={value} placeholder={placeholder} data-extra-focus={focusKey}
        aria-describedby={hint ? hintId : undefined}
        onChange={e => onChange(e.target.value)} style={inputStyle} />
      {hint && <div id={hintId} style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <div style={{ marginBottom: '12px' }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <textarea id={id} value={value} rows={rows} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
    </div>
  );
}

/** Eine Zeile = ein Stichpunkt. Roher Text während des Schreibens, damit
 *  Enter und Leerzeichen nicht weggeschnitten werden (Muster BulletsEditor). */
function LinesField({ label, lines, onChange }: { label: string; lines: string[]; onChange: (l: string[]) => void }) {
  const id = useId();
  const joined = lines.join('\n');
  const [raw, setRaw] = useState(joined);
  const last = useRef(joined);
  useEffect(() => {
    if (joined !== last.current) { setRaw(joined); last.current = joined; }
  }, [joined]);
  const commit = (text: string, final: boolean) => {
    const parts = text.split('\n');
    const next = final ? parts.map(l => l.trim()).filter(Boolean) : parts.filter((l, i) => l.trim() !== '' || i === parts.length - 1);
    last.current = next.join('\n');
    onChange(next);
  };
  return (
    <div style={{ marginBottom: '12px' }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <textarea id={id} value={raw} rows={3}
        onChange={e => { setRaw(e.target.value); commit(e.target.value, false); }}
        onBlur={() => commit(raw, true)}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
    </div>
  );
}

const two: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0 12px' };

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ── Liste von Einträgen ─────────────────────────────────────────────────────

function EntryList<T extends { id: string }>({ items, onChange, t, labelOf, create, render }: {
  items: T[]; onChange: (next: T[]) => void; t: Strings;
  labelOf: (e: T) => string; create: () => T;
  render: (e: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(items.length === 1 ? items[0].id : null);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{t.entries(items.length)}</span>
        <button type="button" style={addBtn} onClick={() => { const e = create(); onChange([...items, e]); setOpenId(e.id); }}>{t.addEntry}</button>
      </div>
      {items.map((e, i) => {
        const name = labelOf(e) || t.newEntry;
        const isOpen = openId === e.id;
        const bodyId = `extra-entry-${e.id}`;
        return (
          <div key={e.id} style={{ border: '1px solid var(--hair)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px 4px 10px', background: 'oklch(0.975 0.004 264)' }}>
              <button type="button" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setOpenId(isOpen ? null : e.id)}
                style={{ flex: 1, minWidth: 0, minHeight: 32, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <span aria-hidden style={{ fontSize: '12px' }}>{isOpen ? '▾' : '▸'}</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: labelOf(e) ? 'var(--ink)' : 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              </button>
              <button type="button" style={smallBtn} disabled={i === 0} aria-label={t.moveUp(name)} onClick={() => onChange(move(items, i, -1))}>↑</button>
              <button type="button" style={smallBtn} disabled={i === items.length - 1} aria-label={t.moveDown(name)} onClick={() => onChange(move(items, i, 1))}>↓</button>
              <button type="button" style={{ ...smallBtn, color: '#b3261e' }} aria-label={t.removeEntry(name)} onClick={() => onChange(items.filter(x => x.id !== e.id))}>×</button>
            </div>
            {isOpen && (
              <div id={bodyId} style={{ padding: '12px 12px 2px', borderTop: '1px solid var(--hair)' }}>
                {render(e, patch => onChange(items.map(x => (x.id === e.id ? { ...x, ...patch } : x))))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Karten je Abschnitt ─────────────────────────────────────────────────────

function SectionCard({ title, hint, children, onRemove, t, extraButtons }: {
  title: string; hint?: string; children: React.ReactNode; onRemove: () => void; t: Strings; extraButtons?: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const headId = useId();
  return (
    <section aria-labelledby={headId} style={{ border: '1px solid var(--hair)', borderRadius: '12px', padding: '12px 12px 4px', marginBottom: '14px', background: 'oklch(0.99 0.002 264)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 id={headId} style={{ margin: 0, fontSize: '14px', fontWeight: 650, color: 'var(--ink)' }}>{title}</h3>
          {hint && <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '2px' }}>{hint}</div>}
        </div>
        {extraButtons}
        {confirm ? (
          <span style={{ display: 'inline-flex', gap: '4px' }}>
            <button type="button" className="ui-btn" style={{ minHeight: 32, fontSize: '12px', color: '#b3261e' }} onClick={onRemove}>{t.confirmRemove}</button>
            <button type="button" className="ui-btn" style={{ minHeight: 32, fontSize: '12px' }} onClick={() => setConfirm(false)}>{t.cancel}</button>
          </span>
        ) : (
          <button type="button" className="ui-btn" style={{ minHeight: 32, fontSize: '12px', color: 'var(--ink-2)' }} onClick={() => setConfirm(true)}>{t.removeSection}</button>
        )}
      </div>
      {children}
    </section>
  );
}

const trimmed = (s?: string) => (s || '').trim();

function FixedSection({ k, data, onChange, t }: { k: FixedExtraKey; data: CVData; onChange: (d: CVData) => void; t: Strings }) {
  const docDefault = EXTRA_SECTION_LABELS[data.labels?.lang ?? 'de']?.[k] ?? sectionHeading(data.labels, k);
  const own = ((data.labels?.sections as Record<string, string | undefined>)?.[k]) ?? '';
  const setHeading = (v: string) => onChange({ ...data, labels: { ...data.labels, sections: { ...data.labels.sections, [k]: v } } });
  const remove = () => { const next = { ...data }; delete next[k]; onChange(next); };
  const headingField = <Field label={t.heading} value={own} placeholder={docDefault} hint={t.headingHint} onChange={setHeading} focusKey={`section-${k}`} />;

  if (k === 'projects') {
    const items = data.projects ?? [];
    return (
      <SectionCard title={sectionHeading(data.labels, k)} hint={t.kindHints[k]} onRemove={remove} t={t}>
        {headingField}
        <EntryList<ProjectEntry> items={items} t={t} onChange={l => onChange({ ...data, projects: l })}
          labelOf={e => trimmed(e.title)} create={() => ({ id: newExtraId('prj'), title: '', role: '', start: '', end: '', url: '', description: '', bullets: [] })}
          render={(e, set) => (<>
            <Field label={t.f.title} value={e.title ?? ''} onChange={v => set({ title: v })} />
            <Field label={t.f.role} value={e.role ?? ''} onChange={v => set({ role: v })} />
            <div style={two}>
              <Field label={t.f.from} value={e.start ?? ''} placeholder={t.datePh} onChange={v => set({ start: v })} />
              <Field label={t.f.to} value={e.end ?? ''} placeholder={t.toPh} onChange={v => set({ end: v })} />
            </div>
            <Field label={t.f.link} value={e.url ?? ''} placeholder={t.linkPh} onChange={v => set({ url: v })} />
            <TextField label={t.f.description} value={e.description ?? ''} onChange={v => set({ description: v })} />
            <LinesField label={t.f.bullets} lines={e.bullets ?? []} onChange={l => set({ bullets: l })} />
          </>)} />
      </SectionCard>
    );
  }
  if (k === 'certificates') {
    const items = data.certificates ?? [];
    return (
      <SectionCard title={sectionHeading(data.labels, k)} hint={t.kindHints[k]} onRemove={remove} t={t}>
        {headingField}
        <EntryList<CertificateEntry> items={items} t={t} onChange={l => onChange({ ...data, certificates: l })}
          labelOf={e => trimmed(e.name)} create={() => ({ id: newExtraId('crt'), name: '', issuer: '', date: '', credentialId: '', url: '' })}
          render={(e, set) => (<>
            <Field label={t.f.name} value={e.name ?? ''} onChange={v => set({ name: v })} />
            <div style={two}>
              <Field label={t.f.issuer} value={e.issuer ?? ''} onChange={v => set({ issuer: v })} />
              <Field label={t.f.date} value={e.date ?? ''} placeholder={t.datePh} onChange={v => set({ date: v })} />
            </div>
            <Field label={t.f.credentialId} value={e.credentialId ?? ''} onChange={v => set({ credentialId: v })} />
            <Field label={t.f.link} value={e.url ?? ''} placeholder={t.linkPh} onChange={v => set({ url: v })} />
          </>)} />
      </SectionCard>
    );
  }
  if (k === 'volunteering') {
    const items = data.volunteering ?? [];
    return (
      <SectionCard title={sectionHeading(data.labels, k)} hint={t.kindHints[k]} onRemove={remove} t={t}>
        {headingField}
        <EntryList<VolunteerEntry> items={items} t={t} onChange={l => onChange({ ...data, volunteering: l })}
          labelOf={e => trimmed(e.role) || trimmed(e.organization)} create={() => ({ id: newExtraId('vol'), role: '', organization: '', location: '', start: '', end: '', bullets: [] })}
          render={(e, set) => (<>
            <Field label={t.f.role} value={e.role ?? ''} onChange={v => set({ role: v })} />
            <div style={two}>
              <Field label={t.f.organization} value={e.organization ?? ''} onChange={v => set({ organization: v })} />
              <Field label={t.f.location} value={e.location ?? ''} onChange={v => set({ location: v })} />
              <Field label={t.f.from} value={e.start ?? ''} placeholder={t.datePh} onChange={v => set({ start: v })} />
              <Field label={t.f.to} value={e.end ?? ''} placeholder={t.toPh} onChange={v => set({ end: v })} />
            </div>
            <LinesField label={t.f.bullets} lines={e.bullets ?? []} onChange={l => set({ bullets: l })} />
          </>)} />
      </SectionCard>
    );
  }
  const items = data.publications ?? [];
  return (
    <SectionCard title={sectionHeading(data.labels, k)} hint={t.kindHints[k]} onRemove={remove} t={t}>
      {headingField}
      <EntryList<PublicationEntry> items={items} t={t} onChange={l => onChange({ ...data, publications: l })}
        labelOf={e => trimmed(e.title)} create={() => ({ id: newExtraId('pub'), title: '', publisher: '', date: '', url: '', description: '' })}
        render={(e, set) => (<>
          <Field label={t.f.title} value={e.title ?? ''} onChange={v => set({ title: v })} />
          <div style={two}>
            <Field label={t.f.publisher} value={e.publisher ?? ''} onChange={v => set({ publisher: v })} />
            <Field label={t.f.date} value={e.date ?? ''} placeholder={t.datePh} onChange={v => set({ date: v })} />
          </div>
          <Field label={t.f.link} value={e.url ?? ''} placeholder={t.linkPh} onChange={v => set({ url: v })} />
          <TextField label={t.f.description} value={e.description ?? ''} onChange={v => set({ description: v })} rows={2} />
        </>)} />
    </SectionCard>
  );
}

function CustomSectionCard({ sec, index, count, onChange, onRemove, onMove, t }: {
  sec: CustomSection; index: number; count: number; t: Strings;
  onChange: (s: CustomSection) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
}) {
  const name = trimmed(sec.title) || t.kinds.custom;
  return (
    <SectionCard title={name} hint={t.kindHints.custom} onRemove={onRemove} t={t}
      extraButtons={count > 1 ? (<>
        <button type="button" style={smallBtn} disabled={index === 0} aria-label={t.moveUp(name)} onClick={() => onMove(-1)}>↑</button>
        <button type="button" style={smallBtn} disabled={index === count - 1} aria-label={t.moveDown(name)} onClick={() => onMove(1)}>↓</button>
      </>) : undefined}>
      <Field label={t.customTitle} value={sec.title ?? ''} placeholder={t.customTitlePlaceholder} onChange={v => onChange({ ...sec, title: v })} focusKey={`custom-${sec.id}`} />
      <LinesField label={t.f.items} lines={sec.items ?? []} onChange={l => onChange({ ...sec, items: l })} />
      <EntryList<CustomEntry> items={sec.entries ?? []} t={t} onChange={l => onChange({ ...sec, entries: l })}
        labelOf={e => trimmed(e.title) || trimmed(e.subtitle)} create={() => ({ id: newExtraId('ent'), title: '', subtitle: '', date: '', text: '' })}
        render={(e, set) => (<>
          <Field label={t.f.title} value={e.title ?? ''} onChange={v => set({ title: v })} />
          <div style={two}>
            <Field label={t.f.subtitle} value={e.subtitle ?? ''} onChange={v => set({ subtitle: v })} />
            <Field label={t.f.date} value={e.date ?? ''} placeholder={t.datePh} onChange={v => set({ date: v })} />
          </div>
          <TextField label={t.f.text} value={e.text ?? ''} onChange={v => set({ text: v })} rows={2} />
        </>)} />
    </SectionCard>
  );
}

// ── Leiste und Blatt ────────────────────────────────────────────────────────

export default function ExtraSectionsEditor({ data, onChange, uiLang, readOnly = false }: {
  data: CVData;
  onChange: (d: CVData) => void;
  uiLang: UiLang;
  /** Nur ansehen (z. B. geteilte Fassung) — nichts ist änderbar. */
  readOnly?: boolean;
}) {
  const t = EXTRA_UI[uiLang] ?? EXTRA_UI.de;
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const titleId = useId();
  const addListId = useId();

  const present = FIXED_EXTRA_KEYS.filter(k => Array.isArray(data[k]));
  const customs = Array.isArray(data.customSections) ? data.customSections : [];
  const filled = [...FIXED_EXTRA_KEYS.filter(k => hasExtra(data, k)).map(k => sectionHeading(data.labels, k)),
    ...customs.filter(c => trimmed(c.title)).map(c => trimmed(c.title))];

  /* Das Blatt liegt genau über dem Inhalt-Paneel. Gemessen wird beim Öffnen
   * und bei jeder Größenänderung; ohne Paneel (schmale Ansicht ohne Rahmen)
   * nimmt es die linke Bildschirmhälfte, auf dem Telefon die volle Breite. */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const host = barRef.current?.closest('.ui-panel') as HTMLElement | null ?? barRef.current?.parentElement ?? null;
      const r = host?.getBoundingClientRect();
      if (r && r.width > 240 && r.height > 240) setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      else setRect({ top: 8, left: 8, width: Math.min(480, window.innerWidth - 16), height: window.innerHeight - 16 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLElement>('[data-extra-title]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!sheetRef.current?.contains(document.activeElement)) return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!focusKey || !open) return;
    requestAnimationFrame(() => {
      const el = sheetRef.current?.querySelector<HTMLElement>(`[data-extra-focus="${focusKey}"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFocusKey(null);
    });
  }, [focusKey, open, data]);

  const addFixed = (k: FixedExtraKey) => {
    const seed: Record<FixedExtraKey, () => CVData> = {
      projects: () => ({ ...data, projects: [{ id: newExtraId('prj'), title: '', role: '', start: '', end: '', url: '', description: '', bullets: [] }] }),
      certificates: () => ({ ...data, certificates: [{ id: newExtraId('crt'), name: '', issuer: '', date: '', credentialId: '', url: '' }] }),
      volunteering: () => ({ ...data, volunteering: [{ id: newExtraId('vol'), role: '', organization: '', location: '', start: '', end: '', bullets: [] }] }),
      publications: () => ({ ...data, publications: [{ id: newExtraId('pub'), title: '', publisher: '', date: '', url: '', description: '' }] }),
    };
    onChange(seed[k]());
    setAdding(false);
    setFocusKey(`section-${k}`);
  };
  const addCustom = () => {
    const sec: CustomSection = { id: newExtraId('sec'), title: '', items: [], entries: [] };
    onChange({ ...data, customSections: [...customs, sec] });
    setAdding(false);
    setFocusKey(`custom-${sec.id}`);
  };
  const setCustom = (i: number, s: CustomSection) => onChange({ ...data, customSections: customs.map((c, j) => (j === i ? s : c)) });

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  return (
    <>
      <div ref={barRef} style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--hair)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 620, color: 'var(--ink)' }}>{t.bar}</div>
          <div style={{ fontSize: '11px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filled.length ? filled.join(' · ') : t.barHint}
          </div>
        </div>
        <button ref={triggerRef} type="button" className="ui-btn" aria-expanded={open} aria-haspopup="dialog"
          onClick={() => { setOpen(true); if (!present.length && !customs.length) setAdding(true); }}
          style={{ minHeight: 34, flexShrink: 0, background: 'var(--accent-wash)', color: 'var(--accent-ink)', fontWeight: 600 }}>
          {present.length || customs.length ? t.barOpen : t.barAdd}
        </button>
      </div>

      {open && rect && (
        <Portal>
          <div ref={sheetRef} role="dialog" aria-modal="false" aria-labelledby={titleId}
            style={{
              position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, zIndex: 1150,
              background: 'var(--float-solid, #fff)', borderRadius: 'var(--r-panel, 18px)',
              boxShadow: 'var(--float-ring, 0 0 0 1px rgba(0,0,0,.08)), 0 18px 48px oklch(0.21 0.021 264 / 0.18)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 10px 10px 20px', borderBottom: '1px solid var(--hair)', flexShrink: 0 }}>
              <h2 id={titleId} data-extra-title tabIndex={-1} style={{ flex: 1, margin: 0, fontSize: '16px', fontWeight: 650, color: 'var(--ink)', outline: 'none' }}>{t.title}</h2>
              <button type="button" className="ui-btn ui-icon-btn" onClick={close} aria-label={t.close} style={{ minWidth: 40, minHeight: 40, fontSize: '20px', color: 'var(--ink-2)' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 28px' }}>
              <p style={{ margin: '0 0 14px', fontSize: '12px', lineHeight: 1.55, color: 'var(--ink-2)' }}>{t.intro}</p>
              <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.title}</legend>
                {present.map(k => <FixedSection key={k} k={k} data={data} onChange={onChange} t={t} />)}
                {customs.map((c, i) => (
                  <CustomSectionCard key={c.id || i} sec={c} index={i} count={customs.length} t={t}
                    onChange={s => setCustom(i, s)}
                    onRemove={() => onChange({ ...data, customSections: customs.filter((_, j) => j !== i) })}
                    onMove={d => onChange({ ...data, customSections: move(customs, i, d) })} />
                ))}

                <div style={{ marginTop: '6px' }}>
                  <button type="button" style={addBtn} aria-expanded={adding} aria-controls={addListId} onClick={() => setAdding(a => !a)}>{t.addSection}</button>
                  {adding && (
                    <div id={addListId} role="group" aria-label={t.addChoose} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      {FIXED_EXTRA_KEYS.filter(k => !present.includes(k)).map(k => (
                        <button key={k} type="button" onClick={() => addFixed(k)}
                          style={{ textAlign: 'left', padding: '10px 12px', minHeight: 44, border: '1px solid var(--hair)', borderRadius: '10px', background: '#fff', cursor: 'pointer', font: 'inherit' }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{t.kinds[k]}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-2)', marginTop: '2px' }}>{t.kindHints[k]}</span>
                        </button>
                      ))}
                      <button type="button" onClick={addCustom}
                        style={{ textAlign: 'left', padding: '10px 12px', minHeight: 44, border: '1px dashed var(--hair)', borderRadius: '10px', background: '#fff', cursor: 'pointer', font: 'inherit' }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{t.kinds.custom}</span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-2)', marginTop: '2px' }}>{t.kindHints.custom}</span>
                      </button>
                    </div>
                  )}
                </div>
              </fieldset>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

import { useState } from 'react';
import type { CoverLetterData } from '../data/types';
import type { UiLang } from '../ui/i18n';
import { EP } from '../ui/editorI18n';

interface Props {
  data: CoverLetterData;
  onUpdate: (updater: (d: CoverLetterData) => CoverLetterData) => void;
  /** UI language for the editor form (independent of CV content language). */
  uiLang: UiLang;
  /** Retained for backwards compat; previously enabled an AI generation flow. */
  resumeId?: string | null;
}

const F = "'Inter', sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid oklch(0.87 0.006 264)',
  borderRadius: '7px',
  fontSize: '13.5px',
  color: 'oklch(0.21 0.021 264)',
  background: '#ffffff',
  fontFamily: F,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border 0.12s',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.4px',
  color: 'oklch(0.44 0.017 264)',
  marginBottom: '5px',
  display: 'block',
  fontFamily: F,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
  minHeight: '76px',
};

// ── Collapsible section ──────────────────────────────────────────────────────

function Section({ title, hint, open, onToggle, children }: {
  title: string; hint: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid oklch(0.91 0.005 264)', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden', background: '#fff' }}>
      <button type="button" onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 14px',
        background: open ? 'oklch(0.968 0.004 264)' : '#ffffff', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: '13px', color: 'oklch(0.55 0.216 264)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: F }}>{title}</span>
          <span style={{ display: 'block', fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', fontFamily: F, marginTop: '1px' }}>{hint}</span>
        </span>
      </button>
      {open && <div style={{ padding: '14px', borderTop: '1px solid oklch(0.91 0.005 264)', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, textarea, rows, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; rows?: number; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const border = focused ? '1px solid oklch(0.55 0.216 264)' : '1px solid oklch(0.87 0.006 264)';
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          rows={rows ?? 4} placeholder={placeholder} style={{ ...textareaStyle, border }} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} style={{ ...inputStyle, border }} />
      )}
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

type SecId = 'recipient' | 'head' | 'body' | 'signoff';

export default function CoverLetterEditor({ data, onUpdate, uiLang }: Props) {
  const t = EP[uiLang];
  const [open, setOpen] = useState<Record<SecId, boolean>>({ recipient: true, head: true, body: true, signoff: false });

  function toggle(id: SecId) { setOpen(o => ({ ...o, [id]: !o[id] })); }
  function set<K extends keyof CoverLetterData>(key: K, value: CoverLetterData[K]) {
    onUpdate(d => ({ ...d, [key]: value }));
  }

  return (
    <div style={{ width: '404px', maxWidth: '100%', minWidth: 0, flexShrink: 1, background: '#fff', borderRight: '1px solid oklch(0.91 0.005 264)', display: 'flex', flexDirection: 'column', overflowY: 'auto', fontFamily: F }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid oklch(0.91 0.005 264)', background: 'oklch(0.985 0.003 264)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.21 0.021 264)' }}>{t.clTitle}</div>
        <div style={{ fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', marginTop: '2px' }}>{t.clSubtitle}</div>
      </div>

      <div style={{ padding: '14px 16px 28px' }}>
        <Section title={t.clRecipient} hint={t.clRecipientHint} open={open.recipient} onToggle={() => toggle('recipient')}>
          <Field label={t.clCompany} value={data.company} onChange={v => set('company', v)} placeholder={t.clCompanyPlaceholder} />
          <Field label={t.clContact} value={data.contactPerson} onChange={v => set('contactPerson', v)} placeholder={t.clContactPlaceholder} />
          <Field label={t.clAddress} value={data.companyAddress} onChange={v => set('companyAddress', v)} placeholder={t.clAddressPlaceholder} />
        </Section>

        <Section title={t.clHead} hint={t.clHeadHint} open={open.head} onToggle={() => toggle('head')}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}><Field label={t.clCity} value={data.city} onChange={v => set('city', v)} placeholder={t.clCityPlaceholder} /></div>
            <div style={{ flex: 2 }}><Field label={t.clDate} value={data.date} onChange={v => set('date', v)} placeholder={t.clDatePlaceholder} /></div>
          </div>
          <Field label={t.clSubject} value={data.subject} onChange={v => set('subject', v)} placeholder={t.clSubjectPlaceholder} />
          <Field label={t.clSalutation} value={data.salutation} onChange={v => set('salutation', v)} placeholder={t.clSalutationPlaceholder} />
        </Section>

        <Section title={t.clBody} hint={t.clBodyHint} open={open.body} onToggle={() => toggle('body')}>
          <Field label={t.clIntro} value={data.intro} onChange={v => set('intro', v)} textarea rows={3} placeholder={t.clIntroPlaceholder} />
          <Field label={t.clMain} value={data.mainBody} onChange={v => set('mainBody', v)} textarea rows={4} placeholder={t.clMainPlaceholder} />
          <Field label={t.clCompanyRef} value={data.companyReference} onChange={v => set('companyReference', v)} textarea rows={3} placeholder={t.clCompanyRefPlaceholder} />
          <Field label={t.clMotivation} value={data.motivation} onChange={v => set('motivation', v)} textarea rows={3} placeholder={t.clMotivationPlaceholder} />
          <Field label={t.clClosing} value={data.closing} onChange={v => set('closing', v)} textarea rows={2} placeholder={t.clClosingPlaceholder} />
        </Section>

        <Section title={t.clSignoffSection} hint={t.clSignoffHint} open={open.signoff} onToggle={() => toggle('signoff')}>
          <Field label={t.clSignoff} value={data.signoff} onChange={v => set('signoff', v)} placeholder={t.clSignoffPlaceholder} />
        </Section>

        <div style={{ padding: '11px 13px', background: 'oklch(0.968 0.004 264)', borderRadius: '9px', border: '1px solid oklch(0.91 0.005 264)', fontSize: '11px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.55 }}>
          {t.clFooter}
        </div>
      </div>
    </div>
  );
}

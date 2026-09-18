import { useEffect, useId, useState, useRef } from 'react';
import { Icon } from '../ui/Icon';
import PhotoCropper from './PhotoCropper';
import type { CVData, ExperienceEntry, EducationEntry, SkillGroup, LanguageEntry, SocialLink, SocialPlatform } from '../data/types';
import type { UiLang } from '../ui/i18n';
import { EP, PanelI18nCtx, usePanelT } from '../ui/editorI18n';
import type { PanelStrings } from '../ui/editorI18n';
import { LABELS } from '../data/labels';

// ── Social platforms ────────────────────────────────────────────────────────
// Keep prefix logic in one place. Renderer reads this same map to display links.
export const SOCIAL_PLATFORMS: Record<SocialPlatform, { label: string; prefix: string; placeholder: string }> = {
  linkedin:  { label: 'LinkedIn',  prefix: 'linkedin.com/in/',   placeholder: 'username' },
  github:    { label: 'GitHub',    prefix: 'github.com/',        placeholder: 'username' },
  xing:      { label: 'Xing',      prefix: 'xing.com/profile/',  placeholder: 'username' },
  twitter:   { label: 'X / Twitter', prefix: 'x.com/',           placeholder: 'username' },
  bluesky:   { label: 'Bluesky',   prefix: 'bsky.app/profile/',  placeholder: 'username.bsky.social' },
  mastodon:  { label: 'Mastodon',  prefix: '',                   placeholder: '@user@instance.social' },
  instagram: { label: 'Instagram', prefix: 'instagram.com/',     placeholder: 'username' },
  youtube:   { label: 'YouTube',   prefix: 'youtube.com/@',      placeholder: 'channel' },
  tiktok:    { label: 'TikTok',    prefix: 'tiktok.com/@',       placeholder: 'username' },
  behance:   { label: 'Behance',   prefix: 'behance.net/',       placeholder: 'username' },
  dribbble:  { label: 'Dribbble',  prefix: 'dribbble.com/',      placeholder: 'username' },
  medium:    { label: 'Medium',    prefix: 'medium.com/@',       placeholder: 'username' },
  substack:  { label: 'Substack',  prefix: '',                   placeholder: 'name.substack.com' },
};

// ── Shared styles ────────────────────────────────────────────────────────────

const editorFont = "'Inter', sans-serif";

/* Width is responsive: 404px is the desktop sidebar slot. On mobile the
 * parent uses `flex: 1` and we need to fill it instead of clipping to 404px
 * — that's what made the editor look "stuck" on phones (right ~30px was
 * cut off + horizontal scroll). `minWidth: 0` lets the flex item actually
 * shrink. `maxWidth: 100%` caps it on narrow viewports. */
const panelStyle: React.CSSProperties = {
  width: '404px',
  maxWidth: '100%',
  minWidth: 0,
  flexShrink: 1,
  background: '#fff',
  borderRight: '1px solid oklch(0.91 0.005 264)',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'hidden',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid oklch(0.91 0.005 264)',
  background: 'oklch(0.985 0.003 264)',
  overflowX: 'auto',
  flexShrink: 0,
  scrollbarWidth: 'none',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '11px 15px',
  fontSize: '12.5px',
  fontWeight: active ? 700 : 500,
  color: active ? 'oklch(0.21 0.021 264)' : '#6b6458',
  background: active ? '#fff' : 'none',
  border: 'none',
  borderBottom: active ? '2px solid oklch(0.55 0.216 264)' : '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: editorFont,
  transition: 'color 0.12s',
  flexShrink: 0,
});

const scrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  /* Unten großzügig: Auf dem Telefon sitzt darunter die Bereichsleiste, und
     bei geöffneter Tastatur schiebt sich das letzte Feld sonst genau unter
     deren Kante. Am Schreibtisch kostet der Abstand nichts. */
  padding: '16px 20px calc(40px + env(safe-area-inset-bottom, 0px))',
};

const fieldGroup: React.CSSProperties = {
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.4px',
  textTransform: 'none',
  color: 'oklch(0.42 0.017 264)',
  marginBottom: '5px',
  fontFamily: editorFont,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  fontSize: '13.5px',
  color: 'oklch(0.21 0.021 264)',
  background: '#ffffff',
  border: '1px solid oklch(0.87 0.006 264)',
  borderRadius: '7px',
  outline: 'none',
  fontFamily: editorFont,
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '80px',
  lineHeight: 1.6,
};

const sectionDivider: React.CSSProperties = {
  height: '1px',
  background: 'oklch(0.91 0.005 264)',
  margin: '20px 0',
};

const addBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: 'oklch(0.96 0.03 264)',
  border: '1px solid oklch(0.91 0.005 264)',
  borderRadius: '6px',
  fontSize: '11.5px',
  fontWeight: 600,
  color: 'oklch(0.55 0.216 264)',
  cursor: 'pointer',
  fontFamily: editorFont,
};

const iconBtn = (color = '#767676'): React.CSSProperties => ({
  padding: '4px 6px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  color,
  lineHeight: 1,
});

const cardStyle: React.CSSProperties = {
  border: '1px solid oklch(0.91 0.005 264)',
  borderRadius: '8px',
  marginBottom: '12px',
  overflow: 'hidden',
};

const cardHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '11px 13px',
  background: 'oklch(0.968 0.004 264)',
  cursor: 'pointer',
  gap: '9px',
};

const cardBody: React.CSSProperties = {
  padding: '12px',
  borderTop: '1px solid oklch(0.91 0.005 264)',
};

// ── Helper: useField ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  // useId verbindet Label und Feld. Vorher standen beide nur nebeneinander —
  // für Screenreader war das Feld damit unbeschriftet, und ein Klick aufs
  // Label setzte den Fokus nicht.
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={fieldGroup}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{ ...inputStyle, border: focused ? '1px solid oklch(0.55 0.216 264)' : inputStyle.border, background: focused ? '#fff' : inputStyle.background }}
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 4, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={fieldGroup}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        placeholder={placeholder}
        style={{ ...textareaStyle, minHeight: `${rows * 22}px`, border: focused ? '1px solid oklch(0.55 0.216 264)' : textareaStyle.border, background: focused ? '#fff' : textareaStyle.background }}
      />
    </div>
  );
}

// ── Socials Editor ──────────────────────────────────────────────────────────

function SocialsEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  const p = data.personal;
  // Migrate legacy linkedin/instagram on first edit so the new model becomes
  // canonical without dropping anyone's data.
  const initialSocials: SocialLink[] = p.socials && p.socials.length
    ? p.socials
    : [
        ...(p.linkedin ? [{ id: 'lin-legacy', platform: 'linkedin' as const, value: p.linkedin }] : []),
        ...(p.instagram ? [{ id: 'ig-legacy', platform: 'instagram' as const, value: p.instagram }] : []),
      ];

  function setSocials(next: SocialLink[]) {
    onChange({ ...data, personal: { ...p, socials: next, linkedin: undefined, instagram: undefined } });
  }
  function add() {
    const used = new Set(initialSocials.map(s => s.platform));
    const firstFree = (Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).find(k => !used.has(k)) || 'linkedin';
    setSocials([...initialSocials, { id: `s-${Date.now()}`, platform: firstFree, value: '' }]);
  }
  function update(idx: number, patch: Partial<SocialLink>) {
    setSocials(initialSocials.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function remove(idx: number) {
    setSocials(initialSocials.filter((_, i) => i !== idx));
  }

  return (
    <div style={fieldGroup}>
      <label style={labelStyle}>{t.socialsLabel}</label>
      {initialSocials.length === 0 && (
        <div style={{ fontSize: '11px', color: '#767676', fontStyle: 'italic', marginBottom: '8px', fontFamily: editorFont }}>
          {t.socialsEmpty}
        </div>
      )}
      {initialSocials.map((s, i) => {
        const meta = SOCIAL_PLATFORMS[s.platform];
        return (
          <div key={s.id} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <select
              value={s.platform}
              onChange={e => update(i, { platform: e.target.value as SocialPlatform })}
              /* Ohne Namen meldet axe „critical": Ein Screenreader liest nur den
                 aktuellen Wert vor, nicht wonach gefragt wird. */
              aria-label={t.socialsLabel}
              style={{ ...inputStyle, width: '120px', fontSize: '12px' }}
            >
              {(Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]).map(k => (
                <option key={k} value={k}>{SOCIAL_PLATFORMS[k].label}</option>
              ))}
            </select>
            <input
              type="text"
              value={s.value}
              onChange={e => update(i, { value: e.target.value })}
              placeholder={meta.placeholder}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              title={t.remove}
              style={{ padding: '6px 8px', background: 'transparent', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '6px', fontSize: '14px', color: '#767676', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} style={addBtn}>{t.add}</button>
    </div>
  );
}

// ── Personal Editor ──────────────────────────────────────────────────────────

function PersonalEditor({ data, onChange, demoMode }: { data: CVData; onChange: (d: CVData) => void; demoMode?: boolean }) {
  const t = usePanelT();
  const fileRef = useRef<HTMLInputElement>(null);
  /** Datei im Zuschnitt — solange gesetzt, steht der Dialog offen. */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  /* Das frisch gewählte Original, solange es nur im Browser liegt. Erst wenn
   * der Zuschnitt bestätigt ist, wandert es mit auf den Server — wer den
   * Dialog abbricht, soll keine Datei hinterlassen haben. */
  const frischesOriginal = useRef<string | null>(null);
  const p = data.personal;

  function updatePersonal(key: string, value: string) {
    onChange({ ...data, personal: { ...p, [key]: value } });
  }

  /** Mehrere Felder auf einmal — sonst überschreibt der zweite `updatePersonal`
   *  den ersten, weil beide vom selben `p` ausgehen. */
  function updatePersonalMany(patch: Partial<CVData['personal']>) {
    onChange({ ...data, personal: { ...p, ...patch } });
  }

  /* Die gewählte Datei geht nicht mehr direkt zum Server, sondern erst in den
   * Zuschnitt. Hochgeladen wird danach genau der Ausschnitt — nicht das
   * Original mit einer Anweisung, wie es zu beschneiden sei. Das ist der
   * Unterschied zwischen „sieht in der Vorschau richtig aus" und „sieht
   * überall richtig aus": Word, PDF und HTML beschneiden sonst jeweils
   * eigenständig. */
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 4 * 1024 * 1024) { window.alert(t.alertTooLarge); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(t.readerError));
        reader.readAsDataURL(file);
      });
      frischesOriginal.current = dataUrl;
      setCropSrc(dataUrl);
    } catch (err) {
      window.alert(t.alertUploadFailed + (err instanceof Error ? err.message : t.alertUnknown));
    }
  }

  async function ladeZugeschnittenesFotoHoch(dataUrl: string) {
    setCropSrc(null);
    const original = frischesOriginal.current;
    frischesOriginal.current = null;
    try {
      const { api } = await import('../data/api');
      const hoch = async (u: string) => {
        const [meta, b64] = u.split(',');
        const mime = (meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg').toLowerCase();
        return (await api.uploadPhoto(mime, b64)).url;
      };
      const photo = await hoch(dataUrl);
      /* Nur bei einer neu gewählten Datei wandert auch das Original mit. Beim
       * Nachjustieren eines vorhandenen Fotos liegt es längst dort; es ein
       * zweites Mal hochzuladen hieße, bei jedem Nachschärfen eine weitere
       * Kopie im Konto abzulegen. */
      if (original) {
        const photoOriginal = await hoch(original);
        updatePersonalMany({ photo, photoOriginal });
      } else {
        updatePersonal('photo', photo);
      }
    } catch (err) {
      window.alert(t.alertUploadFailed + (err instanceof Error ? err.message : t.alertUnknown));
    }
  }

  /* Das Vorschaubild ist der Knopf zum Nachjustieren.
   *
   * Till, 17.09.2026: „bei bereits hochgeladenen Fotos möchte ich, dass man
   * das Foto anklicken kann, um die Crop-Funktion zu haben." Bis dahin führte
   * der einzige Weg zum Zuschnitt über eine neue Datei — wer den Ausschnitt
   * nur ein Stück höher setzen wollte, musste sein Foto erneut heraussuchen.
   * Angesetzt wird am Original, nicht am bestehenden Ausschnitt; nur so lässt
   * sich auch wieder herauszoomen. */
  function zuschnittOeffnen() {
    if (demoMode) return;
    const original = (p.photoOriginal || '').trim();
    const quelle = original || (p.photo || '').trim();
    if (!quelle) { fileRef.current?.click(); return; }
    frischesOriginal.current = null;
    /* Profile von vor dem 17.09.2026 haben kein Original — dort ist das
     * bestehende Foto das Weiteste, was wir haben. Es jetzt als Original zu
     * vermerken kostet nichts (es liegt bereits auf dem Server) und hält
     * wenigstens jedes WEITERE Nachjustieren verlustfrei: sonst schnitte
     * jede Runde in den Zuschnitt der vorigen. */
    if (!original) updatePersonal('photoOriginal', quelle);
    setCropSrc(quelle);
  }

  return (
    <div style={scrollArea}>
      {/* Photo */}
      <div style={fieldGroup}>
        <label style={labelStyle}>{t.photo}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={zuschnittOeffnen}
            disabled={demoMode}
            title={demoMode ? t.photoDisabledTitle : (p.photo ? t.photoRecropTitle : t.photoChooseTitle)}
            aria-label={p.photo ? t.photoRecropTitle : t.photoChooseTitle}
            style={{
              width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden',
              background: 'oklch(0.96 0.03 264)', flexShrink: 0, border: '1px solid oklch(0.91 0.005 264)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, position: 'relative',
              cursor: demoMode ? 'not-allowed' : 'pointer',
            }}>
            {p.photo ? (
              <>
                <img src={p.photo} alt={t.photo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {/* Ein Bild allein sieht nicht nach Knopf aus. Das Zeichen sagt,
                    dass hier etwas passiert, ohne die Vorschau zuzudecken. */}
                {!demoMode && (
                  <span style={{
                    position: 'absolute', right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    padding: '2px 3px 1px', borderTopLeftRadius: '6px',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <Icon name="crop" size={11} />
                  </span>
                )}
              </>
            ) : (
              <Icon name="user" size={20} style={{ color: 'oklch(0.62 0.012 264)' }} />
            )}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              type="button"
              onClick={() => !demoMode && fileRef.current?.click()}
              disabled={demoMode}
              title={demoMode ? t.photoDisabledTitle : t.photoChooseTitle}
              style={{ ...addBtn, opacity: demoMode ? 0.5 : 1, cursor: demoMode ? 'not-allowed' : 'pointer' }}>
              {t.photoUpload}
            </button>
            {p.photo && !demoMode && (
              <button type="button" onClick={() => updatePersonal('photo', '')} style={{ ...addBtn, color: '#c0392b', background: '#fff5f5', borderColor: '#f0b8b8' }}>
                {t.photoRemove}
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoFile} />
        {cropSrc && (
          <PhotoCropper
            src={cropSrc}
            texts={{ title: t.cropTitle, hint: t.cropHint, zoom: t.cropZoom, portrait: t.cropPortrait, square: t.cropSquare, apply: t.cropApply, cancel: t.cropCancel }}
            onCancel={() => setCropSrc(null)}
            onDone={ladeZugeschnittenesFotoHoch}
          />
        )}
        {demoMode ? (
          <div style={{ fontSize: '11px', color: 'oklch(0.55 0.216 264)', marginTop: '8px', fontFamily: editorFont, lineHeight: 1.5 }}>
            {t.photoDemoHint}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '10px', color: '#767676', marginTop: '5px', fontFamily: editorFont }}>
              {t.photoUrlHint}
            </div>
            <input
              type="url"
              value={p.photo?.startsWith('data:') ? '' : (p.photo ?? '')}
              onChange={e => updatePersonal('photo', e.target.value)}
              placeholder={t.photoUrlPlaceholder}
              style={{ ...inputStyle, fontSize: '11px' }} />
          </>
        )}
      </div>

      <div style={sectionDivider} />

      <Field label={t.name} value={p.name} onChange={v => updatePersonal('name', v)} />
      <Field label={t.jobTitle} value={p.title} onChange={v => updatePersonal('title', v)} />

      <div style={sectionDivider} />

      <Field label={t.email} value={p.email} onChange={v => updatePersonal('email', v)} type="email" />
      <Field label={t.phone} value={p.phone} onChange={v => updatePersonal('phone', v)} type="tel" />
      {/* Anschrift zweizeilig: Straße, dann Postleitzahl und Ort. Ein
          einzeiliges Eingabefeld konnte das gar nicht abbilden. */}
      <TextareaField label={t.locationAddress} value={p.location} onChange={v => updatePersonal('location', v)} rows={2} />
      <Field label={t.website} value={p.website ?? ''} onChange={v => updatePersonal('website', v)} />

      <SocialsEditor data={data} onChange={onChange} />

      <div style={sectionDivider} />

      <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 264)', marginBottom: '12px', lineHeight: 1.5, fontFamily: editorFont, background: 'oklch(0.968 0.004 264)', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '8px', padding: '9px 11px' }}>
        {t.personalNote}
      </div>

      <Field label={t.birthDate} value={p.birthDate ?? ''} onChange={v => updatePersonal('birthDate', v)} placeholder={t.birthDatePlaceholder} />
      <Field label={t.birthPlace} value={p.birthPlace ?? ''} onChange={v => updatePersonal('birthPlace', v)} />
      <Field label={t.maritalStatus} value={p.maritalStatus ?? ''} onChange={v => updatePersonal('maritalStatus', v)} />
      <Field label={t.nationality} value={p.nationality ?? ''} onChange={v => updatePersonal('nationality', v)} />
      <Field label={t.driversLicense} value={p.driversLicense ?? ''} onChange={v => updatePersonal('driversLicense', v)} />

      {/* Unterschrift: nur die Vorlagen im Bewerbungsset-Stil zeigen sie, aber
          die Felder stehen immer hier — sonst wären sie nach einem
          Vorlagenwechsel unauffindbar. */}
      <div style={{ borderTop: '1px solid oklch(0.91 0.005 264)', margin: '18px 0 14px' }} />
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'oklch(0.50 0.014 264)', marginBottom: '8px', fontFamily: editorFont }}>{t.signatureHead}</div>
      <div style={{ fontSize: '11px', color: '#767676', marginBottom: '12px', lineHeight: 1.6, fontFamily: editorFont }}>{t.signatureHint}</div>
      <Field label={t.signatureCity} value={p.signatureCity ?? ''} onChange={v => updatePersonal('signatureCity', v)} />
      <Field label={t.signatureDate} value={p.signatureDate ?? ''} onChange={v => updatePersonal('signatureDate', v)} />
    </div>
  );
}

// ── Profile Editor ───────────────────────────────────────────────────────────

function ProfileEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  return (
    <div style={scrollArea}>
      <div style={{ fontSize: '11px', color: '#767676', marginBottom: '14px', lineHeight: 1.6, fontFamily: editorFont }}>
        {t.profileHint}
      </div>
      <TextareaField
        label={t.profileLabel}
        value={data.profile.text}
        onChange={v => onChange({ ...data, profile: { ...data.profile, text: v } })}
        rows={8}
        placeholder={t.profilePlaceholder}
      />
    </div>
  );
}

// ── Beschriftungen ───────────────────────────────────────────────────────────
//
// Überschriften („BERUFSERFAHRUNG"), Feldbezeichnungen („STAATSANGEHÖRIGKEIT")
// und die Fußzeile kamen aus einer festen Tabelle je Sprache und waren an
// keiner Stelle änderbar. Wer „Berufsprofil" lieber „Kurzprofil" nennt oder
// die Zeile „Führerschein" braucht, ohne dass „Führerschein" darübersteht,
// hatte keinen Weg. Sie liegen ohnehin auf dem Datensatz — und weil jede
// Sprachfassung ihren eigenen Datensatz hat, ist eine Änderung automatisch
// sprachspezifisch.

const SECTION_ORDER = ['personal', 'details', 'profile', 'experience', 'education', 'languages', 'additional'] as const;
const FIELD_ORDER = ['email', 'phone', 'address', 'web', 'linkedin', 'birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'] as const;

function LabelsEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  const L = data.labels;
  const fresh = LABELS[L.lang];

  const set = (group: 'sections' | 'fields' | 'misc', key: string, v: string) =>
    onChange({ ...data, labels: { ...L, [group]: { ...L[group], [key]: v } } });

  const groupChanged = (group: 'sections' | 'fields' | 'misc') =>
    Object.keys(fresh[group]).some(k => (L[group] as Record<string, string>)[k] !== (fresh[group] as Record<string, string>)[k]);

  const resetGroup = (group: 'sections' | 'fields' | 'misc') =>
    onChange({ ...data, labels: { ...L, [group]: { ...fresh[group] } } });

  const head = (title: string, group: 'sections' | 'fields' | 'misc') => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '18px 0 8px' }}>
      <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'oklch(0.50 0.014 264)', fontFamily: editorFont }}>{title}</span>
      {groupChanged(group) && (
        <button type="button" onClick={() => resetGroup(group)}
          style={{ background: 'none', border: 'none', fontSize: '10.5px', color: 'oklch(0.55 0.216 264)', cursor: 'pointer', fontFamily: editorFont, padding: '4px 0' }}>
          {t.labelsReset}
        </button>
      )}
    </div>
  );

  return (
    <div style={scrollArea}>
      <div style={{ fontSize: '11px', color: '#767676', marginBottom: '4px', lineHeight: 1.6, fontFamily: editorFont }}>
        {t.labelsIntro}
      </div>

      {head(t.labelsSections, 'sections')}
      {SECTION_ORDER.map(k => (
        /* Beschriftet wird das Feld mit dem VORGABEwert dieser Sprache, nicht
           mit einer eigenen Erklärung: so sieht man auf einen Blick, was man
           umbenannt hat („Berufsprofil" → „Kurzprofil"), und es übersetzt sich
           von selbst mit. */
        <Field key={k} label={fresh.sections[k]} value={L.sections[k]} onChange={v => set('sections', k, v)} />
      ))}

      {head(t.labelsFields, 'fields')}
      {FIELD_ORDER.map(k => (
        <Field key={k} label={fresh.fields[k]} value={L.fields[k]} onChange={v => set('fields', k, v)} />
      ))}

      {head(t.labelsMisc, 'misc')}
      <Field label={`${t.labelsFooter} · ${fresh.misc.cvLabel}`} value={L.misc.cvLabel} onChange={v => set('misc', 'cvLabel', v)} />
      <Field label={fresh.misc.present} value={L.misc.present} onChange={v => set('misc', 'present', v)} />
    </div>
  );
}

// ── Experience Editor ────────────────────────────────────────────────────────

function ExperienceEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function updateExp(idx: number, updated: ExperienceEntry) {
    const next = [...data.experience];
    next[idx] = updated;
    onChange({ ...data, experience: next });
  }

  function addExp() {
    const newEntry: ExperienceEntry = {
      id: `exp-${Date.now()}`,
      role: '',
      company: '',
      location: '',
      start: '',
      end: 'present',
      bullets: [''],
    };
    onChange({ ...data, experience: [newEntry, ...data.experience] });
    setOpenIdx(0);
  }

  function removeExp(idx: number) {
    const next = data.experience.filter((_, i) => i !== idx);
    onChange({ ...data, experience: next });
    setOpenIdx(null);
  }

  function moveExp(idx: number, dir: -1 | 1) {
    const next = [...data.experience];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...data, experience: next });
    setOpenIdx(target);
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= data.experience.length || to >= data.experience.length) return;
    const next = [...data.experience];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...data, experience: next });
    setOpenIdx(to);
  }

  return (
    <div style={scrollArea}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', color: '#767676', fontFamily: editorFont }}>
          {data.experience.length} {t.entries} · ⋮⋮ {t.dragToReorder}
        </span>
        <button type="button" onClick={addExp} style={addBtn}>{t.add}</button>
      </div>

      {data.experience.map((exp, idx) => (
        <div key={exp.id}
          style={{ ...cardStyle,
            opacity: dragIdx === idx ? 0.4 : 1,
            borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid oklch(0.55 0.216 264)' : cardStyle.border,
          }}
          onDragOver={e => { if (dragIdx !== null) { e.preventDefault(); setDragOverIdx(idx); } }}
          onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
          onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) reorder(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
        >
          {/* Der ganze Kopf war vorher ein div mit onClick: per Tastatur gar nicht
              erreichbar — und damit waren alle zugeklappten Positionen für
              Tastaturnutzer nicht editierbar. Jetzt trägt ein echter Button den
              Aufklapp-Zustand, das Ziehen bleibt auf dem Griff. */}
          <div
            style={{ ...cardHeader, cursor: 'grab' }}
            draggable
            onDragStart={e => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            title={t.dragTitle}
          >
            <span style={{ fontSize: '12px', color: '#8a8a8a', userSelect: 'none' }} aria-hidden>⋮⋮</span>
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              aria-expanded={openIdx === idx}
              aria-controls={`exp-body-${exp.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            >
            <span style={{ fontSize: '13px' }} aria-hidden>{openIdx === idx ? '▾' : '▸'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.21 0.021 264)', fontFamily: editorFont, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {exp.role || <span style={{ color: '#8a8a8a' }}>{t.newPosition}</span>}
              </div>
              <div style={{ fontSize: '10.5px', color: 'oklch(0.45 0.16 264)', fontFamily: editorFont }}>
                {exp.company}{exp.location ? ` · ${exp.location}` : ''}
              </div>
            </div>
            </button>
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              <button type="button" onClick={e => { e.stopPropagation(); moveExp(idx, -1); }} style={iconBtn()} title={t.moveUp}>↑</button>
              <button type="button" onClick={e => { e.stopPropagation(); moveExp(idx, 1); }} style={iconBtn()} title={t.moveDown}>↓</button>
              <button type="button" onClick={e => { e.stopPropagation(); removeExp(idx); }} style={iconBtn('#c0392b')} title={t.remove}>×</button>
            </div>
          </div>

          {openIdx === idx && (
            <div id={`exp-body-${exp.id}`} style={cardBody}>
              {/* Hidden toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id={`hidden-${exp.id}`}
                  checked={!!exp.hidden}
                  onChange={e => updateExp(idx, { ...exp, hidden: e.target.checked })}
                  style={{ accentColor: 'oklch(0.55 0.216 264)' }}
                />
                <label htmlFor={`hidden-${exp.id}`} style={{ fontSize: '11.5px', color: '#666', fontFamily: editorFont, cursor: 'pointer' }}>
                  {t.hideInResume}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Field label={t.expRole} value={exp.role} onChange={v => updateExp(idx, { ...exp, role: v })} />
                <Field label={t.expCompany} value={exp.company} onChange={v => updateExp(idx, { ...exp, company: v })} />
                <Field label={t.expLocation} value={exp.location} onChange={v => updateExp(idx, { ...exp, location: v })} />
                <Field label={t.expFrom} value={exp.start} onChange={v => updateExp(idx, { ...exp, start: v })} placeholder={t.expFromPlaceholder} />
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label={t.expTo} value={exp.end === 'present' || exp.end === 'heute' ? '' : exp.end} onChange={v => updateExp(idx, { ...exp, end: v || 'present' })} placeholder={t.expToPlaceholder} />
                </div>
              </div>

              {/* Bullets */}
              <div style={{ marginTop: '4px' }}>
                <label style={labelStyle}>{t.expBulletsLabel}</label>
                <BulletsEditor
                  bullets={exp.bullets}
                  onChange={bullets => updateExp(idx, { ...exp, bullets })}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Education Editor ─────────────────────────────────────────────────────────

function EducationEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  function updateEdu(idx: number, updated: EducationEntry) {
    const next = [...data.education];
    next[idx] = updated;
    onChange({ ...data, education: next });
  }

  function addEdu() {
    const newEntry: EducationEntry = {
      id: `edu-${Date.now()}`,
      degree: '',
      institution: '',
      start: '',
      end: '',
    };
    onChange({ ...data, education: [newEntry, ...data.education] });
    setOpenIdx(0);
  }

  function removeEdu(idx: number) {
    onChange({ ...data, education: data.education.filter((_, i) => i !== idx) });
    setOpenIdx(null);
  }

  return (
    <div style={scrollArea}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', color: '#767676', fontFamily: editorFont }}>
          {data.education.length} {t.entries}
        </span>
        <button type="button" onClick={addEdu} style={addBtn}>{t.add}</button>
      </div>

      {data.education.map((edu, idx) => (
        <div key={edu.id} style={cardStyle}>
          <div style={cardHeader}>
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              aria-expanded={openIdx === idx}
              aria-controls={`edu-body-${edu.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            >
            <span style={{ fontSize: '13px' }} aria-hidden>{openIdx === idx ? '▾' : '▸'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.21 0.021 264)', fontFamily: editorFont, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {edu.degree || <span style={{ color: '#8a8a8a' }}>{t.newEntry}</span>}
              </div>
              <div style={{ fontSize: '10.5px', color: 'oklch(0.45 0.16 264)', fontFamily: editorFont }}>{edu.institution}</div>
            </div>
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); removeEdu(idx); }} style={iconBtn('#c0392b')} title={t.remove}>×</button>
          </div>

          {openIdx === idx && (
            <div id={`edu-body-${edu.id}`} style={cardBody}>
              <Field label={t.eduDegree} value={edu.degree} onChange={v => updateEdu(idx, { ...edu, degree: v })} />
              <Field label={t.eduInstitution} value={edu.institution} onChange={v => updateEdu(idx, { ...edu, institution: v })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Field label={t.eduFrom} value={edu.start} onChange={v => updateEdu(idx, { ...edu, start: v })} placeholder={t.eduYearPlaceholder} />
                <Field label={t.eduTo} value={edu.end} onChange={v => updateEdu(idx, { ...edu, end: v })} placeholder={t.eduYearPlaceholder} />
              </div>
              <TextareaField
                label={t.eduNotes}
                value={edu.notes ?? ''}
                onChange={v => updateEdu(idx, { ...edu, notes: v || undefined })}
                rows={2}
                placeholder={t.eduNotesPlaceholder}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Skills Editor ────────────────────────────────────────────────────────────

function SkillsEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  function updateGroup(idx: number, updated: SkillGroup) {
    const next = [...data.skillGroups];
    next[idx] = updated;
    onChange({ ...data, skillGroups: next });
  }

  function addGroup() {
    onChange({ ...data, skillGroups: [...data.skillGroups, { label: t.newGroupLabel, items: [] }] });
  }

  function removeGroup(idx: number) {
    onChange({ ...data, skillGroups: data.skillGroups.filter((_, i) => i !== idx) });
  }

  return (
    <div style={scrollArea}>
      <div style={{ fontSize: '11px', color: '#767676', marginBottom: '14px', lineHeight: 1.5, fontFamily: editorFont }}>
        {t.skillsHint}
      </div>

      {data.skillGroups.map((group, idx) => (
        <div key={idx} style={{ ...cardStyle, marginBottom: '14px' }}>
          <div style={{ ...cardBody, background: 'oklch(0.985 0.003 264)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t.groupName}</label>
                <input
                  type="text"
                  value={group.label}
                  onChange={e => updateGroup(idx, { ...group, label: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <button type="button" onClick={() => removeGroup(idx)} style={{ ...iconBtn('#c0392b'), paddingTop: '22px' }} title={t.removeGroup}>×</button>
            </div>
            <label style={labelStyle}>{t.skillsItemsLabel}</label>
            <SkillsItemsEditor
              group={group}
              onChangeItems={items => updateGroup(idx, { ...group, items })}
            />
          </div>
        </div>
      ))}

      <button type="button" onClick={addGroup} style={addBtn}>{t.addGroup}</button>

      {/* Additional experience */}
      {data.additionalExperience !== undefined && (
        <>
          <div style={sectionDivider} />
          <AdditionalExperienceEditor
            value={data.additionalExperience ?? []}
            onChange={v => onChange({ ...data, additionalExperience: v })}
          />
        </>
      )}
    </div>
  );
}

/** Skills-Items input mit RAW-Text-State.
 *
 *  Vorheriges Bug-Pattern: `value={items.join(', ')}` + onChange das splittet,
 *  trimmt, joined zurück. Resultat: tippt der User ein Komma oder Leerzeichen,
 *  wird das beim splittenden trim() sofort weggeworfen, die textarea-`value`
 *  springt zurück auf den letzten "stabilen" Stand, der Cursor löst sich, und
 *  weitere Eingaben werden abgewiesen. Magnus' Bug-Report: "kein Leerzeichen,
 *  kein Absatz und kein Komma — nur eine Sache eintragen".
 *
 *  Jetzt: lokaler Raw-String-State. Solange der User schreibt, sieht er was
 *  er tippt, ohne Trim-Schaden. Parsed-Items werden beim onBlur ODER beim
 *  Wechsel der Eingabesemantik (Komma vs. Zeilenumbruch) committed, so dass
 *  die Live-Vorschau trotzdem regelmäßig aktualisiert. */
function SkillsItemsEditor({ group, onChangeItems }: { group: SkillGroup; onChangeItems: (items: string[]) => void }) {
  const t = usePanelT();
  const initial = group.items.join(group.items.some(s => s.includes(',')) ? '\n' : ', ');
  const [raw, setRaw] = useState(initial);
  const lastCommittedRef = useRef(initial);

  /* Sync wenn von außen ein neuer group.items kommt (Profil-Wechsel, Undo,
   * MD-Import) — aber nicht clobbern was der User gerade tippt. */
  useEffect(() => {
    const incoming = group.items.join(group.items.some(s => s.includes(',')) ? '\n' : ', ');
    if (incoming !== lastCommittedRef.current) {
      setRaw(incoming);
      lastCommittedRef.current = incoming;
    }
  }, [group.items]);

  function parse(text: string): string[] {
    return text.includes('\n')
      ? text.split('\n').map(s => s.trim()).filter(Boolean)
      : text.split(',').map(s => s.trim()).filter(Boolean);
  }

  function commit(text: string) {
    const items = parse(text);
    lastCommittedRef.current = text;
    onChangeItems(items);
  }

  return (
    <textarea
      value={raw}
      onChange={e => {
        const text = e.target.value;
        setRaw(text);
        // Live-Commit damit die Preview während des Tippens mitläuft.
        // Wichtig: lastCommittedRef wird mit dem RAW-Text aktualisiert,
        // damit die Sync-Effect oben den User-State nicht überschreibt.
        commit(text);
      }}
      onBlur={() => commit(raw)}
      rows={4}
      style={textareaStyle}
      placeholder={t.skillsItemsPlaceholder}
    />
  );
}

/** Bullets-Editor mit RAW-Text-State — gleiches Pattern wie SkillsItemsEditor.
 *  Vorher wurden leere Zeilen beim Tippen sofort gefiltert, was den Cursor
 *  springen ließ wenn der User zwei Zeilen Abstand zwischen zwei Bullets
 *  setzen wollte. Jetzt: lokaler Raw-State, parser wird beim onBlur
 *  finalisiert. Live-Commit liefert die Preview trotzdem nach jedem Anschlag,
 *  aber ohne den string zu trimmen oder zu filtern. */
function BulletsEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  const t = usePanelT();
  const initial = bullets.join('\n');
  const [raw, setRaw] = useState(initial);
  const lastCommittedRef = useRef(initial);

  useEffect(() => {
    const incoming = bullets.join('\n');
    if (incoming !== lastCommittedRef.current) {
      setRaw(incoming);
      lastCommittedRef.current = incoming;
    }
  }, [bullets]);

  function commit(text: string, final: boolean) {
    lastCommittedRef.current = text;
    // Beim Tippen: Split + nicht-leere Zeilen + ggf. trailing-empty behalten
    // damit Enter-am-Ende nicht "verloren" wirkt. Beim Blur: trim+drop empty.
    if (final) {
      onChange(text.split('\n').map(l => l.trim()).filter(Boolean));
    } else {
      const lines = text.split('\n');
      onChange(lines.filter((l, i) => l.trim() !== '' || i === lines.length - 1));
    }
  }

  /* Inline Bullet-Hints: scannt JEDE Zeile auf typische schwache Starts
   * und gibt eine konkrete Verbesserung. Reine Heuristik, keine KI — die
   * Hints sind als "freundlicher Lektor"-Tooltip gedacht, nicht als
   * Validierung die etwas blockt. */
  const hints = raw.split('\n').map(line => bulletHint(line.trim(), t)).filter(h => h.line.length > 0 && h.advice);

  return (
    <div>
      <textarea
        value={raw}
        onChange={e => { setRaw(e.target.value); commit(e.target.value, false); }}
        onBlur={() => commit(raw, true)}
        rows={5}
        placeholder={t.bulletsPlaceholder}
        style={textareaStyle}
      />
      {hints.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {hints.slice(0, 3).map((h, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#7a5d1a', fontFamily: editorFont, lineHeight: 1.5 }}>
              <span style={{ display: 'inline-block', minWidth: '14px', color: '#b89149' }}>↳</span>
              <span style={{ fontWeight: 600 }}>{truncate(h.line, 42)}</span>: <span>{h.advice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Bullet-Hint-Heuristik. Erkennt typische schwache Starts und gibt einen
 *  konkreten Vorschlag. Keine KI, sondern hand-getunte Pattern aus der
 *  Threads-Recherche (hrswatigupta_official): ATS + Recruiter scannen die
 *  ersten 3 Wörter eines Bullets — die müssen ein konkretes Verb sein,
 *  idealerweise mit Outcome. */
function bulletHint(line: string, t: PanelStrings): { line: string; advice: string } {
  if (!line) return { line: '', advice: '' };
  const lc = line.toLowerCase();
  // Passive / generic / weak starts (DE)
  if (/^(verantwortlich (für|fuer)|verantwortung (für|fuer))\b/.test(lc)) {
    return { line, advice: t.hintResponsible };
  }
  if (/^(arbeitete (an|mit)|war (für|fuer))\b/.test(lc)) {
    return { line, advice: t.hintWorkedOn };
  }
  if (/^(half|unterst(ü|ue)tzte|assistierte)\b/.test(lc)) {
    return { line, advice: t.hintHelped };
  }
  if (/^(t(ä|ae)tigkeiten|aufgaben):/i.test(line)) {
    return { line, advice: t.hintTaskList };
  }
  // English variants
  if (/^(responsible for|in charge of|tasked with)\b/.test(lc)) {
    return { line, advice: t.hintResponsibleEn };
  }
  if (/^(helped|assisted|supported|worked (on|with))\b/.test(lc)) {
    return { line, advice: t.hintHelpedEn };
  }
  // No number, no percentage, no concrete outcome marker → soft hint
  // (nur wenn der bullet schon eine Weile dasteht; sonst nerven wir)
  if (line.length > 30 && !/\d/.test(line) && !/(reduzier|skalier|verdoppel|steigert|growth|saved|cut|increase|launch|ship|deliver)/i.test(line)) {
    return { line, advice: t.hintNoNumber };
  }
  return { line, advice: '' };
}

/** Wie SkillsItemsEditor — verhindert dass beim Tippen die Zeile gleich
 *  weggetrimmt wird wenn User noch nicht fertig ist. */
function AdditionalExperienceEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = usePanelT();
  const initial = value.join('\n');
  const [raw, setRaw] = useState(initial);
  const lastCommittedRef = useRef(initial);

  useEffect(() => {
    const incoming = value.join('\n');
    if (incoming !== lastCommittedRef.current) {
      setRaw(incoming);
      lastCommittedRef.current = incoming;
    }
  }, [value]);

  function commit(text: string) {
    lastCommittedRef.current = text;
    onChange(text.split('\n').map(s => s.trim()).filter(Boolean));
  }

  return (
    <div style={fieldGroup}>
      <label style={labelStyle}>{t.additionalExpLabel}</label>
      <textarea
        value={raw}
        onChange={e => { setRaw(e.target.value); commit(e.target.value); }}
        onBlur={() => commit(raw)}
        rows={4}
        style={textareaStyle}
        placeholder={t.additionalExpPlaceholder}
      />
    </div>
  );
}

// ── Languages Editor ─────────────────────────────────────────────────────────

function LanguagesEditor({ data, onChange }: { data: CVData; onChange: (d: CVData) => void }) {
  const t = usePanelT();
  function updateLang(idx: number, updated: LanguageEntry) {
    const next = [...data.languages];
    next[idx] = updated;
    onChange({ ...data, languages: next });
  }

  function addLang() {
    onChange({ ...data, languages: [...data.languages, { language: '', level: '' }] });
  }

  function removeLang(idx: number) {
    onChange({ ...data, languages: data.languages.filter((_, i) => i !== idx) });
  }

  return (
    <div style={scrollArea}>
      {data.languages.map((lang, idx) => (
        <div key={idx} style={{ ...cardStyle }}>
          <div style={{ ...cardBody }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0 10px', alignItems: 'end' }}>
              <Field label={t.langLanguage} value={lang.language} onChange={v => updateLang(idx, { ...lang, language: v })} />
              <Field label={t.langLevel} value={lang.level} onChange={v => updateLang(idx, { ...lang, level: v })} placeholder={t.langLevelPlaceholder} />
              <button type="button" onClick={() => removeLang(idx)} style={{ ...iconBtn('#c0392b'), paddingBottom: '10px' }} title={t.remove}>×</button>
            </div>
            <DotRatingInput
              value={lang.dots}
              onChange={dots => updateLang(idx, { ...lang, dots })}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addLang} style={addBtn}>{t.addLanguage}</button>
    </div>
  );
}

/** 1–5 dot picker. Click a dot to set the rating, click the same dot again
 *  to clear back to "auto" (template derives from the text level). */
function DotRatingInput({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const t = usePanelT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontFamily: editorFont }}>
      <span style={{ ...labelStyle, marginBottom: 0 }}>{t.scale}</span>
      <div role="radiogroup" aria-label={t.scaleAria} style={{ display: 'inline-flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map(n => {
          const active = typeof value === 'number' && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={typeof value === 'number' && value === n}
              onClick={() => onChange(value === n ? undefined : n)}
              title={`${n} ${t.ofFive}`}
              style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: '1px solid ' + (active ? 'oklch(0.55 0.216 264)' : '#d0c8b8'),
                background: active ? 'oklch(0.55 0.216 264)' : '#fff',
                cursor: 'pointer', padding: 0, lineHeight: 0,
              }}
            />
          );
        })}
        <button
          type="button"
          onClick={() => onChange(undefined)}
          style={{ marginLeft: '6px', padding: '2px 8px', background: 'transparent', border: 'none', fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', cursor: 'pointer', fontFamily: editorFont }}
          title={t.scaleClearTitle}
        >
          {t.auto}
        </button>
      </div>
    </div>
  );
}

// ── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'personal' | 'profil' | 'erfahrung' | 'bildung' | 'skills' | 'sprachen' | 'texte';

// Stable tab order + ids. Labels are resolved from the i18n catalog inside the
// component so they follow the UI language.
const tabOrder: Tab[] = ['personal', 'profil', 'erfahrung', 'bildung', 'skills', 'sprachen', 'texte'];

const tabLabelKeys: Record<Tab, keyof PanelStrings> = {
  personal: 'tabPersonal',
  profil: 'tabProfil',
  erfahrung: 'tabErfahrung',
  bildung: 'tabBildung',
  skills: 'tabSkills',
  sprachen: 'tabSprachen',
  texte: 'tabTexte',
};

// ── EditorPanel ──────────────────────────────────────────────────────────────

interface EditorPanelProps {
  data: CVData;
  lang: string;
  /** UI language for the editor chrome + form panels (independent of CV content language). */
  uiLang: UiLang;
  onUpdate: (updater: (d: CVData) => CVData) => void;
  /** Demo mode disables backend-only operations like photo upload + photo URL. */
  demoMode?: boolean;
  /** Click-on-preview support: when jumpTick changes, switch to jumpTab. */
  jumpTab?: Tab | null;
  jumpTick?: number;
}

export default function EditorPanel({ data, uiLang, onUpdate, demoMode = false, jumpTab, jumpTick = 0 }: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const t = EP[uiLang];

  /* Click-on-preview jump: when DocumentPreview emits a tab match, switch
     here. We key off jumpTick (a counter) so two consecutive jumps to the
     same tab still fire — useful for the "did anything happen?" feedback. */
  useEffect(() => {
    if (jumpTick && jumpTab) setActiveTab(jumpTab);
  }, [jumpTick, jumpTab]);

  function handleChange(newData: CVData) {
    onUpdate(() => newData);
  }

  return (
    <PanelI18nCtx.Provider value={EP[uiLang]}>
      <div style={panelStyle}>
        {/* Tab bar */}
        <div style={tabBarStyle}>
          {tabOrder.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              style={tabStyle(activeTab === id)}
            >
              {t[tabLabelKeys[id]]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'personal' && <PersonalEditor data={data} onChange={handleChange} demoMode={demoMode} />}
        {activeTab === 'profil' && <ProfileEditor data={data} onChange={handleChange} />}
        {activeTab === 'erfahrung' && <ExperienceEditor data={data} onChange={handleChange} />}
        {activeTab === 'bildung' && <EducationEditor data={data} onChange={handleChange} />}
        {activeTab === 'skills' && <SkillsEditor data={data} onChange={handleChange} />}
        {activeTab === 'sprachen' && <LanguagesEditor data={data} onChange={handleChange} />}
        {activeTab === 'texte' && <LabelsEditor data={data} onChange={handleChange} />}
      </div>
    </PanelI18nCtx.Provider>
  );
}

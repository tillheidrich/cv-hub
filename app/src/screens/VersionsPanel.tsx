import { useEffect, useMemo, useState } from 'react';
import { api } from '../data/api';
import type { AppProfile } from '../data/types';
import { useUiLang } from '../ui/useUiLang';
import { VERSIONS_I18N, type VersionsStrings } from '../ui/i18n/klein';

const UI = "'Inter', sans-serif";
const SERIF = "'Space Grotesk', serif";

interface Version {
  id: number;
  source: string;
  created_at: string;
}

interface Props {
  resumeId: string;
  onClose: () => void;
  onRestored: (profile: AppProfile) => void;
}

function relativeTime(iso: string, T: VersionsStrings): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return T.justNow;
  if (m < 60) return T.minutesAgo(m);
  const h = Math.floor(m / 60);
  if (h < 24) return T.hoursAgo(h);
  const d = Math.floor(h / 24);
  if (d < 30) return T.daysAgo(d);
  return new Date(iso).toLocaleDateString(T.locale);
}

export default function VersionsPanel({ resumeId, onClose, onRestored }: Props) {
  const T = VERSIONS_I18N[useUiLang()];
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<{ id: number; preview: AppProfile; createdAt: string } | null>(null);

  useEffect(() => {
    api.listVersions(resumeId)
      .then(d => setVersions(d.versions))
      .catch(e => setErr(e instanceof Error ? e.message : T.loadFailed));
    /* T bewusst nicht in den Abhängigkeiten: die Liste soll bei einem
     * Sprachwechsel nicht neu geladen werden. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  async function preview(v: Version) {
    setBusy(v.id);
    try {
      const d = await api.getVersion(resumeId, v.id);
      setPreviewing({ id: v.id, preview: d.version.payload, createdAt: d.version.created_at });
    } catch (e) {
      setErr(e instanceof Error ? e.message : T.previewFailed);
    } finally {
      setBusy(null);
    }
  }

  async function restore(v: Version) {
    if (!window.confirm(T.confirmRestore)) return;
    setBusy(v.id);
    try {
      const r = await api.restoreVersion(resumeId, v.id);
      onRestored(r.payload);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : T.restoreFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-modal-backdrop="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div data-modal="true" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid oklch(0.91 0.005 264)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, color: 'oklch(0.21 0.021 264)' }}>{T.title}</div>
            <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>
              {T.subtitle}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={T.close} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#767676', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 26px 28px' }}>
          {err && (
            <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '8px', padding: '8px 11px', fontSize: '12px', color: '#c0392b', marginBottom: '14px', fontFamily: UI }}>{err}</div>
          )}
          {!versions && !err && <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>{T.loading}</div>}
          {versions && versions.length === 0 && (
            <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, fontStyle: 'italic' }}>
              {T.empty}
            </div>
          )}
          {versions && versions.map(v => (
            <div key={v.id} style={{ background: 'oklch(0.985 0.003 264)', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: UI, fontSize: '13px', fontWeight: 600, color: 'oklch(0.21 0.021 264)' }}>{T.sources[v.source] || v.source}</div>
                <div style={{ fontFamily: UI, fontSize: '11.5px', color: 'oklch(0.52 0.012 264)' }}>{relativeTime(v.created_at, T)} · {new Date(v.created_at).toLocaleString(T.locale)}</div>
              </div>
              <button type="button" onClick={() => preview(v)} disabled={busy === v.id}
                style={{ padding: '6px 11px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', fontSize: '11.5px', color: 'oklch(0.42 0.017 264)', cursor: 'pointer', fontFamily: UI }}>
                {T.show}
              </button>
              <button type="button" onClick={() => restore(v)} disabled={busy === v.id}
                style={{ padding: '6px 12px', background: busy === v.id ? '#666' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: UI }}>
                {busy === v.id ? '…' : T.restore}
              </button>
            </div>
          ))}
        </div>
      </div>

      {previewing && (
        <VersionPreview profile={previewing.preview} createdAt={previewing.createdAt} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}

function VersionPreview({ profile, createdAt, onClose }: { profile: AppProfile; createdAt: string; onClose: () => void }) {
  const T = VERSIONS_I18N[useUiLang()];
  const lang = profile.settings?.lang || 'de';
  const cv = profile.data?.[lang];
  const cl = profile.coverLetters?.[lang];

  const summary = useMemo(() => ({
    name: cv?.personal?.name,
    title: cv?.personal?.title,
    experienceCount: cv?.experience?.length || 0,
    educationCount: cv?.education?.length || 0,
    skillGroupCount: cv?.skillGroups?.length || 0,
    bulletCount: (cv?.experience || []).reduce((sum, e) => sum + (e.bullets?.length || 0), 0),
    profileLen: cv?.profile?.text?.length || 0,
    clSubject: cl?.subject,
    clBodyLen: (cl?.intro || '').length + (cl?.mainBody || '').length + (cl?.companyReference || '').length + (cl?.motivation || '').length + (cl?.closing || '').length,
  }), [cv, cl, profile.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', padding: '22px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: SERIF, fontSize: '18px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '4px' }}>{T.previewTitle}</div>
        <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', marginBottom: '16px', fontFamily: UI }}>{new Date(createdAt).toLocaleString(T.locale)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12.5px', fontFamily: UI, color: '#3a3a3a' }}>
          <div><b>{T.name}</b><br/>{summary.name || '—'}</div>
          <div><b>{T.position}</b><br/>{summary.title || '—'}</div>
          <div><b>{T.stations}</b><br/>{summary.experienceCount}</div>
          <div><b>{T.bulletsTotal}</b><br/>{summary.bulletCount}</div>
          <div><b>{T.education}</b><br/>{summary.educationCount}</div>
          <div><b>{T.skillGroups}</b><br/>{summary.skillGroupCount}</div>
          <div><b>{T.profileLength}</b><br/>{summary.profileLen} {T.chars}</div>
          <div><b>{T.coverLetter}</b><br/>{summary.clBodyLen ? `${summary.clBodyLen} ${T.chars}` : '—'}</div>
        </div>
        {summary.clSubject && (
          <div style={{ marginTop: '12px', fontSize: '12.5px', fontFamily: UI, color: '#3a3a3a' }}>
            <b>{T.coverLetterSubject}</b> {summary.clSubject}
          </div>
        )}
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 14px', background: 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: UI }}>
            {T.close}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { saveText } from './saveFile';
import { Icon, type IconName } from '../ui/Icon';
import type { CVData, CoverLetterData, AppProfile, Lang } from '../data/types';
import AtsCheckModal from '../screens/AtsCheckModal';
import { useUiLang } from '../ui/useUiLang';
import { EXP_I18N, type ExportStrings } from '../ui/i18n/export';

// ── Lightweight structural diff for MD-import previews ─────────────────────
interface DiffRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function summariseCv(cv: CVData | undefined, t: ExportStrings): Record<string, string> {
  if (!cv) return {};
  return {
    [t.fName]: cv.personal?.name || '',
    [t.fPosition]: cv.personal?.title || '',
    [t.fLocation]: cv.personal?.location || '',
    [t.fEmail]: cv.personal?.email || '',
    [t.fPhone]: cv.personal?.phone || '',
    [t.fProfileText]: cv.profile?.text || '',
    [t.fStations]: String((cv.experience || []).length),
    [t.fBulletsTotal]: String((cv.experience || []).reduce((s, e) => s + (e.bullets?.length || 0), 0)),
    [t.fEducation]: String((cv.education || []).length),
    [t.fSkillGroups]: String((cv.skillGroups || []).length),
    [t.fLanguages]: String((cv.languages || []).length),
  };
}

function summariseCl(cl: CoverLetterData | undefined, t: ExportStrings): Record<string, string> {
  if (!cl) return {};
  return {
    [t.fClCompany]: cl.company || '',
    [t.fClContact]: cl.contactPerson || '',
    [t.fClSubject]: cl.subject || '',
    [t.fClSalutation]: cl.salutation || '',
    [t.fClIntro]: cl.intro || '',
    [t.fClMain]: cl.mainBody || '',
    [t.fClCompanyRef]: cl.companyReference || '',
    [t.fClMotivation]: cl.motivation || '',
    [t.fClClosing]: cl.closing || '',
    [t.fClSignoff]: cl.signoff || '',
  };
}

function diffMaps(before: Record<string, string>, after: Record<string, string>): DiffRow[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).map(label => {
    const b = before[label] || '';
    const a = after[label] || '';
    return { label, before: b, after: a, changed: b !== a };
  });
}
import { exportHtml, exportCoverLetterHtml, exportPdf } from './exportHtml';
import type { ExportRenderConfig } from './exportHtml';
import { exportMarkdown } from './exportMarkdown';
import { exportJson } from './exportJson';
import { exportDocx } from './exportDocx';
import { exportJsonResume, jsonResumeToCv, isJsonResume } from './jsonResume';
import { importLinkedIn, type LinkedInBefund } from '../import/linkedinImport';
import { exportTemplateKit } from './exportTemplate';
import { exportFilename } from './filename';
import { getMdTemplate, type MdTemplateFullLang } from './markdownTemplate';
import { LANG_NAMES } from '../data/labels';
import { api } from '../data/api';
import type { ShareLink } from '../data/api';
import { track } from '../data/track';

interface ExportPanelProps {
  data: CVData;
  coverLetter?: CoverLetterData;
  resumeId?: string | null;
  lang: string;
  template?: string;
  docType?: 'resume' | 'cover-letter';
  exportConfig: ExportRenderConfig;
  onPrint?: () => void;
  /** When true, hide backend-only features (Share, AI, server MD download). */
  demoMode?: boolean;
  /** Called when a demo user tries to access a gated feature. */
  onDemoBlock?: (reason: string) => void;
  /** Called after a successful Markdown import so the app can refresh state. */
  onProfileUpdated?: (profile: AppProfile) => void;
  /** Replace the active language's CV data (used by JSON Resume / bare-CVData import). */
  onReplaceData?: (cv: CVData) => void;
}

// Prompt builders. Embedded variant ships the Markdown content inline so the
// AI never needs to fetch a URL (ChatGPT's browsing tool is unreliable). URL
// variant kept as a last-resort fallback when the content is too big to fit
// in a query string.
// Der Wortlaut selbst steht in EXP_I18N (`promptResumeInline`,
// `promptResumeUrl`, `promptCoverUrl`).

const s = {
  panel: {
    width: '340px',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    background: '#fff',
    borderRight: '1px solid oklch(0.91 0.005 264)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
  },
  header: {
    padding: '20px 20px 14px',
    borderBottom: '1px solid oklch(0.91 0.005 264)',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'oklch(0.21 0.021 264)',
    fontFamily: "'Inter', sans-serif",
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '11px',
    color: '#767676',
    fontFamily: "'Inter', sans-serif",
  },
  section: {
    padding: '16px 20px 8px',
  },
  sectionLabel: {
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    textTransform: 'uppercase' as const,
    color: '#767676',
    marginBottom: '8px',
    fontFamily: "'Inter', sans-serif",
  },
  exportBtn: (hover: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '10px 12px',
    background: hover ? 'oklch(0.985 0.003 264)' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.12s',
    marginBottom: '2px',
  }),
  btnIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'oklch(0.96 0.03 264)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0,
  },
  btnLabel: {
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'oklch(0.21 0.021 264)',
    fontFamily: "'Inter', sans-serif",
    marginBottom: '1px',
  },
  btnSub: {
    fontSize: '10.5px',
    color: '#767676',
    fontFamily: "'Inter', sans-serif",
  },
  statusBox: {
    margin: '16px 20px',
    padding: '12px 14px',
    background: 'oklch(0.985 0.003 264)',
    borderRadius: '8px',
    border: '1px solid oklch(0.91 0.005 264)',
  },
  statusLabel: {
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: 'oklch(0.55 0.216 264)',
    marginBottom: '6px',
    fontFamily: "'Inter', sans-serif",
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#666',
    padding: '2px 0',
    fontFamily: "'Inter', sans-serif",
  },
  statusValue: {
    color: '#333',
    fontWeight: 500,
  },
  pdfBtn: {
    margin: '8px 20px 20px',
    width: 'calc(100% - 40px)',
    padding: '11px',
    background: 'oklch(0.21 0.021 264)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.15s',
  },
  hint: {
    textAlign: 'center' as const,
    fontSize: '10px',
    color: '#ccc',
    fontFamily: "'Inter', sans-serif",
    marginTop: '4px',
    paddingBottom: '20px',
  },
  divider: {
    height: '1px',
    background: 'oklch(0.91 0.005 264)',
    margin: '4px 20px',
  },
};

function ExportButton({
  icon, label, sub, onClick, busy,
}: { icon: IconName; label: string; sub: string; onClick: () => void; busy?: boolean }) {
  const [hover, setHover] = useState(false);
  const t = EXP_I18N[useUiLang()];
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={s.exportBtn(hover)}
    >
      <div style={s.btnIcon}>{busy ? <span className="cv-spin" /> : <Icon name={icon} />}</div>
      <div>
        <div style={s.btnLabel}>{label}</div>
        <div style={s.btnSub}>{busy ? t.buttonBusy : sub}</div>
      </div>
    </button>
  );
}

/**
 * Freigabeliste aus einer Serverantwort, notfalls leer.
 *
 * Antwortet der Server mit 200, aber ohne `shares` — etwa weil ein Proxy die
 * SPA-Startseite zurückgibt statt der API —, landete vorher `undefined` im
 * Zustand, und der nächste Zugriff darauf riss die GANZE Anwendung mit.
 * Auf dem Telefon besonders bitter: dort hängt das Export-Panel dauerhaft im
 * DOM, der Fehler nahm also auch Bearbeiten und Vorschau mit in den
 * weißen Bildschirm.
 */
function asShares(d: unknown): ShareLink[] {
  const list = (d as { shares?: unknown } | null | undefined)?.shares;
  return Array.isArray(list) ? list as ShareLink[] : [];
}

export default function ExportPanel({ data, coverLetter, resumeId, lang, template = '', docType = 'resume', exportConfig, onPrint, onProfileUpdated, onReplaceData, demoMode = false, onDemoBlock }: ExportPanelProps) {
  const t = EXP_I18N[useUiLang()];
  const [pdfHover, setPdfHover] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [kitBusy, setKitBusy] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);
  /** Hinweis, wenn der Markdown-Download nicht vom Server kam. */
  const [mdNote, setMdNote] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  // Diff preview between current data and a candidate import.
  const [importDiff, setImportDiff] = useState<DiffRow[] | null>(null);
  /* LinkedIn-Import: Befund und Gegenüberstellung, bevor irgendetwas ersetzt
   * wird. Läuft vollständig im Browser — die Datei geht an keinen Server,
   * auch nicht an unseren. Deshalb funktioniert er auch im Demo-Modus. */
  const [liBefund, setLiBefund] = useState<LinkedInBefund | null>(null);
  const [liBusy, setLiBusy] = useState(false);
  const [liErr, setLiErr] = useState<string | null>(null);

  const isCover = docType === 'cover-letter';

  // Most recently created, still-active share token — basis for the AI prompt
  // URL fallback. The primary path is inline embedding: we fetch the .md
  // server-side and put the content directly into the chat prompt, so the AI
  // never needs to browse to our domain (ChatGPT's browsing tool is unreliable).
  const activeShare = shares.find(s => !s.revoked && (!s.expires_at || new Date(s.expires_at) > new Date()));
  const resumeMdUrl = activeShare ? `${window.location.origin}/pdfapi/api/share/${activeShare.token}.md` : '';

  // Build a prompt that embeds the actual markdown when possible. If the URL-
  // encoded size would exceed ~12KB we fall back to the URL variant — most
  // chat UIs accept ~32KB query strings but we leave headroom.
  async function buildPrompt(): Promise<string> {
    if (isCover) {
      // No public CL share URL — keep the URL-fallback variant for now.
      return t.promptCoverUrl(resumeMdUrl);
    }
    if (!resumeId) return t.promptResumeUrl(resumeMdUrl);
    try {
      const r = await fetch(`/pdfapi/api/resumes/${encodeURIComponent(resumeId)}.md`, { credentials: 'include' });
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const md = await r.text();
      const inline = t.promptResumeInline(md);
      // 12KB safety threshold for the encoded URL query string.
      if (encodeURIComponent(inline).length < 12000) return inline;
      return t.promptResumeUrl(resumeMdUrl);
    } catch {
      return t.promptResumeUrl(resumeMdUrl);
    }
  }

  async function copyPrompt() {
    if (!activeShare && !resumeId) return;
    const prompt = await buildPrompt();
    try { await navigator.clipboard?.writeText(prompt); setJustCopied('prompt'); setTimeout(() => setJustCopied(null), 1500); }
    catch { /* ignore */ }
  }
  async function openInAi(kind: 'chatgpt' | 'claude' | 'gemini') {
    if (!activeShare && !resumeId) return;
    const prompt = await buildPrompt();
    // Gemini hat (Stand 2026-06) keinen offiziellen Query-Parameter
    // wie ChatGPT/Claude. Wir kopieren den Prompt vorab in die
    // Zwischenablage damit der User ihn drüben mit Cmd/Strg+V einfügt,
    // und öffnen gemini.google.com.
    if (kind === 'gemini') {
      try { await navigator.clipboard?.writeText(prompt); } catch { /* ignore */ }
      window.open('https://gemini.google.com/app', '_blank', 'noopener');
      return;
    }
    const url = kind === 'chatgpt'
      ? `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`
      : `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank', 'noopener');
  }
  // Step 1: run a dry-run import and build a diff for user review.
  async function previewImport() {
    if (!resumeId) return;
    setImportBusy(true); setImportErr(null);
    try {
      const r = isCover
        ? await api.importCoverLetterMarkdown(resumeId, importText, true)
        : await api.importMarkdown(resumeId, importText, true);
      const lang = (data as CVData & { settings?: { lang?: string } }).labels?.lang || 'de';
      const beforeMap = isCover
        ? summariseCl(coverLetter, t)
        : summariseCv(data, t);
      const afterMap = isCover
        ? summariseCl(r.payload.coverLetters?.[lang as 'de' | 'en'], t)
        : summariseCv(r.payload.data?.[lang as 'de' | 'en'], t);
      setImportDiff(diffMaps(beforeMap, afterMap));
    } catch (e) { setImportErr(e instanceof Error ? e.message : t.previewFailed); }
    finally { setImportBusy(false); }
  }

  // Step 2: commit the import after user confirmed the diff.
  async function confirmImport() {
    if (!resumeId) return;
    setImportBusy(true); setImportErr(null);
    try {
      const r = isCover
        ? await api.importCoverLetterMarkdown(resumeId, importText)
        : await api.importMarkdown(resumeId, importText);
      onProfileUpdated?.(r.payload);
      setImportOpen(false); setImportText(''); setImportDiff(null);
    } catch (e) { setImportErr(e instanceof Error ? e.message : t.importFailed); }
    finally { setImportBusy(false); }
  }

  // Download cover-letter MD for the active resume (auth-gated server endpoint).
  /**
   * Markdown vom Server holen — und nachsehen, ob es wirklich Markdown ist.
   *
   * Zwei Dinge gingen hier bisher schief, beide lautlos. Erstens: Steht vor
   * der API ein Proxy, der bei unbekannten Pfaden die Startseite der App
   * ausliefert, antwortet der Server mit 200 und HTML — die Datei hieß dann
   * `.md` und enthielt die Anwendung. Genau dieser Fehler hat an anderer
   * Stelle schon einmal den ganzen Bildschirm weiß gemacht. Zweitens: Jeder
   * Fehler wurde verschluckt; wer klickte, bekam gar nichts und keinen Grund.
   *
   * Der Test ist einfach: die Bridge-Fassung beginnt mit einem Frontmatter.
   * Fehlt es, war es nicht unsere Antwort. Dann lädt die lokale Fassung —
   * besser eine Datei ohne Server-Feinheiten als eine kaputte — und der
   * Hinweis sagt, was passiert ist.
   */
  async function ladeMarkdown(pfad: string, art: 'lebenslauf' | 'anschreiben') {
    setMdNote(null);
    try {
      const r = await fetch(pfad, { credentials: 'include' });
      if (!r.ok) throw new Error(t.serverAnswered(r.status));
      const text = await r.text();
      if (!text.trimStart().startsWith('---')) throw new Error(t.notMarkdown);
      saveText(exportFilename(art, data.personal.name, 'md'), text, 'text/markdown');
    } catch (e) {
      if (art === 'lebenslauf') {
        exportMarkdown(data);
        setMdNote(t.mdFallbackNote(e instanceof Error ? e.message : t.serverUnreachable));
      } else {
        setMdNote(t.clLoadFailed(e instanceof Error ? e.message : t.serverUnreachable));
      }
    }
  }

  const downloadCoverLetterMd = () => resumeId
    && ladeMarkdown(`/pdfapi/api/resumes/${encodeURIComponent(resumeId)}/cover-letter.md`, 'anschreiben');

  // Download CV markdown directly from the server bridge (same format as import).
  const downloadResumeMd = () => resumeId
    && ladeMarkdown(`/pdfapi/api/resumes/${encodeURIComponent(resumeId)}.md`, 'lebenslauf');

  // Import a JSON profile file (full payload). Replaces the current profile.
  function importJsonFile(file: File) {
    setImportBusy(true); setImportErr(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!parsed || typeof parsed !== 'object') throw new Error(t.invalidJson);

        // JSON Resume (jsonresume.org) or a bare CVData → map into the active
        // language's data via the replace callback (autosaves like any edit).
        if (isJsonResume(parsed) || (parsed.personal && parsed.experience !== undefined)) {
          if (!onReplaceData) throw new Error(t.importUnavailable);
          const cv = isJsonResume(parsed) ? jsonResumeToCv(parsed, data) : (parsed as CVData);
          onReplaceData(cv);
          setImportOpen(false);
          return;
        }

        // Full profile export from this tool.
        if (parsed.id && parsed.data) {
          if (!resumeId) throw new Error(t.noActiveProfile);
          const updated: AppProfile = { ...parsed, id: resumeId || parsed.id };
          await api.saveResumeWithSnapshot(updated, 'json_import');
          onProfileUpdated?.(updated);
          setImportOpen(false);
          return;
        }

        throw new Error(t.unknownJsonFormat);
      } catch (e) { setImportErr(e instanceof Error ? e.message : t.jsonImportFailed); }
      finally { setImportBusy(false); }
    };
    reader.onerror = () => { setImportBusy(false); setImportErr(t.fileUnreadable); };
    reader.readAsText(file);
  }

  // Hand the user a starter .md file in the bridge format. They edit it in
  // their tool of choice, paste it back into the import modal.
  function downloadMdTemplate() {
    const kind = isCover ? 'cl' : 'cv';
    const md = getMdTemplate(kind, lang as MdTemplateFullLang);
    saveText(exportFilename(isCover ? 'anschreiben' : 'lebenslauf', 'Vorlage', 'md'), md, 'text/markdown');
  }

  // MD file pickup — read into the import textarea so user can review.
  /* Schritt 1: Archiv lesen, nichts ersetzen. */
  async function linkedinLesen(file: File) {
    setLiBusy(true); setLiErr(null); setLiBefund(null);
    try {
      setLiBefund(await importLinkedIn(file, data));
    } catch (e) {
      setLiErr(e instanceof Error ? e.message : t.liReadError);
    } finally { setLiBusy(false); }
  }

  /* Schritt 2: übernehmen — erst nachdem der Mensch die Zahlen gesehen hat. */
  function linkedinUebernehmen() {
    if (!liBefund || !onReplaceData) return;
    track('import_linkedin');
    onReplaceData(liBefund.cv);
    setLiBefund(null);
  }

  function pickMdFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setImportText(String(reader.result || '')); setImportOpen(true); };
    reader.readAsText(file);
  }

  useEffect(() => {
    // Im Demo-Modus gibt es serverseitig kein Profil — die Anfrage kann nur
    // fehlschlagen. Sie zu unterlassen spart nicht nur einen Fehlversuch,
    // sondern schließt die Ursache eines Totalausfalls aus (siehe `asShares`).
    if (!resumeId || demoMode) { setShares([]); return; }
    let alive = true;
    api.listShares(resumeId).then(d => { if (alive) setShares(asShares(d)); }).catch(() => {});
    return () => { alive = false; };
  }, [resumeId, demoMode]);

  const [newShareIncludeCl, setNewShareIncludeCl] = useState(true);
  async function createShare() {
    if (!resumeId) return;
    setShareBusy(true); setShareErr(null);
    try {
      await api.createShare(resumeId, { includeCoverLetter: newShareIncludeCl });
      setShares(asShares(await api.listShares(resumeId)));
    } catch (e) { setShareErr(e instanceof Error ? e.message : t.shareError); }
    finally { setShareBusy(false); }
  }
  async function toggleShareCl(token: string, next: boolean) {
    if (!resumeId) return;
    try {
      await api.updateShare(token, { includeCoverLetter: next });
      setShares(asShares(await api.listShares(resumeId)));
    } catch (e) { setShareErr(e instanceof Error ? e.message : t.shareError); }
  }
  async function revokeShare(token: string) {
    if (!resumeId) return;
    if (!window.confirm(t.shareRevokeConfirm)) return;
    try {
      await api.revokeShare(token);
      setShares(asShares(await api.listShares(resumeId)));
    } catch (e) { setShareErr(e instanceof Error ? e.message : t.shareError); }
  }
  function relativeTime(iso: string | null): string {
    if (!iso) return t.never;
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t.justNow;
    if (m < 60) return t.minutesAgo(m);
    const h = Math.floor(m / 60);
    if (h < 24) return t.hoursAgo(h);
    const d = Math.floor(h / 24);
    if (d < 30) return t.daysAgo(d);
    return new Date(iso).toLocaleDateString(t.locale);
  }
  function shareUrlOf(token: string) {
    return `${window.location.origin}/share/${token}`;
  }
  async function copyLink(token: string) {
    const u = shareUrlOf(token);
    try { await navigator.clipboard?.writeText(u); setJustCopied(token); setTimeout(() => setJustCopied(null), 1500); }
    catch { /* ignore */ }
  }

  const [pdfErrMsg, setPdfErrMsg] = useState<string | null>(null);
  const [pdfDone, setPdfDone] = useState<string | null>(null);
  async function handlePdf() {
    setPdfErrMsg(null);
    setPdfDone(null);
    // Ein Klick, ein Download — kein Druckdialog. Der PDF-Endpunkt bedient auch
    // den Demo-Modus, dort gibt es dasselbe echte Vektor-PDF. Nur wenn der
    // Dienst wirklich ausfällt, fällt der Demo-Pfad auf den Browserdruck zurück.
    setPdfState('busy');
    try {
      const res = await exportPdf({ data, cfg: exportConfig, isCover, coverLetter });
      track('export_pdf', { docType: isCover ? 'cover' : 'resume', demo: !!demoMode });
      setPdfState('idle');
      setPdfDone(t.pdfReady(res.pages, Math.max(1, Math.round(res.bytes / 1024))));
      setTimeout(() => setPdfDone(null), 9000);
    } catch (err) {
      if (demoMode && onPrint) { setPdfState('idle'); onPrint(); return; }
      setPdfState('error');
      setPdfErrMsg(err instanceof Error ? err.message : t.pdfServiceError);
      setTimeout(() => setPdfState('idle'), 8000);
    }
  }

  const coverWord: Record<string, string> = { de: 'Anschreiben', en: 'Cover Letter', fr: 'Lettre de motivation', es: 'Carta de presentación' };
  const cvWord: Record<string, string> = { de: 'Lebenslauf', en: 'Curriculum Vitae', fr: 'Curriculum Vitae', es: 'Currículum' };
  const docWord = (isCover ? coverWord[lang] : cvWord[lang]) ?? (isCover ? 'Cover Letter' : 'Curriculum Vitae');
  const langLabel = LANG_NAMES[lang as keyof typeof LANG_NAMES] ?? lang.toUpperCase();

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <div style={s.title}>{t.exportTitle(docWord)}</div>
        <div style={s.subtitle}>{t.exportSubtitle}</div>
      </div>

      {/* Status: what's being exported */}
      <div style={s.statusBox}>
        <div style={s.statusLabel}>{t.statusLabel}</div>
        <div style={s.statusRow}>
          <span>{t.statusDocument}</span>
          <span style={s.statusValue}>{docWord}</span>
        </div>
        <div style={s.statusRow}>
          <span>{t.statusName}</span>
          <span style={s.statusValue}>{data.personal.name}</span>
        </div>
        <div style={s.statusRow}>
          <span>{t.statusLanguage}</span>
          <span style={s.statusValue}>{langLabel}</span>
        </div>
        <div style={s.statusRow}>
          <span>{t.statusTemplate}</span>
          <span style={s.statusValue}>{template}</span>
        </div>
      </div>

      {/* PDF — primary action: direct download, no print dialog */}
      <div style={s.section}>
        <div style={s.sectionLabel}>{t.pdfSection}</div>
        <button
          type="button"
          onClick={handlePdf}
          disabled={pdfState === 'busy'}
          onMouseEnter={() => setPdfHover(true)}
          onMouseLeave={() => setPdfHover(false)}
          style={{ ...s.pdfBtn, margin: 0, width: '100%', background: pdfState === 'busy' ? '#555' : (pdfHover ? '#333' : 'oklch(0.21 0.021 264)'), cursor: pdfState === 'busy' ? 'default' : 'pointer' }}
        >
          {pdfState === 'busy'
            ? <><span className="cv-spin" aria-hidden /> {t.pdfBuilding}</>
            : <><span>↓</span> {t.pdfDownload(docWord)}</>}
        </button>
        <div role="status" aria-live="polite" style={{ fontSize: '10.5px', color: pdfState === 'error' ? '#b91c1c' : pdfDone ? '#2d6a3e' : 'oklch(0.50 0.014 264)', lineHeight: 1.55, marginTop: '8px', fontFamily: "'Inter', sans-serif" }}>
          {pdfState === 'error'
            ? t.pdfFailed(pdfErrMsg || t.pdfUnknownError)
            : pdfDone
              ? pdfDone
              : t.pdfHint}
        </div>

        <button
          type="button"
          onClick={() => setAtsOpen(true)}
          style={{
            marginTop: '12px', width: '100%', padding: '10px 14px',
            background: 'oklch(0.985 0.003 264)', border: '1px solid #e8d9b8', color: '#7a5a1a',
            borderRadius: '7px', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.04em', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{t.atsCheck}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400 }}>→</span>
        </button>
      </div>

      <div style={s.divider} />
      <div style={s.section}>
        <div style={s.sectionLabel}>{t.moreFormats}</div>
        {mdNote && (
          <div style={{ background: '#fff7e8', border: '1px solid #e8d4a8', borderRadius: '7px', padding: '7px 10px', fontSize: '11px', color: '#8a6500', marginBottom: '8px', lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
            {mdNote}
          </div>
        )}
        {isCover ? (
          <>
            <ExportButton
              icon="globe" label="HTML"
              sub={t.clHtmlSub}
              onClick={() => coverLetter && exportCoverLetterHtml(data, coverLetter, exportConfig)}
            />
            <ExportButton
              icon="markdown" label="Markdown"
              sub={t.clMdSub}
              onClick={downloadCoverLetterMd}
            />
          </>
        ) : (
          <>
            <ExportButton
              icon="file-text" label="Word (.docx)"
              sub={t.docxSub}
              onClick={() => { track('export_docx'); exportDocx(data, exportConfig.themeId, 'design'); }}
            />
            <ExportButton
              icon="file-text" label={t.docxAtsLabel}
              sub={t.docxAtsSub}
              onClick={() => { track('export_docx_ats'); exportDocx(data, exportConfig.themeId, 'ats'); }}
            />
            {/* „druckfertig" stand hier bis zum 17.09.2026 — und war nicht wahr.
                Was der Browserdruck aus einer HTML-Datei macht, entscheidet
                sein Druckdialog, nicht die Datei: eigene Ränder, Kopf- und
                Fußzeilen, in Safari auch dann, wenn die Datei das Gegenteil
                verlangt. Wer danach ein schiefes Blatt in der Hand hält, hat
                nichts falsch gemacht — ihm wurde etwas versprochen. */}
            <ExportButton icon="globe" label="HTML" sub={t.htmlSub} onClick={() => exportHtml(data, exportConfig)} />
            <ExportButton icon="markdown" label="Markdown" sub={t.mdSub} onClick={resumeId ? downloadResumeMd : () => exportMarkdown(data)} />
            <ExportButton icon="braces" label="JSON" sub={t.jsonSub} onClick={() => exportJson(data)} />
            <ExportButton icon="puzzle" label="JSON Resume" sub={t.jsonResumeSub} onClick={() => { track('export_json_resume'); exportJsonResume(data); }} />
            {/* Der Ausgang aus dem Editor: das Design ohne die Daten, plus
                alles, was ein Mensch oder eine KI braucht, um es zu füllen. */}
            <ExportButton
              icon="package" label={t.kitLabel}
              sub={t.kitSub}
              busy={kitBusy}
              onClick={async () => {
                track('export_template_kit');
                setKitBusy(true);
                try { await exportTemplateKit(exportConfig, (data.labels?.lang ?? 'de') as Lang, data); }
                finally { setKitBusy(false); }
              }}
            />
          </>
        )}
      </div>

      {/* ── Lebenslauf mitbringen ───────────────────────────────────────
          Steht bewusst VOR dem Konto-Bereich und außerhalb davon: Der
          LinkedIn-Import läuft vollständig im Browser, also auch ohne
          Anmeldung. Wer das Werkzeug ausprobiert, soll nicht zuerst seinen
          Lebenslauf abtippen müssen — das war die größte Hürde am Einstieg
          und der auffälligste Rückstand gegenüber jedem Wettbewerber. */}
      {onReplaceData && !isCover && (
        <>
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>{t.bringCv}</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {t.bringCvHint}
            </div>
            <label style={{ ...s.exportBtn(false), cursor: liBusy ? 'wait' : 'pointer' }}>
              <div style={s.btnIcon}><Icon name="upload" /></div>
              <div>
                <div style={s.btnLabel}>{liBusy ? t.liReading : t.liLabel}</div>
                <div style={s.btnSub}>{t.liSub}</div>
              </div>
              <input type="file" accept=".zip,.csv" hidden disabled={liBusy}
                onChange={e => { const f = e.target.files?.[0]; if (f) linkedinLesen(f); e.target.value = ''; }} />
            </label>
            <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer"
              /* Mindestens 32 px hoch: Auf dem Telefon ist eine 16-px-Zeile
                 kein Tippziel, sondern ein Glücksspiel. Der Prüflauf hat
                 genau das gemeldet, als dieser Link neu war. */
              style={{ display: 'flex', alignItems: 'center', minHeight: '32px', fontSize: '10.5px', color: 'oklch(0.55 0.216 264)', fontFamily: "'Inter', sans-serif", textDecoration: 'none' }}>
              {t.liRequest}
            </a>
            {liErr && (
              <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '7px', padding: '8px 11px', fontSize: '11.5px', color: '#c0392b', marginTop: '8px', fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{liErr}</div>
            )}
          </div>
        </>
      )}

      {/* ── Import ──────────────────────────────────────────────────────── */}
      {resumeId && (
        <>
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>{t.importSection}</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {isCover ? t.importHintCl : t.importHintCv}
            </div>
            <label style={{ ...s.exportBtn(false), cursor: 'pointer' }}>
              <div style={s.btnIcon}><Icon name="upload" /></div>
              <div>
                <div style={s.btnLabel}>{t.uploadMd}</div>
                <div style={s.btnSub}>{isCover ? t.uploadMdSubCl : t.uploadMdSubCv}</div>
              </div>
              <input type="file" accept=".md,text/markdown,text/plain" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickMdFile(f); e.target.value = ''; }} />
            </label>
            <button type="button" onClick={downloadMdTemplate}
              style={{ ...s.exportBtn(false), cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <div style={s.btnIcon}><Icon name="markdown" /></div>
              <div>
                <div style={s.btnLabel}>{t.emptyMdTemplate}</div>
                <div style={s.btnSub}>{t.emptyMdTemplateSub}</div>
              </div>
            </button>
            <label style={{ ...s.exportBtn(false), cursor: 'pointer' }}>
              <div style={s.btnIcon}><Icon name="braces" /></div>
              <div>
                <div style={s.btnLabel}>{t.uploadJson}</div>
                <div style={s.btnSub}>{t.uploadJsonSub}</div>
              </div>
              <input type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJsonFile(f); e.target.value = ''; }} />
            </label>
          </div>
        </>
      )}

      {demoMode && (
        <>
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>{t.demoSection}</div>
            <div style={{ fontSize: '11.5px', color: 'oklch(0.42 0.017 264)', lineHeight: 1.55, marginBottom: '12px', fontFamily: "'Inter', sans-serif" }}>
              {t.demoBefore}<strong>{t.demoStrong}</strong>{t.demoAfter}
            </div>
            <button
              type="button"
              onClick={() => onDemoBlock?.('Sharelinks')}
              style={{ width: '100%', padding: '11px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              {t.demoCta}
            </button>
          </div>
        </>
      )}

      {!demoMode && resumeId && (
        <>
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>{t.shareSection}</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {t.shareHint}
            </div>
            {shareErr && (
              <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '7px', padding: '7px 10px', fontSize: '11.5px', color: '#c0392b', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
                {shareErr}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'oklch(0.42 0.017 264)', fontFamily: "'Inter', sans-serif", marginBottom: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={newShareIncludeCl} onChange={e => setNewShareIncludeCl(e.target.checked)} />
              {t.shareIncludeCl}
            </label>
            <button type="button" onClick={createShare} disabled={shareBusy}
              style={{ width: '100%', padding: '9px', background: shareBusy ? '#666' : 'oklch(0.55 0.216 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: shareBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif", marginBottom: '10px' }}>
              {shareBusy ? '…' : t.shareCreate}
            </button>
            {shares.length === 0 && (
              <div style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>{t.shareNone}</div>
            )}
            {shares.map(sh => (
              <div key={sh.token} style={{ background: 'oklch(0.985 0.003 264)', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', opacity: sh.revoked ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', color: 'oklch(0.21 0.021 264)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    /share/{sh.token.slice(0, 12)}…
                  </code>
                  {!sh.revoked && (
                    <button type="button" onClick={() => copyLink(sh.token)}
                      style={{ background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '5px', padding: '3px 8px', fontSize: '10.5px', color: '#666', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                      {justCopied === sh.token ? t.shareCopied : t.shareCopy}
                    </button>
                  )}
                  {!sh.revoked && (
                    <button type="button" onClick={() => revokeShare(sh.token)}
                      style={{ background: 'transparent', border: 'none', color: '#c0392b', fontSize: '10.5px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                      {t.shareRevoke}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', fontFamily: "'Inter', sans-serif", marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  <span><b style={{ color: 'oklch(0.42 0.017 264)', fontWeight: 600 }}>{sh.view_count}</b> {t.shareViewsSuffix}</span>
                  <span>{t.shareLastAccess(relativeTime(sh.last_viewed_at))}</span>
                  {sh.expires_at && <span>{t.shareExpires(new Date(sh.expires_at).toLocaleDateString(t.locale))}</span>}
                </div>
                {sh.recent_views && sh.recent_views.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {sh.recent_views.slice(0, 5).map((v, i) => (
                      <span key={i} title={`${v.variant} · ${new Date(v.viewed_at).toLocaleString(t.locale)}`}
                        style={{ background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '4px', padding: '1px 6px', fontSize: '9.5px', color: 'oklch(0.42 0.017 264)', fontFamily: "'Inter', sans-serif" }}>
                        {v.ua_summary || t.shareUnknownUa}{v.variant === 'md' ? ' · md' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {!sh.revoked && (
                  <label style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'oklch(0.42 0.017 264)', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}>
                    <input type="checkbox" checked={sh.include_cover_letter} onChange={e => toggleShareCl(sh.token, e.target.checked)} />
                    {t.shareClVisible}
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* ── Mit KI bearbeiten ─────────────────────────────────────────── */}
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>{t.aiSection}</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {isCover
                ? t.aiHintCl
                : t.aiHintCv}
            </div>
            {!isCover && !activeShare ? (
              <div style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic', marginBottom: '10px' }}>
                {t.aiNeedLink}
              </div>
            ) : !isCover && activeShare ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                <button type="button" onClick={copyPrompt}
                  style={{ padding: '8px 12px', background: justCopied === 'prompt' ? '#2e7d32' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", textAlign: 'left' }}>
                  {justCopied === 'prompt'
                ? <><Icon name="check" size={13} /> {t.aiPromptCopied}</>
                : <><Icon name="clipboard" size={13} /> {t.aiCopyPrompt}</>}
                </button>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openInAi('chatgpt')}
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {t.aiOpenChatgpt}
                  </button>
                  <button type="button" onClick={() => openInAi('claude')}
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {t.aiOpenClaude}
                  </button>
                  <button type="button" onClick={() => openInAi('gemini')}
                    title={t.aiGeminiTitle}
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {t.aiOpenGemini}
                  </button>
                </div>
              </div>
            ) : null}
            <button type="button" onClick={() => { setImportOpen(true); setImportErr(null); setImportDiff(null); }}
              style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.42 0.017 264)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              {t.aiImportBack}
            </button>
          </div>
        </>
      )}

      {/* Gegenüberstellung vor dem Übernehmen. Ein Import, der ungefragt
          ersetzt, ist kein Import, sondern ein Unfall: Wer hier schon
          gearbeitet hat, sieht erst die Zahlen und entscheidet dann. */}
      {liBefund && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setLiBefund(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '620px', maxHeight: '88vh', overflowY: 'auto', padding: '22px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Space Grotesk', serif", fontSize: '18px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '4px' }}>
              {t.liModalTitle}
            </div>
            <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', marginBottom: '14px', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}>
              {t.liModalBody}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {([[t.countStations, liBefund.gefunden.stationen], [t.countEducation, liBefund.gefunden.ausbildung], [t.countSkills, liBefund.gefunden.skills], [t.countLanguages, liBefund.gefunden.sprachen]] as [string, number][]).map(([l, n]) => (
                <div key={l} style={{ background: n > 0 ? '#f0f7f0' : 'oklch(0.97 0.003 264)', borderRadius: '8px', padding: '10px 12px', fontFamily: "'Inter', sans-serif" }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: n > 0 ? '#2c5e2c' : 'oklch(0.62 0.012 264)', lineHeight: 1.1 }}>{n}</div>
                  <div style={{ fontSize: '10.5px', color: 'oklch(0.50 0.014 264)', marginTop: '2px' }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ border: '1px solid oklch(0.91 0.005 264)', borderRadius: '9px', overflow: 'hidden', marginBottom: '14px' }}>
              {diffMaps(summariseCv(data, t), summariseCv(liBefund.cv, t)).filter(r => r.changed).length === 0 ? (
                <div style={{ padding: '14px', fontSize: '12.5px', color: 'oklch(0.42 0.017 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>
                  {t.liNoDiff}
                </div>
              ) : diffMaps(summariseCv(data, t), summariseCv(liBefund.cv, t)).filter(r => r.changed).map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '8px', padding: '9px 12px', borderTop: i ? '1px solid oklch(0.96 0.003 264)' : 'none', fontSize: '11.5px', fontFamily: "'Inter', sans-serif" }}>
                  <div style={{ fontWeight: 700, color: 'oklch(0.42 0.017 264)' }}>{row.label}</div>
                  <div style={{ background: '#fff0f0', padding: '5px 7px', borderRadius: '5px', color: '#7a2c2c', wordBreak: 'break-word' }}>{row.before || <em style={{ color: '#c0a0a0' }}>{t.valueEmpty}</em>}</div>
                  <div style={{ background: '#f0f7f0', padding: '5px 7px', borderRadius: '5px', color: '#2c5e2c', wordBreak: 'break-word' }}>{row.after || <em style={{ color: '#a0c0a0' }}>{t.valueEmpty}</em>}</div>
                </div>
              ))}
            </div>

            {liBefund.hinweise.length > 0 && (
              <ul style={{ margin: '0 0 16px', padding: '10px 12px 10px 28px', background: '#fff7e8', border: '1px solid #e8d4a8', borderRadius: '8px', fontSize: '11.5px', color: '#8a6500', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
                {liBefund.hinweise.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setLiBefund(null)}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: "'Inter', sans-serif" }}>{t.cancel}</button>
              <button type="button" onClick={linkedinUebernehmen}
                style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{t.apply}</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => !importBusy && setImportOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', padding: '22px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Space Grotesk', serif", fontSize: '18px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '4px' }}>
              {importDiff
                ? t.modalReviewTitle
                : isCover ? t.modalImportClTitle : t.modalImportCvTitle}
            </div>
            <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', marginBottom: '14px', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}>
              {importDiff
                ? t.modalReviewBody
                : isCover
                ? t.modalImportClBody
                : t.modalImportCvBody}
            </div>

            {!importDiff && (
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={t.mdPlaceholder} rows={14}
                style={{ width: '100%', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: 'oklch(0.21 0.021 264)', background: '#ffffff', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, marginBottom: '10px' }} />
            )}

            {importDiff && (
              <div style={{ marginBottom: '14px', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '8px', overflow: 'hidden' }}>
                {importDiff.filter(r => r.changed).length === 0 && (
                  <div style={{ padding: '14px', fontSize: '12.5px', color: 'oklch(0.42 0.017 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>{t.noChanges}</div>
                )}
                {importDiff.filter(r => r.changed).map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px', padding: '10px 12px', borderBottom: i < importDiff.filter(r => r.changed).length - 1 ? '1px solid oklch(0.985 0.003 264)' : 'none', fontSize: '11.5px', fontFamily: "'Inter', sans-serif", background: 'oklch(0.985 0.003 264)' }}>
                    <div style={{ fontWeight: 700, color: 'oklch(0.42 0.017 264)', alignSelf: 'start' }}>{row.label}</div>
                    <div style={{ background: '#fff0f0', padding: '6px 8px', borderRadius: '5px', color: '#7a2c2c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '1px', color: '#a86060', marginBottom: '2px' }}>{t.valueBefore}</div>
                      {row.before || <em style={{ color: '#c0a0a0' }}>{t.valueEmpty}</em>}
                    </div>
                    <div style={{ background: '#f0f7f0', padding: '6px 8px', borderRadius: '5px', color: '#2c5e2c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '1px', color: '#608060', marginBottom: '2px' }}>{t.valueAfter}</div>
                      {row.after || <em style={{ color: '#a0c0a0' }}>{t.valueEmpty}</em>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {importErr && <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '7px', padding: '8px 11px', fontSize: '12px', color: '#c0392b', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>{importErr}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              {importDiff ? (
                <button type="button" onClick={() => setImportDiff(null)} disabled={importBusy}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: "'Inter', sans-serif" }}>
                  {t.back}
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => { setImportOpen(false); setImportDiff(null); setImportText(''); }} disabled={importBusy}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: "'Inter', sans-serif" }}>{t.cancel}</button>
                {!importDiff ? (
                  <button type="button" onClick={previewImport} disabled={importBusy || importText.trim().length < 10}
                    style={{ padding: '8px 16px', background: importBusy ? '#666' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: importBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {importBusy ? t.checking : t.showPreview}
                  </button>
                ) : (
                  <button type="button" onClick={confirmImport} disabled={importBusy}
                    style={{ padding: '8px 16px', background: importBusy ? '#666' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: importBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {importBusy ? t.applying : t.applyChanges}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {atsOpen && <AtsCheckModal data={data} coverLetter={coverLetter} exportConfig={exportConfig} onClose={() => setAtsOpen(false)} />}
    </div>
  );
}

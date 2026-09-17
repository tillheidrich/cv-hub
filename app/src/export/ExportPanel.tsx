import { useEffect, useState } from 'react';
import { saveText } from './saveFile';
import { Icon, type IconName } from '../ui/Icon';
import type { CVData, CoverLetterData, AppProfile, Lang } from '../data/types';
import AtsCheckModal from '../screens/AtsCheckModal';

// ── Lightweight structural diff for MD-import previews ─────────────────────
interface DiffRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function summariseCv(cv: CVData | undefined): Record<string, string> {
  if (!cv) return {};
  return {
    'Name': cv.personal?.name || '',
    'Position': cv.personal?.title || '',
    'Ort': cv.personal?.location || '',
    'E-Mail': cv.personal?.email || '',
    'Telefon': cv.personal?.phone || '',
    'Profiltext': cv.profile?.text || '',
    'Stationen': String((cv.experience || []).length),
    'Bullets gesamt': String((cv.experience || []).reduce((s, e) => s + (e.bullets?.length || 0), 0)),
    'Ausbildung': String((cv.education || []).length),
    'Skill-Gruppen': String((cv.skillGroups || []).length),
    'Sprachen': String((cv.languages || []).length),
  };
}

function summariseCl(cl: CoverLetterData | undefined): Record<string, string> {
  if (!cl) return {};
  return {
    'Empfänger-Firma': cl.company || '',
    'Ansprechpartner': cl.contactPerson || '',
    'Betreff': cl.subject || '',
    'Anrede': cl.salutation || '',
    'Einstieg': cl.intro || '',
    'Hauptteil': cl.mainBody || '',
    'Firmenbezug': cl.companyReference || '',
    'Motivation': cl.motivation || '',
    'Abschluss': cl.closing || '',
    'Grußformel': cl.signoff || '',
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
const RESUME_PROMPT_INLINE = (md: string) =>
  `Hier ist mein Lebenslauf als Markdown:

${md}

Bitte:
1. Schlage Verbesserungen vor: Bullets nach Schema „Aktion + Kontext + Ergebnis/Wirkung" schärfen, Profil prägnanter machen, deutsche Bewerbungssprache. Erfinde KEINE Zahlen.
2. Gib mir am Ende eine VOLLSTÄNDIGE, aktualisierte Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 in mein Tool zurückimportieren kann.`;

const RESUME_PROMPT_URL = (mdUrl: string) =>
  `Hier ist mein Lebenslauf als Markdown:
${mdUrl}

Bitte:
1. Lies meinen Lebenslauf (lade die URL oben, oder bitte mich, dir den Markdown-Text direkt einzufügen, falls du keine URLs lesen kannst).
2. Schlage Verbesserungen vor: Bullets nach Schema „Aktion + Kontext + Ergebnis/Wirkung" schärfen, Profil prägnanter machen, deutsche Bewerbungssprache. Erfinde KEINE Zahlen.
3. Gib mir am Ende eine VOLLSTÄNDIGE, aktualisierte Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 in mein Tool zurückimportieren kann.`;

const COVER_LETTER_PROMPT_URL = (mdUrl: string) =>
  `Hier ist mein Anschreiben als Markdown:
${mdUrl}

Bitte:
1. Lies mein Anschreiben (lade die URL oben, oder bitte mich, den Text direkt einzufügen).
2. Verbessere Aufbau, Sprache und Tonalität für eine deutsche Bewerbung. Halte die Sektionen Einstieg / Hauptteil / Firmenbezug / Motivation / Abschluss. Erfinde KEINE Fakten.
3. Gib mir am Ende die VOLLSTÄNDIGE, überarbeitete Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 zurückimportieren kann.`;

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
    color: '#999',
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
    color: '#bbb',
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
    color: '#aaa',
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
        <div style={s.btnSub}>{busy ? 'Wird gebaut…' : sub}</div>
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
      return COVER_LETTER_PROMPT_URL(resumeMdUrl);
    }
    if (!resumeId) return RESUME_PROMPT_URL(resumeMdUrl);
    try {
      const r = await fetch(`/pdfapi/api/resumes/${encodeURIComponent(resumeId)}.md`, { credentials: 'include' });
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const md = await r.text();
      const inline = RESUME_PROMPT_INLINE(md);
      // 12KB safety threshold for the encoded URL query string.
      if (encodeURIComponent(inline).length < 12000) return inline;
      return RESUME_PROMPT_URL(resumeMdUrl);
    } catch {
      return RESUME_PROMPT_URL(resumeMdUrl);
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
        ? summariseCl(coverLetter)
        : summariseCv(data);
      const afterMap = isCover
        ? summariseCl(r.payload.coverLetters?.[lang as 'de' | 'en'])
        : summariseCv(r.payload.data?.[lang as 'de' | 'en']);
      setImportDiff(diffMaps(beforeMap, afterMap));
    } catch (e) { setImportErr(e instanceof Error ? e.message : 'Vorschau fehlgeschlagen.'); }
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
    } catch (e) { setImportErr(e instanceof Error ? e.message : 'Import fehlgeschlagen.'); }
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
      if (!r.ok) throw new Error(`Der Server antwortete mit ${r.status}.`);
      const text = await r.text();
      if (!text.trimStart().startsWith('---')) throw new Error('Die Antwort war kein Markdown.');
      saveText(exportFilename(art, data.personal.name, 'md'), text, 'text/markdown');
    } catch (e) {
      if (art === 'lebenslauf') {
        exportMarkdown(data);
        setMdNote(`${e instanceof Error ? e.message : 'Der Server war nicht erreichbar.'} Heruntergeladen wurde die lokale Fassung — sie enthält denselben Text, aber keine Server-Einstellungen.`);
      } else {
        setMdNote(`${e instanceof Error ? e.message : 'Der Server war nicht erreichbar.'} Das Anschreiben konnte nicht geladen werden.`);
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
        if (!parsed || typeof parsed !== 'object') throw new Error('Ungültiges JSON');

        // JSON Resume (jsonresume.org) or a bare CVData → map into the active
        // language's data via the replace callback (autosaves like any edit).
        if (isJsonResume(parsed) || (parsed.personal && parsed.experience !== undefined)) {
          if (!onReplaceData) throw new Error('Import hier nicht verfügbar.');
          const cv = isJsonResume(parsed) ? jsonResumeToCv(parsed, data) : (parsed as CVData);
          onReplaceData(cv);
          setImportOpen(false);
          return;
        }

        // Full profile export from this tool.
        if (parsed.id && parsed.data) {
          if (!resumeId) throw new Error('Kein aktives Profil — bitte erst eines anlegen.');
          const updated: AppProfile = { ...parsed, id: resumeId || parsed.id };
          await api.saveResumeWithSnapshot(updated, 'json_import');
          onProfileUpdated?.(updated);
          setImportOpen(false);
          return;
        }

        throw new Error('JSON-Format unbekannt. Erwartet: Profil-Export, JSON Resume oder CVData.');
      } catch (e) { setImportErr(e instanceof Error ? e.message : 'JSON-Import fehlgeschlagen.'); }
      finally { setImportBusy(false); }
    };
    reader.onerror = () => { setImportBusy(false); setImportErr('Datei konnte nicht gelesen werden.'); };
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
      setLiErr(e instanceof Error ? e.message : 'Das Archiv ließ sich nicht lesen.');
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
    } catch (e) { setShareErr(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setShareBusy(false); }
  }
  async function toggleShareCl(token: string, next: boolean) {
    if (!resumeId) return;
    try {
      await api.updateShare(token, { includeCoverLetter: next });
      setShares(asShares(await api.listShares(resumeId)));
    } catch (e) { setShareErr(e instanceof Error ? e.message : 'Fehler.'); }
  }
  async function revokeShare(token: string) {
    if (!resumeId) return;
    if (!window.confirm('Diesen Link widerrufen? Verbindungen damit funktionieren danach nicht mehr.')) return;
    try {
      await api.revokeShare(token);
      setShares(asShares(await api.listShares(resumeId)));
    } catch (e) { setShareErr(e instanceof Error ? e.message : 'Fehler.'); }
  }
  function relativeTime(iso: string | null): string {
    if (!iso) return 'noch nie';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'gerade eben';
    if (m < 60) return `vor ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `vor ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `vor ${d} Tagen`;
    return new Date(iso).toLocaleDateString('de-DE');
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
      setPdfDone(`PDF fertig · ${res.pages === 1 ? 'eine Seite' : `${res.pages} Seiten`} · ${Math.max(1, Math.round(res.bytes / 1024))} KB. Liegt in deinem Download-Ordner.`);
      setTimeout(() => setPdfDone(null), 9000);
    } catch (err) {
      if (demoMode && onPrint) { setPdfState('idle'); onPrint(); return; }
      setPdfState('error');
      setPdfErrMsg(err instanceof Error ? err.message : 'PDF-Dienst-Fehler');
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
        <div style={s.title}>{docWord} exportieren</div>
        <div style={s.subtitle}>Wähle Format und starte den Download</div>
      </div>

      {/* Status: what's being exported */}
      <div style={s.statusBox}>
        <div style={s.statusLabel}>Wird exportiert</div>
        <div style={s.statusRow}>
          <span>Dokument</span>
          <span style={s.statusValue}>{docWord}</span>
        </div>
        <div style={s.statusRow}>
          <span>Name</span>
          <span style={s.statusValue}>{data.personal.name}</span>
        </div>
        <div style={s.statusRow}>
          <span>Sprache</span>
          <span style={s.statusValue}>{langLabel}</span>
        </div>
        <div style={s.statusRow}>
          <span>Vorlage</span>
          <span style={s.statusValue}>{template}</span>
        </div>
      </div>

      {/* PDF — primary action: direct download, no print dialog */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Als PDF speichern</div>
        <button
          type="button"
          onClick={handlePdf}
          disabled={pdfState === 'busy'}
          onMouseEnter={() => setPdfHover(true)}
          onMouseLeave={() => setPdfHover(false)}
          style={{ ...s.pdfBtn, margin: 0, width: '100%', background: pdfState === 'busy' ? '#555' : (pdfHover ? '#333' : 'oklch(0.21 0.021 264)'), cursor: pdfState === 'busy' ? 'default' : 'pointer' }}
        >
          {pdfState === 'busy'
            ? <><span className="cv-spin" aria-hidden /> PDF wird gebaut …</>
            : <><span>↓</span> {docWord} als PDF herunterladen</>}
        </button>
        <div role="status" aria-live="polite" style={{ fontSize: '10.5px', color: pdfState === 'error' ? '#b91c1c' : pdfDone ? '#2d6a3e' : 'oklch(0.50 0.014 264)', lineHeight: 1.55, marginTop: '8px', fontFamily: "'Inter', sans-serif" }}>
          {pdfState === 'error'
            ? `PDF-Export fehlgeschlagen: ${pdfErrMsg || 'unbekannter Fehler'}`
            : pdfDone
              ? pdfDone
              : 'Ein Klick, ein Download. Vektor-PDF, echte Textebene, kein Druckdialog — die Seiten sind exakt die aus der Vorschau.'}
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
          <span>ATS prüfen — so sieht eine Maschine deinen CV</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 400 }}>→</span>
        </button>
      </div>

      <div style={s.divider} />
      <div style={s.section}>
        <div style={s.sectionLabel}>Weitere Formate</div>
        {mdNote && (
          <div style={{ background: '#fff7e8', border: '1px solid #e8d4a8', borderRadius: '7px', padding: '7px 10px', fontSize: '11px', color: '#8a6500', marginBottom: '8px', lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
            {mdNote}
          </div>
        )}
        {isCover ? (
          <>
            <ExportButton
              icon="globe" label="HTML"
              sub="Anschreiben als Webseite — zum Ansehen und Weitergeben. Gedruckt wird das PDF."
              onClick={() => coverLetter && exportCoverLetterHtml(data, coverLetter, exportConfig)}
            />
            <ExportButton
              icon="markdown" label="Markdown"
              sub="Anschreiben als .md (rund-um-bearbeitbar)"
              onClick={downloadCoverLetterMd}
            />
          </>
        ) : (
          <>
            <ExportButton
              icon="file-text" label="Word (.docx)"
              sub="Die gewählte Vorlage in Word — Farbfläche, Akzentfarben, Datumsspalte. Öffnet in Word und LibreOffice."
              onClick={() => { track('export_docx'); exportDocx(data, exportConfig.themeId, 'design'); }}
            />
            <ExportButton
              icon="file-text" label="Word — ATS-Fassung"
              sub="Einspaltig, ohne Tabellen und Flächen. Für Portale, die die Datei maschinell auslesen."
              onClick={() => { track('export_docx_ats'); exportDocx(data, exportConfig.themeId, 'ats'); }}
            />
            {/* „druckfertig" stand hier bis zum 17.09.2026 — und war nicht wahr.
                Was der Browserdruck aus einer HTML-Datei macht, entscheidet
                sein Druckdialog, nicht die Datei: eigene Ränder, Kopf- und
                Fußzeilen, in Safari auch dann, wenn die Datei das Gegenteil
                verlangt. Wer danach ein schiefes Blatt in der Hand hält, hat
                nichts falsch gemacht — ihm wurde etwas versprochen. */}
            <ExportButton icon="globe" label="HTML" sub="Webseite zum Ansehen und Weitergeben. Gedruckt wird das PDF — der Browserdruck legt eigene Ränder und Kopfzeilen darüber." onClick={() => exportHtml(data, exportConfig)} />
            <ExportButton icon="markdown" label="Markdown" sub="Server-Bridge-Format (rund-um-bearbeitbar)" onClick={resumeId ? downloadResumeMd : () => exportMarkdown(data)} />
            <ExportButton icon="braces" label="JSON" sub="Vollständige Daten, re-importierbar" onClick={() => exportJson(data)} />
            <ExportButton icon="puzzle" label="JSON Resume" sub="Standard-Schema (jsonresume.org) — portabel, re-importierbar" onClick={() => { track('export_json_resume'); exportJsonResume(data); }} />
            {/* Der Ausgang aus dem Editor: das Design ohne die Daten, plus
                alles, was ein Mensch oder eine KI braucht, um es zu füllen. */}
            <ExportButton
              icon="package" label="Vorlage ohne Daten"
              sub="ZIP mit HTML, Word, leerem JSON und Anleitung — das Design zum Selbstbefüllen, auch ohne dieses Werkzeug."
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
            <div style={s.sectionLabel}>Lebenslauf mitbringen</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              Du musst nichts abtippen, was du schon hast. Das Archiv wird im Browser gelesen — es geht an keinen Server, auch nicht an unseren.
            </div>
            <label style={{ ...s.exportBtn(false), cursor: liBusy ? 'wait' : 'pointer' }}>
              <div style={s.btnIcon}><Icon name="upload" /></div>
              <div>
                <div style={s.btnLabel}>{liBusy ? 'Lese Archiv…' : 'LinkedIn-Datenexport'}</div>
                <div style={s.btnSub}>ZIP aus „Eine Kopie deiner Daten erhalten" — Stationen, Ausbildung, Skills, Sprachen</div>
              </div>
              <input type="file" accept=".zip,.csv" hidden disabled={liBusy}
                onChange={e => { const f = e.target.files?.[0]; if (f) linkedinLesen(f); e.target.value = ''; }} />
            </label>
            <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '10.5px', color: 'oklch(0.55 0.216 264)', marginTop: '2px', fontFamily: "'Inter', sans-serif", textDecoration: 'none' }}>
              Archiv bei LinkedIn anfordern →
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
            <div style={s.sectionLabel}>Importieren</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {isCover
                ? 'Anschreiben aus Markdown wiederherstellen oder ein komplettes Profil-JSON zurückspielen.'
                : 'Lebenslauf aus Markdown wiederherstellen oder ein komplettes Profil-JSON zurückspielen.'}
            </div>
            <label style={{ ...s.exportBtn(false), cursor: 'pointer' }}>
              <div style={s.btnIcon}><Icon name="upload" /></div>
              <div>
                <div style={s.btnLabel}>Markdown hochladen</div>
                <div style={s.btnSub}>{isCover ? 'Importiert ins Anschreiben' : 'Importiert in den Lebenslauf'}</div>
              </div>
              <input type="file" accept=".md,text/markdown,text/plain" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickMdFile(f); e.target.value = ''; }} />
            </label>
            <button type="button" onClick={downloadMdTemplate}
              style={{ ...s.exportBtn(false), cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <div style={s.btnIcon}><Icon name="markdown" /></div>
              <div>
                <div style={s.btnLabel}>Leere Markdown-Vorlage</div>
                <div style={s.btnSub}>Zum Ausfüllen in deinem Editor (LM-Studio, VS Code, Obsidian …)</div>
              </div>
            </button>
            <label style={{ ...s.exportBtn(false), cursor: 'pointer' }}>
              <div style={s.btnIcon}><Icon name="braces" /></div>
              <div>
                <div style={s.btnLabel}>JSON hochladen</div>
                <div style={s.btnSub}>Vollständiger Profil-Import (überschreibt aktiv)</div>
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
            <div style={s.sectionLabel}>Demo-Modus</div>
            <div style={{ fontSize: '11.5px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.55, marginBottom: '12px', fontFamily: "'Inter', sans-serif" }}>
              Du arbeitest gerade ohne Konto. HTML, Markdown und JSON-Export funktionieren lokal. <strong>Sharelinks und KI-Bearbeitung</strong> brauchen eine Registrierung.
            </div>
            <button
              type="button"
              onClick={() => onDemoBlock?.('Sharelinks')}
              style={{ width: '100%', padding: '11px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              Konto anlegen →
            </button>
          </div>
        </>
      )}

      {!demoMode && resumeId && (
        <>
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>Link teilen</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              Read-only Link, kein Login nötig — auch für Anschreiben (das Anschreiben wird im Link mit angezeigt).
            </div>
            {shareErr && (
              <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '7px', padding: '7px 10px', fontSize: '11.5px', color: '#c0392b', marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
                {shareErr}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'oklch(0.44 0.017 264)', fontFamily: "'Inter', sans-serif", marginBottom: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={newShareIncludeCl} onChange={e => setNewShareIncludeCl(e.target.checked)} />
              Anschreiben im Link sichtbar machen
            </label>
            <button type="button" onClick={createShare} disabled={shareBusy}
              style={{ width: '100%', padding: '9px', background: shareBusy ? '#666' : 'oklch(0.55 0.216 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: shareBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif", marginBottom: '10px' }}>
              {shareBusy ? '…' : '+ Neuen Link erzeugen'}
            </button>
            {shares.length === 0 && (
              <div style={{ fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>Noch keine Links.</div>
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
                      {justCopied === sh.token ? '✓ kopiert' : 'Link kopieren'}
                    </button>
                  )}
                  {!sh.revoked && (
                    <button type="button" onClick={() => revokeShare(sh.token)}
                      style={{ background: 'transparent', border: 'none', color: '#c0392b', fontSize: '10.5px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                      Widerrufen
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', fontFamily: "'Inter', sans-serif", marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  <span><b style={{ color: 'oklch(0.44 0.017 264)', fontWeight: 600 }}>{sh.view_count}</b> Aufrufe</span>
                  <span>Letzter Zugriff: {relativeTime(sh.last_viewed_at)}</span>
                  {sh.expires_at && <span>läuft ab {new Date(sh.expires_at).toLocaleDateString('de-DE')}</span>}
                </div>
                {sh.recent_views && sh.recent_views.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {sh.recent_views.slice(0, 5).map((v, i) => (
                      <span key={i} title={`${v.variant} · ${new Date(v.viewed_at).toLocaleString('de-DE')}`}
                        style={{ background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '4px', padding: '1px 6px', fontSize: '9.5px', color: 'oklch(0.44 0.017 264)', fontFamily: "'Inter', sans-serif" }}>
                        {v.ua_summary || 'Unbekannt'}{v.variant === 'md' ? ' · md' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {!sh.revoked && (
                  <label style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'oklch(0.44 0.017 264)', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}>
                    <input type="checkbox" checked={sh.include_cover_letter} onChange={e => toggleShareCl(sh.token, e.target.checked)} />
                    Anschreiben sichtbar
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* ── Mit KI bearbeiten ─────────────────────────────────────────── */}
          <div style={s.divider} />
          <div style={s.section}>
            <div style={s.sectionLabel}>Mit KI bearbeiten</div>
            <div style={{ fontSize: '10.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.55, marginBottom: '10px', fontFamily: "'Inter', sans-serif" }}>
              {isCover
                ? 'Lade dein Anschreiben oben als .md herunter und füge den Text in deinen KI-Chat ein. Die KI gibt dir eine überarbeitete Version zurück, die du hier importierst.'
                : 'Gib der KI deinen Lebenslauf als Markdown-Link. Sie kann ihn lesen und dir eine korrigierte Markdown-Version zurückgeben, die du hier importierst.'}
            </div>
            {!isCover && !activeShare ? (
              <div style={{ fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic', marginBottom: '10px' }}>
                Erzeuge oben erst einen Link.
              </div>
            ) : !isCover && activeShare ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                <button type="button" onClick={copyPrompt}
                  style={{ padding: '8px 12px', background: justCopied === 'prompt' ? '#2e7d32' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", textAlign: 'left' }}>
                  {justCopied === 'prompt'
                ? <><Icon name="check" size={13} /> Prompt kopiert</>
                : <><Icon name="clipboard" size={13} /> Prompt + Markdown-Link kopieren</>}
                </button>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openInAi('chatgpt')}
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    In ChatGPT öffnen ↗
                  </button>
                  <button type="button" onClick={() => openInAi('claude')}
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    In Claude öffnen ↗
                  </button>
                  <button type="button" onClick={() => openInAi('gemini')}
                    title="Prompt wird in die Zwischenablage kopiert, Gemini öffnet sich — drüben mit Cmd/Strg+V einfügen."
                    style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    In Gemini öffnen ↗
                  </button>
                </div>
              </div>
            ) : null}
            <button type="button" onClick={() => { setImportOpen(true); setImportErr(null); setImportDiff(null); }}
              style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              ↑ Korrigierte Markdown-Version importieren
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
              Das steht im Archiv
            </div>
            <div style={{ fontSize: '12px', color: 'oklch(0.60 0.012 264)', marginBottom: '14px', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}>
              Noch ist nichts ersetzt. Übernimmst du, werden Stationen, Ausbildung, Skills und Sprachen durch die aus dem Archiv ersetzt.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {([['Stationen', liBefund.gefunden.stationen], ['Ausbildung', liBefund.gefunden.ausbildung], ['Skills', liBefund.gefunden.skills], ['Sprachen', liBefund.gefunden.sprachen]] as [string, number][]).map(([l, n]) => (
                <div key={l} style={{ background: n > 0 ? '#f0f7f0' : 'oklch(0.97 0.003 264)', borderRadius: '8px', padding: '10px 12px', fontFamily: "'Inter', sans-serif" }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: n > 0 ? '#2c5e2c' : 'oklch(0.62 0.012 264)', lineHeight: 1.1 }}>{n}</div>
                  <div style={{ fontSize: '10.5px', color: 'oklch(0.50 0.014 264)', marginTop: '2px' }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ border: '1px solid oklch(0.91 0.005 264)', borderRadius: '9px', overflow: 'hidden', marginBottom: '14px' }}>
              {diffMaps(summariseCv(data), summariseCv(liBefund.cv)).filter(r => r.changed).length === 0 ? (
                <div style={{ padding: '14px', fontSize: '12.5px', color: 'oklch(0.44 0.017 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>
                  Keine Unterschiede zum aktuellen Stand — der Import wäre folgenlos.
                </div>
              ) : diffMaps(summariseCv(data), summariseCv(liBefund.cv)).filter(r => r.changed).map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '8px', padding: '9px 12px', borderTop: i ? '1px solid oklch(0.96 0.003 264)' : 'none', fontSize: '11.5px', fontFamily: "'Inter', sans-serif" }}>
                  <div style={{ fontWeight: 700, color: 'oklch(0.44 0.017 264)' }}>{row.label}</div>
                  <div style={{ background: '#fff0f0', padding: '5px 7px', borderRadius: '5px', color: '#7a2c2c', wordBreak: 'break-word' }}>{row.before || <em style={{ color: '#c0a0a0' }}>leer</em>}</div>
                  <div style={{ background: '#f0f7f0', padding: '5px 7px', borderRadius: '5px', color: '#2c5e2c', wordBreak: 'break-word' }}>{row.after || <em style={{ color: '#a0c0a0' }}>leer</em>}</div>
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
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: "'Inter', sans-serif" }}>Abbrechen</button>
              <button type="button" onClick={linkedinUebernehmen}
                style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Übernehmen</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => !importBusy && setImportOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', padding: '22px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Space Grotesk', serif", fontSize: '18px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '4px' }}>
              {importDiff
                ? 'Änderungen prüfen vor Übernahme'
                : isCover ? 'Anschreiben aus Markdown importieren' : 'Lebenslauf aus Markdown importieren'}
            </div>
            <div style={{ fontSize: '12px', color: 'oklch(0.60 0.012 264)', marginBottom: '14px', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}>
              {importDiff
                ? 'Folgende Felder ändern sich. Aktuelle Fassung wird vor der Übernahme automatisch als Version gesichert.'
                : isCover
                ? 'Füge das überarbeitete Anschreiben-Markdown ein (mit oder ohne Frontmatter). Vorhandenes Anschreiben wird überschrieben.'
                : 'Füge die von der KI zurückgegebene Markdown-Version ein. Inklusive des Frontmatter-Blocks (---). Foto bleibt erhalten. Du siehst vor der Übernahme eine Diff-Vorschau.'}
            </div>

            {!importDiff && (
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="---&#10;template: hamburg&#10;lang: de&#10;---&#10;&#10;# Dein Name&#10;**Berufsbezeichnung**&#10;&#10;## Kontakt&#10;…" rows={14}
                style={{ width: '100%', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: 'oklch(0.21 0.021 264)', background: '#ffffff', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, marginBottom: '10px' }} />
            )}

            {importDiff && (
              <div style={{ marginBottom: '14px', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '8px', overflow: 'hidden' }}>
                {importDiff.filter(r => r.changed).length === 0 && (
                  <div style={{ padding: '14px', fontSize: '12.5px', color: 'oklch(0.44 0.017 264)', fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>Keine Änderungen erkannt — Import wäre folgenlos.</div>
                )}
                {importDiff.filter(r => r.changed).map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px', padding: '10px 12px', borderBottom: i < importDiff.filter(r => r.changed).length - 1 ? '1px solid oklch(0.985 0.003 264)' : 'none', fontSize: '11.5px', fontFamily: "'Inter', sans-serif", background: 'oklch(0.985 0.003 264)' }}>
                    <div style={{ fontWeight: 700, color: 'oklch(0.44 0.017 264)', alignSelf: 'start' }}>{row.label}</div>
                    <div style={{ background: '#fff0f0', padding: '6px 8px', borderRadius: '5px', color: '#7a2c2c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '1px', color: '#a86060', marginBottom: '2px' }}>vorher</div>
                      {row.before || <em style={{ color: '#c0a0a0' }}>leer</em>}
                    </div>
                    <div style={{ background: '#f0f7f0', padding: '6px 8px', borderRadius: '5px', color: '#2c5e2c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '1px', color: '#608060', marginBottom: '2px' }}>nachher</div>
                      {row.after || <em style={{ color: '#a0c0a0' }}>leer</em>}
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
                  ← Zurück
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => { setImportOpen(false); setImportDiff(null); setImportText(''); }} disabled={importBusy}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: "'Inter', sans-serif" }}>Abbrechen</button>
                {!importDiff ? (
                  <button type="button" onClick={previewImport} disabled={importBusy || importText.trim().length < 10}
                    style={{ padding: '8px 16px', background: importBusy ? '#666' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: importBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {importBusy ? 'Prüfe…' : 'Vorschau anzeigen'}
                  </button>
                ) : (
                  <button type="button" onClick={confirmImport} disabled={importBusy}
                    style={{ padding: '8px 16px', background: importBusy ? '#666' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: importBusy ? 'default' : 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    {importBusy ? 'Übernehme…' : 'Änderungen übernehmen'}
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

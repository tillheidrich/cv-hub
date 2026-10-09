import type { CVData } from '../data/types';

// ── Fotos in Exporten ───────────────────────────────────────────────────────
//
// Zwei Regeln, beide vom 08.10.2026:
//
// 1. Ein Platzhalter ist kein Foto. Das Demo-Profil trug bis dahin eine graue
//    Silhouette mit dem Wort „FOTO", und die landete in jedem Demo-PDF — mit
//    dem Profil einer erfundenen Person sah das nach einem fertigen Dokument
//    mit vergessenem Bild aus. Der Platzhalter ist aus dem Demo-Profil
//    entfernt; ältere Demo-Profile im Browser tragen ihn aber noch. Deshalb
//    fällt er hier, an der Tür zu jedem Export, heraus.
//
// 2. Das Foto reist mit dem Dokument. Steht im Profil eine Adresse
//    (`/pdfapi/api/photos/…`), holt der Browser das Bild — mit der Sitzung,
//    die ihm ohnehin gehört — und bettet es als data:-URL ein. Der PDF-Dienst
//    muss dann nichts mehr über HTTP nachladen, und die Fotoadresse kann
//    hinter der Anmeldung liegen. Eine exportierte HTML-Datei zeigt das Foto
//    auch noch, wenn die Adresse längst ungültig ist.

/** Erkennt die Platzhalter-Silhouette aus den Demo-Profilen. */
export function isPlaceholderPhoto(src?: string | null): boolean {
  const s = (src || '').trim();
  if (!s.startsWith('data:image/svg+xml')) return false;
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch { /* bleibt roh */ }
  return />\s*FOTO\s*</.test(decoded);
}

/** Entfernt einen Platzhalter aus Foto und Original. Alles andere bleibt. */
export function stripPlaceholderPhoto(cv: CVData): CVData {
  const p = cv.personal;
  if (!p || (!isPlaceholderPhoto(p.photo) && !isPlaceholderPhoto(p.photoOriginal))) return cv;
  return {
    ...cv,
    personal: {
      ...p,
      photo: isPlaceholderPhoto(p.photo) ? '' : p.photo,
      photoOriginal: isPlaceholderPhoto(p.photoOriginal) ? '' : p.photoOriginal,
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error ?? new Error('Foto nicht lesbar'));
    r.readAsDataURL(blob);
  });
}

/** Holt ein Foto als data:-URL. `null`, wenn es nicht zu bekommen ist. */
export async function photoAsDataUrl(src: string): Promise<string | null> {
  const s = (src || '').trim();
  if (!s) return null;
  if (s.startsWith('data:')) return s;
  try {
    const r = await fetch(s, { credentials: 'include' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Lebenslauf für einen Export vorbereiten: Platzhalter weg, Foto eingebettet,
 * Original nicht mitgeschickt (es gehört in den Editor, nicht ins Dokument).
 *
 * Lässt sich das Foto nicht holen, fällt es aus dem Export heraus, statt als
 * Adresse stehen zu bleiben, die der PDF-Dienst nicht mehr abrufen darf — ein
 * Dokument ohne Foto ist besser als eines mit einem Bruchsymbol.
 */
export async function withEmbeddedPhoto(cv: CVData): Promise<CVData> {
  const clean = stripPlaceholderPhoto(cv);
  const p = clean.personal;
  const photo = (p?.photo || '').trim();
  const out: CVData = { ...clean, personal: { ...p, photoOriginal: undefined } };
  if (!photo) return out;
  const embedded = await photoAsDataUrl(photo);
  if (!embedded) {
    console.warn('Foto konnte für den Export nicht geladen werden und wird weggelassen.');
    out.personal.photo = '';
    return out;
  }
  out.personal.photo = embedded;
  return out;
}

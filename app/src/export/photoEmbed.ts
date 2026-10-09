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

// ── Druckgröße ──────────────────────────────────────────────────────────────
//
// Der PDF-Dienst nimmt seit 08.10.2026 höchstens 3.000.000 Zeichen HTML an
// (Technik-Bericht N2). Ein Foto aus der Zeit vor dem Zuschnitt (17.09.2026)
// oder eine eingetragene Adresse kann das Original in voller Größe sein —
// 4 MB JPEG sind als data:-URL 5,6 Mio. Zeichen, der Export schlüge mit 413
// fehl. Gedruckt wird das Foto mit 35–45 mm Breite; selbst bei 300 dpi sind
// das gut 500 Pixel. 1200 an der langen Kante lassen Luft nach oben.

/** Lange Kante des Fotos im Export (Pixel). */
export const PRINT_PHOTO_MAX_SIDE = 1200;
/** JPEG-Qualität beim Herunterrechnen. */
export const PRINT_PHOTO_QUALITY = 0.85;
/** Bis zu dieser Länge (Zeichen) bleibt eine data:-URL unangetastet, wenn sie
 *  auch in den Maßen passt — der Zuschnitt (900 px, JPEG 0,92) liegt darunter. */
const PRINT_PHOTO_MAX_CHARS = 700_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Foto nicht lesbar'));
    i.src = src;
  });
}

/**
 * Rechnet ein Foto auf Druckgröße herunter, wenn es größer ist als nötig.
 * Kleine Fotos bleiben Zeichen für Zeichen, wie sie sind (kein zweites
 * JPEG-Verlustrunde für den Zuschnitt). Klappt das Umrechnen nicht, bleibt
 * das Original — dann entscheidet der Dienst.
 */
export async function photoForPrint(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return dataUrl;
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (long <= PRINT_PHOTO_MAX_SIDE && dataUrl.length <= PRINT_PHOTO_MAX_CHARS) return dataUrl;
    const scale = Math.min(1, PRINT_PHOTO_MAX_SIDE / long);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.fillStyle = '#ffffff';   // Transparenz wird weiß, wie beim Zuschnitt
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = c.toDataURL('image/jpeg', PRINT_PHOTO_QUALITY);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

/**
 * Lebenslauf für einen Export vorbereiten: Platzhalter weg, Foto eingebettet
 * (höchstens in Druckgröße, siehe `photoForPrint`), Original nicht mitgeschickt (es gehört in den Editor, nicht ins Dokument).
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
  out.personal.photo = await photoForPrint(embedded);
  return out;
}

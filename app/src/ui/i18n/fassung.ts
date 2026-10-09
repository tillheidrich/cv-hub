/**
 * Texte für „Fassung duplizieren" und die ATS-Fassung als PDF (Runde 3,
 * 09.10.2026, Wettbewerbsbericht Lücken 3 und 6).
 */
import type { UiLang } from '../i18n';

export interface FassungStrings {
  duplicate: string;
  duplicateTitle: string;
  duplicateSub: string;
  copyName: (name: string) => string;
  duplicated: (name: string) => string;
  duplicateFailed: string;
  atsPdf: string;
  atsPdfSub: (template: string) => string;
  atsWordShort: string;
  atsPdfShort: string;
  atsWordAria: string;
  atsPdfAria: string;
  atsPdfBusy: string;
  atsPdfDone: (pages: number, kb: number, template: string) => string;
  atsPdfFailed: (reason: string) => string;
}

export const FASSUNG_I18N: Record<UiLang, FassungStrings> = {
  de: {
    duplicate: 'Duplizieren',
    duplicateTitle: 'Fassung duplizieren',
    duplicateSub: 'Kopie für die nächste Bewerbung',
    copyName: n => `${n} (Kopie)`,
    duplicated: n => `„${n}" angelegt.`,
    duplicateFailed: 'Die Kopie konnte nicht gespeichert werden.',
    atsPdf: 'PDF – ATS-Fassung',
    atsPdfSub: tpl => `Derselbe Inhalt in der einspaltigen Vorlage ${tpl}. Deine gewählte Vorlage bleibt.`,
    atsWordShort: 'ATS-Word',
    atsPdfShort: 'ATS-PDF',
    atsWordAria: 'Word – ATS-Fassung herunterladen',
    atsPdfAria: 'PDF – ATS-Fassung herunterladen',
    atsPdfBusy: 'ATS-PDF wird gesetzt…',
    atsPdfDone: (p, kb, tpl) => `ATS-PDF fertig (${tpl}) · ${p === 1 ? 'eine Seite' : `${p} Seiten`} · ${kb} KB`,
    atsPdfFailed: r => `ATS-PDF fehlgeschlagen: ${r}`,
  },
  en: {
    duplicate: 'Duplicate',
    duplicateTitle: 'Duplicate version',
    duplicateSub: 'A copy for your next application',
    copyName: n => `${n} (copy)`,
    duplicated: n => `“${n}” created.`,
    duplicateFailed: 'The copy could not be saved.',
    atsPdf: 'PDF – ATS version',
    atsPdfSub: tpl => `The same content in the single-column template ${tpl}. Your chosen template stays.`,
    atsWordShort: 'ATS Word',
    atsPdfShort: 'ATS PDF',
    atsWordAria: 'Download Word – ATS version',
    atsPdfAria: 'Download PDF – ATS version',
    atsPdfBusy: 'Setting the ATS PDF…',
    atsPdfDone: (p, kb, tpl) => `ATS PDF ready (${tpl}) · ${p === 1 ? 'one page' : `${p} pages`} · ${kb} KB`,
    atsPdfFailed: r => `ATS PDF failed: ${r}`,
  },
  fr: {
    duplicate: 'Dupliquer',
    duplicateTitle: 'Dupliquer la version',
    duplicateSub: 'Une copie pour la prochaine candidature',
    copyName: n => `${n} (copie)`,
    duplicated: n => `« ${n} » créé.`,
    duplicateFailed: 'La copie n’a pas pu être enregistrée.',
    atsPdf: 'PDF – version ATS',
    atsPdfSub: tpl => `Le même contenu dans le modèle à une colonne ${tpl}. Votre modèle choisi reste inchangé.`,
    atsWordShort: 'Word ATS',
    atsPdfShort: 'PDF ATS',
    atsWordAria: 'Télécharger Word – version ATS',
    atsPdfAria: 'Télécharger PDF – version ATS',
    atsPdfBusy: 'Mise en page du PDF ATS…',
    atsPdfDone: (p, kb, tpl) => `PDF ATS prêt (${tpl}) · ${p === 1 ? 'une page' : `${p} pages`} · ${kb} Ko`,
    atsPdfFailed: r => `Échec du PDF ATS : ${r}`,
  },
  es: {
    duplicate: 'Duplicar',
    duplicateTitle: 'Duplicar versión',
    duplicateSub: 'Una copia para la próxima candidatura',
    copyName: n => `${n} (copia)`,
    duplicated: n => `«${n}» creado.`,
    duplicateFailed: 'No se pudo guardar la copia.',
    atsPdf: 'PDF – versión ATS',
    atsPdfSub: tpl => `El mismo contenido en la plantilla de una columna ${tpl}. Tu plantilla elegida se mantiene.`,
    atsWordShort: 'Word ATS',
    atsPdfShort: 'PDF ATS',
    atsWordAria: 'Descargar Word – versión ATS',
    atsPdfAria: 'Descargar PDF – versión ATS',
    atsPdfBusy: 'Componiendo el PDF ATS…',
    atsPdfDone: (p, kb, tpl) => `PDF ATS listo (${tpl}) · ${p === 1 ? 'una página' : `${p} páginas`} · ${kb} KB`,
    atsPdfFailed: r => `Falló el PDF ATS: ${r}`,
  },
};

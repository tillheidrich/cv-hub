/**
 * Page format catalogue. A CV almost always lives on A4 (Europe) or
 * US Letter (North America). Legal and A5 are included because some
 * markets ask for them (Legal for academic CVs in the US, A5 for
 * compact one-pagers).
 */

export type PageFormat = 'a4' | 'letter' | 'legal' | 'a5';

export interface PageFormatSpec {
  /** Stable id used in profile.settings.pageFormat */
  id: PageFormat;
  /** Friendly label for the picker */
  label: string;
  /** Region / use-case hint */
  hint: string;
  /** Width in millimetres */
  widthMm: number;
  /** Height in millimetres */
  heightMm: number;
  /** Playwright `page.pdf({ format })` value */
  playwrightFormat: string;
}

export const PAGE_FORMATS: Record<PageFormat, PageFormatSpec> = {
  a4: {
    id: 'a4', label: 'A4', hint: 'Europa · Standard',
    widthMm: 210, heightMm: 297, playwrightFormat: 'A4',
  },
  letter: {
    id: 'letter', label: 'US Letter', hint: 'USA, Kanada',
    widthMm: 216, heightMm: 279, playwrightFormat: 'Letter',
  },
  legal: {
    id: 'legal', label: 'US Legal', hint: 'USA · Akademische CVs',
    widthMm: 216, heightMm: 356, playwrightFormat: 'Legal',
  },
  a5: {
    id: 'a5', label: 'A5', hint: 'Kompakt · Halbe Höhe',
    widthMm: 148, heightMm: 210, playwrightFormat: 'A5',
  },
};

export const PAGE_FORMAT_LIST: PageFormatSpec[] = Object.values(PAGE_FORMATS);

export function getPageFormat(id?: PageFormat | string): PageFormatSpec {
  if (id && id in PAGE_FORMATS) return PAGE_FORMATS[id as PageFormat];
  return PAGE_FORMATS.a4;
}

/** Nur für das Vorrendern: Sprache aus globalThis.__CV_SSR_LANG__ statt aus
 *  localStorage und navigator (die es im Bau nicht gibt bzw. die dort „en"
 *  meldeten). */
import type { UiLang } from '../../ui/i18n';

export function useUiLang(): UiLang {
  return (globalThis as unknown as { __CV_SSR_LANG__?: UiLang }).__CV_SSR_LANG__ ?? 'de';
}

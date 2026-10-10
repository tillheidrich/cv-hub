/** Eintrag eines Bildschirmfotos aus shots.gen.ts (scripts/landing-shots.mjs). */
import { SHOTS, type ShotImage } from './shots.gen';

export function shot(key: string): ShotImage | null {
  return SHOTS[key] ?? null;
}

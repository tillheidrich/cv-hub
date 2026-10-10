/**
 * Bildschirmfoto als <picture>: AVIF und WebP mit srcset, PNG als Rückfall,
 * immer mit width/height (kein Layoutsprung). Die Dateien erzeugt
 * scripts/landing-shots.mjs; die Version hängt als ?v= an der Adresse, damit
 * nginx sie lange zwischenspeichern darf.
 */
import type { CSSProperties } from 'react';
import type { ShotImage } from './shots.gen';

const url = (f: string, v: string) => `/landing/${f}?v=${v}`;
const srcset = (list: [string, number][], v: string) => list.map(([f, w]) => `${url(f, v)} ${w}w`).join(', ');

interface Props {
  img: ShotImage;
  alt: string;
  sizes: string;
  /** Hero: sofort laden, hohe Priorität. Sonst lazy. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Telefonbild für schmale Fenster (eigene Quelle mit eigenem Format). */
  mobile?: { img: ShotImage; media: string; sizes: string } | null;
}

export default function Picture({ img, alt, sizes, priority, className, style, mobile }: Props) {
  const fallback = img.png ?? img.webp[0];
  return (
    <picture className={className} style={style}>
      {mobile && <source type="image/avif" media={mobile.media} srcSet={srcset(mobile.img.avif, mobile.img.v)} sizes={mobile.sizes} width={mobile.img.w} height={mobile.img.h} />}
      {mobile && <source type="image/webp" media={mobile.media} srcSet={srcset(mobile.img.webp, mobile.img.v)} sizes={mobile.sizes} width={mobile.img.w} height={mobile.img.h} />}
      <source type="image/avif" srcSet={srcset(img.avif, img.v)} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(img.webp, img.v)} sizes={sizes} />
      <img
        src={url(fallback[0], img.v)}
        width={img.w}
        height={img.h}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        // React 19 kennt fetchPriority; im vorgerenderten HTML steht fetchpriority.
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </picture>
  );
}

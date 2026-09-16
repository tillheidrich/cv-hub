/**
 * Bewerbungsfoto zuschneiden, bevor es hochgeladen wird.
 *
 * Vorher landete die Datei so im Lebenslauf, wie sie aus der Kamera kam: ein
 * Querformat wurde von `object-fit: cover` mittig beschnitten, und wer nicht
 * genau in der Mitte des Bildes stand, war im Lebenslauf angeschnitten. Die
 * einzige Abhilfe war, das Bild vorher in einem anderen Programm zu
 * beschneiden — für ein Werkzeug, das sonst alles selbst kann, eine Zumutung.
 *
 * Der Ausschnitt wird hier festgelegt und in Pixel gebacken: Was im Rahmen zu
 * sehen ist, ist die Datei, die gespeichert wird. Das ist wichtiger als es
 * klingt — Word, PDF und HTML beschneiden sonst jeweils auf eigene Art, und
 * am Ende sieht das Foto in jeder Ausgabe anders aus.
 *
 * Zwei Formate, weil die Vorlagen zwei Formen kennen: Hochformat 4:5 für die
 * eckigen und abgerundeten Rahmen, Quadrat für die runden. Ein quadratisches
 * Bild in einem runden Rahmen bleibt ein Kreis; ein hochformatiges würde zur
 * Ellipse.
 */
import { useEffect, useRef, useState } from 'react';

export type CropRatio = 'portrait' | 'square';

const VIEW_W = 240;
/** Kantenlänge des Rahmens je Format. */
const viewH = (r: CropRatio) => (r === 'square' ? VIEW_W : Math.round(VIEW_W * 1.25));
/** Lange Kante der gespeicherten Datei. Mehr braucht ein Druckbild nicht. */
const OUT_LONG = 900;

export default function PhotoCropper({ src, texts, onCancel, onDone }: {
  src: string;
  texts: {
    title: string; hint: string; zoom: string; portrait: string; square: string;
    apply: string; cancel: string;
  };
  onCancel: () => void;
  /** Liefert den Ausschnitt als Data-URL (JPEG). */
  onDone: (dataUrl: string) => void;
}) {
  const [ratio, setRatio] = useState<CropRatio>('portrait');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const H = viewH(ratio);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  /** Kleinster Maßstab, bei dem das Bild den Rahmen noch füllt. */
  const cover = img ? Math.max(VIEW_W / img.naturalWidth, H / img.naturalHeight) : 1;
  const scale = cover * zoom;

  /* Der Rahmen darf nie leer laufen: das Bild bleibt immer mindestens so
   * groß wie der Ausschnitt, und die Verschiebung wird an seinen Rändern
   * angehalten. Sonst steht im Lebenslauf ein weißer Streifen. */
  function clamp(o: { x: number; y: number }) {
    if (!img) return o;
    const maxX = Math.max(0, (img.naturalWidth * scale - VIEW_W) / 2);
    const maxY = Math.max(0, (img.naturalHeight * scale - H) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  }
  useEffect(() => { setOff(o => clamp(o)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [zoom, ratio, img]);

  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
  }
  const up = () => { drag.current = null; };

  function apply() {
    if (!img) return;
    const outH = ratio === 'square' ? OUT_LONG : OUT_LONG;
    const outW = ratio === 'square' ? OUT_LONG : Math.round(OUT_LONG / 1.25);
    const c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    // Linke obere Ecke des dargestellten Bildes im Rahmen …
    const x0 = VIEW_W / 2 + off.x - (img.naturalWidth * scale) / 2;
    const y0 = H / 2 + off.y - (img.naturalHeight * scale) / 2;
    // … und daraus der Ausschnitt in den Pixeln der Originaldatei.
    ctx.drawImage(img, -x0 / scale, -y0 / scale, VIEW_W / scale, H / scale, 0, 0, outW, outH);
    onDone(c.toDataURL('image/jpeg', 0.92));
  }

  const box: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(15,17,21,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  };
  const knopf = (primär: boolean): React.CSSProperties => ({
    padding: '9px 14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    border: primär ? 'none' : '1px solid oklch(0.88 0.006 264)',
    background: primär ? 'oklch(0.21 0.021 264)' : '#fff',
    color: primär ? '#fff' : 'oklch(0.35 0.015 264)',
  });
  const tab = (aktiv: boolean): React.CSSProperties => ({
    ...knopf(false), padding: '6px 11px', fontSize: '11.5px',
    background: aktiv ? 'oklch(0.95 0.01 264)' : '#fff',
    borderColor: aktiv ? 'oklch(0.72 0.03 264)' : 'oklch(0.9 0.006 264)',
  });

  return (
    <div style={box} onPointerUp={up} role="dialog" aria-modal="true" aria-label={texts.title}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', width: 'min(340px, 100%)', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '4px' }}>{texts.title}</div>
        <div style={{ fontSize: '11px', color: 'oklch(0.55 0.012 264)', lineHeight: 1.5, marginBottom: '12px' }}>{texts.hint}</div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <button type="button" style={tab(ratio === 'portrait')} onClick={() => setRatio('portrait')}>{texts.portrait}</button>
          <button type="button" style={tab(ratio === 'square')} onClick={() => setRatio('square')}>{texts.square}</button>
        </div>

        <div
          onPointerDown={down}
          onPointerMove={move}
          style={{
            width: VIEW_W, height: H, margin: '0 auto', overflow: 'hidden', position: 'relative',
            borderRadius: ratio === 'square' ? '50%' : '10px', background: 'oklch(0.94 0.004 264)',
            cursor: 'grab', touchAction: 'none', userSelect: 'none',
            boxShadow: 'inset 0 0 0 1px oklch(0.85 0.008 264)',
          }}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                width: img.naturalWidth * scale, height: img.naturalHeight * scale,
                transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
                maxWidth: 'none', pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '9px', margin: '13px 0 15px', fontSize: '11px', color: 'oklch(0.45 0.015 264)' }}>
          {texts.zoom}
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" style={knopf(false)} onClick={onCancel}>{texts.cancel}</button>
          <button type="button" style={knopf(true)} onClick={apply} disabled={!img}>{texts.apply}</button>
        </div>
      </div>
    </div>
  );
}

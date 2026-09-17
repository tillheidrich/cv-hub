/* Prüfstand für den Foto-Zuschnitt.
 *
 * Der Weg „Foto anklicken → Zuschnitt" liegt hinter einer Anmeldung: der
 * Demo-Modus schaltet ihn ab, und ohne Konto kommt man im Werkzeug nicht in
 * den Editor. Diese Seite rendert nur den Editor, mit demoMode=false und
 * einem Foto als Data-URL, damit der Klickweg prüfbar ist, ohne dass eine
 * Datei auf einem Server landet. Nicht Teil der App — nur über /dev-photo.html.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import EditorPanel from '../editor/EditorPanel';
import { PERSONAS } from './personas';
import type { CVData } from '../data/types';

/* Ein erkennbares Bild: linke Hälfte blau, rechte Hälfte orange, damit im
   Zuschnitt sofort zu sehen ist, welcher Ausschnitt gerade im Rahmen steht. */
function testBild(): string {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 400;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2563eb'; x.fillRect(0, 0, 300, 400);
  x.fillStyle = '#ea580c'; x.fillRect(300, 0, 300, 400);
  x.fillStyle = '#fff'; x.font = 'bold 48px sans-serif';
  x.fillText('L', 120, 220); x.fillText('R', 420, 220);
  return c.toDataURL('image/png');
}

function Probe() {
  const foto = testBild();
  const [data, setData] = useState<CVData>(() => {
    const d = structuredClone(PERSONAS.marketing) as CVData;
    d.personal.photo = foto;
    d.personal.photoOriginal = foto;
    return d;
  });
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 380, borderRight: '1px solid #ddd', background: '#fff' }}>
        <EditorPanel data={data} lang="de" uiLang="de" demoMode={false} onUpdate={f => setData(f(data))} />
      </div>
      <pre id="zustand" style={{ padding: 16, fontSize: 11 }}>
        {JSON.stringify({ photo: data.personal.photo?.slice(0, 40), original: data.personal.photoOriginal?.slice(0, 40) }, null, 2)}
      </pre>
    </div>
  );
}
createRoot(document.getElementById('dev-root')!).render(<Probe />);

import { useRef, useState } from 'react';
import { useUiLang } from './useUiLang';
import { DESIGN_I18N } from './i18n/design';

/**
 * Skills als Chips (Gestaltungsbericht, Bau-Liste 8). Das Datenmodell bleibt
 * `string[]`.
 *
 *  - Enter oder Komma legt einen Chip an; eingefügte Komma- oder Zeilenlisten
 *    werden geteilt.
 *  - Rücktaste im leeren Feld markiert zuerst den letzten Chip, erst die
 *    zweite löscht ihn — kein versehentliches Löschen.
 *  - ← / → wandern zwischen den Chips, Entf/Rücktaste löscht den gewählten.
 *  - Jeder Chip hat ein × mit Namen („Figma entfernen"); eine Live-Region
 *    meldet Hinzufügen und Entfernen.
 *
 * Ein Eintrag darf selbst ein Komma enthalten, wenn er so importiert wurde —
 * er wird angezeigt, wie er ist; nur neue Eingaben teilt das Komma.
 */
export default function ChipInput({ items, onChange, placeholder, label }: {
  items: string[]; onChange: (items: string[]) => void; placeholder?: string; label: string;
}) {
  const d = DESIGN_I18N[useUiLang()];
  const [text, setText] = useState('');
  const [marked, setMarked] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...items];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setLive(parts.map(p => d.chipAdded(p)).join('. '));
  };
  const removeAt = (i: number) => {
    const name = items[i];
    onChange(items.filter((_, j) => j !== i));
    setMarked(null);
    setLive(d.chipRemoved(name));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (text.trim()) { e.preventDefault(); add(text); setText(''); }
      else if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key === 'Backspace' && !text) {
      e.preventDefault();
      if (!items.length) return;
      const last = items.length - 1;
      if (marked === last) removeAt(last);
      else { setMarked(last); setLive(d.chipMarked(items[last])); }
      return;
    }
    if (e.key === 'ArrowLeft' && !text && items.length) {
      e.preventDefault();
      chipRefs.current[items.length - 1]?.focus();
      return;
    }
    if (marked !== null) setMarked(null);
  };

  const onChipKey = (i: number) => (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); chipRefs.current[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (i + 1 < items.length) chipRefs.current[i + 1]?.focus(); else inputRef.current?.focus();
    }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeAt(i); }
  };

  return (
    <div className="ui-chipinput" onClick={e => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}>
      {items.map((it, i) => (
        <span key={`${it}-${i}`} className="ui-skill" data-marked={marked === i}
          ref={el => { chipRefs.current[i] = el; }} tabIndex={-1} onKeyDown={onChipKey(i)}
          onFocus={() => setMarked(i)} onBlur={() => setMarked(m => (m === i ? null : m))}>
          <span>{it}</span>
          <button type="button" tabIndex={-1} aria-label={d.chipRemove(it)} onClick={() => removeAt(i)}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={text}
        aria-label={label}
        placeholder={items.length ? undefined : (placeholder ?? d.chipPlaceholder)}
        onChange={e => {
          const v = e.target.value;
          // Eingefügte Listen sofort teilen; ein einzelnes Komma am Ende auch.
          if (/[,\n]/.test(v)) {
            const lastSep = Math.max(v.lastIndexOf(','), v.lastIndexOf('\n'));
            add(v.slice(0, lastSep));
            setText(v.slice(lastSep + 1).trimStart());
          } else setText(v);
          setMarked(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => { if (text.trim()) { add(text); setText(''); } setMarked(null); }}
        onPaste={e => {
          const t = e.clipboardData.getData('text');
          if (/[,\n]/.test(t)) { e.preventDefault(); add(text + t); setText(''); }
        }}
      />
      <span className="cv-sr-only" role="status" aria-live="polite">{live}</span>
    </div>
  );
}

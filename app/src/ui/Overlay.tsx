import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Hängt seine Kinder direkt ans Dokument, nicht dorthin, wo sie im Baum
 *  stehen.
 *
 *  Anlass war ein Bildschirmfoto vom iPhone: Das Auswahlblatt „Vorlage wählen"
 *  war bis auf seine Kopfzeile verdeckt. Es lag im `<header>`, und der war auf
 *  dem Telefon ein waagerecht scrollbarer Kasten. WebKit behandelt einen
 *  scrollbaren Vorfahren als Begrenzung für `position: fixed` — das Blatt war
 *  damit auf die 56 px hohe Leiste beschnitten. In Chromium passiert das
 *  nicht, der Prüfstand konnte es also nicht sehen.
 *
 *  Im Portal hängt das Blatt am Dokument: kein Stapelkontext, kein Überlauf
 *  und keine Transformation eines Vorfahren kann es einfangen. (Aus App.tsx
 *  hierher gezogen, 08.10.2026.) */
export function Portal({ children }: { children: React.ReactNode }) {
  const [host] = useState(() => {
    const d = document.createElement('div');
    d.className = 'ui';
    return d;
  });
  useEffect(() => {
    document.body.appendChild(host);
    return () => { document.body.removeChild(host); };
  }, [host]);
  return createPortal(children, host);
}

/** Ein Blatt, das von unten kommt — die Form, in der auf dem Telefon jede
 *  seltene Auswahl erscheint. */
export function MobileSheet({ title, onClose, closeLabel, children }: {
  title: string; onClose: () => void; closeLabel: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Portal>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'oklch(0.21 0.021 264 / 0.32)' }} />
      <div
        ref={ref} tabIndex={-1}
        role="dialog" aria-modal="true" aria-label={title}
        className="cv-sheet"
        style={{
          position: 'fixed', left: '12px', right: '12px',
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 1210,
          background: 'var(--float-solid)', borderRadius: '22px',
          boxShadow: 'var(--float-ring), 0 -14px 40px oklch(0.21 0.021 264 / 0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px 8px 18px', borderBottom: '1px solid var(--hair)', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--t-lg)', fontWeight: 620, color: 'var(--ink)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="ui-btn ui-icon-btn" style={{ minHeight: '44px', width: '44px', fontSize: '22px', color: 'var(--ink-2)' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 14px 16px' }}>{children}</div>
      </div>
    </Portal>
  );
}

/**
 * Aufklappmenü nach dem ARIA-Muster „menu button".
 *
 * Pfeiltasten wandern zwischen den Einträgen, Pos1/Ende springen, Escape
 * schließt und gibt den Fokus an den Auslöser zurück, Tab schließt ebenfalls.
 * Ein Klick daneben schließt — im Erfassungsdurchgang, sonst öffnete der
 * Auslöser das Menü im selben Klick wieder.
 */
export function Menu({ open, onClose, label, triggerRef, align = 'right', width, children }: {
  open: boolean; onClose: () => void; label: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right'; width?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    const first = ref.current?.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]') ?? items()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); triggerRef.current?.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
      else if (e.key === 'Tab') { onClose(); }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [open, onClose, triggerRef]);
  if (!open) return null;
  return (
    <div ref={ref} role="menu" aria-label={label} className="ui-menu"
      style={{ top: 'calc(100% + 8px)', [align]: 0, width: width ? `${width}px` : undefined, maxHeight: 'min(calc(100vh - 96px), 640px)', overflowY: 'auto' }}>
      {children}
    </div>
  );
}

/** Ein Eintrag im Menü. */
export function MenuItem({ onSelect, children, checked, sub, icon, tag, disabled }: {
  onSelect: () => void; children: React.ReactNode; checked?: boolean; sub?: React.ReactNode;
  icon?: React.ReactNode; tag?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button type="button" className="ui-menu-item" disabled={disabled}
      role={checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={checked}
      onClick={onSelect}>
      {icon && <span aria-hidden style={{ display: 'inline-flex', width: '20px', justifyContent: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{children}{tag}</span>
        {sub && <span className="ui-menu-sub">{sub}</span>}
      </span>
      {checked && <span aria-hidden style={{ color: 'var(--accent-ink)' }}>✓</span>}
    </button>
  );
}

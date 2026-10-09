/**
 * Darstellung der Vertragstexte (Markdown-Teilmenge, ohne HTML).
 *
 * Die Texte aus app/src/legal/ sind Klartext mit Überschriften (#, ##, ###),
 * Absätzen, Listen (-, *, 1.), **fett** und [Link](Adresse). Mehr braucht
 * ein Vertragstext nicht, und ohne HTML kann aus einem Text auch kein
 * Skript werden.
 */
import { Fragment, type ReactNode } from 'react';
import { linkClick } from './route';

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else {
      const href = m[3];
      const internal = href.startsWith('/') && !href.startsWith('//');
      const safe = internal || /^(https?:|mailto:|tel:)/i.test(href);
      out.push(safe
        ? <a key={`${key}-a${i++}`} href={href} onClick={internal ? linkClick(href) : undefined}
            {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{m[2]}</a>
        : m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function LegalText({ text, headingOffset = 1 }: { text: string; headingOffset?: number }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="bl-legal">
      {blocks.map((b, bi) => {
        const lines = b.split('\n').filter(l => l.trim() !== '');
        if (!lines.length) return null;
        const h = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
        if (h && lines.length === 1) {
          const level = Math.min(6, h[1].length + headingOffset);
          const Tag = `h${level}` as 'h2';
          return <Tag key={bi}>{inline(h[2], `h${bi}`)}</Tag>;
        }
        if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `l${bi}-${li}`)}</li>)}</ul>;
        }
        if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), `o${bi}-${li}`)}</li>)}</ol>;
        }
        // Überschrift mit Text darunter im selben Block
        if (h) {
          const level = Math.min(6, h[1].length + headingOffset);
          const Tag = `h${level}` as 'h2';
          return (
            <Fragment key={bi}>
              <Tag>{inline(h[2], `h${bi}`)}</Tag>
              <p>{lines.slice(1).map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `p${bi}-${li}`)}</Fragment>)}</p>
            </Fragment>
          );
        }
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `p${bi}-${li}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/** Abschnitte aus app/src/legal (LegalSection[]): Überschrift, Absätze,
 *  Aufzählung, Absätze danach. Anker über `id`, damit Links wie /agb#widerruf
 *  funktionieren. */
export function LegalSections({ sections, level = 2, idPrefix = '' }: {
  sections: { id: string; title: string; paragraphs: string[]; list?: string[]; after?: string[] }[];
  level?: 2 | 3;
  idPrefix?: string;
}) {
  const H = `h${level}` as 'h2';
  return (
    <div className="bl-legal">
      {sections.map(sec => (
        <section key={sec.id} id={`${idPrefix}${sec.id}`} aria-labelledby={`${idPrefix}${sec.id}-h`}>
          <H id={`${idPrefix}${sec.id}-h`}>{sec.title}</H>
          {sec.paragraphs.map((p, i) => <p key={i}>{inline(p, `${sec.id}-p${i}`)}</p>)}
          {sec.list && sec.list.length > 0 && <ul>{sec.list.map((l, i) => <li key={i}>{inline(l, `${sec.id}-l${i}`)}</li>)}</ul>}
          {sec.after?.map((p, i) => <p key={`a${i}`}>{inline(p, `${sec.id}-a${i}`)}</p>)}
        </section>
      ))}
    </div>
  );
}

/** Text mit einem verlinkten Wort, z. B. „Ich habe die AGB gelesen …" mit
 *  Link auf /agb. Findet das Wort nicht, bleibt der Text ohne Link. */
export function Linkify({ text, word, href, newTab = true }: { text: string; word: string | RegExp; href: string; newTab?: boolean }) {
  const re = typeof word === 'string' ? new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : word;
  const m = re.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <a href={href} {...(newTab ? { target: '_blank', rel: 'noopener' } : { onClick: linkClick(href) })}>{m[0]}</a>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

/** Kurze Anzeigeform einer Web-Adresse: ohne Protokoll, ohne „www.", ohne
 *  Schrägstrich am Ende. Jedes weggelassene Zeichen macht es wahrscheinlicher,
 *  dass die Adresse in einer schmalen Spalte am Stück steht — und ein Parser
 *  erkennt „linkedin.com/in/…" auch ohne „https://www.". */
export function shortUrl(v: string): string {
  return (v || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

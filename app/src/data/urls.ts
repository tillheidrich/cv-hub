/** Kurze Anzeigeform einer Web-Adresse: ohne Protokoll, ohne „www.", ohne
 *  Schrägstrich am Ende. Jedes weggelassene Zeichen macht es wahrscheinlicher,
 *  dass die Adresse in einer schmalen Spalte am Stück steht — und ein Parser
 *  erkennt „linkedin.com/in/…" auch ohne „https://www.". */
export function shortUrl(v: string): string {
  return (v || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

/** Öffentliches Repository der quelloffenen Fassung (AGPL-3.0). Eine Stelle
 *  für Impressum und den Hinweis „selbst hosten" auf der Preisseite.
 *  Wer eine geänderte Fassung betreibt, trägt hier das eigene Repository ein
 *  (AGPL-3.0 § 13: Nutzer müssen den Quelltext der laufenden Fassung bekommen). */
export const SOURCE_REPO_URL = 'https://github.com/tillheidrich/cv-hub';

/** Adresse einer Datei oder eines Ordners im Repository, z. B. die
 *  Prüfskripte unter app/scripts. Schema von GitHub (/tree/<Zweig>/<Pfad>,
 *  GitHub leitet Dateien selbst auf /blob/ weiter); wer auf Forgejo oder Gitea
 *  hostet, nimmt /src/branch/<Zweig>/<Pfad>. */
export function sourceFileUrl(path: string, branch = 'main'): string {
  return `${SOURCE_REPO_URL}/tree/${branch}/${path.replace(/^\/+/, '')}`;
}

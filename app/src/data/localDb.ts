/**
 * Kleine Hülle um IndexedDB — ohne Abhängigkeit.
 *
 * Warum IndexedDB statt localStorage (Technik-Bericht 08.10.2026, Abschnitt 4):
 * localStorage fasst je Ursprung rund 5 MB, und ein einziges Foto mit Original
 * belegt davon schnell ein Fünftel. IndexedDB bekommt einen Anteil am freien
 * Plattenplatz und kann Binärdaten speichern, ohne sie als Base64 um ein
 * Drittel aufzublähen.
 *
 * Diese Datei kennt keine Profile, nur Speicherbereiche und Fehlerarten. Was
 * gespeichert wird, entscheidet `storage.ts`.
 *
 * Grundregel: Jeder Zugriff kann scheitern — privates Fenster, gesperrte
 * Website-Daten, voller Speicher, ein zweiter Tab mit älterer Fassung, die
 * das Upgrade blockiert. Deshalb gibt es hier keine Funktion, die einen
 * Fehler verschluckt. Jeder wird als `LocalDbError` mit einer Art
 * weitergereicht, damit die Oberfläche sagen kann, WAS nicht ging.
 */

export const DB_NAME = 'cv-hub-local';
export const DB_VERSION = 1;

/** Speicherbereiche (object stores). */
export const STORE = {
  /** Ein Datensatz je Profil, Schlüssel `id`. Fotos stehen darin nur als
   *  Verweis (`idbphoto:<schlüssel>`), die Bilddaten liegen in `photos`. */
  profiles: 'profiles',
  /** Bilddaten, Schlüssel = Inhaltsprüfsumme. Dasselbe Foto in vier
   *  Sprachfassungen und zwanzig Versionen liegt so nur einmal da. */
  photos: 'photos',
  /** Lokaler Verlauf, Schlüssel `vid` (fortlaufend), Index `byProfile`. */
  versions: 'versions',
  /** Kleine Werte: Reihenfolge der Profile, letzte Sicherung, Migration. */
  meta: 'meta',
} as const;
export type StoreName = typeof STORE[keyof typeof STORE];

export type LocalDbErrorKind =
  /** Speicher voll (QuotaExceededError) — der wichtigste Fall. */
  | 'quota'
  /** IndexedDB gibt es nicht oder der Browser sperrt sie (privates Fenster,
   *  Website-Daten blockiert). */
  | 'unavailable'
  /** Ein anderer Tab hält eine ältere Fassung der Datenbank offen. */
  | 'blocked'
  /** Öffnen hat zu lange gedauert. */
  | 'timeout'
  | 'unknown';

export class LocalDbError extends Error {
  kind: LocalDbErrorKind;
  constructor(kind: LocalDbErrorKind, message: string) {
    super(message);
    this.name = 'LocalDbError';
    this.kind = kind;
  }
}

/** Ordnet einen beliebigen Fehler einer Art zu. Browser melden „voll" unter
 *  verschiedenen Namen (Chrome/Firefox: QuotaExceededError, ältere Firefox:
 *  NS_ERROR_DOM_QUOTA_REACHED, Safari teils als UnknownError mit Text). */
export function classifyError(err: unknown): LocalDbError {
  if (err instanceof LocalDbError) return err;
  const name = (err as { name?: string } | null)?.name || '';
  const msg = String((err as { message?: string } | null)?.message || err || '');
  if (/quota/i.test(name) || /quota|NS_ERROR_DOM_QUOTA_REACHED|disk is full|storage full/i.test(msg)) {
    return new LocalDbError('quota', msg || 'Speicher voll');
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || /not allowed|denied|security/i.test(msg)) {
    return new LocalDbError('unavailable', msg || 'IndexedDB nicht verfügbar');
  }
  return new LocalDbError('unknown', msg || 'Unbekannter Speicherfehler');
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Öffnet die Datenbank (einmal je Seite). Wird nach `timeoutMs` aufgegeben —
 * ein blockiertes Upgrade soll die App nicht ewig auf „lädt…" halten.
 */
export function openDb(timeoutMs = 4000): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => done(() => reject(new LocalDbError('timeout', 'IndexedDB antwortet nicht'))), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw new LocalDbError('unavailable', 'IndexedDB fehlt');
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      done(() => reject(classifyError(e)));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE.profiles)) db.createObjectStore(STORE.profiles, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE.photos)) db.createObjectStore(STORE.photos, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORE.versions)) {
        const v = db.createObjectStore(STORE.versions, { keyPath: 'vid', autoIncrement: true });
        v.createIndex('byProfile', 'profileId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE.meta)) db.createObjectStore(STORE.meta);
    };
    req.onblocked = () => done(() => reject(new LocalDbError('blocked', 'Ein anderer Tab hält eine ältere Fassung offen')));
    req.onerror = () => done(() => reject(classifyError(req.error)));
    req.onsuccess = () => {
      const db = req.result;
      // Will ein anderer Tab später upgraden, geben wir die Verbindung frei,
      // statt ihn zu blockieren. Danach wird beim nächsten Zugriff neu geöffnet.
      db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } dbPromise = null; };
      done(() => resolve(db));
    };
  });
  // Ein gescheiterter Versuch soll den nächsten nicht für immer verhindern.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Nur für Prüfläufe und „Alle lokalen Daten löschen": Verbindung schließen. */
export async function closeDb(): Promise<void> {
  const p = dbPromise;
  dbPromise = null;
  if (!p) return;
  try { (await p).close(); } catch { /* ignore */ }
}

/**
 * Eine Transaktion über mehrere Bereiche. `fn` darf NUR synchron Anfragen
 * stellen (IndexedDB schließt eine Transaktion, sobald der Code auf etwas
 * anderes wartet). Alles Asynchrone — Fotos umrechnen, Prüfsummen — gehört
 * vor den Aufruf.
 *
 * Erfüllt sich erst, wenn die Transaktion abgeschlossen ist (`complete`),
 * nicht schon, wenn die Anfragen gestellt sind. Erst dann liegt es wirklich
 * auf der Platte, und erst dann darf die Oberfläche „Gespeichert" sagen.
 */
export async function runTx<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (e) {
      reject(classifyError(e));
      return;
    }
    let result: T;
    let failed: LocalDbError | null = null;
    tx.oncomplete = () => (failed ? reject(failed) : resolve(result));
    tx.onerror = () => { failed = failed ?? classifyError(tx.error); };
    tx.onabort = () => reject(failed ?? classifyError(tx.error ?? new Error('Transaktion abgebrochen')));
    try {
      result = fn(tx);
    } catch (e) {
      // Eine synchron geworfene Ausnahme (z. B. QuotaExceededError aus put)
      // bricht die Transaktion ab — sonst würde sie halb geschrieben.
      failed = classifyError(e);
      try { tx.abort(); } catch { /* schon beendet */ }
    }
  });
}

/** Ergebnis einer einzelnen Anfrage innerhalb einer Transaktion. */
export function reqResult<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(classifyError(r.error));
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  let req!: IDBRequest<T[]>;
  await runTx([store], 'readonly', tx => { req = tx.objectStore(store).getAll() as IDBRequest<T[]>; });
  return req.result ?? [];
}

export async function getOne<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  let req!: IDBRequest<T | undefined>;
  await runTx([store], 'readonly', tx => { req = tx.objectStore(store).get(key) as IDBRequest<T | undefined>; });
  return req.result;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return getOne<T>(STORE.meta, key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await runTx([STORE.meta], 'readwrite', tx => { tx.objectStore(STORE.meta).put(value, key); });
}

/** Alle Bereiche leeren (die Datenbank selbst bleibt bestehen — Löschen der
 *  ganzen Datenbank würde von einem zweiten offenen Tab blockiert). */
export async function clearAll(): Promise<void> {
  const all = Object.values(STORE) as StoreName[];
  await runTx(all, 'readwrite', tx => { for (const s of all) tx.objectStore(s).clear(); });
}

/**
 * Den Browser bitten, unsere Daten nicht bei Platzmangel zu löschen.
 *
 * Chrome entscheidet selbst (ohne Rückfrage, nach Nutzungsintensität),
 * Firefox fragt den Menschen — deshalb rufen wir das erst auf, wenn es
 * wirklich lokale Profile gibt, nicht schon auf der Startseite. Safari
 * gewährt es meist nicht; seine Sieben-Tage-Regel hebt es ohnehin nicht auf.
 */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    const sm = (navigator as Navigator & { storage?: StorageManager }).storage;
    if (!sm?.persist) return null;
    if (sm.persisted && await sm.persisted()) return true;
    return await sm.persist();
  } catch {
    return null;
  }
}

/** Belegung und Kontingent laut Browser, falls er es verrät. */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const sm = (navigator as Navigator & { storage?: StorageManager }).storage;
    if (!sm?.estimate) return null;
    const e = await sm.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

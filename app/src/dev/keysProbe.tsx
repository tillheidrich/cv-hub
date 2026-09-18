/* Prüfstand für das Einstellungen-Fenster.
 *
 * Liegt hinter der Anmeldung; die API-Aufrufe scheitern hier und das ist in
 * Ordnung — geprüft wird der Teil, der ohne Daten steht: die MCP-Adresse, die
 * Kopierknöpfe und die Anleitungen je Client, auch auf Telefonbreite.
 */
import { createRoot } from 'react-dom/client';
import KeysPanel from '../screens/KeysPanel';
createRoot(document.getElementById('dev-root')!).render(<KeysPanel onClose={() => {}} />);

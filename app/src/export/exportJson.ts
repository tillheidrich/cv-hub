import type { CVData } from '../data/types';
import { exportFilename } from './filename';

export function exportJson(data: CVData): void {
  const json = JSON.stringify(data, null, 2);
  const filename = exportFilename('lebenslauf', data.personal.name, 'json');

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

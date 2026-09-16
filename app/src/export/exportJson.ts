import type { CVData } from '../data/types';
import { saveText } from './saveFile';
import { exportFilename } from './filename';

export function exportJson(data: CVData): void {
  const json = JSON.stringify(data, null, 2);
  const filename = exportFilename('lebenslauf', data.personal.name, 'json');

  saveText(filename, json, 'application/json');
}

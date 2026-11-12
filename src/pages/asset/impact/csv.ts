/** CSV download (v03 downloadCsv) with quote escaping and spreadsheet formula-injection protection. */
import { toast } from '../../../ui/overlay';

/** Quote a cell; cells starting with = + - @ (or tab/CR) get a leading single quote so spreadsheets do not run them as formulas. */
export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const toCsv = (rows: unknown[][]) => rows.map(row => row.map(csvCell).join(',')).join('\r\n');

export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export prepared for this demo.');
}

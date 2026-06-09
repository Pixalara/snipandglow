// =============================================================================
// Client-side CSV export (Excel-friendly).
//
// Dependency-free: builds a CSV string and triggers a browser download. The
// UTF-8 BOM makes Excel open it with correct encoding (₹, names in any script).
// Files open directly in Excel / Google Sheets / LibreOffice.
// =============================================================================

export interface ExportColumn<T> {
  /** Column header shown in the spreadsheet. */
  header: string;
  /** Value accessor — return a string/number/null for the cell. */
  value: (row: T) => string | number | null | undefined;
}

/** Escape a single CSV cell per RFC 4180 (quote if it contains , " or newline). */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from rows + column definitions. */
export function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * Build a CSV and trigger a download in the browser.
 * @param filenameBase  base name (a date stamp + .csv is appended)
 */
export function downloadCsv<T>(
  filenameBase: string,
  rows: T[],
  columns: ExportColumn<T>[]
): void {
  const csv = buildCsv(rows, columns);
  // BOM so Excel detects UTF-8.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

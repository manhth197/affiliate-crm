/** UTF-8 byte order mark: makes Excel read Vietnamese text correctly. */
export const CSV_BOM = '﻿';

export type CsvValue = string | number | null | undefined;

/**
 * Escapes one CSV cell (RFC 4180) and neutralises spreadsheet formulas:
 * a text cell starting with = + - @ (or tab/CR) would be executed by Excel
 * ("CSV injection"), so it is prefixed with a single quote.
 */
export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsvLine(values: CsvValue[]): string {
  return `${values.map(escapeCsvCell).join(',')}\r\n`;
}

/** Leads have a sequential number; the human-friendly code is "LD-" + 6 digits. */
export function formatLeadCode(number: number): string {
  return `LD-${String(number).padStart(6, '0')}`;
}

/** "LD-000123", "ld-123", "LD000123" → 123; anything else → null. */
export function parseLeadCode(code: string): number | null {
  const match = /^LD-?(\d{1,9})$/i.exec(code.trim());
  return match ? Number(match[1]) : null;
}

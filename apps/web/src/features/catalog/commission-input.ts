/** Admins type percentages; the API stores basis points (150 = 1.5%). */

/** "1,5" or "1.5" → 150 basis points; null if not a number. */
export function percentToBasisPoints(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/** 150 → "1,5" */
export function basisPointsToPercent(bp: number): string {
  return String(bp / 100).replace('.', ',')
}

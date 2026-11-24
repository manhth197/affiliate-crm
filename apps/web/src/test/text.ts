/**
 * Testing Library collapses all whitespace in the DOM (including the non-breaking space we
 * put before "₫") to a plain space, but not in the string we search for. Use this on
 * formatted values: `screen.getByText(asText(formatVnd(1_500_000)))`.
 */
export function asText(formatted: string): string {
  return formatted.replace(/\s+/g, ' ').trim()
}

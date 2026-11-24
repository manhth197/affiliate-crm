/**
 * Normalises text for accent- and case-insensitive search:
 * "Nguyễn Đức Mạnh" → "nguyen duc manh".
 *
 * NFD splits "ễ" into "e" + combining marks, which are then removed; "đ" is a
 * separate letter (no decomposition) so it is mapped by hand. The SQL backfill
 * in migration 20261124034430 applies the same rule with translate().
 */
export function toSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

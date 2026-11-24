/**
 * PII masking applied when an AFFILIATE reads customer data.
 * The number of characters is preserved so the UI keeps a stable width.
 */
function maskMiddle(value: string, keepStart: number, keepEnd: number): string {
  if (value.length <= keepStart + keepEnd) {
    return '*'.repeat(value.length);
  }
  const hidden = value.length - keepStart - keepEnd;
  return (
    value.slice(0, keepStart) +
    '*'.repeat(hidden) +
    value.slice(value.length - keepEnd)
  );
}

/** "0912345689" → "09******89" (first 2 and last 2 digits). */
export function maskPhone(phone: string): string {
  return maskMiddle(phone, 2, 2);
}

/** "001203004123" → "*********123" (last 3 digits). */
export function maskNationalId(nationalId: string): string {
  return maskMiddle(nationalId, 0, 3);
}

/** "0123456789" → "******6789" (last 4 digits). */
export function maskBankAccount(account: string): string {
  return maskMiddle(account, 0, 4);
}

/** A partner (bank / finance company) allowed to push lead status updates. */
export interface PartnerWebhookConfig {
  /** Sent in the X-Partner-Id header, e.g. "an-phat". */
  id: string;
  /** Must equal Product.partnerName of the leads this partner may update. */
  name: string;
  /** Shared HMAC secret. */
  secret: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,49}$/;
const MIN_SECRET_LENGTH = 16;

/** Parses and validates the PARTNER_WEBHOOKS env value; throws a readable error. */
export function parsePartnerWebhooks(json: string): PartnerWebhookConfig[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('must be valid JSON');
  }
  if (!Array.isArray(value)) {
    throw new Error('must be a JSON array');
  }
  const partners = value.map((entry: unknown, index) => {
    const { id, name, secret } = (entry ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      throw new Error(
        `[${index}].id must be lowercase letters, digits and dashes`,
      );
    }
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`[${index}].name is required`);
    }
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `[${index}].secret must be at least ${MIN_SECRET_LENGTH} characters`,
      );
    }
    return { id, name, secret };
  });
  const ids = new Set(partners.map((p) => p.id));
  if (ids.size !== partners.length) {
    throw new Error('partner ids must be unique');
  }
  return partners;
}

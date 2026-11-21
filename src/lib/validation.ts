// Synchronized verbatim with firebase-blueprint.json entity constraints
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 100,
  EMAIL_MAX: 200,
  BOOK_TITLE_MIN: 1,
  BOOK_TITLE_MAX: 120,
  WORKER_PHONE_MAX: 24,
  BOOK_NOTES_MAX: 300,
  BILL_TITLE_MIN: 1,
  BILL_TITLE_MAX: 120,
  DATE_MAX: 32,
  BILL_NUMBER_MAX: 40,
  BILL_NOTES_MAX: 400,
  ITEM_DETAILS_MIN: 1,
  ITEM_DETAILS_MAX: 200,
  VARAVU_NOTE_MAX: 200,
  AMOUNT_MIN: 0,
  AMOUNT_MAX: 10000000,
  BALANCE_MIN: -100000000,
  BALANCE_MAX: 100000000,
  LANGUAGE_MODES: ['mixed', 'ml', 'en'] as const,
} as const;

export function truncateString(value: string, maxLength: number): string {
  const cleaned = (value ?? '').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX);
  return cleaned || `id_${Date.now()}`;
}

export function generateSafeId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return sanitizeId(`${prefix}_${randomPart}`);
}

export function clampNonNegativeNumber(value: unknown, max = BLUEPRINT_LIMITS.AMOUNT_MAX): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(Math.round(num * 100) / 100, max);
}

export function clampSignedNumber(
  value: unknown,
  min = BLUEPRINT_LIMITS.BALANCE_MIN,
  max = BLUEPRINT_LIMITS.BALANCE_MAX
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(Math.round(num * 100) / 100, max));
}

export function formatCurrencyINR(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

export function formatShortDate(isoOrRaw: string): string {
  if (!isoOrRaw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoOrRaw.trim());
  if (match) {
    return `${match[3]}/${match[2]}/${match[1].slice(2)}`;
  }
  return isoOrRaw;
}

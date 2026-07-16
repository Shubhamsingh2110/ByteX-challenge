/**
 * Money is represented everywhere as an integer number of cents.
 *
 * Storing money as floating-point dollars is the classic financial bug:
 * `0.1 + 0.2 === 0.30000000000000004`, and `Math.round(1.005 * 100) === 100`
 * (not 101) because 1.005 isn't representable in IEEE-754. We avoid this
 * entirely by parsing decimal strings ourselves and never multiplying floats.
 */

export const MAX_AMOUNT_CENTS = 100_000_000_000; // $1,000,000,000 sanity ceiling

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyParseError";
  }
}

/**
 * Parse a human-entered amount ("$1,234.56", "1234.5", ".99", "10") into an
 * integer number of cents, WITHOUT ever doing float multiplication.
 *
 * Values with more than 2 decimal places are rounded half-up on the 3rd digit.
 */
export function toCents(input: string | number): number {
  const raw = typeof input === "number" ? numberToDecimalString(input) : input;

  // Strip currency symbols, thousands separators, and surrounding whitespace.
  const cleaned = raw.trim().replace(/[$£€,\s]/g, "");

  if (cleaned === "" || cleaned === "-" || cleaned === "+") {
    throw new MoneyParseError(`Not a valid amount: "${input}"`);
  }

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) {
    throw new MoneyParseError(`Not a valid amount: "${input}"`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? "";

  if (intPart === "" && fracPart === "") {
    throw new MoneyParseError(`Not a valid amount: "${input}"`);
  }

  const dollars = intPart === "" ? 0 : Number(intPart);
  const firstTwo = (fracPart + "00").slice(0, 2);
  let cents = dollars * 100 + Number(firstTwo);

  // Round half-up based on the third fractional digit.
  const thirdDigit = fracPart[2];
  if (thirdDigit !== undefined && Number(thirdDigit) >= 5) {
    cents += 1;
  }

  cents *= sign;

  if (!Number.isSafeInteger(cents)) {
    throw new MoneyParseError(`Amount out of safe range: "${input}"`);
  }
  if (Math.abs(cents) > MAX_AMOUNT_CENTS) {
    throw new MoneyParseError(`Amount exceeds maximum allowed: "${input}"`);
  }

  return cents;
}

/**
 * A float number → decimal string that keeps up to 2 decimals precisely.
 * We route number input through this so the rest of the parser stays string-based.
 */
function numberToDecimalString(n: number): string {
  if (!Number.isFinite(n)) {
    throw new MoneyParseError(`Not a finite amount: ${n}`);
  }
  // toFixed(2) gives the correctly-rounded 2-decimal representation for the
  // human-scale magnitudes this app deals with.
  return n.toFixed(2);
}

/** Format integer cents as a localized currency string, e.g. 123456 → "$1,234.56". */
export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  // Division is display-only; Intl rounds to the currency's minor units.
  return formatter.format(cents / 100);
}

/** Format cents without the currency symbol, e.g. 123456 → "1,234.56". */
export function formatAmount(cents: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Sum integer cents safely. */
export function sumCents(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

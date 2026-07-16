import { describe, it, expect } from "vitest";
import {
  toCents,
  formatMoney,
  formatAmount,
  sumCents,
  MoneyParseError,
} from "../src/money.js";

describe("toCents", () => {
  it("parses whole and decimal dollar strings", () => {
    expect(toCents("10")).toBe(1000);
    expect(toCents("10.5")).toBe(1050);
    expect(toCents("1234.56")).toBe(123456);
    expect(toCents(".99")).toBe(99);
    expect(toCents("0")).toBe(0);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(toCents("$1,234.56")).toBe(123456);
    expect(toCents("£1,000")).toBe(100000);
    expect(toCents(" $ 42.00 ")).toBe(4200);
  });

  it("avoids the classic float-multiplication bug (1.005)", () => {
    // Math.round(1.005 * 100) === 100 in IEEE-754; our parser returns 101.
    expect(toCents("1.005")).toBe(101);
    expect(Math.round(1.005 * 100)).toBe(100); // proves the naive bug exists
  });

  it("rounds half-up on the third decimal", () => {
    expect(toCents("1.004")).toBe(100);
    expect(toCents("1.006")).toBe(101);
    expect(toCents("9.999")).toBe(1000);
  });

  it("handles negative amounts", () => {
    expect(toCents("-5.50")).toBe(-550);
    expect(toCents("-0.01")).toBe(-1);
  });

  it("parses numbers without reintroducing float error", () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
  });

  it("throws on garbage input", () => {
    expect(() => toCents("abc")).toThrow(MoneyParseError);
    expect(() => toCents("")).toThrow(MoneyParseError);
    expect(() => toCents("1.2.3")).toThrow(MoneyParseError);
    expect(() => toCents("-")).toThrow(MoneyParseError);
  });

  it("rejects non-finite numbers and out-of-range values", () => {
    expect(() => toCents(Infinity)).toThrow(MoneyParseError);
    expect(() => toCents(NaN)).toThrow(MoneyParseError);
    expect(() => toCents("9999999999999")).toThrow(MoneyParseError);
  });
});

describe("formatMoney / formatAmount", () => {
  it("formats cents as localized INR currency", () => {
    expect(formatMoney(123456)).toBe("₹1,234.56");
    expect(formatMoney(-550)).toBe("-₹5.50");
    expect(formatMoney(0)).toBe("₹0.00");
    // Indian digit grouping (lakh) for larger amounts
    expect(formatMoney(1234567890)).toBe("₹1,23,45,678.90");
  });

  it("formats amount without a symbol", () => {
    expect(formatAmount(123456)).toBe("1,234.56");
  });
});

describe("sumCents", () => {
  it("sums integer cents exactly", () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    // The float trap: 0.1+0.2+0.3 !== 0.6, but in cents it's exact.
    expect(sumCents([10, 20, 30]) / 100).toBe(0.6);
  });
});

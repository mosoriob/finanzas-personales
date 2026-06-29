import { describe, it, expect } from "vitest";
import { formatMoney, isCLP } from "@/lib/currency";

describe("formatMoney", () => {
  it("formats a negative USD charge as -US$ with the sign inside the string", () => {
    expect(formatMoney(-119, "USD")).toBe("-US$119");
  });

  it("formats a positive USD amount as US$", () => {
    expect(formatMoney(119, "USD")).toBe("US$119");
  });

  it("groups thousands with es-CL separators for USD", () => {
    expect(formatMoney(1234, "USD")).toBe("US$1.234");
  });

  it("delegates to the peso formatter when currency is null", () => {
    expect(formatMoney(-45230, null)).toBe("-$45.230");
  });

  it("delegates to the peso formatter when currency is absent", () => {
    expect(formatMoney(-45230)).toBe("-$45.230");
  });

  it("treats an explicit CLP currency as pesos", () => {
    expect(formatMoney(45230, "CLP")).toBe("$45.230");
  });
});

describe("isCLP", () => {
  it("counts a row with null currency as pesos", () => {
    expect(isCLP({ currency: null })).toBe(true);
  });

  it("counts a row with absent currency as pesos", () => {
    expect(isCLP({})).toBe(true);
  });

  it('counts a row with "CLP" currency as pesos', () => {
    expect(isCLP({ currency: "CLP" })).toBe(true);
  });

  it('excludes a row with "USD" currency', () => {
    expect(isCLP({ currency: "USD" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { formatDateRange, formatIsoDate } from "@/lib/data/format";

describe("localized date display", () => {
  it("uses the English calendar convention for English UI", () => {
    expect(formatIsoDate("1941-08-31", "en")).toBe("31 August 1941");
    expect(formatDateRange({
      raw: "1941-08-01 to 1941-08-31",
      start: "1941-08-01",
      end: "1941-08-31",
      precision: "interval",
    }, "en")).toBe("1 August 1941 – 31 August 1941");
  });

  it("uses the Romanian calendar convention for Romanian UI", () => {
    expect(formatIsoDate("1941-08-31", "ro")).toBe("31 august 1941");
    expect(formatDateRange({
      raw: "1941-08-01 to 1941-08-31",
      start: "1941-08-01",
      end: "1941-08-31",
      precision: "interval",
    }, "ro")).toBe("1 august 1941 – 31 august 1941");
  });

  it("uses a single localized month label for month-precision dates", () => {
    expect(formatDateRange({
      raw: "Iunie 1941",
      start: "1941-06-01",
      end: null,
      precision: "month",
    }, "en")).toBe("June 1941");
    expect(formatDateRange({
      raw: "Iunie 1941",
      start: "1941-06-01",
      end: null,
      precision: "month",
    }, "ro")).toBe("iunie 1941");
  });
});

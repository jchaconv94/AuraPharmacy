import { describe, it, expect } from "vitest";
import { toIsoDate } from "./immunizationExcelService";

describe("toIsoDate parser for Excel dates", () => {
  it("parses standard slash format DD/MM/YYYY", () => {
    expect(toIsoDate("31/10/2026")).toBe("2026-10-31");
    expect(toIsoDate("01/05/2025")).toBe("2025-05-01");
    expect(toIsoDate("15/08/2027")).toBe("2027-08-15");
  });

  it("parses slash format with timestamps from Excel", () => {
    expect(toIsoDate("31/10/2026 00:00:00")).toBe("2026-10-31");
    expect(toIsoDate("31/10/2026 12:00:00 AM")).toBe("2026-10-31");
    expect(toIsoDate("31/10/2026 15:30:00")).toBe("2026-10-31");
  });

  it("parses Excel numeric serial date codes (numbers and strings)", () => {
    // 46326 in Excel serial is 2026-10-31
    expect(toIsoDate(46326)).toBe("2026-10-31");
    expect(toIsoDate("46326")).toBe("2026-10-31");
    expect(toIsoDate("46326.0")).toBe("2026-10-31");
  });

  it("parses hyphenated and dotted dates", () => {
    expect(toIsoDate("31-10-2026")).toBe("2026-10-31");
    expect(toIsoDate("31.10.2026")).toBe("2026-10-31");
    expect(toIsoDate("2026-10-31")).toBe("2026-10-31");
  });

  it("parses text month names in Spanish/English", () => {
    expect(toIsoDate("31-OCT-2026")).toBe("2026-10-31");
    expect(toIsoDate("31/OCTUBRE/2026")).toBe("2026-10-31");
    expect(toIsoDate("15-ENE-2025")).toBe("2025-01-15");
  });

  it("parses MM/YYYY month-year strings to end of month", () => {
    expect(toIsoDate("10/2026")).toBe("2026-10-31");
    expect(toIsoDate("02/2024")).toBe("2024-02-29"); // leap year
    expect(toIsoDate("02/2025")).toBe("2025-02-28");
  });

  it("handles JavaScript Date objects", () => {
    const d = new Date(2026, 9, 31); // month 9 is October (0-indexed)
    expect(toIsoDate(d)).toBe("2026-10-31");
  });

  it("returns null for empty or invalid values", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
    expect(toIsoDate("texto no fecha")).toBeNull();
  });
});

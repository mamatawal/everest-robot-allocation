import { describe, expect, it } from "vitest";
import { AllocationService } from "../src/domain/AllocationService";

describe("AllocationService", () => {
  const service = new AllocationService();

  it("returns level 1, level 2, and comparison for valid request", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 3,
        Delta: 2
      },
      requestedHours: 16
    });

    expect(result.level1.strategy).toBe("level-1-category-distribution");
    expect(result.level1.totalHoursProvided).toBeGreaterThanOrEqual(16);
    expect(result.level2.strategy).toBe("level-2-cost-optimized");
    expect(result.level2.totalHoursProvided).toBeGreaterThanOrEqual(16);
    expect(result.comparison.level1Cost).toBe(result.level1.totalChargingCost);
    expect(result.comparison.level2Cost).toBe(result.level2.totalChargingCost);
  });

  it("prefers more categories among equal-excess plans", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 1,
        Delta: 2
      },
      requestedHours: 17
    });

    expect(result.level1.assignment.Bravo).toBeGreaterThanOrEqual(1);
    expect(result.level1.assignment.Charlie).toBeGreaterThanOrEqual(1);
    expect(result.level1.assignment.Delta).toBeGreaterThanOrEqual(1);
  });

  it("matches the PDF Example 1 Level 1 vs Level 2 comparison", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 3,
        Delta: 2
      },
      requestedHours: 20
    });

    expect(result.level1.totalChargingCost).toBe(12);
    expect(result.level2.totalChargingCost).toBe(11);
    expect(result.comparison.costDifference).toBe(1);
    expect(result.comparison.insight).toContain("$1 additional cost");
  });

  it("keeps all robot categories in Level 1 when the request is small", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 3,
        Delta: 2
      },
      requestedHours: 6
    });

    expect(result.level1.assignment).toEqual({ Bravo: 1, Charlie: 1, Delta: 1 });
    expect(result.level1.totalHoursProvided).toBe(16);
    expect(result.level1.totalChargingCost).toBe(9);
    expect(result.comparison.costDifference).toBe(5);
  });

  it("matches the PDF Level 1 worked example (16 hours)", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 3,
        Delta: 2
      },
      requestedHours: 16
    });

    expect(result.level1.assignment).toEqual({ Bravo: 1, Charlie: 1, Delta: 1 });
    expect(result.level1.totalHoursProvided).toBe(16);
    expect(result.level1.totalChargingCost).toBe(9);
  });

  it("matches the PDF Level 2 Example 2 (6 hours)", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 2,
        Delta: 3
      },
      requestedHours: 6
    });

    expect(result.level2.assignment).toEqual({ Bravo: 2, Charlie: 0, Delta: 0 });
    expect(result.level2.totalHoursProvided).toBe(6);
    expect(result.level2.totalChargingCost).toBe(4);
  });

  it("for level 2 minimizes total charging cost", () => {
    const result = service.allocate({
      robots: {
        Bravo: 2,
        Charlie: 3,
        Delta: 2
      },
      requestedHours: 20
    });

    expect(result.level2.totalChargingCost).toBe(11);
    expect(result.level2.assignment).toEqual({
      Bravo: 0,
      Charlie: 1,
      Delta: 2
    });
  });

  it("allows standalone Level 2 allocation without every robot category", () => {
    const result = service.allocateLevel2({
      robots: {
        Bravo: 2,
        Charlie: 2,
        Delta: 0
      },
      requestedHours: 6
    });

    expect(result.assignment).toEqual({ Bravo: 2, Charlie: 0, Delta: 0 });
    expect(result.totalHoursProvided).toBe(6);
    expect(result.totalChargingCost).toBe(4);
  });

  it("handles large Level 1 and Level 2 inventories without enumerating every combination", () => {
    const level1 = service.allocateLevel1({
      robots: { Bravo: 100, Charlie: 100, Delta: 100 },
      requestedHours: 16
    });
    const level2 = service.allocateLevel2({
      robots: { Bravo: 100, Charlie: 100, Delta: 100 },
      requestedHours: 200
    });

    expect(level1.assignment).toEqual({ Bravo: 1, Charlie: 1, Delta: 1 });
    expect(level1.totalHoursProvided).toBe(16);
    expect(level2.totalHoursProvided).toBeGreaterThanOrEqual(200);
    expect(level2.totalChargingCost).toBeGreaterThan(0);
  });

  it("throws when total capacity is insufficient", () => {
    expect(() =>
      service.allocate({
        robots: {
          Bravo: 1,
          Charlie: 1,
          Delta: 1
        },
        requestedHours: 21
      })
    ).toThrow("Insufficient robot capacity to complete the requested work.");
  });

  it("throws the PDF category distribution error when Level 1 cannot use every category", () => {
    expect(() =>
      service.allocate({
        robots: {
          Bravo: 2,
          Charlie: 2,
          Delta: 0
        },
        requestedHours: 6
      })
    ).toThrow("Unable to allocate at least one robot from each category with the available inventory.");
  });

  it("throws when no robots are available", () => {
    expect(() =>
      service.allocate({
        robots: {
          Bravo: 0,
          Charlie: 0,
          Delta: 0
        },
        requestedHours: 5
      })
    ).toThrow("No robots available for assignment.");
  });
});

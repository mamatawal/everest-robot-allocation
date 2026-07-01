import { describe, expect, it } from "vitest";
import { StandbyPlanner } from "../src/domain/StandbyPlanner";

describe("StandbyPlanner", () => {
  const planner = new StandbyPlanner();

  it("returns cost-optimized standby plan when active capacity is insufficient", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 1, Charlie: 1, Delta: 1 },
      standbyRobots: { Bravo: 2, Charlie: 1, Delta: 1 },
      requestedHours: 21
    });

    expect(result.activeCapacity).toBe(16);
    expect(result.activeRobots).toEqual({ Bravo: 1, Charlie: 1, Delta: 1 });
    expect(result.standbyRequiredHours).toBe(5);
    expect(result.standbyRobotsRequired).toEqual({ Bravo: 0, Charlie: 1, Delta: 0 });
    expect(result.totalStandbyCost).toBe(3);
    expect(result.status).toContain("lowest charging cost");
  });

  it("returns zero standby when active capacity already covers the request", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 2, Charlie: 3, Delta: 2 },
      standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
      requestedHours: 20
    });

    expect(result.standbyRequiredHours).toBe(0);
    expect(result.standbyRobotsRequired).toEqual({ Bravo: 0, Charlie: 0, Delta: 0 });
    expect(result.totalStandbyCost).toBe(0);
  });

  it("handles large standby inventories without enumerating every combination", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
      standbyRobots: { Bravo: 100, Charlie: 100, Delta: 100 },
      requestedHours: 200
    });

    expect(result.standbyRequiredHours).toBe(200);
    expect(result.standbyRobotsRequired.Bravo + result.standbyRobotsRequired.Charlie + result.standbyRobotsRequired.Delta)
      .toBeGreaterThan(0);
    expect(result.totalStandbyCost).toBeGreaterThan(0);
  });

  it("throws when standby inventory cannot satisfy the deficit", () => {
    expect(() =>
      planner.plan({
        activeRobots: { Bravo: 1, Charlie: 1, Delta: 1 },
        standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
        requestedHours: 21
      })
    ).toThrow("Insufficient robot capacity to complete the requested work.");
  });
});

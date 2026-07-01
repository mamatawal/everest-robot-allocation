import { describe, expect, it } from "vitest";
import { MultiClientPlanner } from "../src/domain/MultiClientPlanner";
import { RobotPlan } from "../src/domain/types";

function addPlans(plans: RobotPlan[]): RobotPlan {
  return plans.reduce<RobotPlan>(
    (total, plan) => ({
      Bravo: total.Bravo + plan.Bravo,
      Charlie: total.Charlie + plan.Charlie,
      Delta: total.Delta + plan.Delta
    }),
    { Bravo: 0, Charlie: 0, Delta: 0 }
  );
}

describe("MultiClientPlanner", () => {
  const planner = new MultiClientPlanner();

  it("processes highest requests first", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 2, Charlie: 3, Delta: 2 },
      standbyRobots: { Bravo: 4, Charlie: 4, Delta: 4 },
      clientHours: [12, 16, 17, 10, 21]
    });

    expect(result.summary.allocationOrder).toEqual([21, 17, 16, 12, 10]);
    expect(result.clients).toHaveLength(5);
    expect(result.clients[0].clientHours).toBe(21);
    expect(result.summary.totalRequestedHours).toBe(76);
    expect(result.summary.totalChargingCost).toBeGreaterThan(0);
  });

  it("supports a single client hour input", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 1, Charlie: 1, Delta: 1 },
      standbyRobots: { Bravo: 0, Charlie: 1, Delta: 0 },
      clientHours: [20]
    });

    expect(result.summary.allocationOrder).toEqual([20]);
    expect(result.clients[0].standbyRobotsUsed).toEqual({ Bravo: 0, Charlie: 1, Delta: 0 });
  });

  it("uses standby robots when active inventory alone cannot cover a client", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 0, Charlie: 0, Delta: 1 },
      standbyRobots: { Bravo: 0, Charlie: 0, Delta: 1 },
      clientHours: [16]
    });

    expect(result.clients[0].activeRobotsUsed).toEqual({ Bravo: 0, Charlie: 0, Delta: 1 });
    expect(result.clients[0].standbyRobotsUsed).toEqual({ Bravo: 0, Charlie: 0, Delta: 1 });
    expect(result.clients[0].totalHoursProvided).toBe(16);
    expect(result.summary.totalChargingCost).toBe(8);
  });

  it("does not reuse robots across multiple clients", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 0, Charlie: 0, Delta: 1 },
      standbyRobots: { Bravo: 0, Charlie: 0, Delta: 1 },
      clientHours: [8, 8]
    });

    const activeUsage = addPlans(result.clients.map((client) => client.activeRobotsUsed));
    const standbyUsage = addPlans(result.clients.map((client) => client.standbyRobotsUsed));

    expect(activeUsage).toEqual({ Bravo: 0, Charlie: 0, Delta: 1 });
    expect(standbyUsage).toEqual({ Bravo: 0, Charlie: 0, Delta: 1 });
    expect(result.clients.every((client) => client.totalHoursProvided >= client.clientHours)).toBe(true);
  });

  it("reports summary cost, robot count, efficiency, and per-type utilization", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 2, Charlie: 0, Delta: 0 },
      standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
      clientHours: [6]
    });

    expect(result.summary.totalRequestedHours).toBe(6);
    expect(result.summary.totalChargingCost).toBe(4);
    expect(result.summary.totalRobotsUsed).toBe(2);
    expect(result.summary.averageEfficiency).toBe(1);
    expect(result.summary.utilization).toEqual({
      Bravo: 1,
      Charlie: 0,
      Delta: 0
    });
  });

  it("keeps fulfilled hours at or above each client request while tracking excess", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 1, Charlie: 1, Delta: 0 },
      standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
      clientHours: [4]
    });

    expect(result.clients[0].totalHoursProvided).toBe(5);
    expect(result.clients[0].excessHours).toBe(1);
    expect(result.clients[0].totalHoursProvided).toBeGreaterThanOrEqual(result.clients[0].clientHours);
  });

  it("handles large inventories without enumerating every robot combination", () => {
    const result = planner.plan({
      activeRobots: { Bravo: 100, Charlie: 100, Delta: 100 },
      standbyRobots: { Bravo: 100, Charlie: 100, Delta: 100 },
      clientHours: [20, 30, 40, 50, 60]
    });

    expect(result.summary.allocationOrder).toEqual([60, 50, 40, 30, 20]);
    expect(result.clients).toHaveLength(5);
    expect(result.summary.totalRequestedHours).toBe(200);
    expect(result.clients.every((client) => client.totalHoursProvided >= client.clientHours)).toBe(true);
  });

  it("throws when combined active and standby capacity is insufficient", () => {
    expect(() =>
      planner.plan({
        activeRobots: { Bravo: 1, Charlie: 0, Delta: 0 },
        standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
        clientHours: [4]
      })
    ).toThrow("Insufficient robot capacity to complete the requested work.");
  });

  it("throws when total capacity is enough but cannot be split across all clients", () => {
    expect(() =>
      planner.plan({
        activeRobots: { Bravo: 0, Charlie: 0, Delta: 1 },
        standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
        clientHours: [4, 4]
      })
    ).toThrow("Insufficient robot capacity to complete the requested work.");
  });

  it("throws when no robots are available", () => {
    expect(() =>
      planner.plan({
        activeRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
        standbyRobots: { Bravo: 0, Charlie: 0, Delta: 0 },
        clientHours: [12, 16]
      })
    ).toThrow("No robots available for assignment.");
  });
});

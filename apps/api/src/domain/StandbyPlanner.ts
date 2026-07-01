import { InsufficientRobotCapacityError } from "./errors.js";
import {
  enumerateUsefulPlans,
  totalCostFor,
  totalHoursFor,
  totalRobotsUsed
} from "./strategies/CombinationUtils.js";
import {
  RobotInventory,
  RobotPlan,
  StandbyAllocationRequest,
  StandbyAllocationResponse
} from "./types.js";

interface PlanMetrics {
  plan: RobotPlan;
  totalHours: number;
  totalCost: number;
  excessHours: number;
  robotsUsed: number;
}

function createZeroPlan(): RobotPlan {
  return {
    Bravo: 0,
    Charlie: 0,
    Delta: 0
  };
}

function scorePlan(plan: RobotPlan, deficitHours: number): PlanMetrics {
  const totalHours = totalHoursFor(plan);
  const totalCost = totalCostFor(plan);

  return {
    plan,
    totalHours,
    totalCost,
    excessHours: totalHours - deficitHours,
    robotsUsed: totalRobotsUsed(plan)
  };
}

function selectBestStandbyPlan(inventory: RobotInventory, deficitHours: number): PlanMetrics {
  const feasiblePlans = enumerateUsefulPlans(inventory, deficitHours).map((plan) =>
    scorePlan(plan, deficitHours)
  );

  if (feasiblePlans.length === 0) {
    throw new InsufficientRobotCapacityError();
  }

  feasiblePlans.sort((a, b) => {
    const costDiff = a.totalCost - b.totalCost;
    if (costDiff !== 0) {
      return costDiff;
    }

    const excessDiff = a.excessHours - b.excessHours;
    if (excessDiff !== 0) {
      return excessDiff;
    }

    return a.robotsUsed - b.robotsUsed;
  });

  return feasiblePlans[0];
}

export class StandbyPlanner {
  plan(input: StandbyAllocationRequest): StandbyAllocationResponse {
    const activeCapacity = totalHoursFor(input.activeRobots);
    const standbyRequiredHours = Math.max(0, input.requestedHours - activeCapacity);

    const standbyPlan =
      standbyRequiredHours === 0
        ? {
            plan: createZeroPlan(),
            totalHours: 0,
            totalCost: 0,
            excessHours: 0,
            robotsUsed: 0
          }
        : selectBestStandbyPlan(input.standbyRobots, standbyRequiredHours);

    return {
      requestedHours: input.requestedHours,
      activeRobots: input.activeRobots,
      activeCapacity,
      standbyRequiredHours,
      standbyRobotsRequired: standbyPlan.plan,
      totalStandbyCost: standbyPlan.totalCost,
      status:
        standbyRequiredHours === 0
          ? "Active capacity already covers the request."
          : "Standby robots activated using the lowest charging cost combination."
    };
  }
}

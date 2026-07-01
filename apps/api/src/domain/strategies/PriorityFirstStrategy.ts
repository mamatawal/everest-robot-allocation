import { RobotInventory, RobotPlan, StrategyAllocationResult } from "../types.js";
import { AllocationStrategy } from "./AllocationStrategy.js";
import { enumerateUsefulPlans, totalCostFor, totalHoursFor, totalRobotsUsed } from "./CombinationUtils.js";

interface PlanMetrics {
  plan: RobotPlan;
  totalHours: number;
  totalCost: number;
  excessHours: number;
  robotsUsed: number;
}

function computeMetrics(plan: RobotPlan, requestedHours: number): PlanMetrics {
  const totalHours = totalHoursFor(plan);
  const totalCost = totalCostFor(plan);

  return {
    plan,
    totalHours,
    totalCost,
    excessHours: totalHours - requestedHours,
    robotsUsed: totalRobotsUsed(plan)
  };
}

export class PriorityFirstStrategy implements AllocationStrategy {
  allocate(inventory: RobotInventory, requestedHours: number): StrategyAllocationResult {
    const feasiblePlans = enumerateUsefulPlans(inventory, requestedHours).map((plan) =>
      computeMetrics(plan, requestedHours)
    );

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

    const bestPlan = feasiblePlans[0];

    return {
      strategy: "level-2-cost-optimized",
      assignment: bestPlan.plan,
      totalHoursProvided: bestPlan.totalHours,
      totalChargingCost: bestPlan.totalCost
    };
  }
}

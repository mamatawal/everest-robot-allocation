import { CategoryDistributionError } from "../errors.js";
import { RobotInventory, RobotPlan, StrategyAllocationResult } from "../types.js";
import { AllocationStrategy } from "./AllocationStrategy.js";
import {
  enumerateUsefulPlans,
  totalCostFor,
  totalHoursFor,
  totalRobotsUsed,
  usedCategoryCount
} from "./CombinationUtils.js";

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

export class LoadBalancedStrategy implements AllocationStrategy {
  allocate(inventory: RobotInventory, requestedHours: number): StrategyAllocationResult {
    const feasiblePlans = enumerateUsefulPlans(inventory, requestedHours, { requireAllCategories: true })
      .filter((plan) => usedCategoryCount(plan) === 3)
      .map((plan) => computeMetrics(plan, requestedHours));

    if (feasiblePlans.length === 0) {
      throw new CategoryDistributionError();
    }

    feasiblePlans.sort((a, b) => {
      const excessDiff = a.excessHours - b.excessHours;
      if (excessDiff !== 0) {
        return excessDiff;
      }

      const costDiff = a.totalCost - b.totalCost;
      if (costDiff !== 0) {
        return costDiff;
      }

      return a.robotsUsed - b.robotsUsed;
    });

    const bestPlan = feasiblePlans[0];

    return {
      strategy: "level-1-category-distribution",
      assignment: bestPlan.plan,
      totalHoursProvided: bestPlan.totalHours,
      totalChargingCost: bestPlan.totalCost
    };
  }
}

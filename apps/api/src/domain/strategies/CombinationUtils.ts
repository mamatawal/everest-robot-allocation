import { RobotInventory, RobotPlan } from "../types.js";
import { ROBOT_COSTS, ROBOT_HOURS, ROBOT_TYPES } from "../robotCatalog.js";

export function enumerateUsefulPlans(
  inventory: RobotInventory,
  targetHours: number,
  options?: { requireAllCategories?: boolean }
): RobotPlan[] {
  const minimumRequiredHours = options?.requireAllCategories
    ? ROBOT_TYPES.reduce((sum, type) => sum + ROBOT_HOURS[type], 0)
    : 0;
  const maxRobotHours = Math.max(...ROBOT_TYPES.map((type) => ROBOT_HOURS[type]));
  const maxUsefulHours = Math.max(targetHours, minimumRequiredHours) + maxRobotHours - 1;
  const maxByType = {
    Bravo: Math.min(inventory.Bravo, Math.floor(maxUsefulHours / ROBOT_HOURS.Bravo)),
    Charlie: Math.min(inventory.Charlie, Math.floor(maxUsefulHours / ROBOT_HOURS.Charlie)),
    Delta: Math.min(inventory.Delta, Math.floor(maxUsefulHours / ROBOT_HOURS.Delta))
  };
  const plans: RobotPlan[] = [];

  for (let bravo = 0; bravo <= maxByType.Bravo; bravo += 1) {
    for (let charlie = 0; charlie <= maxByType.Charlie; charlie += 1) {
      for (let delta = 0; delta <= maxByType.Delta; delta += 1) {
        const plan = { Bravo: bravo, Charlie: charlie, Delta: delta };
        const planHours = totalHoursFor(plan);

        if (planHours >= targetHours && planHours <= maxUsefulHours) {
          plans.push(plan);
        }
      }
    }
  }

  return plans;
}

export function usedCategoryCount(plan: RobotPlan): number {
  return ROBOT_TYPES.filter((type) => plan[type] > 0).length;
}

export function totalRobotsUsed(plan: RobotPlan): number {
  return ROBOT_TYPES.reduce((sum, type) => sum + plan[type], 0);
}

export function totalHoursFor(plan: RobotPlan): number {
  return ROBOT_TYPES.reduce((sum, type) => sum + plan[type] * ROBOT_HOURS[type], 0);
}

export function totalCostFor(plan: RobotPlan): number {
  return ROBOT_TYPES.reduce((sum, type) => sum + plan[type] * ROBOT_COSTS[type], 0);
}

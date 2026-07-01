import { InsufficientRobotCapacityError, NoRobotsAvailableError } from "./errors.js";
import {
  enumerateUsefulPlans,
  totalCostFor,
  totalHoursFor,
  totalRobotsUsed
} from "./strategies/CombinationUtils.js";
import {
  ClientAllocationResult,
  MultiClientAllocationRequest,
  MultiClientAllocationResponse,
  RobotInventory,
  RobotPlan
} from "./types.js";

interface SequenceState {
  plans: RobotPlan[];
  totalChargingCost: number;
  totalExcessHours: number;
  totalRobotsUsed: number;
}

function zeroPlan(): RobotPlan {
  return {
    Bravo: 0,
    Charlie: 0,
    Delta: 0
  };
}

function totalCount(inventory: RobotInventory): number {
  return inventory.Bravo + inventory.Charlie + inventory.Delta;
}

function addPlans(left: RobotPlan, right: RobotPlan): RobotPlan {
  return {
    Bravo: left.Bravo + right.Bravo,
    Charlie: left.Charlie + right.Charlie,
    Delta: left.Delta + right.Delta
  };
}

function subtractPlans(left: RobotPlan, right: RobotPlan): RobotPlan {
  return {
    Bravo: left.Bravo - right.Bravo,
    Charlie: left.Charlie - right.Charlie,
    Delta: left.Delta - right.Delta
  };
}

function splitPlan(plan: RobotPlan, activeRemaining: RobotInventory): { activeUsed: RobotPlan; standbyUsed: RobotPlan } {
  const activeUsed: RobotPlan = {
    Bravo: Math.min(plan.Bravo, activeRemaining.Bravo),
    Charlie: Math.min(plan.Charlie, activeRemaining.Charlie),
    Delta: Math.min(plan.Delta, activeRemaining.Delta)
  };

  return {
    activeUsed,
    standbyUsed: subtractPlans(plan, activeUsed)
  };
}

function inventoryKey(inventory: RobotInventory): string {
  return `${inventory.Bravo}|${inventory.Charlie}|${inventory.Delta}`;
}

function compareStates(a: SequenceState, b: SequenceState): number {
  const costDiff = a.totalChargingCost - b.totalChargingCost;
  if (costDiff !== 0) {
    return costDiff;
  }

  const excessDiff = a.totalExcessHours - b.totalExcessHours;
  if (excessDiff !== 0) {
    return excessDiff;
  }

  return a.totalRobotsUsed - b.totalRobotsUsed;
}

function planClientSequence(requestedHours: number[], inventory: RobotInventory): RobotPlan[] {
  const memo = new Map<string, SequenceState | null>();

  function recurse(index: number, remaining: RobotInventory): SequenceState | null {
    if (index === requestedHours.length) {
      return {
        plans: [],
        totalChargingCost: 0,
        totalExcessHours: 0,
        totalRobotsUsed: 0
      };
    }

    const key = `${index}:${inventoryKey(remaining)}`;
    if (memo.has(key)) {
      return memo.get(key) ?? null;
    }

    const targetHours = requestedHours[index];
    let best: SequenceState | null = null;

    for (const plan of enumerateUsefulPlans(remaining, targetHours)) {
      const planHours = totalHoursFor(plan);
      const nextRemaining = subtractPlans(remaining, plan);
      const suffix = recurse(index + 1, nextRemaining);
      if (!suffix) {
        continue;
      }

      const candidate: SequenceState = {
        plans: [plan, ...suffix.plans],
        totalChargingCost: totalCostFor(plan) + suffix.totalChargingCost,
        totalExcessHours: planHours - targetHours + suffix.totalExcessHours,
        totalRobotsUsed: totalRobotsUsed(plan) + suffix.totalRobotsUsed
      };

      if (!best || compareStates(candidate, best) < 0) {
        best = candidate;
      }
    }

    memo.set(key, best);
    return best;
  }

  const result = recurse(0, inventory);
  if (!result) {
    throw new InsufficientRobotCapacityError();
  }

  return result.plans;
}

function toClientResult(clientHours: number, activeUsed: RobotPlan, standbyUsed: RobotPlan): ClientAllocationResult {
  const totalHoursProvided = totalHoursFor(addPlans(activeUsed, standbyUsed));
  const totalChargingCost = totalCostFor(activeUsed) + totalCostFor(standbyUsed);

  return {
    clientHours,
    activeRobotsUsed: activeUsed,
    standbyRobotsUsed: standbyUsed,
    totalChargingCost,
    totalHoursProvided,
    excessHours: totalHoursProvided - clientHours
  };
}

export class MultiClientPlanner {
  plan(input: MultiClientAllocationRequest): MultiClientAllocationResponse {
    const totalAvailableCount = totalCount(input.activeRobots) + totalCount(input.standbyRobots);
    if (totalAvailableCount === 0) {
      throw new NoRobotsAvailableError();
    }

    const totalAvailableCapacity = totalHoursFor(input.activeRobots) + totalHoursFor(input.standbyRobots);
    const sortedClientHours = [...input.clientHours].sort((a, b) => b - a);
    const totalRequestedHours = sortedClientHours.reduce((sum, hours) => sum + hours, 0);

    if (totalAvailableCapacity < totalRequestedHours) {
      throw new InsufficientRobotCapacityError();
    }

    const combinedPlans = planClientSequence(sortedClientHours, {
      Bravo: input.activeRobots.Bravo + input.standbyRobots.Bravo,
      Charlie: input.activeRobots.Charlie + input.standbyRobots.Charlie,
      Delta: input.activeRobots.Delta + input.standbyRobots.Delta
    });

    let activeRemaining = input.activeRobots;
    const clients: ClientAllocationResult[] = [];

    for (let index = 0; index < sortedClientHours.length; index += 1) {
      const allocationPlan = combinedPlans[index];
      const split = splitPlan(allocationPlan, activeRemaining);
      clients.push(toClientResult(sortedClientHours[index], split.activeUsed, split.standbyUsed));
      activeRemaining = subtractPlans(activeRemaining, split.activeUsed);
    }

    const activeRobotUsage = clients.reduce<RobotPlan>(
      (acc, client) => addPlans(acc, client.activeRobotsUsed),
      zeroPlan()
    );

    const standbyRobotUsage = clients.reduce<RobotPlan>(
      (acc, client) => addPlans(acc, client.standbyRobotsUsed),
      zeroPlan()
    );

    const totalHoursProvided = clients.reduce((sum, client) => sum + client.totalHoursProvided, 0);
    const totalChargingCost = clients.reduce((sum, client) => sum + client.totalChargingCost, 0);
    const totalRobotsUsedAcrossClients = clients.reduce(
      (sum, client) => sum + totalRobotsUsed(client.activeRobotsUsed) + totalRobotsUsed(client.standbyRobotsUsed),
      0
    );

    const totalUsage = addPlans(activeRobotUsage, standbyRobotUsage);
    const availableByType: RobotPlan = {
      Bravo: input.activeRobots.Bravo + input.standbyRobots.Bravo,
      Charlie: input.activeRobots.Charlie + input.standbyRobots.Charlie,
      Delta: input.activeRobots.Delta + input.standbyRobots.Delta
    };
    const utilizationFor = (used: number, available: number): number =>
      available === 0 ? 0 : used / available;

    return {
      clients,
      summary: {
        allocationOrder: sortedClientHours,
        totalRequestedHours,
        totalChargingCost,
        totalRobotsUsed: totalRobotsUsedAcrossClients,
        averageEfficiency: totalHoursProvided === 0 ? 0 : totalRequestedHours / totalHoursProvided,
        utilization: {
          Bravo: utilizationFor(totalUsage.Bravo, availableByType.Bravo),
          Charlie: utilizationFor(totalUsage.Charlie, availableByType.Charlie),
          Delta: utilizationFor(totalUsage.Delta, availableByType.Delta)
        }
      }
    };
  }
}

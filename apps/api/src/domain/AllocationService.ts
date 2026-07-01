import { InsufficientRobotCapacityError, NoRobotsAvailableError } from "./errors.js";
import { totalHoursFor } from "./strategies/CombinationUtils.js";
import { LoadBalancedStrategy } from "./strategies/LoadBalancedStrategy.js";
import { PriorityFirstStrategy } from "./strategies/PriorityFirstStrategy.js";
import { AllocationRequest, AllocationResponse, StrategyAllocationResult } from "./types.js";

export class AllocationService {
  private readonly level1Strategy = new LoadBalancedStrategy();
  private readonly level2Strategy = new PriorityFirstStrategy();

  private validateCapacity(input: AllocationRequest): void {
    const totalRobotCount = input.robots.Bravo + input.robots.Charlie + input.robots.Delta;
    if (totalRobotCount === 0) {
      throw new NoRobotsAvailableError();
    }

    const maxCapacity = totalHoursFor(input.robots);

    if (maxCapacity < input.requestedHours) {
      throw new InsufficientRobotCapacityError();
    }
  }

  allocateLevel1(input: AllocationRequest): StrategyAllocationResult {
    this.validateCapacity(input);
    return this.level1Strategy.allocate(input.robots, input.requestedHours);
  }

  allocateLevel2(input: AllocationRequest): StrategyAllocationResult {
    this.validateCapacity(input);
    return this.level2Strategy.allocate(input.robots, input.requestedHours);
  }

  allocate(input: AllocationRequest): AllocationResponse {
    this.validateCapacity(input);

    const level1 = this.level1Strategy.allocate(input.robots, input.requestedHours);
    const level2 = this.level2Strategy.allocate(input.robots, input.requestedHours);

    const costDifference = level1.totalChargingCost - level2.totalChargingCost;
    const insight =
      costDifference > 0
        ? `Level 1 strategy resulted in $${costDifference} additional cost due\nto mandatory usage of multiple robot categories.`
        : costDifference < 0
          ? `Level 1 is $${Math.abs(costDifference)} cheaper than Level 2 for this request.`
          : "Level 1 and Level 2 produced the same charging cost for this request.";

    return {
      requestedHours: input.requestedHours,
      level1,
      level2,
      comparison: {
        level1Cost: level1.totalChargingCost,
        level2Cost: level2.totalChargingCost,
        costDifference,
        insight
      }
    };
  }
}

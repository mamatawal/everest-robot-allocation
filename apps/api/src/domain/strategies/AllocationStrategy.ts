import { RobotInventory, StrategyAllocationResult } from "../types.js";

export interface AllocationStrategy {
  allocate(inventory: RobotInventory, requestedHours: number): StrategyAllocationResult;
}

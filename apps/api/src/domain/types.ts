export type RobotType = "Bravo" | "Charlie" | "Delta";

export interface RobotInventory {
  Bravo: number;
  Charlie: number;
  Delta: number;
}

export interface RobotPlan {
  Bravo: number;
  Charlie: number;
  Delta: number;
}

export interface StrategyAllocationResult {
  strategy: "level-1-category-distribution" | "level-2-cost-optimized";
  assignment: RobotPlan;
  totalHoursProvided: number;
  totalChargingCost: number;
}

export interface ComparisonResult {
  level1Cost: number;
  level2Cost: number;
  costDifference: number;
  insight: string;
}

export interface AllocationRequest {
  robots: RobotInventory;
  requestedHours: number;
}

export interface AllocationResponse {
  requestedHours: number;
  level1: StrategyAllocationResult;
  level2: StrategyAllocationResult;
  comparison: ComparisonResult;
}

export interface StandbyAllocationRequest {
  activeRobots: RobotInventory;
  standbyRobots: RobotInventory;
  requestedHours: number;
}

export interface StandbyAllocationResponse {
  requestedHours: number;
  activeRobots: RobotInventory;
  activeCapacity: number;
  standbyRequiredHours: number;
  standbyRobotsRequired: RobotPlan;
  totalStandbyCost: number;
  status: string;
}

export interface MultiClientAllocationRequest {
  activeRobots: RobotInventory;
  standbyRobots: RobotInventory;
  clientHours: number[];
}

export interface ClientAllocationResult {
  clientHours: number;
  activeRobotsUsed: RobotPlan;
  standbyRobotsUsed: RobotPlan;
  totalChargingCost: number;
  totalHoursProvided: number;
  excessHours: number;
}

export interface MultiClientSummary {
  allocationOrder: number[];
  totalRequestedHours: number;
  totalChargingCost: number;
  totalRobotsUsed: number;
  averageEfficiency: number;
  utilization: {
    Bravo: number;
    Charlie: number;
    Delta: number;
  };
}

export interface MultiClientAllocationResponse {
  clients: ClientAllocationResult[];
  summary: MultiClientSummary;
}

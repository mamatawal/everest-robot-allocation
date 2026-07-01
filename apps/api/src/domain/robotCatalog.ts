import { RobotType } from "./types.js";

export const ROBOT_HOURS: Record<RobotType, number> = {
  Bravo: 3,
  Charlie: 5,
  Delta: 8
};

export const ROBOT_COSTS: Record<RobotType, number> = {
  Bravo: 2,
  Charlie: 3,
  Delta: 4
};

export const ROBOT_TYPES: RobotType[] = ["Bravo", "Charlie", "Delta"];

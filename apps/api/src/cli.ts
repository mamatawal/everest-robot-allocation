import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";
import { AllocationService } from "./domain/AllocationService.js";
import { MultiClientPlanner } from "./domain/MultiClientPlanner.js";
import { ROBOT_COSTS } from "./domain/robotCatalog.js";
import { StandbyPlanner } from "./domain/StandbyPlanner.js";
import {
  AllocationResponse,
  AllocationRequest,
  MultiClientAllocationResponse,
  RobotInventory,
  RobotPlan,
  StrategyAllocationResult,
  StandbyAllocationResponse
} from "./domain/types.js";

const allocationService = new AllocationService();
const standbyPlanner = new StandbyPlanner();
const multiClientPlanner = new MultiClientPlanner();
let rl: readline.Interface | undefined;

interface CliIO {
  question(question: string): Promise<string>;
  log(message?: unknown): void;
  close?(): void;
}

let cliIO: CliIO | undefined;

export function setCliIOForTest(io: CliIO): void {
  rl?.close();
  rl = undefined;
  cliIO = io;
}

export function resetCliIOForTest(): void {
  cliIO?.close?.();
  cliIO = undefined;
}

function getReadline(): readline.Interface {
  rl ??= readline.createInterface({ input, output });
  return rl;
}

async function prompt(question: string): Promise<string> {
  const answer = cliIO ? await cliIO.question(question) : await getReadline().question(question);
  return answer.trim();
}

function writeLine(message?: unknown): void {
  if (cliIO) {
    cliIO.log(message);
    return;
  }

  console.log(message);
}

function closeCli(): void {
  if (cliIO) {
    cliIO.close?.();
    return;
  }

  rl?.close();
}

async function promptNumber(question: string, options?: { allowZero?: boolean }): Promise<number> {
  while (true) {
    const raw = await prompt(question);
    const value = Number(raw);
    const isValidInteger = Number.isInteger(value);
    const isAllowed = options?.allowZero ? value >= 0 : value > 0;

    if (isValidInteger && isAllowed) {
      return value;
    }

    writeLine(options?.allowZero ? "Enter a non-negative integer." : "Enter a positive integer.");
  }
}

async function promptInventory(title: string): Promise<{ Bravo: number; Charlie: number; Delta: number }> {
  writeLine(`\n${title}:`);
  const counts = {
    Bravo: await promptNumber("Bravo: ", { allowZero: true }),
    Charlie: await promptNumber("Charlie: ", { allowZero: true }),
    Delta: await promptNumber("Delta: ", { allowZero: true })
  };
  return counts;
}

function parseInventory(values: string[], offset: number): RobotInventory {
  return {
    Bravo: Number(values[offset]),
    Charlie: Number(values[offset + 1]),
    Delta: Number(values[offset + 2])
  };
}

function parseClientHours(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));
}

function isValidInventory(inventory: RobotInventory): boolean {
  return [inventory.Bravo, inventory.Charlie, inventory.Delta].every((value) => Number.isInteger(value) && value >= 0);
}

function isValidHours(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function formatAssignment(plan: RobotPlan, indent = "  "): string {
  const lines = (Object.keys(plan) as Array<keyof RobotPlan>)
    .filter((type) => plan[type] > 0)
    .map((type) => `${indent}${type}: ${plan[type]}`);
  return lines.length > 0 ? lines.join("\n") : `${indent}(none)`;
}

function formatLevel1Result(level1: StrategyAllocationResult, requestedHours: number): string {
  return [
    "-----------------------------------------------------",
    "Level 1 - Robot Assignment",
    "",
    formatAssignment(level1.assignment, ""),
    "",
    `Total Work Hours Provided: ${level1.totalHoursProvided}`,
    `Client Work Hours Requested: ${requestedHours}`
  ].join("\n");
}

function formatLevel1(result: AllocationResponse): string {
  return formatLevel1Result(result.level1, result.requestedHours);
}

function formatLevel2Result(level2: StrategyAllocationResult): string {
  return [
    "-----------------------------------------------------",
    "Level 2 - Cost Optimized Allocation",
    "",
    formatAssignment(level2.assignment, ""),
    "",
    `Total Hours Provided: ${level2.totalHoursProvided}`,
    `Total Charging Cost: $${level2.totalChargingCost}`
  ].join("\n");
}

function formatLevel2(result: AllocationResponse): string {
  return formatLevel2Result(result.level2);
}

function formatComparison(result: AllocationResponse): string {
  const { comparison } = result;
  return [
    "-----------------------------------------------------",
    "Level 1 vs Level 2 Comparison",
    "",
    `Level 1 Cost: $${comparison.level1Cost}`,
    `Level 2 Cost: $${comparison.level2Cost}`,
    "",
    `Cost Difference: $${Math.abs(comparison.costDifference)}`,
    "",
    "Insight:",
    `${comparison.insight}`
  ].join("\n");
}

function formatAllocation(result: AllocationResponse): string {
  return [
    formatLevel1(result),
    "",
    formatLevel2(result),
    "",
    formatComparison(result)
  ].join("\n");
}

function formatStandby(result: StandbyAllocationResponse): string {
  const plan = result.standbyRobotsRequired;
  const robotLines = (Object.keys(plan) as Array<keyof RobotPlan>)
    .filter((type) => plan[type] > 0)
    .map((type) => `${type}: ${plan[type]} - cost $${plan[type] * ROBOT_COSTS[type]}`);

  return [
    "-----------------------------------------------------",
    `Active Robot Capacity: ${result.activeCapacity} hours`,
    `Client Work Requested: ${result.requestedHours} hours`,
    "",
    "Active robots:",
    formatAssignment(result.activeRobots, ""),
    "",
    "Additional Standby Robots Required:",
    ...(robotLines.length > 0
      ? robotLines
      : ["None - active capacity already covers the request"])
  ].join("\n");
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatMultiClient(result: MultiClientAllocationResponse): string {
  const lines: string[] = ["Allocation Order (highest hours first): " + result.summary.allocationOrder.join(", ")];

  result.clients.forEach((client, index) => {
    lines.push("");
    lines.push(`Client #${index + 1} - Requested: ${client.clientHours} hours`);
    lines.push("  Active robots:");
    lines.push(formatAssignment(client.activeRobotsUsed, "    "));
    lines.push("  Standby robots:");
    lines.push(formatAssignment(client.standbyRobotsUsed, "    "));
    lines.push(`  Hours Provided: ${client.totalHoursProvided} (excess ${client.excessHours})`);
    lines.push(`  Charging Cost: $${client.totalChargingCost}`);
  });

  const { summary } = result;
  lines.push("");
  lines.push("Allocation Summary");
  lines.push(`  Total Robots Used: ${summary.totalRobotsUsed}`);
  lines.push(`  Total Charging Cost: $${summary.totalChargingCost}`);
  lines.push(`  Avg Robot Utilization (hours): ${formatPercent(summary.averageEfficiency)}`);
  lines.push(`  Bravo utilization: ${formatPercent(summary.utilization.Bravo)}`);
  lines.push(`  Charlie utilization: ${formatPercent(summary.utilization.Charlie)}`);
  lines.push(`  Delta utilization: ${formatPercent(summary.utilization.Delta)}`);
  return lines.join("\n");
}

export async function runFromArgs(args: string[]): Promise<boolean> {
  if (args.length === 0) {
    return false;
  }

  const level = args[0];

  if (level === "1" || level === "2" || level === "compare" || level === "comparison") {
    if (args.length < 5) {
      throw new Error("Usage: npm run cli -- <1|2|compare> <Bravo> <Charlie> <Delta> <requestedHours>");
    }

    const robots = parseInventory(args, 1);
    const requestedHours = Number(args[4]);

    if (!isValidInventory(robots)) {
      throw new Error("Robot counts must be non-negative integers.");
    }
    if (!isValidHours(requestedHours)) {
      throw new Error("Work hours must be a positive integer.");
    }

    if (level === "1") {
      const result = allocationService.allocateLevel1({ robots, requestedHours });
      writeLine(formatLevel1Result(result, requestedHours));
    } else if (level === "2") {
      const result = allocationService.allocateLevel2({ robots, requestedHours });
      writeLine(formatLevel2Result(result));
    } else {
      const result = allocationService.allocate({ robots, requestedHours });
      writeLine(formatAllocation(result));
    }
    return true;
  }

  if (level === "3") {
    if (args.length < 8) {
      throw new Error(
        "Usage: npm run cli -- 3 <activeBravo> <activeCharlie> <activeDelta> <standbyBravo> <standbyCharlie> <standbyDelta> <requestedHours>"
      );
    }

    const activeRobots = parseInventory(args, 1);
    const standbyRobots = parseInventory(args, 4);
    const requestedHours = Number(args[7]);

    if (!isValidInventory(activeRobots) || !isValidInventory(standbyRobots)) {
      throw new Error("Robot counts must be non-negative integers.");
    }
    if (!isValidHours(requestedHours)) {
      throw new Error("Work hours must be a positive integer.");
    }

    const result = standbyPlanner.plan({ activeRobots, standbyRobots, requestedHours });
    writeLine(formatStandby(result));
    return true;
  }

  if (level === "4") {
    if (args.length < 8) {
      throw new Error(
        "Usage: npm run cli -- 4 <activeBravo> <activeCharlie> <activeDelta> <standbyBravo> <standbyCharlie> <standbyDelta> <clientHours...>"
      );
    }

    const activeRobots = parseInventory(args, 1);
    const standbyRobots = parseInventory(args, 4);
    const clientHours = parseClientHours(args.slice(7).join(" "));

    if (!isValidInventory(activeRobots) || !isValidInventory(standbyRobots)) {
      throw new Error("Robot counts must be non-negative integers.");
    }

    if (clientHours.length === 0 || clientHours.some((value) => !isValidHours(value))) {
      throw new Error("Work hours must be a positive integer.");
    }

    const result = multiClientPlanner.plan({ activeRobots, standbyRobots, clientHours });
    writeLine(formatMultiClient(result));
    return true;
  }

  return false;
}

async function promptAllocationRequest(): Promise<AllocationRequest> {
  const robots = await promptInventory("Enter number of robots available");
  const requestedHours = await promptNumber("\nEnter client work hours:\n");
  return { robots, requestedHours };
}

async function runLevel1(): Promise<void> {
  const request = await promptAllocationRequest();
  const result = allocationService.allocateLevel1(request);

  writeLine("");
  writeLine(formatLevel1Result(result, request.requestedHours));
}

async function runLevel2(): Promise<void> {
  const request = await promptAllocationRequest();
  const result = allocationService.allocateLevel2(request);

  writeLine("");
  writeLine(formatLevel2Result(result));
}

async function runComparison(): Promise<void> {
  const request = await promptAllocationRequest();
  const result = allocationService.allocate(request);

  writeLine("");
  writeLine(formatAllocation(result));
}

async function runLevel3(): Promise<void> {
  const activeRobots = await promptInventory("Enter active robots");
  const standbyRobots = await promptInventory("Enter standby robots");
  const requestedHours = await promptNumber("\nClient work request:\n");
  const result = standbyPlanner.plan({ activeRobots, standbyRobots, requestedHours });

  writeLine("");
  writeLine(formatStandby(result));
}

async function runLevel4(): Promise<void> {
  const activeRobots = await promptInventory("Enter active robots");
  const standbyRobots = await promptInventory("Enter standby robots");
  const clientHoursInput = await prompt("\nClient working hours (single value, comma-separated or space-separated):\n");
  const clientHours = clientHoursInput
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));

  if (clientHours.length === 0 || clientHours.some((value) => !Number.isInteger(value) || value <= 0)) {
    writeLine("Work hours must be a positive integer.");
    return;
  }

  const result = multiClientPlanner.plan({ activeRobots, standbyRobots, clientHours });
  writeLine("\nMulti-client Allocation Result");
  writeLine(formatMultiClient(result));
}

export async function runInteractive(): Promise<void> {
  writeLine("Robot Work Allocation System");
  writeLine("1) Level 1 - Robot Category Distribution");
  writeLine("2) Level 2 - Cost Optimised Allocation");
  writeLine("3) Level 3 - Standby Robot Activation");
  writeLine("4) Level 4 - Multi-client Allocation");
  writeLine("c) Compare Level 1 vs Level 2");

  const option = await prompt("Choose an option (1/2/3/4/c): ");

  try {
    if (option === "1") {
      await runLevel1();
    } else if (option === "2") {
      await runLevel2();
    } else if (option === "3") {
      await runLevel3();
    } else if (option === "4") {
      await runLevel4();
    } else if (option.toLowerCase() === "c") {
      await runComparison();
    } else {
      writeLine("Invalid option.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    writeLine(message);
  } finally {
    closeCli();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    try {
      const handled = await runFromArgs(args);
      if (!handled) {
        writeLine("Invalid option.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      writeLine(message);
    } finally {
      closeCli();
    }
    return;
  }

  await runInteractive();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

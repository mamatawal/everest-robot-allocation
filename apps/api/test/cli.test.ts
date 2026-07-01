import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCliIOForTest, runFromArgs, runInteractive, setCliIOForTest } from "../src/cli";

async function runCli(args: string[]): Promise<string> {
  const logs: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    logs.push(String(message ?? ""));
  });

  await runFromArgs(args);
  logSpy.mockRestore();

  return logs.join("\n");
}

async function runInteractiveCli(answers: string[]): Promise<string> {
  const logs: string[] = [];
  const pendingAnswers = [...answers];

  setCliIOForTest({
    async question() {
      const answer = pendingAnswers.shift();
      if (answer === undefined) {
        throw new Error("Missing test answer for CLI prompt.");
      }

      return answer;
    },
    log(message?: unknown) {
      logs.push(String(message ?? ""));
    }
  });

  await runInteractive();

  return logs.join("\n");
}

describe("CLI", () => {
  afterEach(() => {
    resetCliIOForTest();
    vi.restoreAllMocks();
  });

  it("runs Level 1 as a standalone command", async () => {
    const output = await runCli(["1", "2", "3", "2", "16"]);

    expect(output).toContain("Level 1 - Robot Assignment");
    expect(output).toContain("Bravo: 1");
    expect(output).toContain("Charlie: 1");
    expect(output).toContain("Delta: 1");
    expect(output).not.toContain("Level 2 - Cost Optimized Allocation");
  });

  it("runs Level 2 as a standalone command", async () => {
    const output = await runCli(["2", "2", "2", "3", "6"]);

    expect(output).toContain("Level 2 - Cost Optimized Allocation");
    expect(output).toContain("Bravo: 2");
    expect(output).toContain("Total Charging Cost: $4");
    expect(output).not.toContain("Level 1 - Robot Assignment");
  });

  it("runs standalone Level 2 even when Level 1 category distribution is impossible", async () => {
    const output = await runCli(["2", "2", "2", "0", "6"]);

    expect(output).toContain("Level 2 - Cost Optimized Allocation");
    expect(output).toContain("Bravo: 2");
    expect(output).not.toContain("Unable to allocate at least one robot from each category");
  });

  it("keeps the Level 1 vs Level 2 comparison available", async () => {
    const output = await runCli(["compare", "2", "3", "2", "20"]);

    expect(output).toContain("Level 1 - Robot Assignment");
    expect(output).toContain("Level 2 - Cost Optimized Allocation");
    expect(output).toContain("Level 1 vs Level 2 Comparison");
    expect(output).toContain("Cost Difference: $1");
  });

  it("runs the interactive Level 1 prompt flow", async () => {
    const output = await runInteractiveCli(["1", "2", "3", "2", "16"]);

    expect(output).toContain("Robot Work Allocation System");
    expect(output).toContain("Enter number of robots available:");
    expect(output).toContain("Level 1 - Robot Assignment");
    expect(output).toContain("Bravo: 1");
    expect(output).toContain("Charlie: 1");
    expect(output).toContain("Delta: 1");
    expect(output).toContain("Client Work Hours Requested: 16");
  });
});

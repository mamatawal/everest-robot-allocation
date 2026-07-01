# Everest Robot Work Allocation

A terminal-based (CLI) application for EverBot Solutions that assigns robots to fulfil client work requests across four strategy levels.

- Language: Node.js + TypeScript
- Runner: tsx (CLI), tsc (build)
- Tests: Vitest

## Robot Types

| Robot   | Working Hours / Day | Charging Cost / Day |
|---------|---------------------|---------------------|
| Bravo   | 3 hours             | $2                  |
| Charlie | 5 hours             | $3                  |
| Delta   | 8 hours             | $4                  |

## Project Structure

```text
.
└── apps
    └── api
        ├── src
        │   ├── cli.ts            # Terminal entry point
        │   └── domain            # Allocation logic (framework-agnostic)
        │       └── strategies
        └── test                  # Vitest domain tests
```

## Quick Start

Node.js version used: 22.x (run `nvm use 22` first if needed).

### 1) Install dependencies

```bash
npm install
```

### 2) Run the CLI (interactive)

```bash
npm run cli
```

You will be prompted to choose a level (1/2/3/4), or `c` for the Level 1 vs Level 2 comparison, and enter robot counts and work hours.

### 3) Run the CLI (with arguments)

```bash
# Level 1 Robot Category Distribution: <Bravo> <Charlie> <Delta> <requestedHours>
npm run cli -- 1 2 3 2 16

# Level 2 cost optimised: <Bravo> <Charlie> <Delta> <requestedHours>
npm run cli -- 2 2 2 3 6

# Level 1 & 2 comparison: <Bravo> <Charlie> <Delta> <requestedHours>
npm run cli -- compare 2 3 2 20

# Level 3 standby: <activeB> <activeC> <activeD> <standbyB> <standbyC> <standbyD> <requestedHours>
npm run cli -- 3 1 1 1 2 1 1 21

# Level 4 multi-client: <activeB> <activeC> <activeD> <standbyB> <standbyC> <standbyD> <clientHours...>
npm run cli -- 4 2 3 2 2 1 1 16 10 22 7
```

### 4) Run tests

```bash
npm test
```

### 5) Build (type-check + emit)

```bash
npm run build
```

## Levels

### Level 1 — Robot Category Distribution
Requires at least one Bravo, one Charlie, and one Delta robot when producing a Level 1 allocation. Among plans that satisfy that category-distribution rule, it minimizes excess hours first, then charging cost, then robot count.

If the inventory cannot allocate at least one robot from every category, Level 1 returns the PDF-specified category distribution error.

### Level 2 — Cost Optimised Allocation
Minimizes total charging cost while fulfilling requested hours. Level 2 is standalone and ignores the Level 1 category-distribution requirement.

### Level 3 — Standby Robot Activation
When active robot capacity is insufficient, activates the cost-optimised combination of standby robots to cover the deficit. The output reports active capacity, active robot counts, and the standby robots required.

### Level 4 — Multi-Client Allocation
Processes multiple client requests prioritised by highest hours first. Accepts a single value, or comma/space-separated values. Displays a per-client breakdown plus an allocation summary (total robots used, total charging cost, average utilization, and per-type Bravo/Charlie/Delta utilization). Candidate plans are pruned per client request so large multi-client inventories do not enumerate every robot combination.

### Level 1 vs Level 2 Comparison
Reports `Level 1 Cost`, `Level 2 Cost`, `Cost Difference`, and an insight explaining the financial impact of the category-distribution strategy.

## Error Handling

- **Insufficient capacity**: `Insufficient robot capacity to complete the requested work.`
- **Zero robots**: `No robots available for assignment.`
- **Level 1 category distribution impossible**: `Unable to allocate at least one robot from each category with the available inventory.`
- **Invalid input**: `Work hours must be a positive integer.`

## Assumptions

- Robot types are fixed as Bravo (3h, $2), Charlie (5h, $3), Delta (8h, $4).
- Robots are used at most once per allocation run.
- Total provided hours can exceed requested hours but cannot be less.
- Robot counts must be non-negative integers; client work hours must be positive integers.
- Level 1 is intentionally allowed to over-provide hours when needed to include all three robot categories, because its purpose is category distribution analysis.

## Design Notes

- Domain logic is isolated and framework-agnostic in `apps/api/src/domain`.
- The Strategy Pattern is used for Level 1 and Level 2 allocation policies.
- Standby planning is handled by a dedicated cost-optimised planner.
- Deterministic tie-breakers keep outputs stable for reliable testing.

## Testing

- Unit tests cover the allocation service, CLI argument handling, standby planning, and multi-client planning.
- The test suite currently has 28 tests.
- Run all tests with `npm test`.

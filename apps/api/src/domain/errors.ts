class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NoRobotsAvailableError extends DomainError {
  constructor() {
    super("No robots available for assignment.");
    this.name = "NoRobotsAvailableError";
  }
}

export class InsufficientRobotCapacityError extends DomainError {
  constructor() {
    super("\nInsufficient robot capacity to complete the requested work.");
    this.name = "InsufficientRobotCapacityError";
  }
}

export class CategoryDistributionError extends DomainError {
  constructor() {
    super("Unable to allocate at least one robot from each category with the available inventory.");
    this.name = "CategoryDistributionError";
  }
}

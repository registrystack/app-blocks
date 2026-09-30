import type { HostProblem } from "./types.js";

export class HostError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: HostProblem,
  ) {
    super(problem.message);
    this.name = "HostError";
  }
}
/** A transport interruption after dispatch is not a confirmed refusal. */
export class UnknownOutcome extends Error {
  constructor(public readonly attemptId: string) {
    super("The service could not confirm the result.");
    this.name = "UnknownOutcome";
  }
}

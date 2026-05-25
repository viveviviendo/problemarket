import { BigInt } from "@graphprotocol/graph-ts";
import {
  ProblemCreated,
  SolutionSubmitted,
  ProblemSolved,
  ProblemCancelled,
  ProblemDisputed
} from "../generated/ProblemMarket/ProblemMarket";
import { Problem, Solution, UserStats, ProtocolStats } from "../generated/schema";

const ZERO = BigInt.zero();
const ONE = BigInt.fromI32(1);

function stats(): ProtocolStats {
  let value = ProtocolStats.load("protocol");
  if (value == null) {
    value = new ProtocolStats("protocol");
    value.problems = ZERO;
    value.solved = ZERO;
    value.escrowFunded = ZERO;
    value.volumePaid = ZERO;
    value.feesCollected = ZERO;
  }
  return value;
}

function user(address: string): UserStats {
  let value = UserStats.load(address);
  if (value == null) {
    value = new UserStats(address);
    value.problemsCreated = ZERO;
    value.solutionsSubmitted = ZERO;
    value.usdcEarned = ZERO;
    value.usdcFunded = ZERO;
  }
  return value;
}

export function handleProblemCreated(event: ProblemCreated): void {
  const id = event.params.problemId.toString();
  const problem = new Problem(id);
  problem.owner = event.params.owner;
  problem.bounty = event.params.bounty;
  problem.ownerFee = event.params.ownerFee;
  problem.category = event.params.category;
  problem.status = "Open";
  problem.createdAt = event.block.timestamp;
  problem.save();

  const owner = user(event.params.owner.toHexString());
  owner.problemsCreated = owner.problemsCreated.plus(ONE);
  owner.usdcFunded = owner.usdcFunded.plus(event.params.bounty).plus(event.params.ownerFee);
  owner.save();

  const protocol = stats();
  protocol.problems = protocol.problems.plus(ONE);
  protocol.escrowFunded = protocol.escrowFunded.plus(event.params.bounty).plus(event.params.ownerFee);
  protocol.save();
}

export function handleSolutionSubmitted(event: SolutionSubmitted): void {
  const solution = new Solution(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  solution.problem = event.params.problemId.toString();
  solution.solver = event.params.solver;
  solution.solutionURI = event.params.solutionURI;
  solution.submittedAt = event.block.timestamp;
  solution.save();

  const solver = user(event.params.solver.toHexString());
  solver.solutionsSubmitted = solver.solutionsSubmitted.plus(ONE);
  solver.save();
}

export function handleProblemSolved(event: ProblemSolved): void {
  const problem = Problem.load(event.params.problemId.toString());
  if (problem == null) return;
  problem.status = "Solved";
  problem.solver = event.params.solver;
  problem.netSolver = event.params.netSolver;
  problem.totalFees = event.params.totalFees;
  problem.save();

  const solver = user(event.params.solver.toHexString());
  solver.usdcEarned = solver.usdcEarned.plus(event.params.netSolver);
  solver.save();

  const protocol = stats();
  protocol.solved = protocol.solved.plus(ONE);
  protocol.volumePaid = protocol.volumePaid.plus(event.params.netSolver);
  protocol.feesCollected = protocol.feesCollected.plus(event.params.totalFees);
  protocol.save();
}

export function handleProblemCancelled(event: ProblemCancelled): void {
  const problem = Problem.load(event.params.problemId.toString());
  if (problem == null) return;
  problem.status = "Cancelled";
  problem.save();
}

export function handleProblemDisputed(event: ProblemDisputed): void {
  const problem = Problem.load(event.params.problemId.toString());
  if (problem == null) return;
  problem.status = "Disputed";
  problem.save();
}

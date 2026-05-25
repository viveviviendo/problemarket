import type { Abi, Address } from "viem";
import problemMarketArtifact from "../../contracts/artifacts/contracts/ProblemMarket.sol/ProblemMarket.json";

export const marketAddress = (
  process.env.NEXT_PUBLIC_PROBLEM_MARKET_ADDRESS ||
  process.env.NEXT_PUBLIC_MARKET_ADDRESS ||
  ""
) as Address;
export const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "") as Address;
export const hasContracts = Boolean(marketAddress && usdcAddress);

// The ABI comes from Hardhat output; compile contracts before building the client.
export const problemMarketAbi = problemMarketArtifact.abi as Abi;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const;

export type Problem = {
  id: bigint;
  owner: Address;
  title: string;
  descriptionURI: string;
  bounty: bigint;
  feeAmount: bigint;
  status: number;
  solver: Address;
  solutionURI: string;
  createdAt: bigint;
  deadline: bigint;
  category: number;
};

export type Solution = {
  solver: Address;
  solutionURI: string;
  createdAt: bigint;
};

export type PlatformConfig = readonly [
  feePercentOwner: bigint,
  feePercentSolver: bigint,
  minFee: bigint,
  minBounty: bigint,
  maxBounty: bigint,
  maxActiveProblems: bigint,
  feeCollector: Address
];

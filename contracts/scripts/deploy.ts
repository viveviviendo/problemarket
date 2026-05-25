import { ethers } from "hardhat";

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS;
  if (!usdcAddress || !feeCollector) {
    throw new Error("USDC_ADDRESS and FEE_COLLECTOR_ADDRESS are required");
  }

  const config = {
    feePercentOwner: 250,
    feePercentSolver: 250,
    minFee: 100_000,
    minBounty: 1_000_000,
    maxBounty: 100_000_000,
    maxActiveProblems: 10,
    feeCollector
  };
  const market = await ethers.deployContract("ProblemMarket", [usdcAddress, config]);
  await market.waitForDeployment();
  console.log(`ProblemMarket deployed at ${await market.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers, network, run } from "hardhat";

async function verify(address: string, constructorArguments: unknown[]) {
  if (network.name === "hardhat" || !process.env.BASESCAN_API_KEY) return;
  try {
    await run("verify:verify", { address, constructorArguments });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already verified")) throw error;
  }
}

async function main() {
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS;
  if (!feeCollector) throw new Error("FEE_COLLECTOR_ADDRESS is required");

  let tokenAddress = process.env.USDC_ADDRESS;
  let mockDeployed = false;
  if (!tokenAddress && process.env.DEPLOY_MOCK_USDC === "true") {
    const mock = await ethers.deployContract("MockUSDC");
    await mock.waitForDeployment();
    tokenAddress = await mock.getAddress();
    mockDeployed = true;
    await verify(tokenAddress, []);
  }
  if (!tokenAddress) {
    throw new Error("USDC_ADDRESS is required unless DEPLOY_MOCK_USDC=true on a private testnet");
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
  const market = await ethers.deployContract("ProblemMarket", [tokenAddress, config]);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();

  await verify(marketAddress, [tokenAddress, config]);
  console.log(JSON.stringify({
    network: network.name,
    problemMarket: marketAddress,
    usdc: tokenAddress,
    feeCollector,
    mockUsdcDeployed: mockDeployed,
    timestamp: new Date().toISOString()
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

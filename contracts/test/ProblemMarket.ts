import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const usdc = (amount: string) => ethers.parseUnits(amount, 6);

describe("ProblemMarket", function () {
  async function deployFixture() {
    const [admin, collector, owner, solver, secondSolver, stranger] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const config = {
      feePercentOwner: 250,
      feePercentSolver: 250,
      minFee: usdc("0.10"),
      minBounty: usdc("1"),
      maxBounty: usdc("100"),
      maxActiveProblems: 10,
      feeCollector: collector.address
    };
    const market = await ethers.deployContract("ProblemMarket", [await token.getAddress(), config]);
    await token.mint(owner.address, usdc("1000"));
    await token.connect(owner).approve(await market.getAddress(), ethers.MaxUint256);
    return { admin, collector, owner, solver, secondSolver, stranger, token, market, config };
  }

  async function createProblem(context: Awaited<ReturnType<typeof deployFixture>>, amount = "50", deadline = 0) {
    return context.market
      .connect(context.owner)
      .createProblem("Audit a protocol", "ipfs://problem", usdc(amount), 0, deadline);
  }

  it("escrows bounty plus the owner's disclosed fee and snapshots solver fee", async function () {
    const context = await deployFixture();
    await expect(createProblem(context))
      .to.emit(context.market, "ProblemCreated")
      .withArgs(1, context.owner.address, usdc("50"), usdc("1.25"), 0);

    expect(await context.token.balanceOf(await context.market.getAddress())).to.equal(usdc("51.25"));
    expect(await context.market.reservedOwnerFeePercent(1)).to.equal(250);
    expect(await context.market.reservedSolverFeePercent(1)).to.equal(250);
    expect(await context.market.reservedSolverFee(1)).to.equal(usdc("1.25"));
    expect(await context.market.activeProblems(context.owner.address)).to.equal(1);
  });

  it("applies the configured minimum fee to small bounties", async function () {
    const context = await deployFixture();
    await createProblem(context, "1");
    expect(await context.token.balanceOf(await context.market.getAddress())).to.equal(usdc("1.10"));
    expect(await context.market.reservedSolverFee(1)).to.equal(usdc("0.10"));
  });

  it("exposes fee previews and submitted solutions for contract clients", async function () {
    const context = await deployFixture();
    expect(await context.token.decimals()).to.equal(6);
    expect(await context.market.calculateFees(usdc("50"))).to.deep.equal([usdc("1.25"), usdc("1.25")]);
    await createProblem(context);
    await context.market.connect(context.solver).submitSolution(1, "ipfs://readable-answer");
    const proposals = await context.market.getSolutions(1);
    expect(proposals[0].solver).to.equal(context.solver.address);
    expect(proposals[0].solutionURI).to.equal("ipfs://readable-answer");
  });

  it("pays exactly one submitted solver and collects both fees", async function () {
    const context = await deployFixture();
    await createProblem(context);
    await context.market.connect(context.solver).submitSolution(1, "ipfs://answer-one");
    await context.market.connect(context.secondSolver).submitSolution(1, "ipfs://answer-two");

    await expect(context.market.connect(context.owner).acceptSolution(1, context.solver.address))
      .to.emit(context.market, "ProblemSolved")
      .withArgs(1, context.solver.address, usdc("48.75"), usdc("2.50"));

    expect(await context.token.balanceOf(context.solver.address)).to.equal(usdc("48.75"));
    expect(await context.token.balanceOf(context.collector.address)).to.equal(usdc("2.50"));
    expect(await context.token.balanceOf(await context.market.getAddress())).to.equal(0);
    expect((await context.market.getProblem(1)).status).to.equal(1);
    expect(await context.market.activeProblems(context.owner.address)).to.equal(0);
    await expect(context.market.connect(context.owner).acceptSolution(1, context.secondSolver.address))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");
  });

  it("prevents self-submissions, duplicate submissions and an unsubmitted winner", async function () {
    const context = await deployFixture();
    await createProblem(context);
    await expect(context.market.connect(context.owner).submitSolution(1, "ipfs://self"))
      .to.be.revertedWithCustomError(context.market, "OwnerCannotSolve");
    await context.market.connect(context.solver).submitSolution(1, "ipfs://answer");
    await expect(context.market.connect(context.solver).submitSolution(1, "ipfs://again"))
      .to.be.revertedWithCustomError(context.market, "AlreadySubmitted");
    await expect(context.market.connect(context.owner).acceptSolution(1, context.stranger.address))
      .to.be.revertedWithCustomError(context.market, "SolverDidNotSubmit");
  });

  it("refunds unused escrow, but does not allow cancellation around live proposals", async function () {
    const context = await deployFixture();
    await createProblem(context, "10");
    await expect(context.market.connect(context.owner).cancelProblem(1))
      .to.emit(context.market, "ProblemCancelled")
      .withArgs(1, usdc("10.25"));
    expect((await context.market.getProblem(1)).status).to.equal(3);
    expect(await context.market.activeProblems(context.owner.address)).to.equal(0);

    const deadline = (await time.latest()) + 100;
    await createProblem(context, "10", deadline);
    await context.market.connect(context.solver).submitSolution(2, "ipfs://proposal");
    await expect(context.market.connect(context.owner).cancelProblem(2))
      .to.be.revertedWithCustomError(context.market, "CannotCancelWithActiveSolutions");
    await time.increaseTo(deadline + 1);
    await expect(context.market.connect(context.owner).cancelProblem(2)).to.emit(context.market, "ProblemCancelled");
  });

  it("lets participants dispute and the fee collector either refund or award an actual solver", async function () {
    const context = await deployFixture();
    await createProblem(context, "20");
    await expect(context.market.connect(context.stranger).disputeProblem(1))
      .to.be.revertedWithCustomError(context.market, "NotParticipant");
    await context.market.connect(context.solver).submitSolution(1, "ipfs://solution");
    await context.market.connect(context.solver).disputeProblem(1);
    await expect(context.market.connect(context.admin).resolveDispute(1, ethers.ZeroAddress, false))
      .to.be.revertedWithCustomError(context.market, "NotFeeCollector");
    await expect(context.market.connect(context.collector).resolveDispute(1, ethers.ZeroAddress, false))
      .to.emit(context.market, "DisputeResolved")
      .withArgs(1, ethers.ZeroAddress, false);
    expect(await context.token.balanceOf(context.owner.address)).to.equal(usdc("1000"));

    await createProblem(context, "20");
    await context.market.connect(context.solver).submitSolution(2, "ipfs://winner");
    await context.market.connect(context.owner).disputeProblem(2);
    await expect(context.market.connect(context.collector).resolveDispute(2, context.stranger.address, true))
      .to.be.revertedWithCustomError(context.market, "SolverDidNotSubmit");
    await context.market.connect(context.collector).resolveDispute(2, context.solver.address, true);
    expect(await context.token.balanceOf(context.solver.address)).to.equal(usdc("19.50"));
  });

  it("keeps promised fees after configuration changes and supports emergency pausing", async function () {
    const context = await deployFixture();
    await createProblem(context, "50");
    await context.market.updatePlatformConfig({
      ...context.config,
      feePercentOwner: 500,
      feePercentSolver: 500
    });
    await context.market.connect(context.solver).submitSolution(1, "ipfs://locked-terms");
    await context.market.connect(context.owner).acceptSolution(1, context.solver.address);
    expect(await context.token.balanceOf(context.solver.address)).to.equal(usdc("48.75"));

    await context.market.pause();
    await expect(createProblem(context)).to.be.revertedWith("Pausable: paused");
    await context.market.unpause();
    await expect(createProblem(context)).to.emit(context.market, "ProblemCreated");
  });

  it("validates bounty limits, deadlines, categories and active-problem cap", async function () {
    const context = await deployFixture();
    await expect(createProblem(context, "0.99")).to.be.revertedWithCustomError(context.market, "InvalidBounty");
    await expect(createProblem(context, "101")).to.be.revertedWithCustomError(context.market, "InvalidBounty");
    await expect(
      context.market.connect(context.owner).createProblem("Bad category", "ipfs://uri", usdc("2"), 5, 0)
    ).to.be.revertedWithCustomError(context.market, "InvalidCategory");
    await expect(createProblem(context, "2", await time.latest())).to.be.revertedWithCustomError(
      context.market,
      "InvalidDeadline"
    );

    await context.market.updatePlatformConfig({ ...context.config, maxActiveProblems: 1 });
    await createProblem(context, "2");
    await expect(createProblem(context, "2")).to.be.revertedWithCustomError(context.market, "TooManyActiveProblems");
  });

  it("rejects malformed problems, missing allowance and the full active-problem limit", async function () {
    const context = await deployFixture();
    await expect(
      context.market.connect(context.owner).createProblem("", "ipfs://uri", usdc("2"), 0, 0)
    ).to.be.revertedWithCustomError(context.market, "InvalidProblem");
    await expect(
      context.market.connect(context.owner).createProblem("No URI", "", usdc("2"), 0, 0)
    ).to.be.revertedWithCustomError(context.market, "InvalidProblem");

    await context.token.mint(context.stranger.address, usdc("2.10"));
    await expect(
      context.market.connect(context.stranger).createProblem("No allowance", "ipfs://uri", usdc("2"), 0, 0)
    ).to.be.revertedWith("ERC20: insufficient allowance");

    for (let i = 0; i < 10; i++) {
      await createProblem(context, "1");
    }
    await expect(createProblem(context, "1")).to.be.revertedWithCustomError(context.market, "TooManyActiveProblems");
  });

  it("blocks submissions once a problem is no longer open or has expired", async function () {
    const context = await deployFixture();
    await createProblem(context);
    await context.market.connect(context.solver).submitSolution(1, "ipfs://winner");
    await context.market.connect(context.owner).acceptSolution(1, context.solver.address);
    await expect(context.market.connect(context.secondSolver).submitSolution(1, "ipfs://late"))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");

    await createProblem(context);
    await context.market.connect(context.owner).cancelProblem(2);
    await expect(context.market.connect(context.solver).submitSolution(2, "ipfs://cancelled"))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");

    await createProblem(context);
    await context.market.connect(context.solver).submitSolution(3, "ipfs://pending");
    await context.market.connect(context.owner).disputeProblem(3);
    await expect(context.market.connect(context.secondSolver).submitSolution(3, "ipfs://disputed"))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");

    const deadline = (await time.latest()) + 30;
    await createProblem(context, "2", deadline);
    await time.increaseTo(deadline + 1);
    await expect(context.market.connect(context.solver).submitSolution(4, "ipfs://expired"))
      .to.be.revertedWithCustomError(context.market, "InvalidDeadline");
  });

  it("blocks unauthorized or stale acceptance and cancellation operations", async function () {
    const context = await deployFixture();
    await createProblem(context);
    await context.market.connect(context.solver).submitSolution(1, "ipfs://answer");
    await expect(context.market.connect(context.stranger).acceptSolution(1, context.solver.address))
      .to.be.revertedWithCustomError(context.market, "NotProblemOwner");
    await expect(context.market.connect(context.stranger).cancelProblem(1))
      .to.be.revertedWithCustomError(context.market, "NotProblemOwner");
    await context.market.connect(context.owner).disputeProblem(1);
    await expect(context.market.connect(context.owner).acceptSolution(1, context.solver.address))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");
    await context.market.connect(context.collector).resolveDispute(1, context.solver.address, true);
    await expect(context.market.connect(context.owner).cancelProblem(1))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");
  });

  it("validates addresses and every platform-configuration boundary", async function () {
    const context = await deployFixture();
    const Market = await ethers.getContractFactory("ProblemMarket");
    await expect(Market.deploy(ethers.ZeroAddress, context.config))
      .to.be.revertedWithCustomError(context.market, "InvalidAddress");
    await expect(context.market.updatePlatformConfig({ ...context.config, feeCollector: ethers.ZeroAddress }))
      .to.be.revertedWithCustomError(context.market, "InvalidAddress");
    await expect(context.market.updatePlatformConfig({ ...context.config, minBounty: 0 }))
      .to.be.revertedWithCustomError(context.market, "InvalidConfiguration");
    await expect(context.market.updatePlatformConfig({ ...context.config, minBounty: usdc("101") }))
      .to.be.revertedWithCustomError(context.market, "InvalidConfiguration");
    await expect(context.market.updatePlatformConfig({ ...context.config, maxActiveProblems: 0 }))
      .to.be.revertedWithCustomError(context.market, "InvalidConfiguration");
    await expect(context.market.updatePlatformConfig({ ...context.config, feePercentOwner: 501, feePercentSolver: 500 }))
      .to.be.revertedWithCustomError(context.market, "InvalidConfiguration");
    await expect(context.market.updatePlatformConfig({ ...context.config, minFee: usdc("1.01") }))
      .to.be.revertedWithCustomError(context.market, "InvalidConfiguration");

    await context.market.updatePlatformConfig({ ...context.config, feePercentOwner: 0, feePercentSolver: 0 });
    await createProblem(context, "2");
    expect(await context.token.balanceOf(await context.market.getAddress())).to.equal(usdc("2"));
  });

  it("rejects invalid reads and invalid dispute resolutions", async function () {
    const context = await deployFixture();
    await expect(context.market.getProblem(99)).to.be.revertedWithCustomError(context.market, "InvalidProblem");
    await expect(context.market.getSolutions(99)).to.be.revertedWithCustomError(context.market, "InvalidProblem");
    await expect(context.market.connect(context.collector).resolveDispute(99, context.solver.address, true))
      .to.be.revertedWithCustomError(context.market, "InvalidProblem");
    await createProblem(context);
    await expect(context.market.connect(context.collector).resolveDispute(1, context.solver.address, true))
      .to.be.revertedWithCustomError(context.market, "InvalidStatus");
    await expect(context.market.connect(context.owner).disputeProblem(1))
      .to.be.revertedWithCustomError(context.market, "NotParticipant");
  });

  it("blocks cross-problem cancellation reentry during a token refund", async function () {
    const [, collector] = await ethers.getSigners();
    const token = await ethers.deployContract("ReentrantUSDC");
    const market = await ethers.deployContract("ProblemMarket", [await token.getAddress(), {
      feePercentOwner: 250,
      feePercentSolver: 250,
      minFee: usdc("0.10"),
      minBounty: usdc("1"),
      maxBounty: usdc("100"),
      maxActiveProblems: 10,
      feeCollector: collector.address
    }]);
    const attacker = await ethers.deployContract("ReentrancyAttacker", [await market.getAddress(), await token.getAddress()]);
    await token.mint(await attacker.getAddress(), usdc("3"));
    await attacker.createTwoProblems(usdc("1"));
    await token.setInvokeReceiver(true);

    await attacker.attackCancellation();
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect((await market.getProblem(1)).status).to.equal(3);
    expect((await market.getProblem(2)).status).to.equal(0);
    expect(await market.activeProblems(await attacker.getAddress())).to.equal(1);
  });
});

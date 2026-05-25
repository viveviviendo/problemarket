// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ProblemMarket is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    enum Status {
        Open,
        Solved,
        Disputed,
        Cancelled
    }

    struct Problem {
        uint256 id;
        address owner;
        string title;
        string descriptionURI;
        uint256 bounty;
        uint256 feeAmount;
        Status status;
        address solver;
        string solutionURI;
        uint256 createdAt;
        uint256 deadline;
        uint8 category;
    }

    struct Solution {
        address solver;
        string solutionURI;
        uint256 createdAt;
    }

    struct PlatformConfig {
        uint256 feePercentOwner;
        uint256 feePercentSolver;
        uint256 minFee;
        uint256 minBounty;
        uint256 maxBounty;
        uint256 maxActiveProblems;
        address feeCollector;
    }

    IERC20 public immutable paymentToken;
    PlatformConfig public config;
    uint256 public problemCount;

    mapping(uint256 => Problem) private problems;
    mapping(uint256 => Solution[]) private solutions;
    mapping(uint256 => uint256) public reservedOwnerFeePercent;
    mapping(uint256 => uint256) public reservedSolverFeePercent;
    mapping(uint256 => uint256) public reservedSolverFee;
    mapping(uint256 => mapping(address => bool)) public hasSubmittedSolution;
    mapping(address => uint256) public activeProblems;

    event ProblemCreated(
        uint256 indexed problemId,
        address indexed owner,
        uint256 bounty,
        uint256 ownerFee,
        uint8 category
    );
    event SolutionSubmitted(uint256 indexed problemId, address indexed solver, string solutionURI);
    event ProblemSolved(
        uint256 indexed problemId,
        address indexed solver,
        uint256 netSolver,
        uint256 totalFees
    );
    event ProblemCancelled(uint256 indexed problemId, uint256 refunded);
    event ProblemDisputed(uint256 indexed problemId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed problemId, address indexed solver, bool solverAwarded);
    event PlatformConfigUpdated(PlatformConfig config);

    error InvalidAddress();
    error InvalidConfiguration();
    error InvalidBounty();
    error InvalidDeadline();
    error InvalidCategory();
    error InvalidProblem();
    error InvalidStatus();
    error NotProblemOwner();
    error OwnerCannotSolve();
    error AlreadySubmitted();
    error NotParticipant();
    error SolverDidNotSubmit();
    error TooManyActiveProblems();
    error CannotCancelWithActiveSolutions();
    error NotFeeCollector();

    modifier onlyFeeCollector() {
        if (msg.sender != config.feeCollector) revert NotFeeCollector();
        _;
    }

    constructor(IERC20 token, PlatformConfig memory initialConfig) {
        if (address(token) == address(0)) revert InvalidAddress();
        paymentToken = token;
        _setConfig(initialConfig);
    }

    function createProblem(
        string calldata title,
        string calldata descriptionURI,
        uint256 bounty,
        uint8 category,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (uint256 problemId) {
        PlatformConfig memory current = config;
        if (bytes(title).length == 0) revert InvalidProblem();
        if (bytes(descriptionURI).length == 0) revert InvalidProblem();
        if (bounty < current.minBounty) revert InvalidBounty();
        if (bounty > current.maxBounty) revert InvalidBounty();
        if (category > 4) revert InvalidCategory();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidDeadline();
        if (activeProblems[msg.sender] >= current.maxActiveProblems) revert TooManyActiveProblems();

        uint256 ownerFee = _feeFor(bounty, current.feePercentOwner);
        uint256 solverFee = _feeFor(bounty, current.feePercentSolver);
        paymentToken.safeTransferFrom(msg.sender, address(this), bounty + ownerFee);

        problemId = ++problemCount;
        problems[problemId] = Problem({
            id: problemId,
            owner: msg.sender,
            title: title,
            descriptionURI: descriptionURI,
            bounty: bounty,
            feeAmount: ownerFee,
            status: Status.Open,
            solver: address(0),
            solutionURI: "",
            createdAt: block.timestamp,
            deadline: deadline,
            category: category
        });
        reservedOwnerFeePercent[problemId] = current.feePercentOwner;
        reservedSolverFeePercent[problemId] = current.feePercentSolver;
        reservedSolverFee[problemId] = solverFee;
        activeProblems[msg.sender]++;

        emit ProblemCreated(problemId, msg.sender, bounty, ownerFee, category);
    }

    function submitSolution(uint256 problemId, string calldata solutionURI) external whenNotPaused {
        Problem storage problem = _openProblem(problemId);
        if (problem.owner == msg.sender) revert OwnerCannotSolve();
        if (bytes(solutionURI).length == 0) revert InvalidProblem();
        if (problem.deadline != 0 && block.timestamp > problem.deadline) revert InvalidDeadline();
        if (hasSubmittedSolution[problemId][msg.sender]) revert AlreadySubmitted();

        hasSubmittedSolution[problemId][msg.sender] = true;
        solutions[problemId].push(Solution(msg.sender, solutionURI, block.timestamp));
        emit SolutionSubmitted(problemId, msg.sender, solutionURI);
    }

    function acceptSolution(uint256 problemId, address solver) external whenNotPaused nonReentrant {
        Problem storage problem = _openProblem(problemId);
        if (problem.owner != msg.sender) revert NotProblemOwner();
        if (!hasSubmittedSolution[problemId][solver]) revert SolverDidNotSubmit();

        string memory selectedURI = _solutionURIFor(problemId, solver);
        _paySolver(problem, solver, selectedURI);
    }

    function cancelProblem(uint256 problemId) external nonReentrant {
        Problem storage problem = _openProblem(problemId);
        if (problem.owner != msg.sender) revert NotProblemOwner();
        bool expired = problem.deadline != 0 && block.timestamp > problem.deadline;
        if (solutions[problemId].length != 0 && !expired) revert CannotCancelWithActiveSolutions();

        problem.status = Status.Cancelled;
        activeProblems[msg.sender]--;
        uint256 refund = problem.bounty + problem.feeAmount;
        paymentToken.safeTransfer(msg.sender, refund);
        emit ProblemCancelled(problemId, refund);
    }

    function disputeProblem(uint256 problemId) external whenNotPaused {
        Problem storage problem = _openProblem(problemId);
        if (problem.owner != msg.sender && !hasSubmittedSolution[problemId][msg.sender]) {
            revert NotParticipant();
        }
        if (solutions[problemId].length == 0) revert NotParticipant();
        problem.status = Status.Disputed;
        emit ProblemDisputed(problemId, msg.sender);
    }

    function resolveDispute(uint256 problemId, address solver, bool awardSolver) external onlyFeeCollector nonReentrant {
        Problem storage problem = problems[problemId];
        if (problem.id == 0) revert InvalidProblem();
        if (problem.status != Status.Disputed) revert InvalidStatus();

        if (awardSolver) {
            if (!hasSubmittedSolution[problemId][solver]) revert SolverDidNotSubmit();
            _paySolver(problem, solver, _solutionURIFor(problemId, solver));
        } else {
            problem.status = Status.Cancelled;
            activeProblems[problem.owner]--;
            paymentToken.safeTransfer(problem.owner, problem.bounty + problem.feeAmount);
        }
        emit DisputeResolved(problemId, solver, awardSolver);
    }

    function updatePlatformConfig(PlatformConfig calldata newConfig) external onlyOwner {
        _setConfig(newConfig);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getProblem(uint256 problemId) external view returns (Problem memory) {
        if (problems[problemId].id == 0) revert InvalidProblem();
        return problems[problemId];
    }

    function getSolutions(uint256 problemId) external view returns (Solution[] memory) {
        if (problems[problemId].id == 0) revert InvalidProblem();
        return solutions[problemId];
    }

    function calculateFees(uint256 bounty) external view returns (uint256 ownerFee, uint256 solverFee) {
        ownerFee = _feeFor(bounty, config.feePercentOwner);
        solverFee = _feeFor(bounty, config.feePercentSolver);
    }

    function _paySolver(Problem storage problem, address solver, string memory solutionURI) private {
        uint256 solverFee = reservedSolverFee[problem.id];
        uint256 netSolver = problem.bounty - solverFee;
        uint256 totalFees = problem.feeAmount + solverFee;

        problem.status = Status.Solved;
        problem.solver = solver;
        problem.solutionURI = solutionURI;
        activeProblems[problem.owner]--;

        paymentToken.safeTransfer(solver, netSolver);
        paymentToken.safeTransfer(config.feeCollector, totalFees);
        emit ProblemSolved(problem.id, solver, netSolver, totalFees);
    }

    function _openProblem(uint256 problemId) private view returns (Problem storage problem) {
        problem = problems[problemId];
        if (problem.id == 0) revert InvalidProblem();
        if (problem.status != Status.Open) revert InvalidStatus();
    }

    function _solutionURIFor(uint256 problemId, address solver) private view returns (string memory) {
        Solution[] storage candidateSolutions = solutions[problemId];
        for (uint256 i = 0; i < candidateSolutions.length; i++) {
            if (candidateSolutions[i].solver == solver) return candidateSolutions[i].solutionURI;
        }
        revert SolverDidNotSubmit();
    }

    function _feeFor(uint256 bounty, uint256 percentage) private view returns (uint256) {
        if (percentage == 0) return 0;
        uint256 percentageFee = (bounty * percentage) / BPS;
        return percentageFee < config.minFee ? config.minFee : percentageFee;
    }

    function _setConfig(PlatformConfig memory newConfig) private {
        if (newConfig.feeCollector == address(0)) revert InvalidAddress();
        if (newConfig.minBounty == 0) revert InvalidConfiguration();
        if (newConfig.minBounty > newConfig.maxBounty) revert InvalidConfiguration();
        if (newConfig.maxActiveProblems == 0) revert InvalidConfiguration();
        if (newConfig.feePercentOwner + newConfig.feePercentSolver > 1_000) revert InvalidConfiguration();
        if (newConfig.minFee > newConfig.minBounty) revert InvalidConfiguration();
        config = newConfig;
        emit PlatformConfigUpdated(newConfig);
    }
}

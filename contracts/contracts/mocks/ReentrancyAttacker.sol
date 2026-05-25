// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProblemMarket} from "../ProblemMarket.sol";

contract ReentrancyAttacker {
    ProblemMarket public immutable market;
    IERC20 public immutable token;
    bool public reentrySucceeded;
    bool private attacking;

    constructor(ProblemMarket market_, IERC20 token_) {
        market = market_;
        token = token_;
    }

    function createTwoProblems(uint256 bounty) external {
        token.approve(address(market), type(uint256).max);
        market.createProblem("attack-one", "ipfs://one", bounty, 0, 0);
        market.createProblem("attack-two", "ipfs://two", bounty, 0, 0);
    }

    function attackCancellation() external {
        attacking = true;
        market.cancelProblem(1);
        attacking = false;
    }

    function onTokenTransfer() external {
        if (attacking) {
            (reentrySucceeded,) = address(market).call(
                abi.encodeCall(ProblemMarket.cancelProblem, (2))
            );
        }
    }
}

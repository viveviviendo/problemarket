// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITokenReceiver {
    function onTokenTransfer() external;
}

contract ReentrantUSDC is ERC20 {
    bool public invokeReceiver;

    constructor() ERC20("Reentrant USD Coin", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setInvokeReceiver(bool enabled) external {
        invokeReceiver = enabled;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        super._transfer(from, to, amount);
        if (invokeReceiver && to.code.length != 0) {
            ITokenReceiver(to).onTokenTransfer();
        }
    }
}

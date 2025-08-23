// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPool.sol";

contract AaveManager {
    IPool public immutable lendingPool;

    constructor(address _lendingPool) {
        lendingPool = IPool(_lendingPool);
    }

    function depositToAave(address asset, uint256 amount) internal {
        IERC20(asset).approve(address(lendingPool), amount);
        lendingPool.supply(asset, amount, address(this), 0);
    }

    function borrowFromAave(address asset, uint256 amount) internal {
        lendingPool.borrow(asset, amount, 2, 0, address(this));
    }

    function repayAave(address asset, uint256 amount) internal {
        IERC20(asset).approve(address(lendingPool), amount);
        lendingPool.repay(asset, amount, 2, address(this));
    }

    function withdrawFromAave(address asset, uint256 amount) internal {
        lendingPool.withdraw(asset, amount, address(this));
    }
}

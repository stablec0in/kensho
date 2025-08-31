// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.19;

import "./aavemanager.sol";
import "./kitteswap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract KenshoManager is lpManager, AaveManager {

    //event Executed(bytes32 actionId);

    constructor(
        address _lendingPool,
        address _pool,
        address _deployer,
        address _positionManager,
        address _router,
        address _initialOwner
    )
        lpManager(_pool, _positionManager, _deployer, _router, _initialOwner)
        AaveManager(_lendingPool)
    {}

    // Etre un peu plus modulaire
    // de
    function execute(
        address swapAsset,
        uint256 swapAmount,
        bytes calldata swapCalldata,
        uint256 borrow_amount,
        uint256 repay_amount,
        uint256 withdraw_amount,
        uint256 deposit_amount,
        int24 newTickLower,
        int24 newTickUpper
    ) external onlyBot {
        if (currentTokenId != 0) {
            _exitFarming();
            claimAllRewardsToOwner();
            _withdrawAllAndMaybeBurn(currentTokenId, true);
        }
        if (swapAmount > 0) {
            _swap(swapAsset, swapAmount, swapCalldata);
        }
        if (repay_amount > 0) {
            repayAave(token0, repay_amount);
        }
        if (deposit_amount > 0) {
            depositToAave(token1, deposit_amount);
        }
        if (borrow_amount > 0) {
            borrowFromAave(token0, borrow_amount);
        }
        if (withdraw_amount > 0) {
            withdrawFromAave(token1, withdraw_amount);
        }
        _mintNewPosition(newTickLower, newTickUpper);
        _enterFarming();
        //emit Executed(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
    }

    function stop() external onlyBot {
        if (currentTokenId != 0) {
            _exitFarming();
            claimAllRewardsToOwner();
            _withdrawAllAndMaybeBurn(currentTokenId, true);
        }
        IERC20(token0).transfer(owner(), IERC20(token0).balanceOf(address(this)));
        IERC20(token1).transfer(owner(), IERC20(token1).balanceOf(address(this)));
    }
}

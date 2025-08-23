// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.19;

import "./aavemanager.sol";
import "./lpmanager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KenshoManager is AaveManager, LPManager, Ownable {
    address public bot;
    address public router;

    event Executed(bytes32 actionId);

    modifier onlyBot() {
        require(msg.sender == bot, "Only bot");
        _;
    }

    constructor(address _lendingPool, address _pool, address _positionManager, address _owner,address _router)
        AaveManager(_lendingPool)
        LPManager(_pool, _positionManager)
        Ownable(_owner)
    {router = _router;}

    function setBot(address _bot) external onlyOwner {
        bot = _bot;
    }

    /// @param swapAsset l’asset à swap avant rebalance
    /// @param swapAmount quantité à swap (en in)
    /// @param swapCalldata données du swap (décodées off-chain pour router)


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
        // 1. Retirer ancienne position et éventuellement brûler NFT
        if (currentTokenId != 0) {
            _withdrawAndBurn(currentTokenId);
        }
        // 1. Optionnel : swap si nécessaire
        if (swapAmount > 0) {
            _swap(swapAsset, swapAmount, swapCalldata);
        }
        // logique pour aave ... 
        if (repay_amount > 0) {
            repayAave(token0,repay_amount);
        }
        if (deposit_amount > 0) {
            depositToAave(token1,deposit_amount);
        }
        if (borrow_amount > 0) {
            borrowFromAave(token0,borrow_amount);
        }
        if (withdraw_amount > 0) {
            withdrawFromAave(token1,withdraw_amount);
        }

        // 3. Ajouter nouvelle position
        _mintNewPosition(newTickLower, newTickUpper);

        emit Executed(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
    }

    function stop() external onlyBot{
        if (currentTokenId!=0){
            _withdrawAndBurn(currentTokenId);
        }
        IERC20(token0).transfer(owner(),IERC20(token0).balanceOf(address(this)));
        IERC20(token1).transfer(owner(),IERC20(token1).balanceOf(address(this)));
    }

    function _swap(address asset, uint256 amount, bytes memory data) internal {
        require(amount > 0, "amount must be > 0");
        IERC20(asset).approve(router, amount); // Le bot gère le swap via un router externe
        (bool success, ) = router.call(data);
        require(success, "swap failed");
        IERC20(asset).approve(router, 0);
    }
}

// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interface/NonFungiblePositionManager.sol";
import "./interface/UniswapV3Pool.sol";

contract LPManager {
    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Pool public immutable pool;
    address public immutable token0;
    address public immutable token1;
    int24 public immutable tickSpacing;

    uint256 public currentTokenId;
    int24 public currentTickLower;
    int24 public currentTickUpper;
    uint128 public currentLiquidity;

    constructor(address _pool, address _positionManager) {
        pool = IUniswapV3Pool(_pool);
        positionManager = INonfungiblePositionManager(_positionManager);
        token0 = pool.token0();
        token1 = pool.token1();
        tickSpacing = pool.tickSpacing();
    }
    
    function getNftData() external view returns (uint256, int24, int24, uint128) {
        return (currentTokenId, currentTickLower, currentTickUpper, currentLiquidity);
    }

    function _withdrawAndBurn(uint256 tokenId) internal {
        (, , , , , uint128 liquidity, , , , ) = positionManager.positions(tokenId);

        INonfungiblePositionManager.DecreaseLiquidityParams memory dParams =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        positionManager.decreaseLiquidity(dParams);

        INonfungiblePositionManager.CollectParams memory cParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        positionManager.collect(cParams);
        positionManager.burn(tokenId);
    }

    function _mintNewPosition(int24 tickLower, int24 tickUpper) internal returns (uint256) {
        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));

        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);

        INonfungiblePositionManager.MintParams memory mParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            tickSpacing: tickSpacing,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        });

        (uint256 newTokenId, uint128 liquidity, , ) = positionManager.mint(mParams);

        currentTokenId = newTokenId;
        currentTickLower = tickLower;
        currentTickUpper = tickUpper;
        currentLiquidity = liquidity;

        return newTokenId;
    }
}

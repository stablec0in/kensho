// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.19;

/* ─────────────── OpenZeppelin ─────────────── */
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/* ─────────────── Algebra Core / Periphery ─────────────── */
import "@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol";
import "@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol";
import "@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

/* ─────────────── Farming ─────────────── */
import "@cryptoalgebra/integral-farming/contracts/interfaces/IAlgebraEternalFarming.sol";
import "@cryptoalgebra/integral-farming/contracts/interfaces/IFarmingCenter.sol";
import "@cryptoalgebra/integral-farming/contracts/base/IncentiveKey.sol";

contract lpManager is Ownable {
    /* DEX / NFT manager */
    INonfungiblePositionManager public immutable positionManager;
    IFarmingCenter public immutable farmingCenter;
    IAlgebraEternalFarming public immutable eternalFarming;
    IAlgebraPool public immutable pool;

    /* Pool tokens */
    address public immutable token0;
    address public immutable token1;
    int24   public immutable tickSpacing;
    address public  deployer;

    /* Exec */
    address public bot;
    address public router;

    /* Position courante (NFT détenu par le contrat) */
    uint256 public currentTokenId;
    int24   public currentTickLower;
    int24   public currentTickUpper;
    uint128 public currentLiquidity;

    /* Events */
    event Rebalanced(uint256 oldTokenId, uint256 newTokenId);
    event BotSet(address newBot);

    modifier onlyBot() {
        require(msg.sender == bot, "only bot");
        _;
    }

    constructor(
        address _pool,
        address _positionManager,
        address _deployer,
        address _router,
        address _initialOwner

    ) Ownable(_initialOwner) {
        require(_pool != address(0) && _positionManager != address(0), "zero addr");
        pool = IAlgebraPool(_pool);
        positionManager = INonfungiblePositionManager(_positionManager);
        address _farmingCenter = positionManager.farmingCenter();
        farmingCenter = IFarmingCenter(_farmingCenter);
        eternalFarming = farmingCenter.eternalFarming();
        router = _router;
        deployer = _deployer;
        token0 = pool.token0();
        token1 = pool.token1();
        tickSpacing = pool.tickSpacing();
    }

    function setBot(address _bot) external onlyOwner {
        bot = _bot;
        emit BotSet(_bot);
    }

    /* ─────────────── Helpers ─────────────── */
    function _getIncentiveKey() internal view returns (IncentiveKey memory key) {
        // Décomposition du tuple de eternalFarming en struct IncentiveKey
        (IERC20Minimal rewardToken, IERC20Minimal bonusRewardToken, IAlgebraPool poolAddr, uint256 nonce) =
            eternalFarming.incentiveKeys(address(pool));
        require(address(rewardToken) != address(0), "no incentive");
        key = IncentiveKey({
            rewardToken: rewardToken,
            bonusRewardToken: bonusRewardToken,
            pool: poolAddr,
            nonce: nonce
        });
    }

    function getNftData() external view returns (uint256, int24, int24, uint128) {
        return (currentTokenId, currentTickLower, currentTickUpper, currentLiquidity);
    }

    //---------------- Farming -------------//
    function _enterFarming() internal {
        require(currentTokenId != 0, "No active position");
        IncentiveKey memory key = _getIncentiveKey();
        positionManager.approveForFarming(currentTokenId, true, address(farmingCenter));
        farmingCenter.enterFarming(key, currentTokenId); // arf la bourde 
    }

    function _exitFarming() internal {
        require(currentTokenId != 0, "No active position");
        IncentiveKey memory key = _getIncentiveKey();
        farmingCenter.exitFarming(key, currentTokenId);
    }


    /* ─────────────── Claim rewards to owner ─────────────── */
    function claimAllRewardsToOwner() internal  {
        IncentiveKey memory key = _getIncentiveKey();
        if (address(key.rewardToken) != address(0)) {
            farmingCenter.claimReward(key.rewardToken, address(this), type(uint256).max);
            uint256 bal0 = IERC20Minimal(address(key.rewardToken)).balanceOf(address(this));
            if (bal0 > 0) IERC20Minimal(address(key.rewardToken)).transfer(owner(), bal0);
        }

        if (address(key.bonusRewardToken) != address(0)) {
            farmingCenter.claimReward(key.bonusRewardToken, address(this), type(uint256).max);
            uint256 bal1 = IERC20Minimal(address(key.bonusRewardToken)).balanceOf(address(this));
            if (bal1 > 0) IERC20Minimal(address(key.bonusRewardToken)).transfer(owner(), bal1);
        }
    }



    /* ─────────────── Internals LP ─────────────── */
    function _withdrawAllAndMaybeBurn(uint256 tokenId, bool shouldBurn) internal {
        ( , , , , , , , uint128 liquidity, , , , ) = positionManager.positions(tokenId);
        if (liquidity > 0) {
            INonfungiblePositionManager.DecreaseLiquidityParams memory dParams = INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });
            positionManager.decreaseLiquidity(dParams);

            INonfungiblePositionManager.CollectParams memory cParams = INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
            positionManager.collect(cParams);
        }

        if (shouldBurn) {
            positionManager.burn(tokenId);
        }
    }

    function _mintNewPosition(int24 tickLower, int24 tickUpper) internal {
        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));

        IERC20(token0).approve(address(positionManager), 0);
        IERC20(token1).approve(address(positionManager), 0);
        IERC20(token0).approve(address(positionManager), amount0);
        IERC20(token1).approve(address(positionManager), amount1);

        INonfungiblePositionManager.MintParams memory mParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            deployer: deployer,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        });

        (uint256 newTokenId, uint128 liquidity,,) = positionManager.mint(mParams);

        currentTokenId   = newTokenId;
        currentTickLower = tickLower;
        currentTickUpper = tickUpper;
        currentLiquidity = liquidity;
    }

    /* ─────────────── Swap générique ─────────────── */
    function _swap(address asset, uint256 amount, bytes memory data) internal {
        require(router != address(0), "router not set");
        require(amount > 0, "amount=0");
        require(asset == token0 || asset == token1,"Not allowed");
        //require(IERC20(asset).balanceOf(address(this) >= amount,"insufficiant balance"));
        IERC20(asset).approve(router, 0);
        IERC20(asset).approve(router, amount);

        (bool ok, ) = router.call(data);
        require(ok, "swap failed");
    }

    /* ─────────────── ERC721 Receiver ─────────────── */
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /* ─────────────── Rescue ─────────────── */
    function rescue(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Call failed");
        return result;
    }
}

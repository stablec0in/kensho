import { ethers } from "ethers";
import {whype,usdt} from "../scripts/config.js";
// a changer
const managerAddress = "0x61e3162dE902D16313c61Ff43be390B41b8b51A2";
const poolAddress = "0x41100C6D2c6920B10d12Cd8D59c8A9AA2eF56fC7";

const MANAGER_ABI = [
  "function getNftData() view returns (uint256,int24,int24,uint128)",
  "function getPosition(address depositAsset, address borrowAsset) public view returns (uint256 deposited, uint256 borrowed)"
];
// slot0
const POOL_ABI = [
  "function globalState() external view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)"
];
const lendingAdress ="0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const lending_abi =[
  "  function getUserAccountData(address user)external view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)"
];

const token = [
  "function balanceOf(address owner) view returns (uint256)"
]

const atoken = "0x625E7708f30cA75bfd92586e17077590C60eb4cD";
const btoken ="0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8";
console.log(whype);
console.log(usdt);
const provider = new ethers.JsonRpcProvider("https://lb.drpc.org/avalanche/AppnJCL1b0LDhjBuqrEEwA0efgJUSAcR76gBkmBg0PjN");

export async function fetchPositions() {
  const manager = new ethers.Contract(managerAddress, MANAGER_ABI, provider);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const lending =new ethers.Contract(lendingAdress,lending_abi,provider);
  // ajouter getposition() aave 
  const [tokenId, tickLower, tickUpper, liquidity] = await manager.getNftData();
  const slot0 = await pool.globalState();

  const debt = new ethers.Contract(btoken,token,provider);
  const lend = new ethers.Contract(atoken,token,provider);
  const abal = await lend.balanceOf(managerAddress);
  const bbal = await debt.balanceOf(managerAddress);
  return [
    {
      id: String(tokenId),
      collat:abal,
      borrow:bbal,
      liquidity: String(liquidity),
      pool: {
        id: poolAddress.toLowerCase(),
        tick: Number(slot0.tick),
      },
      tickLower: {
        tickIdx: String(tickLower),
      },
      tickUpper: {
        tickIdx: String(tickUpper),
      },
    }
  ];
}

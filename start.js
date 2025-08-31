import { ethers } from 'ethers';
import ManagerABI from '../abi/Manager.json' with { type: 'json' };
import dotenv from 'dotenv';
import {whype,usdt} from '../scripts/config.js';
dotenv.config();
//0x71C10AfBcEc18053C11FcbB2102AF64f4D0336B6
export const RPC_URL = process.env.RPC_URL;
export const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS;
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

const provider  = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const managerContract = new ethers.Contract(MANAGER_ADDRESS, ManagerABI, wallet);
function safeToBigInt(value) {
  if (typeof value === 'number') {
    value = Math.trunc(value).toString(); // enlève la partie décimale
  } else if (typeof value === 'string') {
    if (value.includes('.')) {
      value = value.split('.')[0]; // coupe après le point
    }
  }
  return ethers.toBigInt(value);
}
export async function execute(rebalance,swapCalldata){
    const datas         = rebalance.datas;
    const swapAsset     = datas.swap.asset_in.address;
    const swapAmount    = safeToBigInt(datas.swap.amount_in);
    const borrow_amount = safeToBigInt(datas.borrow);
    const repay_amount  = safeToBigInt(datas.repay*0.993);
    const deposit_amount = safeToBigInt(datas.deposit*0.993);
    const withdraw_amount = safeToBigInt(datas.withdraw);
    const newTickLower    = rebalance.newTickLower;
    const newTickUpper    = rebalance.newTickUpper;

    const tx = await managerContract.execute(
        swapAsset,
        swapAmount,
        swapCalldata,
        borrow_amount,
        repay_amount,
        withdraw_amount,
        deposit_amount,
        newTickLower,
        newTickUpper
    );
    console.log(tx.hash);

}
async function start(){
	/*
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
    )
	*/
	console.log(usdt.address);
	const tx = await managerContract.execute(
		usdt.address,0n,"0x",0n,0n,0n,0n,-200000,-190000);
	console.log(tx.hash);
}
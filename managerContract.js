import { ethers } from 'ethers';
import ManagerABI from '../abi/Manager.json' with { type: 'json' };
import dotenv from 'dotenv';
dotenv.config();
//0x71C10AfBcEc18053C11FcbB2102AF64f4D0336B6
export const RPC_URL = process.env.RPC_URL;
export const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS;
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

const provider  = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const managerContract = new ethers.Contract(MANAGER_ADDRESS, ManagerABI, wallet);

// ici je peux mettre une condition pour check amount_out mais faut modifier le contrat.
export async function rebalance(newTickLower, newTickUpper, asset, amount, data) {
  try {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    if (!gasPrice) {
      throw new Error("Gas price not available from provider");
    }

    const estimatedGas = await managerContract.rebalance.estimateGas(
      newTickLower,
      newTickUpper,
      asset,
      amount,
      data,
      true
    ); // estimatedGas est un bigint

    const HYPE_USD = 26; // Prix du HYPE en dollars
    const maxUsdCost = 0.10;

    const gasCostInWei = gasPrice * estimatedGas; // bigint
    const gasCostInHype = Number(ethers.formatEther(gasCostInWei)); // float
    const gasCostInUSD = gasCostInHype * HYPE_USD;

    console.log(`💸 Estimation du coût: ${gasCostInUSD.toFixed(4)} USD`);

    if (gasCostInUSD > maxUsdCost) {
      console.warn(`⛔ Transaction annulée : coût estimé ${gasCostInUSD.toFixed(4)} $ > ${maxUsdCost} $`);
      return null;
    }

    const gasLimit = estimatedGas * 110n / 100n; // +10% marge de sécurité

    const tx = await managerContract.rebalance(
      newTickLower,
      newTickUpper,
      asset,
      amount,
      data,
      true,
      {
        gasPrice,
        gasLimit
      }
    );

    console.log('✅ Transaction envoyée:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Confirmée:', receipt.transactionHash);
    return receipt;

  } catch (err) {
    console.error('❌ Erreur dans rebalance:', err);
    throw err;
  }
}

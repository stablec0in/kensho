import dotenv from 'dotenv';
import { getTokenDecimals } from './config.js';
import { ethers } from 'ethers';

dotenv.config();

import { fetchPositions } from '../core/fetchPositions.js';
import { swapdata } from '../core/getSwapData.js';
import { execute } from '../core/start.js';
import { simulateFullRebalance } from '../scripts/_computeRebalance.js';

function safeToBigInt(value) {
  if (typeof value === "string" && value.includes('.')) {
    throw new Error(`Cannot convert float string to BigInt: ${value}`);
  }
  return ethers.toBigInt(value);
}

// Calcule une nouvelle range de ticks autour du tick courant
function getCenteredTickRange(x, tickSpacing = 200) {
  x = Number(x);
  const base = Math.round(x / tickSpacing);
  const tickLower = (base - 1) * tickSpacing;
  const tickUpper = (base + 1) * tickSpacing;
  return {
    tickLower,
    tickUpper
  };
}

async function orchestrate() {
  try {
    console.log('🔄 Fetching positions...');
    const positions = await fetchPositions();
    console.log(positions);

    const threshold = 32; // distance max avant bord

    for (const pos of positions) {
      if (pos.liquidity === '0') {
        console.log(`🚫 Position ${pos.id} has 0 liquidity. Skipping.`);
        continue;
      }

      const currentTick = Number(pos.pool.tick);
      const lowerTick = parseInt(pos.tickLower.tickIdx);
      const upperTick = parseInt(pos.tickUpper.tickIdx);

      const nearLower = currentTick < (lowerTick + threshold);
      const nearUpper = currentTick > (upperTick - threshold);
      const outOfRange = currentTick < lowerTick || currentTick > upperTick;

      if (outOfRange || nearLower || nearUpper) {
        console.log(`\n📍 Position ID: ${pos.id}`);
        console.log(`Current Tick: ${currentTick}, Range: [${lowerTick}, ${upperTick}]`);
        console.log(outOfRange ? '⚠ Out of range!' : '⚠ Near boundary!');

        const { tickLower: newTickLower, tickUpper: newTickUpper } = getCenteredTickRange(currentTick);
        console.log(`✅ New tick range: [${newTickLower}, ${newTickUpper}]`);
        

        const rebalance = simulateFullRebalance({collat_usdc0:Number(pos.collat), aeth_borrow0:Number(pos.borrow),L0:pos.liquidity,HF:Number(1.2), MLTV:Number(0.795), tl:lowerTick, 
          tu:upperTick, new_t:currentTick, ntl:newTickLower, ntu:newTickUpper
        });
        
        // ici faut path 
        /*
        const rebalanceData = repositionLiquidity({
          tick: currentTick,
          ta: lowerTick,
          tb: upperTick,
          nta: newTickLower,
          ntb: newTickUpper,
          liquidity: Number(pos.liquidity)
        });
        */
        const swap = rebalance.datas.swap;
        console.log(swap);
        const tokenIn = swap.asset_in;
        const tokenOut = swap.asset_out;
        const amountIn =swap.amount_in; 
        if (!tokenIn || !tokenOut || !amountIn || amountIn <= 0) {
          console.warn('🚨 Invalid swap data or no amount to swap:', {
            tokenIn, tokenOut, amountIn
          });
          continue;
        }

        console.log('🔁 Swap info:', {
          direction: `${tokenIn.address} → ${tokenOut.address}`,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amountIn
        });

        console.log('📦 Fetching swap calldata...');
        console.log(`Human-readable amount: ${amountIn}`);
        const calldata = await swapdata(tokenIn.address, tokenOut.address,0.998*amountIn);

        //const amountInBigInt = safeToBigInt(amountIn);

        console.log('🧠 Calling rebalance on contract...');
        const receipt = await execute(rebalance,calldata);
      } else {
        console.log(`✅ Position ${pos.id} is safe in range, skipping.`);
      }
    }
  } catch (err) {
    console.error('❌ Error in orchestrate:', err);
  }
}

orchestrate();

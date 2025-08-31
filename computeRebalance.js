// Uniswap V3 helper functions

import { whype, usdt } from '../scripts/config.js';
export function toSqrtPrice(tick) {
  return Math.pow(1.0001, tick / 2);
}
const slippage = 0.05;

function calculateExit({ tick, ta, tb, liquidity }) {
  const sqrtP = toSqrtPrice(tick);
  const sqrtPa = toSqrtPrice(ta);
  const sqrtPb = toSqrtPrice(tb);
  let a0, a1;
  if (tick < ta) {
    a0 = liquidity * (1 / sqrtPa - 1 / sqrtPb);
    a1 = 0;
  } else if (tick > tb) {
    a0 = 0;
    a1 = liquidity * (sqrtPb - sqrtPa);
  } else {
    a0 = liquidity * (1 / sqrtP - 1 / sqrtPb);
    a1 = liquidity * (sqrtP - sqrtPa);
  }
  return { a0, a1 };
}

// Ajout du cas où a0 > 0 && a1 > 0
function simulateRebalance({ tick, ta, tb, a0 = 0, a1 = 0 }) {
  const sqrtP = toSqrtPrice(tick);
  const sqrtPa = toSqrtPrice(ta);
  const sqrtPb = toSqrtPrice(tb);
  let p = sqrtP ** 2;

  const alpha = (1 / sqrtP) - (1 / sqrtPb);
  const beta = sqrtP - sqrtPa;

  if (a0 > 0 && a1 === 0) {
    p = (1 - slippage) * p;
    const x = (beta * a0) / (beta + alpha * p);
    return {
      postSwap: {
        amountIn: x,
        token0: a0 - x,
        token1: x * p
      }
    };
  } else if (a1 > 0 && a0 === 0) {
    p = (1 + slippage) * p;
    const y = (alpha * a1) / ((beta / p) + alpha);
    return {
      postSwap: {
        amountIn: y,
        token0: y / p,
        token1: a1 - y
      }
    };
  } else {
    // Nouveau cas : a0 > 0 && a1 > 0 (position partiellement dans le range)
    // Objectif : rendre (a0, a1) proportionnel à (alpha, beta)
    const ratioCurrent = a0 / alpha;
    const ratioTarget = a1 / beta;

    if (Math.abs(ratioCurrent - ratioTarget) < 1e-12) {
      // Déjà équilibré, pas de swap
      return {
        postSwap: {
          amountIn: 0,
          token0: a0,
          token1: a1
        }
      };
    }

    if (ratioCurrent > ratioTarget) {
      // Trop de token0 → swap 0 -> 1
      p = (1 - slippage) * p;
      const x = (beta * a0 - alpha * a1) / (beta + alpha * p);
      const swapAmount = Math.max(0, x);
      return {
        postSwap: {
          amountIn: swapAmount,
          token0: a0 - swapAmount,
          token1: a1 + swapAmount * p
        }
      };
    } else {
      // Trop de token1 → swap 1 -> 0
      p = (1 + slippage) * p;
      const y = (alpha * a1 - beta * a0) / (alpha + beta / p);
      const swapAmount = Math.max(0, y);
      return {
        postSwap: {
          amountIn: swapAmount,
          token0: a0 + swapAmount / p,
          token1: a1 - swapAmount
        }
      };
    }
  }
}

export function calculateLiquidity({ tick, ta, tb, amount0, amount1 }) {
  const sqrtP = toSqrtPrice(tick);
  const sqrtPa = toSqrtPrice(ta);
  const sqrtPb = toSqrtPrice(tb);

  const [sqrtA, sqrtB] = sqrtPa < sqrtPb ? [sqrtPa, sqrtPb] : [sqrtPb, sqrtPa];

  if (tick <= ta) {
    return amount0 / ((1 / sqrtA) - (1 / sqrtB));
  } else if (tick >= tb) {
    return amount1 / (sqrtB - sqrtA);
  } else {
    const l0 = amount0 / ((1 / sqrtP) - (1 / sqrtB));
    const l1 = amount1 / (sqrtP - sqrtA);
    return Math.min(l0, l1);
  }
}

export function repositionLiquidity({ tick, ta, tb, nta, ntb, liquidity }) {
  const { a0, a1 } = calculateExit({ tick, ta, tb, liquidity });

  let swapResult;
  let tokenIn;
  let tokenOut;
  if (a0 > 0 && a1 === 0) {
    tokenIn = whype;
    tokenOut = usdt;
    swapResult = simulateRebalance({ tick, ta: nta, tb: ntb, a0 });
  } else if (a1 > 0 && a0 === 0) {
    tokenIn = usdt;
    tokenOut = whype;
    swapResult = simulateRebalance({ tick, ta: nta, tb: ntb, a1 });
  } else {
    // Nouveau cas : les deux sont non nuls
    swapResult = simulateRebalance({ tick, ta: nta, tb: ntb, a0, a1 });
    // Déterminer la direction pour tokenIn / tokenOut
    if (swapResult.postSwap.token0 < a0) {
      tokenIn = whype;
      tokenOut = usdt;
    } else if (swapResult.postSwap.token1 < a1) {
      tokenIn = usdt;
      tokenOut = whype;
    } else {
      tokenIn = null;
      tokenOut = null;
    }
  }

  const { token0, token1, amountIn } = swapResult.postSwap;
  const newLiquidity = calculateLiquidity({ tick, ta: nta, tb: ntb, amount0: token0, amount1: token1 });

  return {
    amountIn: parseInt(amountIn),
    tokenIn,
    tokenOut,
    newLiquidity
  };
}

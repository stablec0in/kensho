// ===== Kensho Rebalance Machine (Safe Numbers) =====
import {whype,usdt} from "../scripts/config.js";

export function toSqrtPrice(tick) {
  return Math.pow(1.0001, tick / 2);
}

const safeNumber = (n) => (typeof n === "number" && !isNaN(n)) ? n : 0;

// ===== Formule Kensho =====
// j'ai amount_usdc en  usdc.
// je veux calculer 
// combien je depose en lend, combien j'emprunte en eth pour que 
// ce qui me reste en usdc + borrwo eth tombe dans le range.

/*
    (eth_borrow : lp_usdc)  proportionelle a (alpha,beta)
    lp_usdc = usdc_total - usdc_collat
     c = usdc_collat * MLTV
     d = eth * P 

     HF = c/d 

     c = HF *d  
     eth_borrow * P 

    alpha * lp_usdc = beta * eth_borrow 
    usdc_collat * MLTV = HF * eth_borrow * P 
    lp_usdc = usdc_total - usdc_collat



*/



export function main(amount_usdc, MLTV, HF, t, tl, tu) {
  const sqrtP = toSqrtPrice(t);
  const sqrtPl = toSqrtPrice(tl);
  const sqrtPu = toSqrtPrice(tu);
  const P = sqrtP ** 2;

  const alpha = safeNumber((1 / sqrtP) - (1 / sqrtPu));
  const beta  = safeNumber(sqrtP - sqrtPl);

  const denom = HF * alpha * P + beta * MLTV;
  const usdc_lp = safeNumber((amount_usdc * beta * MLTV) / denom);
  const aeth_borrow = safeNumber((amount_usdc * alpha * MLTV) / denom);

  return { usdc_lp, aeth_borrow, P, alpha, beta };
}

// ===== LP Exit & Liquidity =====
export function calculateExit({ tick, ta, tb, liquidity }) {
  const sqrtP = toSqrtPrice(tick);
  const sqrtPa = toSqrtPrice(ta);
  const sqrtPb = toSqrtPrice(tb);

  let amount0 = 0, amount1 = 0;
  if (tick < ta) amount0 = liquidity * (1 / sqrtPa - 1 / sqrtPb);
  else if (tick > tb) amount1 = liquidity * (sqrtPb - sqrtPa);
  else {
    amount0 = liquidity * (1 / sqrtP - 1 / sqrtPb);
    amount1 = liquidity * (sqrtP - sqrtPa);
  }
  return { amount0: safeNumber(amount0), amount1: safeNumber(amount1) };
}

export function calculateLiquidity({ tick, ta, tb, amount0, amount1 }) {
  const sqrtP = toSqrtPrice(tick);
  const sqrtPa = toSqrtPrice(ta);
  const sqrtPb = toSqrtPrice(tb);
  const [sqrtA, sqrtB] = sqrtPa < sqrtPb ? [sqrtPa, sqrtPb] : [sqrtPb, sqrtPa];

  let liquidity = 0;
  if (tick <= ta) liquidity = amount0 / ((1 / sqrtA) - (1 / sqrtB));
  else if (tick >= tb) liquidity = amount1 / (sqrtB - sqrtA);
  else {
    const l0 = amount0 / ((1 / sqrtP) - (1 / sqrtB));
    const l1 = amount1 / (sqrtP - sqrtA);
    liquidity = Math.min(l0, l1);
  }
  return safeNumber(liquidity);
}

// ===== Simulate & Build Args =====
export function simulateFullRebalance({
  collat_usdc0, aeth_borrow0,L0,HF, MLTV, tl, tu, new_t, ntl, ntu
}) {
  const { amount0: ethFromLP, amount1: usdcFromLP } = calculateExit({ tick: new_t, ta: tl, tb: tu, liquidity: L0 });

  let cash_usdc = collat_usdc0 + usdcFromLP;
  // ----- 2) Nouvelle stratégie Kensho -----
  const P = toSqrtPrice(new_t)**2;
  const value_usdc = safeNumber(cash_usdc + (ethFromLP - aeth_borrow0) * P);
  console.log(value_usdc);
  // ici nouveau param
  const { usdc_lp: usdc_lp1, aeth_borrow: aeth_borrow1 } = main(value_usdc, MLTV, HF, new_t, ntl, ntu);
  console.log(P);
  const collat_usdc1 = HF * aeth_borrow1 * P / MLTV;
  const delta = {
    debt    : safeNumber(aeth_borrow1 - aeth_borrow0),
    collat  : safeNumber(collat_usdc1 - collat_usdc0),
    swap    : safeNumber(aeth_borrow0 - ethFromLP),
  };
  let asset_in;
  let amount_in;
  let asset_out;
  if (delta.swap > 0){
    asset_in  = usdt;
    asset_out = whype;
    amount_in =  delta.swap*P;
  } 
  else {
    asset_in = whype;
    asset_out = usdt;
    amount_in = -delta.swap;
  }// 9) Dépôt / retrait
  console.log(amount_in);
  const deposit = delta.collat > 0 ? delta.collat : 0;
  const withdraw = delta.collat < 0 ? -delta.collat : 0;

  // 10) Borrow / repay
  const borrow = delta.debt > 0 ? delta.debt : 0;
  const repay = delta.debt < 0 ? -delta.debt : 0;

  const datas = {
    swap: {
      asset_in,
      asset_out,
      amount_in
    },
    deposit,
    withdraw,
    borrow,
    repay
  };
  console.log(borrow,withdraw);
  return {
    datas,
    newTickLower: ntl,
    newTickUpper: ntu
  };
}

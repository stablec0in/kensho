const quoteUrl = 'https://api.odos.xyz/sor/quote/v2';
const address  = "0xa2D8B63b2d7b3d7b1A7a481Ae780F6Ddd6d0b16d";
fqire un fonction 
export async function swapdata(tokenIn, tokenOut, amountIn)
const quoteRequestBody = {
  chainId:43114  , // Replace with desired chainId
  inputTokens: [
    {
        tokenAddress: '0x...', // checksummed input token address
        amount: '100000', // input amount as a string in fixed integer precision
    }
  ],
  outputTokens: [
    {
        tokenAddress: '0x...', // checksummed output token address
        proportion: 1
    }
  ],
  userAddr: address, // checksummed user address
  slippageLimitPercent: 0.1, // set your slippage limit percentage (1 = 1%),
  referralCode: 0, // referral code (recommended)
  disableRFQs: true,
  compact: true,
};

const response = await fetch(
  quoteUrl,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteRequestBody),
  });

if (response.status === 200) {
  const quote = await response.json();
  // handle quote response data
} else {
  console.error('Error in Quote:', response);
  // handle quote failure cases
}


const assembleUrl = 'https://api.odos.xyz/sor/assemble';

const assembleRequestBody = {
  userAddr: '0x...', // the checksummed address used to generate the quote
  pathId: quote.pathId, // Replace with the pathId from quote response in step 1
  simulate: true, // this can be set to true if the user isn't doing their own estimate gas call for the transaction
};

const response = await fetch(
  assembleUrl,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assembleRequestBody),
  });

if (response.status === 200) {
  const assembledTransaction = await response.json();
  // handle Transaction Assembly response data
} else {
  console.error('Error in Transaction Assembly:', response);
  // handle quote failure cases
}

return transaction.data
const quoteUrl = 'https://api.odos.xyz/sor/quote/v3';
const assembleUrl = 'https://api.odos.xyz/sor/assemble';
const address = "0x61e3162dE902D16313c61Ff43be390B41b8b51A2";

export async function swapdata(tokenIn, tokenOut, amountIn) {
  try {
    console.log((amountIn.toString()).split('.')[0]);
    // Étape 1 : Préparer la requête Quote
    const quoteRequestBody = {
      chainId: 43114, // Avalanche C-Chain par défaut
      inputTokens: [
        {
          tokenAddress: tokenIn, // token d'entrée
          amount:  (amountIn.toString()).split('.')[0], // montant en string
        }
      ],
      outputTokens: [
        {
          tokenAddress: tokenOut, // token de sortie
          proportion: 1
        }
      ],
      userAddr: address, // Adresse utilisateur
      slippageLimitPercent: 1, // 0.1% de slippage
      referralCode: 0,
      disableRFQs: true,
      compact: true
    };

    const quoteResponse = await fetch(quoteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteRequestBody)
    });

    if (quoteResponse.status !== 200) {
      throw new Error(`Erreur dans la requête Quote : ${quoteResponse.status}`);
    }

    const quoteData = await quoteResponse.json();
    // Vérifier si pathId existe
    if (!quoteData.pathId) {
      throw new Error('Réponse quote invalide : pathId manquant');
    }

    // Étape 2 : Préparer la requête Assemble
    const assembleRequestBody = {
      userAddr: address,
      pathId: quoteData.pathId,
      simulate: false // true pour simulation
    };

    const assembleResponse = await fetch(assembleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assembleRequestBody)
    });

    if (assembleResponse.status !== 200) {
      throw new Error(`Erreur dans la requête Assemble : ${assembleResponse.status}`);
    }

    const assembledTransaction = await assembleResponse.json();
    console.log(assembledTransaction.transaction);
    // Retourner la data de la transaction
    return assembledTransaction.transaction.data;

  } catch (error) {
    console.error('Erreur dans swapdata:', error.message);
    throw error;
  }
}

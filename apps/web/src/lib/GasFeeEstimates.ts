// Snapshot source: https://gas-price-oracle.phantom.app/?chainId=eip155:137
// For now we intentionally use the fast/aggressive estimate for all approval txs.
export const polygonGasFeeEstimates = {
  gasPriceSources: {
    recommended: {
      priceEstimates: {
        fast: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
        standard: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
        slow: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
      },
    },
    phantom_gas_estimator: {
      priceEstimates: {
        standard: {
          maxFeePerGas: '759246922027',
          maxPriorityFeePerGas: '120000000000',
        },
      },
    },
    blocknative: {
      priceEstimates: {
        fast: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
        standard: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
        slow: {
          maxFeePerGas: '510000000000',
          maxPriorityFeePerGas: '30000000000',
        },
      },
    },
  },
} as const;

export function getAggressivePolygonGasPriceWei(): bigint {
  const candidates = [
    polygonGasFeeEstimates.gasPriceSources.recommended.priceEstimates.fast.maxFeePerGas,
    polygonGasFeeEstimates.gasPriceSources.blocknative.priceEstimates.fast.maxFeePerGas,
    polygonGasFeeEstimates.gasPriceSources.phantom_gas_estimator.priceEstimates.standard
      .maxFeePerGas,
  ];

  return candidates.reduce((max, current) => {
    const value = BigInt(current);
    return value > max ? value : max;
  }, 0n);
}

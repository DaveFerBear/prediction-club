// ABI exports
export {
  ClubVaultV1Abi,
  ClubVaultV1Events,
  ERC20Abi,
  type ClubVaultV1EventName,
} from './abi';

// Client utilities
export {
  createChainPublicClient,
  createChainWalletClient,
  getViemChain,
  getVaultContract,
  getERC20Contract,
  getMemberBalance,
  getCohortStatus,
  getTokenBalance,
  getTokenAllowance,
} from './client';

// Configuration
export {
  CHAIN_CONFIG,
  USDC_DECIMALS,
  chainEnvSchema,
  getChainConfig,
  isSupportedChain,
  parseUsdc,
  formatUsdc,
  type ChainEnv,
  type SupportedChainId,
} from './config';

// Safe integration
export {
  SafeClient,
  buildCommitToCohortTx,
  buildSettleCohortTx,
  buildWithdrawTx,
  buildRescueTokenTx,
  generateCohortId,
  type SafeTransactionData,
  type CommitEntry,
  type SettleEntry,
} from './safe';

// Re-export commonly used viem types
export type { Address, Hex, Hash } from 'viem';

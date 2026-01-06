/**
 * ClubVaultV1 ABI - Generated from contracts/src/ClubVaultV1.sol
 *
 * DO NOT EDIT MANUALLY - regenerate with `yarn generate-abi`
 */
export const ClubVaultV1Abi = [
  // Constructor
  {
    type: 'constructor',
    inputs: [
      { name: 'safe_', type: 'address', internalType: 'address' },
      { name: 'collateralToken_', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },

  // Errors
  {
    type: 'error',
    name: 'OnlySafe',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientAvailable',
    inputs: [
      { name: 'member', type: 'address', internalType: 'address' },
      { name: 'have', type: 'uint256', internalType: 'uint256' },
      { name: 'need', type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientCommitted',
    inputs: [
      { name: 'member', type: 'address', internalType: 'address' },
      { name: 'have', type: 'uint256', internalType: 'uint256' },
      { name: 'need', type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientCohortCommit',
    inputs: [
      { name: 'cohortId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'member', type: 'address', internalType: 'address' },
      { name: 'have', type: 'uint256', internalType: 'uint256' },
      { name: 'need', type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'CohortFinalized',
    inputs: [{ name: 'cohortId', type: 'bytes32', internalType: 'bytes32' }],
  },
  {
    type: 'error',
    name: 'CannotRescueCollateral',
    inputs: [],
  },

  // Events
  {
    type: 'event',
    name: 'MemberRegistered',
    inputs: [
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'withdrawAddress', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawAddressUpdated',
    inputs: [
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'oldWithdrawAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newWithdrawAddress', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CohortCommitted',
    inputs: [
      { name: 'cohortId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CohortSettled',
    inputs: [
      { name: 'cohortId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'commitAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'payoutAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'member', type: 'address', indexed: true, internalType: 'address' },
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenRescued',
    inputs: [
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },

  // View Functions
  {
    type: 'function',
    name: 'collateralToken',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IERC20' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'safe',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdrawAddressOf',
    inputs: [{ name: 'member', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'member', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ClubVaultV1.MemberBalance',
        components: [
          { name: 'available', type: 'uint256', internalType: 'uint256' },
          { name: 'committed', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableOf',
    inputs: [{ name: 'member', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'committedOf',
    inputs: [{ name: 'member', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cohortCommittedRemaining',
    inputs: [
      { name: 'cohortId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'member', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cohortTotalRemaining',
    inputs: [{ name: 'cohortId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cohortFinalized',
    inputs: [{ name: 'cohortId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },

  // Member Functions
  {
    type: 'function',
    name: 'setWithdrawAddress',
    inputs: [{ name: 'withdrawAddress', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositFor',
    inputs: [
      { name: 'member', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Safe-only Functions
  {
    type: 'function',
    name: 'commitToCohort',
    inputs: [
      { name: 'cohortId', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'entries',
        type: 'tuple[]',
        internalType: 'struct ClubVaultV1.CommitEntry[]',
        components: [
          { name: 'member', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settleCohort',
    inputs: [
      { name: 'cohortId', type: 'bytes32', internalType: 'bytes32' },
      {
        name: 'entries',
        type: 'tuple[]',
        internalType: 'struct ClubVaultV1.SettleEntry[]',
        components: [
          { name: 'member', type: 'address', internalType: 'address' },
          { name: 'commitAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'payoutAmount', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'member', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rescueToken',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Event names for type safety
export const ClubVaultV1Events = [
  'MemberRegistered',
  'WithdrawAddressUpdated',
  'Deposited',
  'CohortCommitted',
  'CohortSettled',
  'Withdrawn',
  'TokenRescued',
] as const;

export type ClubVaultV1EventName = (typeof ClubVaultV1Events)[number];

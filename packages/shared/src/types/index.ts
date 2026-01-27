/**
 * Shared types for Prediction Club
 */

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  email: string | null;
  walletAddress: string;
  createdAt: Date;
}

export interface UserWithVerification extends User {
  isVerified: boolean;
}

// ============================================================================
// Club Types
// ============================================================================

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  managerUserId: string;
  safeAddress: string;
  vaultAddress: string;
  chainId: number;
  isPublic: boolean;
  createdAt: Date;
}

export interface ClubWithManager extends Club {
  manager: User;
}

export interface ClubWithStats extends Club {
  memberCount: number;
  predictionRoundCount: number;
  totalValueLocked: string; // BigInt as string
}

// ============================================================================
// Membership Types
// ============================================================================

export type MemberRole = 'MEMBER' | 'ADMIN';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
}

export interface ClubMemberWithUser extends ClubMember {
  user: User;
}

export interface MemberBalance {
  available: string; // BigInt as string (wei)
  committed: string;
  total: string;
  withdrawAddress: string;
}

// ============================================================================
// Application Types
// ============================================================================

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Application {
  id: string;
  clubId: string;
  userId: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: Date;
}

export interface ApplicationWithUser extends Application {
  user: User;
}

// ============================================================================
// Prediction Round Types
// ============================================================================

export type PredictionRoundStatus = 'PENDING' | 'COMMITTED' | 'SETTLED' | 'CANCELLED';

export interface PredictionRound {
  id: string;
  clubId: string;
  cohortId: string; // bytes32 as hex string
  marketRef: string | null;
  marketTitle: string | null;
  stakeTotal: string; // BigInt as string
  status: PredictionRoundStatus;
  commitTxHash: string | null;
  settleTxHash: string | null;
  createdAt: Date;
}

export interface PredictionRoundMember {
  id: string;
  predictionRoundId: string;
  userId: string;
  commitAmount: string;
  payoutAmount: string;
  pnlAmount: string;
}

export interface PredictionRoundWithMembers extends PredictionRound {
  members: PredictionRoundMemberWithUser[];
}

export interface PredictionRoundMemberWithUser extends PredictionRoundMember {
  user: User;
}

// ============================================================================
// Vault Event Types
// ============================================================================

export type VaultEventName =
  | 'MemberRegistered'
  | 'WithdrawAddressUpdated'
  | 'Deposited'
  | 'CohortCommitted'
  | 'CohortSettled'
  | 'Withdrawn'
  | 'TokenRescued';

export interface VaultEvent {
  id: string;
  clubId: string;
  txHash: string;
  logIndex: number;
  eventName: VaultEventName;
  payloadJson: Record<string, unknown>;
  blockNumber: bigint;
  blockTime: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface CreateClubRequest {
  name: string;
  slug: string;
  description?: string;
  safeAddress: string;
  vaultAddress: string;
  chainId: number;
  isPublic?: boolean;
}

export interface ApplyToClubRequest {
  message?: string;
}

export interface CreatePredictionRoundRequest {
  cohortId: string;
  marketRef?: string;
  marketTitle?: string;
  members: {
    userId: string;
    commitAmount: string;
  }[];
}

export interface WithdrawRequest {
  amount: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardStats {
  totalClubs: number;
  totalDeposited: string;
  totalCommitted: string;
  activePredictionRounds: number;
  recentPnl: string;
}

export interface ClubDashboard {
  club: ClubWithStats;
  members: ClubMemberWithUser[];
  activePredictionRounds: PredictionRound[];
  recentEvents: VaultEvent[];
}

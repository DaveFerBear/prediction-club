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
  polymarketSafeAddress?: string | null;
  polymarketApiKeyId?: string | null;
  polymarketApiSecret?: string | null;
  polymarketApiPassphrase?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  isPublic: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  updatedAt: Date;
}

export interface ClubMemberWithUser extends ClubMember {
  user: User;
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
  updatedAt: Date;
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
  createdByUserId: string | null;
  marketRef: string | null;
  marketTitle: string | null;
  stakeTotal: string; // BigInt as string
  status: PredictionRoundStatus;
  targetOutcome: string | null;
  targetTokenId: string | null;
  outcome: string | null;
  resolvedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PredictionRoundMember {
  id: string;
  predictionRoundId: string;
  userId: string;
  commitAmount: string;
  payoutAmount: string;
  pnlAmount: string;
  orderId: string | null;
  orderStatus: string | null;
  orderSide: string | null;
  orderPrice: string | null;
  orderSize: string | null;
  orderSizeMatched: string | null;
  orderType: string | null;
  orderOutcome: string | null;
  orderCreatedAt: Date | null;
  orderTxHashes: unknown | null;
  orderMakingAmount: string | null;
  orderTakingAmount: string | null;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PredictionRoundWithMembers extends PredictionRound {
  members: PredictionRoundMemberWithUser[];
}

export interface PredictionRoundMemberWithUser extends PredictionRoundMember {
  user: User;
}

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
  isPublic?: boolean;
}

export interface ApplyToClubRequest {
  message?: string;
}

export interface CreatePredictionRoundRequest {
  marketRef?: string;
  marketTitle?: string;
  commitAmount: string;
  tokenId: string;
  outcome: string;
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
}

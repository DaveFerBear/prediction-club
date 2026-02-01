/**
 * Shared utility functions
 */

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate an Ethereum address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a BigInt as a string with commas
 */
export function formatBigInt(value: bigint | string, decimals = 0): string {
  const num = typeof value === 'string' ? BigInt(value) : value;
  const divisor = BigInt(10 ** decimals);
  const wholePart = num / divisor;
  const fractionalPart = num % divisor;

  const wholeStr = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimals === 0 || fractionalPart === BigInt(0)) {
    return wholeStr;
  }

  const fracStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${wholeStr}.${fracStr}`;
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(value: bigint | string): string {
  return formatBigInt(value, 6);
}

/**
 * Sum ledger entry amounts (string wei values).
 */
export function sumLedgerAmounts(entries: Array<{ amount: string }>): string {
  const total = entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  return total.toString();
}

/**
 * Parse USDC amount to wei
 */
export function parseUSDC(value: string | number): bigint {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return BigInt(Math.floor(num * 1_000_000));
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a datetime for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(d);
}

/**
 * Calculate PnL percentage
 */
export function calculatePnlPercent(commit: bigint | string, payout: bigint | string): number {
  const c = typeof commit === 'string' ? BigInt(commit) : commit;
  const p = typeof payout === 'string' ? BigInt(payout) : payout;

  if (c === BigInt(0)) return 0;

  // Calculate as (payout - commit) / commit * 100
  const pnl = p - c;
  return Number((pnl * BigInt(10000)) / c) / 100;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate bytes32 hex string
 */
export function isValidBytes32(hex: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hex);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

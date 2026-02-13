'use client';

import { formatUsdAmount } from '@prediction-club/shared';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prediction-club/ui';
import { CopyableAddress } from '@/components/copyable-address';

type ProvisioningStatus = 'PENDING' | 'PROVISIONING' | 'READY' | 'FAILED';

type TreasuryWallet = {
  walletAddress: string | null;
  balance: string;
  provisioningStatus: ProvisioningStatus;
  provisioningError: string | null;
};

type ClubTreasuryCardProps = {
  wallet: TreasuryWallet | null;
  onInitWallet: () => Promise<void>;
  onRefreshWallet: () => Promise<void>;
  onWithdraw: () => Promise<void>;
  walletInitializing: boolean;
  walletInitError?: Error;
  withdrawMessage: string | null;
};

export function ClubTreasuryCard(props: ClubTreasuryCardProps) {
  const {
    wallet,
    onInitWallet,
    onRefreshWallet,
    onWithdraw,
    walletInitializing,
    walletInitError,
    withdrawMessage,
  } = props;

  return (
    <Card className="h-full border-[color:var(--club-border-soft)] shadow-sm">
      <CardHeader>
        <CardTitle>Club Treasury</CardTitle>
        <CardDescription>Safe address, treasury balance, and wallet actions for this club.</CardDescription>
      </CardHeader>
      <CardContent>
        {wallet ? (
          <div className="space-y-4 rounded-xl border border-[color:var(--club-border-soft)] bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--club-text-secondary)]">
                  Treasury Safe
                </div>
                {wallet.walletAddress ? (
                  <CopyableAddress address={wallet.walletAddress} variant="compact" />
                ) : (
                  <span className="text-xs text-muted-foreground">Provisioning in progress</span>
                )}
              </div>
              <div className="text-left md:text-right">
                <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--club-text-secondary)]">
                  Treasury Balance
                </div>
                <div className="text-3xl font-semibold tabular-nums text-[color:var(--club-text-primary)]">
                  ${formatUsdAmount(wallet.balance)}
                </div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void onRefreshWallet()}>
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onWithdraw()}>
                Withdraw
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Use the Deposit into club action above to top up treasury.
            </p>

            {wallet.provisioningStatus === 'FAILED' ? (
              <p className="text-xs text-destructive">
                {wallet.provisioningError ?? 'Wallet provisioning failed. Retry initialize wallet.'}
              </p>
            ) : null}

            {withdrawMessage ? <p className="text-xs text-muted-foreground">{withdrawMessage}</p> : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-[color:var(--club-border-soft)] bg-white p-4">
            <p className="text-sm text-muted-foreground">
              Initialize a per-club wallet to begin funding and trading.
            </p>
            <Button size="sm" onClick={() => void onInitWallet()} disabled={walletInitializing}>
              {walletInitializing ? 'Initializing...' : 'Initialize wallet'}
            </Button>
            {walletInitError ? <p className="text-xs text-destructive">{walletInitError.message}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

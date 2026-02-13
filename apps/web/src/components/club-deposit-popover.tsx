'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '@prediction-club/ui';
import { useClubWalletDeposit } from '@/hooks/use-club-wallet-deposit';

const statusLabel: Record<string, string> = {
  connecting: 'Connecting wallet...',
  'switching-chain': 'Switching network...',
  submitting: 'Awaiting wallet signature...',
  confirming: 'Confirming onchain...',
};

export function ClubDepositPopover(props: {
  slug: string;
  walletAddress: string | null;
  canDeposit: boolean;
}) {
  const { slug, walletAddress, canDeposit } = props;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const { state, isBusy, submitDeposit, reset } = useClubWalletDeposit(slug);

  const busyLabel = useMemo(() => statusLabel[state.tag] ?? 'Deposit', [state.tag]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = async () => {
    if (!walletAddress) return;
    await submitDeposit({
      amount,
      clubWalletAddress: walletAddress,
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={!canDeposit}>
          Deposit into club
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <div className="text-sm font-medium">Fund your club wallet</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign an ERC-20 transfer in your browser wallet.
          </p>
        </div>

        {!walletAddress ? (
          <p className="text-xs text-muted-foreground">
            Initialize your club wallet first in the setup section below.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="club-deposit-amount">
                Amount (USDC)
              </label>
              <Input
                id="club-deposit-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="10"
                inputMode="decimal"
              />
            </div>

            <Button size="sm" className="w-full" disabled={isBusy} onClick={() => void handleSubmit()}>
              {isBusy ? busyLabel : 'Confirm deposit'}
            </Button>

            {state.tag === 'success' ? (
              <p className="text-xs text-emerald-600">
                Deposit recorded. Tx:{' '}
                <Link
                  href={`https://polygonscan.com/tx/${state.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {state.txHash.slice(0, 10)}...
                </Link>
              </p>
            ) : null}

            {state.tag === 'error' ? (
              <p className="text-xs text-destructive">{state.message}</p>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

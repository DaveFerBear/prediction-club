'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from '@prediction-club/ui';
import { ActiveCheckList, ActiveCheckListItem } from './active-check-list';
import { CopyableAddress } from './copyable-address';
import type { ClubSetupStep } from '@/hooks/use-club-setup-status';
import type { ClubWalletSummary } from '@/hooks/use-club-wallet';

type ClubSetupChecklistProps = {
  steps: ClubSetupStep[];
  wallet: ClubWalletSummary | null;
  canInitializeWallet: boolean;
  isInitializingWallet: boolean;
  walletInitError?: Error;
  onInitializeWallet: () => Promise<void>;
  onRefreshWallet: () => Promise<void>;
  onWithdraw: () => Promise<void>;
  withdrawMessage: string | null;
};

export function ClubSetupChecklist({
  steps,
  wallet,
  canInitializeWallet,
  isInitializingWallet,
  walletInitError,
  onInitializeWallet,
  onRefreshWallet,
  onWithdraw,
  withdrawMessage,
}: ClubSetupChecklistProps) {
  return (
    <Accordion type="single" collapsible defaultValue="setup">
      <AccordionItem value="setup" className="border-b-0">
        <AccordionTrigger className="py-0 hover:no-underline">
          <div className="text-left">
            <div className="text-base font-semibold">Setup Checklist</div>
            <div className="text-xs text-muted-foreground">
              Progress from sign-in to autonomous execution readiness.
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <ActiveCheckList>
            {steps.map((step) => (
              <ActiveCheckListItem key={step.id} active={step.active} status={step.status}>
                <div>
                  <div className="font-medium">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.hint}</div>
                </div>
              </ActiveCheckListItem>
            ))}
          </ActiveCheckList>

          {!wallet && canInitializeWallet ? (
            <div className="space-y-2">
              <Button size="sm" onClick={() => void onInitializeWallet()} disabled={isInitializingWallet}>
                {isInitializingWallet ? 'Initializing...' : 'Initialize wallet'}
              </Button>
              {walletInitError ? (
                <p className="text-xs text-destructive">{walletInitError.message}</p>
              ) : null}
            </div>
          ) : null}

          {wallet ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Address</span>
                  <CopyableAddress address={wallet.walletAddress} variant="compact" />
                </div>
                <div>
                  <span className="text-muted-foreground">Balance</span>{' '}
                  <span className="font-medium">${formatUsdAmount(wallet.balance)} USDC</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void onRefreshWallet()}>
                  Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onWithdraw()}>
                  Withdraw
                </Button>
                <span className="text-xs text-muted-foreground">
                  Top up by sending USDC to this club wallet.
                </span>
              </div>
              {withdrawMessage ? <p className="mt-2 text-xs text-muted-foreground">{withdrawMessage}</p> : null}
            </div>
          ) : null}

          {!canInitializeWallet && !wallet ? (
            <p className="text-xs text-muted-foreground">
              Join this club and <Link href="/profile" className="underline">sign in</Link> to initialize a club wallet.
            </p>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}


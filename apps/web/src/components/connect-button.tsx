'use client';

import Link from 'next/link';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@prediction-club/ui';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { CopyableAddress } from '@/components/copyable-address';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  return (
    <div className="flex items-center gap-2">
      {isConnected && address && (
        <span className="max-w-[120px] truncate rounded-md border border-input px-2 py-1 text-xs font-mono text-muted-foreground sm:max-w-none">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <span aria-hidden="true" className="text-xl leading-none">
              ≡
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 px-3 py-2">
          <div className="flex flex-col gap-3">
            <div className="grid gap-1 sm:hidden">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  My clubs
                </Button>
              </Link>
              <Link href="/clubs">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Find a club
                </Button>
              </Link>
              <Link href="/clubs/create">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Create a club
                </Button>
              </Link>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              {isConnected && address ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Connected wallet</p>
                    <CopyableAddress address={address} variant="block" truncate={true} />
                  </div>
                  {balance && (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="text-sm font-medium">
                        {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                      </p>
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => disconnect()}>
                    Disconnect wallet
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => connect({ connector: injected() })}
                  disabled={isPending}
                >
                  {isPending ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

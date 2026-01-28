'use client';

import Link from 'next/link';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@prediction-club/ui';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function ConnectButton() {
  const { isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <circle cx="12" cy="8" r="4.25" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M4 20c0-3.3137 3.5817-6 8-6s8 2.6863 8 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 px-3 py-2">
          <div className="flex flex-col gap-3">
            <div className="grid gap-1 sm:hidden">
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Profile
                </Button>
              </Link>
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
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Profile
                </Button>
              </Link>
              {isConnected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => disconnect()}
                >
                  Disconnect wallet
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => connect({ connector: injected() })}
                  disabled={isPending}
                >
                  {isPending ? 'Connecting...' : 'Connect wallet'}
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

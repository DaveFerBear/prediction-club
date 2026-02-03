'use client';

import Link from 'next/link';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@prediction-club/ui';
import { useSession } from 'next-auth/react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useSiweSignIn } from '@/hooks';

export function ProfileDropdownMenu() {
  const { isConnected, address } = useAccount();
  const { data: session, status: sessionStatus } = useSession();
  const { signInWithSiwe, isSigningIn } = useSiweSignIn();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const sessionAddress = session?.address?.toLowerCase() ?? null;
  const walletAddress = address?.toLowerCase() ?? null;
  const isAuthenticated = !!sessionAddress && sessionAddress === walletAddress;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          <DropdownMenuItem asChild>
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard">My clubs</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/clubs">Find a club</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/markets">Markets</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/clubs/create">Create a club</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isConnected ? (
            <>
              {!isAuthenticated && (
                <DropdownMenuItem
                  onSelect={() => signInWithSiwe()}
                  disabled={isSigningIn || sessionStatus === 'loading'}
                >
                  {isSigningIn ? 'Signing in...' : 'Sign in'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => disconnect()}>Disconnect wallet</DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => connect({ connector: injected() })}
              disabled={isPending}
            >
              {isPending ? 'Connecting...' : 'Connect wallet'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
import { useApi, useAppSession } from '@/hooks';

export function ProfileDropdownMenu() {
  const { fetch: apiFetch } = useApi();
  const { authenticated, refreshSession } = useAppSession();

  const handleSignOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    await refreshSession();
  };

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
          {authenticated ? (
            <DropdownMenuItem onSelect={() => void handleSignOut()}>Sign out</DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/profile">Sign in</Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gradientFromEmail(email: string | null | undefined): string {
  const normalized = (email ?? 'guest').trim().toLowerCase();
  const hash = hashString(normalized);
  const hueA = hash % 360;
  const hueB = (hash >>> 9) % 360;
  const angle = (hash >>> 18) % 360;
  return `linear-gradient(${angle}deg, hsl(${hueA} 78% 56%), hsl(${hueB} 72% 48%))`;
}

export function ProfileDropdownMenu() {
  const { fetch: apiFetch } = useApi();
  const { authenticated, user, refreshSession } = useAppSession();
  const avatarGradient = gradientFromEmail(user?.email);

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
          {authenticated && (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-full border border-border"
                  style={{ backgroundImage: avatarGradient }}
                />
                <div className="min-w-0 text-sm font-medium text-foreground">
                  <p className="truncate">{user?.email ?? 'No email'}</p>
                </div>
              </Link>
              <DropdownMenuSeparator />
            </>
          )}
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

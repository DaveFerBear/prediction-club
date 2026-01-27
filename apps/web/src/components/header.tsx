'use client';

import Link from 'next/link';
import { Button } from '@prediction-club/ui';
import { ConnectButton } from './connect-button';
import { Logo } from './logo';

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Logo size={24} />
          Prediction Club
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost">My clubs</Button>
          </Link>
          <Link href="/clubs">
            <Button variant="ghost">Find a club</Button>
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}

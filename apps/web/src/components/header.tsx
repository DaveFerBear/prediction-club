'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Button } from '@prediction-club/ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from './connect-button';
import { Logo } from './logo';

export function Header() {
  const logoRef = useRef<SVGSVGElement | null>(null);
  const { address, isConnected } = useAccount();

  const handleLogoEnter = () => {
    const el = logoRef.current;
    if (!el) return;
    if (el.classList.contains('logo-spin-anim')) return;
    el.classList.add('logo-spin-anim');
  };

  const handleLogoAnimationEnd = () => {
    logoRef.current?.classList.remove('logo-spin-anim');
  };

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2 text-xl font-bold">
          <span onMouseEnter={handleLogoEnter} className="inline-flex">
            <Logo
              size={24}
              className="logo-spin"
              ref={logoRef}
              onAnimationEnd={handleLogoAnimationEnd}
            />
          </span>
          Prediction Club
        </Link>
        <nav className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/dashboard">
              <Button variant="ghost">My clubs</Button>
            </Link>
            <Link href="/clubs">
              <Button variant="ghost">Find a club</Button>
            </Link>
            <Link href="/markets">
              <Button variant="ghost">Markets</Button>
            </Link>
          </div>
          {isConnected && address && (
            <span className="hidden rounded-md border border-input px-2 py-1 text-xs font-mono text-muted-foreground sm:inline-flex">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}

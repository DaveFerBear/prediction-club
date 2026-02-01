'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { Button } from '@prediction-club/ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from './connect-button';
import { Logo } from './logo';
import { useLedgerNetBalance } from '@/hooks';

export function Header({ variant = 'default' }: { variant?: 'default' | 'ghost' }) {
  const logoRef = useRef<SVGSVGElement | null>(null);
  const { address, isConnected } = useAccount();
  const { balance } = useLedgerNetBalance();
  const balanceDisplay = formatUsdAmount(balance);

  const handleLogoEnter = () => {
    const el = logoRef.current;
    if (!el) return;
    if (el.classList.contains('logo-spin-anim')) return;
    el.classList.add('logo-spin-anim');
  };

  const handleLogoAnimationEnd = () => {
    logoRef.current?.classList.remove('logo-spin-anim');
  };

  const headerClass =
    variant === 'ghost'
      ? 'border-b border-transparent bg-transparent'
      : 'border-b bg-background';

  return (
    <header className={headerClass}>
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
            <Link href="/clubs">
              <Button variant="ghost">Find a club</Button>
            </Link>
          </div>
          {isConnected && address && (
            <div className="rounded-md border border-input px-2 py-1 text-right sm:min-w-[120px] sm:text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">
                Portfolio
              </div>
              <div className="text-sm font-semibold tabular-nums sm:hidden">${balanceDisplay}</div>
              <div className="hidden items-center justify-between sm:flex">
                <div className="text-xs text-muted-foreground">Portfolio</div>
                <div className="text-sm font-semibold tabular-nums">${balanceDisplay}</div>
              </div>
            </div>
          )}
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

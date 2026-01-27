'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Button } from '@prediction-club/ui';
import { ConnectButton } from './connect-button';
import { Logo } from './logo';

export function Header() {
  const logoRef = useRef<SVGSVGElement | null>(null);

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
          </div>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}

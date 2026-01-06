'use client';

import { Button } from '@prediction-club/ui';
import { useState, useEffect } from 'react';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isPhantom?: boolean;
    };
  }
}

export function ConnectButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(typeof window !== 'undefined' && !!window.ethereum);

    // Check if already connected
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          const accts = accounts as string[];
          if (accts.length > 0) {
            setAddress(accts[0]);
          }
        })
        .catch(console.error);

      // Listen for account changes
      const handleAccountsChanged = (accounts: unknown) => {
        const accts = accounts as string[];
        setAddress(accts.length > 0 ? accts[0] : null);
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const connect = async () => {
    if (!window.ethereum) return;

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const accts = accounts as string[];
      if (accts.length > 0) {
        setAddress(accts[0]);
      }
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  if (address) {
    return (
      <Button variant="outline" onClick={disconnect}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </Button>
    );
  }

  if (!hasWallet) {
    return (
      <Button onClick={() => window.open('https://metamask.io/download/', '_blank')}>
        Install Wallet
      </Button>
    );
  }

  return (
    <Button onClick={connect} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}

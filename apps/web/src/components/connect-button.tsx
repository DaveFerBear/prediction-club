'use client';

import { Button } from '@prediction-club/ui';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button variant="outline" onClick={() => disconnect()}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </Button>
    );
  }

  return (
    <Button onClick={() => connect({ connector: injected() })} disabled={isPending}>
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}

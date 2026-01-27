'use client';

import { Button, Popover, PopoverTrigger, PopoverContent } from '@prediction-club/ui';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  if (isConnected && address) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {address.slice(0, 6)}...{address.slice(-4)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Connected Wallet</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>
            {balance && (
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="font-medium">
                  {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                </p>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => disconnect()}>
              Disconnect
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button onClick={() => connect({ connector: injected() })} disabled={isPending}>
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}

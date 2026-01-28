'use client';

import { useMemo, useState } from 'react';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { Web3Provider } from '@ethersproject/providers';
import {
  useAccount,
  useConnect,
  useChainId,
  useSwitchChain,
  useWalletClient,
  useDisconnect,
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import {
  POLYMARKET_CHAIN_ID,
  POLYMARKET_CLOB_URL,
  getPolymarketBuilderConfig,
} from '@/lib/polymarket';
import {
  usePolymarketApprovals,
  usePolymarketCreds,
  usePolymarketSafe,
  usePolymarketOrders,
} from '@/hooks';

type ApiCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

const defaultOrder = {
  tokenID: '',
  price: '0.4',
  size: '5',
  side: Side.BUY,
  orderType: OrderType.GTC,
  useSafe: true,
};

function walletClientToSigner(walletClient: ReturnType<typeof useWalletClient>['data']) {
  if (!walletClient) return null;
  const provider = new Web3Provider(walletClient.transport as any, walletClient.chain.id);
  return provider.getSigner(walletClient.account.address);
}

export default function DemoTxPage() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: POLYMARKET_CHAIN_ID });
  const [creds, setCreds] = useState<ApiCreds | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [order, setOrder] = useState(defaultOrder);
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  const { saveCreds, isSaving } = usePolymarketCreds();
  const { submitOrder, isSubmitting } = usePolymarketOrders();
  const { safeAddress, isSafeDeployed, deploySafe, isDeploying } = usePolymarketSafe();
  const { checkApprovals, approveAll, isApproving } = usePolymarketApprovals();

  const signer = useMemo(() => walletClientToSigner(walletClient), [walletClient]);

  const ensureConnected = async () => {
    if (!isConnected) {
      connect({ connector: injected() });
      return false;
    }
    if (chainId !== POLYMARKET_CHAIN_ID) {
      await switchChainAsync({ chainId: POLYMARKET_CHAIN_ID });
      return false;
    }
    if (!walletClient) {
      connect({ connector: injected(), chainId: POLYMARKET_CHAIN_ID });
      return false;
    }
    return true;
  };

  const handleDeriveCreds = async () => {
    const connected = await ensureConnected();
    if (!connected) return;
    if (!signer || chainId !== POLYMARKET_CHAIN_ID) {
      setStatus('Wallet not ready on Polygon');
      return;
    }

    setStatus('Deriving API creds...');
    try {
      const tmpClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID, signer);
      const derived = await tmpClient.createOrDeriveApiKey();
      setCreds(derived);
      setStatus('Creds derived');
    } catch (error) {
      setStatus(`Derive failed: ${(error as Error).message}`);
    }
  };

  const handleSaveCreds = async () => {
    if (!creds) {
      setStatus('No creds to save');
      return;
    }

    setStatus('Saving creds to server...');
    try {
      const response = await saveCreds({
        key: creds.key,
        secret: creds.secret,
        passphrase: creds.passphrase,
        safeAddress: safeAddress ?? undefined,
      });
      if (response?.success) {
        setStatus('Creds saved');
      } else {
        setStatus(response?.error?.message || 'Failed to save creds');
      }
    } catch (error) {
      setStatus(`Save failed: ${(error as Error).message}`);
    }
  };

  const handleCheckSafe = async () => {
    if (!safeAddress) {
      setStatus('Safe address not available');
      return;
    }
    const deployed = await isSafeDeployed();
    setStatus(deployed ? `Safe deployed: ${safeAddress}` : `Safe not deployed: ${safeAddress}`);
  };

  const handleDeploySafe = async () => {
    setStatus('Deploying Safe...');
    try {
      const deployed = await deploySafe();
      setStatus(`Safe ready: ${deployed}`);
    } catch (error) {
      setStatus(`Deploy failed: ${(error as Error).message}`);
    }
  };

  const handleCheckApprovals = async () => {
    if (!safeAddress) {
      setStatus('Safe address not available');
      return;
    }
    const result = await checkApprovals(safeAddress);
    setStatus(result.allApproved ? 'Approvals already set' : 'Approvals missing');
  };

  const handleApproveAll = async () => {
    setStatus('Submitting approvals...');
    try {
      await approveAll();
      setStatus('Approvals set');
    } catch (error) {
      setStatus(`Approvals failed: ${(error as Error).message}`);
    }
  };

  const buildClient = () => {
    if (!signer) return null;
    if (!creds) return null;
    const builderConfig = getPolymarketBuilderConfig();
    return new ClobClient(
      POLYMARKET_CLOB_URL,
      POLYMARKET_CHAIN_ID,
      signer,
      creds,
      order.useSafe ? 2 : undefined,
      order.useSafe ? (safeAddress ?? undefined) : undefined,
      undefined,
      false,
      builderConfig
    );
  };

  const handleClientPost = async () => {
    const connected = await ensureConnected();
    if (!connected) return;
    const client = buildClient();
    if (!client) {
      setStatus('Missing signer or creds');
      return;
    }

    setIsSubmittingClient(true);
    setStatus('Creating order...');
    try {
      const signed = await client.createOrder({
        tokenID: order.tokenID,
        price: Number(order.price),
        side: order.side,
        size: Number(order.size),
      });
      setStatus('Posting order...');
      const response = await client.postOrder(signed, order.orderType);
      setStatus(`Order posted: ${response?.orderID || 'ok'}`);
    } catch (error) {
      setStatus(`Client post failed: ${(error as Error).message}`);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleServerPost = async () => {
    const connected = await ensureConnected();
    if (!connected) return;
    const client = buildClient();
    if (!client) {
      setStatus('Missing signer or creds');
      return;
    }

    setStatus('Creating signed order...');
    try {
      const signed = await client.createOrder({
        tokenID: order.tokenID,
        price: Number(order.price),
        side: order.side,
        size: Number(order.size),
      });
      setStatus('Submitting to server...');
      const response = await submitOrder({
        order: signed,
        orderType: order.orderType,
      });
      if (response?.success) {
        setStatus(`Server posted: ${response?.data?.orderID || 'ok'}`);
      } else {
        setStatus(response?.error?.message || 'Server post failed');
      }
    } catch (error) {
      setStatus(`Server post failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Polymarket Demo Tx</CardTitle>
            <CardDescription>
              Test the full wallet → creds → Safe → approvals → order flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {!isConnected ? (
                <Button onClick={() => connect({ connector: injected() })} disabled={isConnecting}>
                  {isConnecting ? 'Connecting...' : 'Connect wallet'}
                </Button>
              ) : chainId !== POLYMARKET_CHAIN_ID ? (
                <Button
                  onClick={() => switchChainAsync({ chainId: POLYMARKET_CHAIN_ID })}
                  disabled={isSwitching}
                >
                  {isSwitching ? 'Switching...' : 'Switch to Polygon'}
                </Button>
              ) : !walletClient ? (
                <Button
                  onClick={() => connect({ connector: injected(), chainId: POLYMARKET_CHAIN_ID })}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Reconnecting...' : 'Reconnect on Polygon'}
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">Connected: {address}</span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => disconnect()}>
                  Disconnect
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                UI chain: {chainId} · Wallet client chain: {walletClient?.chain?.id ?? 'none'}
              </div>
            </div>
            {status && <div className="text-sm text-muted-foreground">{status}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: API Credentials</CardTitle>
            <CardDescription>Derive once, then save server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDeriveCreds}>Derive creds</Button>
              <Button onClick={handleSaveCreds} disabled={!creds || isSaving}>
                {isSaving ? 'Saving...' : 'Save creds to server'}
              </Button>
            </div>
            {creds && (
              <div className="text-xs text-muted-foreground">
                Derived key: {creds.key.slice(0, 6)}...{creds.key.slice(-4)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Safe + Approvals</CardTitle>
            <CardDescription>Deploy Safe and set approvals for trading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCheckSafe}>
                Check Safe
              </Button>
              <Button onClick={handleDeploySafe} disabled={isDeploying}>
                {isDeploying ? 'Deploying...' : 'Deploy Safe'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCheckApprovals}>
                Check approvals
              </Button>
              <Button onClick={handleApproveAll} disabled={isApproving}>
                {isApproving ? 'Approving...' : 'Approve all'}
              </Button>
            </div>
            {safeAddress && (
              <div className="text-xs text-muted-foreground">Safe address: {safeAddress}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Place Order</CardTitle>
            <CardDescription>Create + post a signed order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Token ID</label>
                <Input
                  value={order.tokenID}
                  onChange={(e) => setOrder({ ...order, tokenID: e.target.value })}
                  placeholder="Polymarket token ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Side</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={order.side}
                  onChange={(e) => setOrder({ ...order, side: e.target.value as Side })}
                >
                  <option value={Side.BUY}>BUY</option>
                  <option value={Side.SELL}>SELL</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price</label>
                <Input
                  value={order.price}
                  onChange={(e) => setOrder({ ...order, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Size</label>
                <Input
                  value={order.size}
                  onChange={(e) => setOrder({ ...order, size: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Order type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={order.orderType}
                  onChange={(e) => setOrder({ ...order, orderType: e.target.value as OrderType })}
                >
                  <option value={OrderType.GTC}>GTC</option>
                  <option value={OrderType.GTD}>GTD</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Use Safe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={order.useSafe}
                    onChange={(e) => setOrder({ ...order, useSafe: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Use Safe funder + signatureType 2
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleClientPost}
                disabled={isSubmittingClient || !order.tokenID || !creds}
              >
                {isSubmittingClient ? 'Posting...' : 'Post order (client)'}
              </Button>
              <Button
                variant="outline"
                onClick={handleServerPost}
                disabled={isSubmitting || !order.tokenID || !creds}
              >
                {isSubmitting ? 'Submitting...' : 'Post order (server)'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

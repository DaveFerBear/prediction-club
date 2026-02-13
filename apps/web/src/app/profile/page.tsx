'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import useSWR from 'swr';
import { formatUsdAmount } from '@prediction-club/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';
import { useApi, useAppSession } from '@/hooks';

type ClubWalletSummary = {
  id: string;
  club: {
    id: string;
    name: string;
    slug: string;
  };
  walletAddress: string | null;
  turnkeyWalletAddress: string;
  provisioningStatus: 'PENDING' | 'PROVISIONING' | 'READY' | 'FAILED';
  provisioningError: string | null;
  isDisabled: boolean;
  balance: string;
  createdAt: string;
};

type ClubWalletResponse = {
  success: boolean;
  data?: {
    wallets: ClubWalletSummary[];
  };
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function ProfilePage() {
  const { fetch: apiFetch } = useApi();
  const { authenticated, user, isLoading: sessionLoading, refreshSession } = useAppSession();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleScriptReady, setIsGoogleScriptReady] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const { data, error, isLoading } = useSWR<ClubWalletResponse>(
    authenticated ? '/api/profile/wallets' : null,
    (url: string) => apiFetch<ClubWalletResponse>(url)
  );

  const wallets = data?.data?.wallets ?? [];

  const signInWithGoogleToken = useCallback(async (oidcToken: string) => {
    setLoginError(null);
    setIsSigningIn(true);

    try {
      await apiFetch('/api/auth/turnkey/login', {
        method: 'POST',
        body: JSON.stringify({
          oidcToken,
          providerName: 'Google',
        }),
      });
      await refreshSession();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsSigningIn(false);
    }
  }, [apiFetch, refreshSession]);

  useEffect(() => {
    if (authenticated) return;
    if (!isGoogleScriptReady) return;
    if (!googleClientId || !window.google || !googleButtonRef.current) return;

    const callback = (response: { credential?: string }) => {
      const oidcToken = response.credential;
      if (!oidcToken) {
        setLoginError('Google did not return a credential.');
        return;
      }
      void signInWithGoogleToken(oidcToken);
    };

    const buttonElement = googleButtonRef.current;
    buttonElement.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback,
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
    });
    window.google.accounts.id.renderButton(buttonElement, {
      type: 'standard',
      theme: 'outline',
      text: 'continue_with',
      size: 'large',
      shape: 'pill',
      width: 280,
      logo_alignment: 'left',
    });
  }, [authenticated, googleClientId, isGoogleScriptReady, signInWithGoogleToken]);

  const signOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    await refreshSession();
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-muted-foreground">Loading profile...</div>
        </main>
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setIsGoogleScriptReady(true)}
        />
        <Header />
        <main className="container py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Sign in with Turnkey using Google.</p>
          </div>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Turnkey Sign In</CardTitle>
              <CardDescription>
                Continue with Google to create or access your Turnkey-backed account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!googleClientId ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Missing <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> environment variable.
                </div>
              ) : null}

              <div ref={googleButtonRef} className={isSigningIn ? 'pointer-events-none opacity-70' : ''} />

              {isSigningIn ? <p className="text-sm text-muted-foreground">Signing in...</p> : null}
              {loginError ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {loginError}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                By continuing, you sign in through Google and we link the session to your Turnkey
                sub-organization.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Turnkey-linked account and club wallets.</p>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Email</div>
                <div>{user.email ?? 'No email'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Primary wallet</div>
                <CopyableAddress address={user.walletAddress} variant="compact" />
              </div>
              <div>
                <div className="text-muted-foreground">Turnkey sub-org</div>
                <div className="font-mono text-xs">{user.turnkeySubOrgId ?? 'Unavailable'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Turnkey end-user</div>
                <div className="font-mono text-xs">{user.turnkeyEndUserId ?? 'Unavailable'}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Club Wallets</CardTitle>
              <CardDescription>One wallet per club membership.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading wallets...</p> : null}
              {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

              {!isLoading && !error && wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No club wallets yet.</p>
              ) : null}

              {!isLoading && !error
                ? wallets.map((wallet) => (
                    <div key={wallet.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{wallet.club.name}</div>
                          <div className="text-xs text-muted-foreground">/{wallet.club.slug}</div>
                        </div>
                        <Badge variant={wallet.isDisabled ? 'destructive' : 'secondary'}>
                          {wallet.isDisabled ? 'Disabled' : 'Active'}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Address</div>
                          {wallet.walletAddress ? (
                            <CopyableAddress address={wallet.walletAddress} variant="compact" />
                          ) : (
                            <div className="text-xs text-muted-foreground">Not provisioned yet</div>
                          )}
                        </div>
                        <div>
                          <div className="text-muted-foreground">Provisioning</div>
                          <div>{wallet.provisioningStatus}</div>
                          {wallet.provisioningError ? (
                            <div className="text-xs text-destructive">{wallet.provisioningError}</div>
                          ) : null}
                        </div>
                        <div>
                          <div className="text-muted-foreground">Balance</div>
                          <div>${formatUsdAmount(wallet.balance)} USDC</div>
                        </div>
                      </div>
                    </div>
                  ))
                : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { SiweMessage } from 'siwe';
import { getCsrfToken, signIn } from 'next-auth/react';

export function useSiweSignIn() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signInWithSiwe = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }
    if (!walletClient) {
      throw new Error('Wallet client unavailable');
    }

    setIsSigningIn(true);
    try {
      const nonce = await getCsrfToken();
      if (!nonce) {
        throw new Error('Failed to fetch nonce');
      }

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Prediction Club.',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      });

      const signature = await walletClient.signMessage({
        message: message.prepareMessage(),
      });

      const result = await signIn('credentials', {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    } finally {
      setIsSigningIn(false);
    }
  }, [address, chainId, isConnected, walletClient]);

  return { signInWithSiwe, isSigningIn };
}

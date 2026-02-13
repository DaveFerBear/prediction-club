import { useMemo } from 'react';
import { useAppSession } from './use-app-session';
import { useClubWallet } from './use-club-wallet';

export type ClubSetupStepStatus = 'idle' | 'in-progress' | 'complete';

export type ClubSetupStep = {
  id: 'signed-in' | 'club-wallet' | 'automation' | 'funded' | 'ready';
  label: string;
  hint: string;
  active: boolean;
  status: ClubSetupStepStatus;
};

export function useClubSetupStatus(input: { slug?: string; isMember: boolean }) {
  const { authenticated, isLoading: isSessionLoading } = useAppSession();
  const walletState = useClubWallet(
    authenticated && input.isMember && input.slug ? input.slug : undefined
  );
  const wallet = walletState.wallet;

  const walletReady = Boolean(wallet && !wallet.isDisabled);
  const automationReady = Boolean(wallet && !wallet.isDisabled && wallet.automationReady);
  const funded = useMemo(() => {
    if (!wallet) return false;
    try {
      return BigInt(wallet.balance) > 0n;
    } catch {
      return false;
    }
  }, [wallet]);

  const signedInStep: ClubSetupStep = {
    id: 'signed-in',
    label: 'Signed in',
    hint: authenticated ? 'Turnkey session active.' : 'Continue with Google.',
    active: true,
    status: isSessionLoading ? 'in-progress' : authenticated ? 'complete' : 'idle',
  };

  const walletStep: ClubSetupStep = {
    id: 'club-wallet',
    label: 'Club wallet ready',
    hint: walletReady
      ? 'Wallet initialized for this club.'
      : walletState.isInitializing
        ? 'Initializing wallet...'
        : 'Initialize your per-club wallet.',
    active: authenticated && input.isMember,
    status:
      !authenticated || !input.isMember
        ? 'idle'
        : walletReady
          ? 'complete'
          : walletState.isLoading || walletState.isInitializing
            ? 'in-progress'
            : 'idle',
  };

  const automationStep: ClubSetupStep = {
    id: 'automation',
    label: 'Automation authorized',
    hint: automationReady
      ? 'Delegated trading policy is attached.'
      : walletReady
        ? 'Provisioning delegated signer and policy.'
        : 'Requires club wallet first.',
    active: authenticated && input.isMember && walletReady,
    status:
      !walletReady
        ? 'idle'
        : automationReady
          ? 'complete'
          : walletState.isLoading || walletState.isInitializing
            ? 'in-progress'
            : 'idle',
  };

  const fundedStep: ClubSetupStep = {
    id: 'funded',
    label: 'Wallet funded',
    hint: funded ? 'Balance detected.' : 'Send USDC to your club wallet.',
    active: authenticated && input.isMember && walletReady,
    status: funded ? 'complete' : 'idle',
  };

  const ready = authenticated && walletReady && automationReady && funded;
  const readyStep: ClubSetupStep = {
    id: 'ready',
    label: 'Ready to trade',
    hint: ready ? 'Eligible for autonomous round execution.' : 'Complete steps above.',
    active: authenticated && input.isMember,
    status: ready ? 'complete' : 'idle',
  };

  return {
    steps: [signedInStep, walletStep, automationStep, fundedStep, readyStep] as ClubSetupStep[],
    ready,
    authenticated,
    isMember: input.isMember,
    wallet,
    walletLoading: walletState.isLoading,
    walletInitializing: walletState.isInitializing,
    walletInitError: walletState.initError,
    initWallet: walletState.initWallet,
    refreshWallet: walletState.refreshWallet,
  };
}


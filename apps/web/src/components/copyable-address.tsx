import { useCallback, useMemo, useState } from 'react';

type CopyableAddressVariant = 'default' | 'compact' | 'inline' | 'block';

interface CopyableAddressProps {
  address: string;
  variant?: CopyableAddressVariant;
  truncate?: boolean;
  className?: string;
}

const baseWrapper = 'group inline-flex items-center gap-2';
const baseText = 'font-mono decoration-current underline-offset-2 group-hover:underline';
const buttonBase =
  'rounded border border-border px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100';

const variantClasses: Record<CopyableAddressVariant, { wrapper: string; text: string; button: string }> = {
  default: {
    wrapper: baseWrapper,
    text: `${baseText} text-sm`,
    button: buttonBase,
  },
  compact: {
    wrapper: baseWrapper,
    text: `${baseText} text-xs`,
    button: `${buttonBase} text-[10px]`,
  },
  inline: {
    wrapper: `${baseWrapper} align-middle`,
    text: baseText,
    button: buttonBase,
  },
  block: {
    wrapper: 'group flex flex-wrap items-center gap-2',
    text: `${baseText} break-all`,
    button: buttonBase,
  },
};

function truncateAddress(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function CopyableAddress({
  address,
  variant = 'default',
  truncate = true,
  className,
}: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const displayValue = useMemo(
    () => (truncate && address ? truncateAddress(address) : address),
    [address, truncate]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address]);

  const styles = variantClasses[variant];

  return (
    <span className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <span className={styles.text} title={address}>
        {displayValue}
      </span>
      <button type="button" onClick={handleCopy} className={styles.button}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

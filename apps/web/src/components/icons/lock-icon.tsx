export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 9V7a5 5 0 0 1 10 0v2"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <rect x="5" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.3" />
      <path d="M12 13v3" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

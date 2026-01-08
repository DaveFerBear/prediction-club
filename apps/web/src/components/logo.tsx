interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 1 A11 11 0 0 0 12 23 Z"
        fill="currentColor"
      />
    </svg>
  );
}

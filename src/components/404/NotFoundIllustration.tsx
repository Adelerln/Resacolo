'use client';

const BLUE = '#3B82F6';
const ORANGE = '#F97316';
const BLUE_LIGHT = '#93C5FD';
const ORANGE_LIGHT = '#FDBA74';
const AMBER = '#FDE68A';
const GRAY = '#94A3B8';

export function NotFoundIllustration() {
  return (
    <svg
      viewBox="0 0 320 200"
      className="mx-auto h-44 w-full max-w-xs sm:h-52 sm:max-w-sm"
      aria-hidden
    >
      {/* Wooden signpost pole */}
      <rect x="148" y="70" width="24" height="100" rx="4" fill="#A8A29E" />
      {/* Sign board */}
      <rect x="60" y="45" width="200" height="36" rx="8" fill="#F5F5F4" stroke="#D6D3D1" strokeWidth="2" />
      <text x="100" y="68" textAnchor="middle" fontSize="24" fontWeight="bold" fill={BLUE}>?</text>
      <text x="160" y="68" textAnchor="middle" fontSize="24" fontWeight="bold" fill={ORANGE}>?</text>
      <text x="220" y="68" textAnchor="middle" fontSize="24" fontWeight="bold" fill={BLUE}>?</text>

      {/* Child with backpack - simple flat shapes */}
      <g transform="translate(72, 95)">
        {/* Backpack */}
        <rect x="28" y="18" width="24" height="32" rx="6" fill={ORANGE} />
        <circle cx="40" cy="28" r="5" fill={ORANGE_LIGHT} />
        {/* Head with scratching gesture */}
        <circle cx="40" cy="0" r="18" fill={AMBER} stroke="#F59E0B" strokeWidth="1.5" />
        <circle cx="36" cy="-4" r="3" fill="#78716C" />
        <circle cx="44" cy="-4" r="3" fill="#78716C" />
        <path d="M58 -2 Q68 0 70 8" stroke="#78716C" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Arm scratching head */}
        <ellipse cx="58" cy="-8" rx="6" ry="8" fill={AMBER} transform="rotate(-20 58 -8)" />
        {/* Body / t-shirt */}
        <path d="M 22 18 L 26 52 L 54 52 L 58 18 Z" fill={BLUE} />
        <rect x="32" y="28" width="16" height="10" rx="2" fill={BLUE_LIGHT} />
        {/* Legs */}
        <rect x="28" y="52" width="12" height="24" rx="6" fill={GRAY} />
        <rect x="44" y="52" width="12" height="24" rx="6" fill={GRAY} />
      </g>

      {/* Small bird mascot - confused */}
      <g transform="translate(228, 100)">
        <ellipse cx="32" cy="36" rx="28" ry="24" fill={BLUE_LIGHT} />
        <circle cx="32" cy="28" r="12" fill="white" />
        <circle cx="35" cy="26" r="3" fill="#475569" />
        <path d="M 18 24 Q 10 20 8 28" stroke="#475569" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 46 24 Q 54 20 56 28" stroke="#475569" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 24 42 L 32 52 L 40 42" fill={ORANGE} />
      </g>
    </svg>
  );
}

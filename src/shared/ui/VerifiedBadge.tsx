import { useId } from "react";

/** A rosette with a check, like the verified badges of social networks (and HeroUI's showcase). Decorative. */
export function VerifiedBadge({ className = "size-4" }: { className?: string }) {
  // Each badge needs its own gradient id: several can sit on one page.
  const gradient = `verified-badge-${useId()}`;

  return (
    <svg viewBox="0 0 23 24" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={gradient} x1="3" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ADE80" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M13.9844 3.40625L14.2471 3.65625L14.6055 3.60645L18.0098 3.13281L18.5977 6.48145L18.6611 6.84375L18.9873 7.01562L22.0059 8.60156L20.4941 11.6963L20.332 12.0283L20.4961 12.3594L22.002 15.3994L18.9873 16.9844L18.6611 17.1562L18.5977 17.5186L18.0098 20.8662L14.6055 20.3936L14.2471 20.3438L13.9844 20.5938L11.5 22.9629L9.01562 20.5938L8.75293 20.3438L8.39453 20.3936L4.98926 20.8662L4.40234 17.5186L4.33887 17.1562L4.0127 16.9844L0.99707 15.3994L2.50391 12.3594L2.66797 12.0283L2.50586 11.6963L0.993164 8.60156L4.0127 7.01562L4.33887 6.84375L4.40234 6.48145L4.98926 3.13281L8.39453 3.60645L8.75293 3.65625L9.01562 3.40625L11.5 1.03613L13.9844 3.40625Z"
      />
      <path d="M7.5 12.2L10.2 14.9L15.6 9.3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

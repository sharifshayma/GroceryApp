type IconProps = { className?: string };

export function IconHomeFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.707 2.293a1 1 0 00-1.414 0l-8 8A1 1 0 004 12h1v7a2 2 0 002 2h3a1 1 0 001-1v-4a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 001 1h3a2 2 0 002-2v-7h1a1 1 0 00.707-1.707l-8-8z" />
    </svg>
  );
}

export function IconHome({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  );
}

export function IconListsFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="7.5" cy="8.5" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="7.5" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
      <circle cx="7.5" cy="12" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="11" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
      <circle cx="7.5" cy="15.5" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="14.5" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
    </svg>
  );
}

export function IconLists({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="8.5" x2="7.5" y2="8.5" strokeWidth={2} />
      <line x1="11" y1="8.5" x2="17" y2="8.5" />
      <line x1="7.5" y1="12" x2="7.5" y2="12" strokeWidth={2} />
      <line x1="11" y1="12" x2="17" y2="12" />
      <line x1="7.5" y1="15.5" x2="7.5" y2="15.5" strokeWidth={2} />
      <line x1="11" y1="15.5" x2="17" y2="15.5" />
    </svg>
  );
}

export function IconStockFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v1a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
      <path d="M5 10h14v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9z" />
      <rect x="9" y="12" width="6" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
    </svg>
  );
}

export function IconStock({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M5 10v9a2 2 0 002 2h10a2 2 0 002-2v-9" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function IconProfileFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M12 14c-4.418 0-7 2.239-7 4.5 0 .828.559 1.5 1.25 1.5h11.5c.691 0 1.25-.672 1.25-1.5 0-2.261-2.582-4.5-7-4.5z" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function IconProfile({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="3" />
      <path d="M6.168 18.849A4 4 0 0110 16h4a4 4 0 013.834 2.855" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function IconEdit({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z" />
    </svg>
  );
}

export function IconTrash({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function IconCheckCircle({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

export function IconChevronDown({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Centralized icon components — rounded & friendly style matching Hello Sunshine brand.
 * All icons use viewBox="0 0 24 24", round linecaps/linejoins, strokeWidth 1.5.
 * Pass className for sizing (e.g. "w-5 h-5", "w-7 h-7").
 */

// ─── Tab Bar Icons (filled = active, outlined = inactive) ───

export function IconHomeFilled({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.707 2.293a1 1 0 00-1.414 0l-8 8A1 1 0 004 12h1v7a2 2 0 002 2h3a1 1 0 001-1v-4a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 001 1h3a2 2 0 002-2v-7h1a1 1 0 00.707-1.707l-8-8z" />
    </svg>
  )
}

export function IconHome({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  )
}

export function IconListsFilled({ className = 'w-7 h-7' }) {
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
  )
}

export function IconLists({ className = 'w-7 h-7' }) {
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
  )
}

export function IconStockFilled({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v1a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
      <path d="M5 10h14v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9z" />
      <rect x="9" y="12" width="6" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
    </svg>
  )
}

export function IconStock({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M5 10v9a2 2 0 002 2h10a2 2 0 002-2v-9" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  )
}

export function IconProfileFilled({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M12 14c-4.418 0-7 2.239-7 4.5 0 .828.559 1.5 1.25 1.5h11.5c.691 0 1.25-.672 1.25-1.5 0-2.261-2.582-4.5-7-4.5z" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

export function IconProfile({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="3" />
      <path d="M6.168 18.849A4 4 0 0110 16h4a4 4 0 013.834 2.855" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

// ─── Action Icons ───

export function IconSearch({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function IconCart({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

export function IconEdit({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z" />
    </svg>
  )
}

export function IconTrash({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function IconShare({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

export function IconCopy({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

export function IconLink({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function IconTag({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function IconSettings({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

export function IconChevronRight({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ─── Navigation Icons ───

export function IconBack({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconChevronDown({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconPlus({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// ─── Utility Icons ───

export function IconCheck({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 9 17 20 6" />
    </svg>
  )
}

export function IconClose({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Empty State Illustrations ───

export function IllustrationNoLists({ className = 'w-24 h-24' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none">
      <rect x="25" y="15" width="70" height="90" rx="10" fill="#FFF8E7" stroke="#F28B30" strokeWidth="2" />
      <rect x="20" y="10" width="10" height="20" rx="3" fill="#E8C840" />
      <rect x="90" y="10" width="10" height="20" rx="3" fill="#E8C840" />
      <line x1="40" y1="42" x2="80" y2="42" stroke="#F2A665" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="55" x2="72" y2="55" stroke="#F2A665" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="40" y1="68" x2="76" y2="68" stroke="#F2A665" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx="33" cy="42" r="3" fill="#8BC34A" />
      <circle cx="33" cy="55" r="3" fill="#8BC34A" opacity="0.6" />
      <circle cx="33" cy="68" r="3" fill="#8BC34A" opacity="0.4" />
    </svg>
  )
}

export function IllustrationNoItems({ className = 'w-24 h-24' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none">
      <rect x="25" y="30" width="70" height="65" rx="8" fill="#FFF8E7" stroke="#F28B30" strokeWidth="2" />
      <path d="M25 38h70" stroke="#F28B30" strokeWidth="2" />
      <rect x="38" y="20" width="44" height="18" rx="6" fill="none" stroke="#E8611A" strokeWidth="2" />
      <path d="M48 55l6 6 12-12" stroke="#8BC34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="40" y1="76" x2="80" y2="76" stroke="#F2A665" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx="90" cy="25" r="5" fill="#E8C840" opacity="0.5" />
      <circle cx="97" cy="35" r="3" fill="#E8C840" opacity="0.3" />
    </svg>
  )
}

export function IllustrationNoResults({ className = 'w-24 h-24' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none">
      <circle cx="52" cy="52" r="28" fill="#FFF8E7" stroke="#F28B30" strokeWidth="2" />
      <circle cx="52" cy="52" r="18" stroke="#F2A665" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="72" y1="72" x2="98" y2="98" stroke="#F28B30" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M45 50h14" stroke="#E8611A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="92" cy="22" r="4" fill="#E8C840" opacity="0.5" />
      <circle cx="28" cy="88" r="5" fill="#8BC34A" opacity="0.3" />
    </svg>
  )
}
